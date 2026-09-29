const crypto = require('crypto');
const WebSocket = require('ws');
const Y = require('yjs');
const jwt = require('jsonwebtoken');
const { setupWSConnection, setPersistence, getYDoc, docs } = require('y-websocket/bin/utils');
const StudySpace = require('../models/StudySpace');
const Membership = require('../models/Membership');
const User = require('../models/User');
const DocumentSnapshot = require('../models/DocumentSnapshot');
const logActivity = require('../utils/logActivity');

// Room names come from the client as `studysync-room-<spaceId>`
const ROOM_PATTERN = /studysync-room-([a-f0-9]{24})$/;
const SAVE_DEBOUNCE_MS = 1000;
// One version every few minutes keeps the history readable (PRD §20) rather
// than producing a snapshot per keystroke.
const SNAPSHOT_INTERVAL_MS = Number(process.env.SNAPSHOT_INTERVAL_MS || 5 * 60 * 1000);
const MAX_SNAPSHOTS_PER_SPACE = Number(process.env.MAX_SNAPSHOTS || 50);
// "X edited Shared Notes" is one feed entry per editing session, not per edit
const EDIT_ACTIVITY_THROTTLE_MS = 10 * 60 * 1000;

const loading = new Map(); // docName -> promise that settles once the stored state is applied
const pendingWrites = new Map(); // docName -> in-flight save, so a reload waits for it
const saveTimers = new Map();
const lastSnapshotAt = new Map(); // docName -> ms timestamp of the last snapshot
// Most recent authenticated editor per doc, used to attribute snapshots and
// activity. Yjs updates carry no identity of their own.
const lastEditor = new Map(); // docName -> { id, name }
const lastEditActivityAt = new Map(); // `${docName}:${userId}` -> ms timestamp

const spaceIdFor = (docName) => docName.match(ROOM_PATTERN)?.[1];
const docNameFor = (spaceId) => `studysync-room-${spaceId}`;

// Plain-text preview of the shared notes, for identifying a version at a glance
const previewOf = (ydoc) => ydoc.getText('quill').toString();

const writeState = (docName, ydoc) => {
  clearTimeout(saveTimers.get(docName));
  saveTimers.delete(docName);

  const spaceId = spaceIdFor(docName);
  if (!spaceId) return Promise.resolve();

  const state = Buffer.from(Y.encodeStateAsUpdate(ydoc));
  const write = (pendingWrites.get(docName) || Promise.resolve())
    .then(() => StudySpace.updateOne({ _id: spaceId }, { notesState: state }))
    .catch((err) => console.error(`Yjs: failed to save ${docName}:`, err.message))
    .finally(() => {
      if (pendingWrites.get(docName) === write) pendingWrites.delete(docName);
    });
  pendingWrites.set(docName, write);
  return write;
};

/**
 * Fingerprint of the notes' content: the text together with its formatting
 * (the Quill delta). Two versions are "the same" exactly when this matches, so
 * an edit anywhere in the document, or a formatting-only change such as making
 * a word bold, counts as a change, while reconnects and no-op syncs do not.
 */
const contentHashOf = (ydoc) =>
  crypto.createHash('sha256').update(JSON.stringify(ydoc.getText('quill').toDelta())).digest('hex');

// Latest version of a space and its fingerprint. Versions saved before
// fingerprints existed have none, so theirs is computed from the stored state.
const latestVersionOf = async (spaceId) => {
  const latest = await DocumentSnapshot.findOne({ spaceId })
    .sort({ version: -1 })
    .select('version contentHash')
    .lean();
  if (!latest || latest.contentHash) return latest;

  const full = await DocumentSnapshot.findById(latest._id).select('+snapshotData');
  const doc = new Y.Doc();
  try {
    Y.applyUpdate(doc, new Uint8Array(full.snapshotData));
    return { ...latest, contentHash: contentHashOf(doc) };
  } finally {
    doc.destroy();
  }
};

// Snapshot creation per doc runs one at a time. Version numbers are "latest + 1",
// so two saves racing (a double-click, or a manual save landing on a timed one)
// would otherwise both pick the same number.
const snapshotQueues = new Map(); // docName -> tail of the queue

const enqueueSnapshot = (docName, task) => {
  const run = (snapshotQueues.get(docName) || Promise.resolve()).then(task, task);
  const tail = run.catch(() => {}).finally(() => {
    if (snapshotQueues.get(docName) === tail) snapshotQueues.delete(docName);
  });
  snapshotQueues.set(docName, tail);
  return run;
};

/**
 * Store the document as a new version, unless it matches the latest version.
 *
 * @param {string} docName
 * @param {Y.Doc}  ydoc
 * @param {object} [options]
 * @param {boolean} [options.force] - save even if unchanged (guards a restore)
 * @param {object}  [options.user]  - `{ id, name }` to credit; defaults to the last editor
 * @returns {Promise<{ created: boolean, reason?: 'empty' | 'unchanged', version?: object, latestVersion?: number }>}
 */
const createSnapshot = (docName, ydoc, { force = false, user } = {}) =>
  enqueueSnapshot(docName, async () => {
    const spaceId = spaceIdFor(docName);
    const text = previewOf(ydoc);

    // Nothing worth versioning yet
    if (text.trim().length === 0) return { created: false, reason: 'empty' };

    const contentHash = contentHashOf(ydoc);
    const latest = await latestVersionOf(spaceId);

    if (!force && latest && latest.contentHash === contentHash) {
      return { created: false, reason: 'unchanged', latestVersion: latest.version };
    }

    const author = user || lastEditor.get(docName);
    const snapshot = await DocumentSnapshot.create({
      spaceId,
      documentId: docName,
      snapshotData: Buffer.from(Y.encodeStateAsUpdate(ydoc)),
      contentHash,
      version: (latest?.version || 0) + 1,
      preview: text.replace(/\s+/g, ' ').trim().slice(0, 300),
      charCount: text.length,
      createdBy: author?.id || null,
      createdByName: author?.name || 'Unknown',
    });

    // Update the space's lastSavedAt so the UI shows when this was saved
    await StudySpace.updateOne({ _id: spaceId }, { lastSavedAt: snapshot.createdAt });

    // Keep only the most recent N versions per space
    const stale = await DocumentSnapshot.find({ spaceId })
      .sort({ version: -1 })
      .skip(MAX_SNAPSHOTS_PER_SPACE)
      .select('_id')
      .lean();
    if (stale.length > 0) {
      await DocumentSnapshot.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
    }

    lastSnapshotAt.set(docName, Date.now());
    const { snapshotData: _data, ...version } = snapshot.toObject();
    return { created: true, version };
  });

/**
 * Store a version of the document if the snapshot interval has elapsed.
 * Runs off the back of a state save, so it costs nothing while nobody is typing.
 */
const maybeSnapshot = async (docName, ydoc, { force = false } = {}) => {
  const spaceId = spaceIdFor(docName);
  if (!spaceId) return;

  const now = Date.now();
  const previous = lastSnapshotAt.get(docName);

  // Claim the slot before awaiting, so two saves landing together cannot both
  // decide to snapshot.
  if (!force && previous && now - previous < SNAPSHOT_INTERVAL_MS) return;
  lastSnapshotAt.set(docName, now);

  try {
    await createSnapshot(docName, ydoc, { force });
  } catch (err) {
    console.error(`Yjs: snapshot failed for ${docName}:`, err.message);
    // Let the next save try again rather than waiting a full interval
    lastSnapshotAt.set(docName, previous || 0);
  }
};

/**
 * "Save Now": store the current notes as a version immediately, if they differ
 * from the latest version. Uses the live document when someone is editing, so
 * the version includes edits the debounced save has not written yet; otherwise
 * the stored state.
 *
 * @param {string} spaceId
 * @param {object} user - `{ id, name }` of the member saving
 */
const saveVersionNow = async (spaceId, user) => {
  const docName = docNameFor(spaceId);

  const live = docs.get(docName);
  if (live) {
    await loading.get(docName);
    const result = await createSnapshot(docName, live, { user });
    // Persist now too, so the saved version and the stored notes agree
    if (result.created) await writeState(docName, live);
    return result;
  }

  await pendingWrites.get(docName);
  const space = await StudySpace.findById(spaceId).select('+notesState');
  const doc = new Y.Doc();
  try {
    if (space?.notesState?.length) Y.applyUpdate(doc, new Uint8Array(space.notesState));
    return await createSnapshot(docName, doc, { user });
  } finally {
    doc.destroy();
  }
};

// One "edited Shared Notes" entry per editing session per user
const logEditActivity = (docName, user) => {
  const spaceId = spaceIdFor(docName);
  if (!spaceId || !user) return;

  const key = `${docName}:${user.id}`;
  const last = lastEditActivityAt.get(key) || 0;
  if (Date.now() - last < EDIT_ACTIVITY_THROTTLE_MS) return;
  lastEditActivityAt.set(key, Date.now());

  logActivity({
    spaceId,
    user,
    type: 'notes_edited',
    summary: 'edited the shared notes',
    targetType: 'notes',
    targetId: null,
  });
};

// Called by y-websocket when it creates a doc (first client joins a room)
const bindState = (docName, ydoc) => {
  const spaceId = spaceIdFor(docName);
  if (!spaceId) return;

  const load = (pendingWrites.get(docName) || Promise.resolve())
    .then(() => StudySpace.findById(spaceId).select('+notesState'))
    .then((space) => {
      if (space?.notesState?.length) {
        Y.applyUpdate(ydoc, new Uint8Array(space.notesState));
      }
    })
    .catch((err) => console.error(`Yjs: failed to load ${docName}:`, err.message))
    .finally(() => {
      loading.delete(docName);
      ydoc.on('update', () => {
        logEditActivity(docName, lastEditor.get(docName));
        clearTimeout(saveTimers.get(docName));
        saveTimers.set(
          docName,
          setTimeout(async () => {
            await writeState(docName, ydoc);
            await maybeSnapshot(docName, ydoc);
          }, SAVE_DEBOUNCE_MS)
        );
      });
    });
  loading.set(docName, load);
};

setPersistence({ bindState, writeState });

/**
 * Verify the token on a Yjs upgrade request and confirm the user belongs to the
 * space the room maps to. Without this a client could sync any space's notes by
 * guessing a room id, which PRD §22 rules out explicitly. Socket.IO already
 * authenticates its own handshake; this is the parallel check for the Yjs
 * WebSocket, which does not go through Socket.IO.
 */
const authorizeUpgrade = async (request) => {
  const url = new URL(request.url, 'http://localhost');
  const spaceId = spaceIdFor(url.pathname);

  if (!spaceId) {
    return { ok: false, reason: 'Unknown document' };
  }

  // Key the in-memory doc by space, not by the raw path (which carries the
  // `/yjs` mount prefix), so server-side code such as restoreSnapshot finds
  // the very doc that clients are connected to.
  const docName = docNameFor(spaceId);

  const token = url.searchParams.get('token');
  if (!token) {
    return { ok: false, reason: 'Missing token' };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [user, membership] = await Promise.all([
      User.findById(decoded.id).select('name'),
      Membership.findOne({ spaceId, userId: decoded.id }),
    ]);

    if (!user) return { ok: false, reason: 'User not found' };
    if (!membership) return { ok: false, reason: 'Not a member of this space' };

    return { ok: true, docName, user: { id: String(user._id), name: user.name } };
  } catch {
    return { ok: false, reason: 'Invalid or expired token' };
  }
};

/**
 * Replace the live shared notes with a stored version (PRD §20 "restore").
 *
 * The change is applied to the server's copy of the document as an ordinary Yjs
 * transaction, so y-websocket broadcasts it to every connected editor and the
 * normal persistence path saves it. The current state is versioned first, which
 * makes a restore itself undoable.
 *
 * @param {string}     spaceId
 * @param {Uint8Array} snapshotState - encoded Yjs state of the version to restore
 * @param {object}     user          - `{ id, name }` of the member restoring
 */
const restoreSnapshot = async (spaceId, snapshotState, user) => {
  const docName = docNameFor(spaceId);
  const ydoc = getYDoc(docName);
  await loading.get(docName);

  await maybeSnapshot(docName, ydoc, { force: true });

  // Rebuild from the version's formatted content (a delta), not its plain text,
  // so headings, lists and code blocks come back too.
  const source = new Y.Doc();
  Y.applyUpdate(source, snapshotState);
  const delta = source.getText('quill').toDelta();
  source.destroy();

  lastEditor.set(docName, user);
  const ytext = ydoc.getText('quill');
  ydoc.transact(() => {
    ytext.delete(0, ytext.length);
    ytext.applyDelta(delta);
  });

  // Persist now rather than on the debounce, so the response means "saved"
  await writeState(docName, ydoc);
};

/**
 * Current shared notes of a space as plain text, for server-side readers such
 * as the AI assistant. Prefers the live in-memory doc, which holds edits that
 * are not saved yet; otherwise decodes the stored state. Reads never create a
 * doc, since y-websocket only frees one when its last client disconnects.
 *
 * @param {string} spaceId
 * @returns {Promise<string>}
 */
const getNotesText = async (spaceId) => {
  const docName = docNameFor(spaceId);

  const live = docs.get(docName);
  if (live) {
    await loading.get(docName);
    return previewOf(live);
  }

  const space = await StudySpace.findById(spaceId).select('+notesState');
  if (!space) return '';

  if (space.notesState?.length) {
    const ydoc = new Y.Doc();
    try {
      Y.applyUpdate(ydoc, new Uint8Array(space.notesState));
      return previewOf(ydoc);
    } finally {
      ydoc.destroy();
    }
  }

  // Spaces from before Yjs persistence only have the HTML copy
  return (space.notesContent || '')
    .replace(/<\/(p|h[1-6]|li|div|pre|blockquote)>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const initYjs = (server) => {
  const wss = new WebSocket.Server({ noServer: true });

  wss.on('connection', (ws, request, context) => {
    // y-websocket derives the room from the request URL, and the query string
    // would otherwise become part of the room name.
    setupWSConnection(ws, request, { docName: context.docName });

    // Attribute subsequent edits in this room to this user. Last writer wins,
    // which is what "who made this version" means for a shared document.
    ws.on('message', () => lastEditor.set(context.docName, context.user));
  });

  server.on('upgrade', async (request, socket, head) => {
    // Only handle WebSocket upgrades on /yjs; Socket.IO handles its own path
    if (!request.url.startsWith('/yjs')) return;

    const auth = await authorizeUpgrade(request);
    if (!auth.ok) {
      console.warn(`Yjs: rejected upgrade — ${auth.reason}`);
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }

    // Load the stored doc before completing the handshake, so the client's first
    // sync already contains it. Otherwise the editor sees an empty doc and
    // re-seeds it from HTML, which duplicates the notes once the state arrives.
    getYDoc(auth.docName);
    await loading.get(auth.docName);

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, { docName: auth.docName, user: auth.user });
    });
  });

  console.log('Yjs WebSocket server initialized on /yjs (authenticated, persisted to MongoDB)');
};

module.exports = { initYjs, restoreSnapshot, getNotesText, saveVersionNow };
