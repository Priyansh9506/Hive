const WebSocket = require('ws');
const Y = require('yjs');
const jwt = require('jsonwebtoken');
const { setupWSConnection, setPersistence, getYDoc } = require('y-websocket/bin/utils');
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
 * Store a version of the document if the snapshot interval has elapsed.
 * Runs off the back of a state save, so it costs nothing while nobody is typing.
 */
const maybeSnapshot = async (docName, ydoc) => {
  const spaceId = spaceIdFor(docName);
  if (!spaceId) return;

  const now = Date.now();
  const previous = lastSnapshotAt.get(docName);

  // Claim the slot before awaiting, so two saves landing together cannot both
  // decide to snapshot.
  if (previous && now - previous < SNAPSHOT_INTERVAL_MS) return;
  lastSnapshotAt.set(docName, now);

  try {
    const text = previewOf(ydoc);

    // Nothing worth versioning yet
    if (text.trim().length === 0) return;

    const latest = await DocumentSnapshot.findOne({ spaceId })
      .sort({ version: -1 })
      .select('version charCount')
      .lean();

    // Skip if the document has not actually changed since the last version
    if (latest && latest.charCount === text.length) return;

    const editor = lastEditor.get(docName);
    await DocumentSnapshot.create({
      spaceId,
      documentId: docName,
      snapshotData: Buffer.from(Y.encodeStateAsUpdate(ydoc)),
      version: (latest?.version || 0) + 1,
      preview: text.replace(/\s+/g, ' ').trim().slice(0, 300),
      charCount: text.length,
      createdBy: editor?.id || null,
      createdByName: editor?.name || 'Unknown',
    });

    // Keep only the most recent N versions per space
    const stale = await DocumentSnapshot.find({ spaceId })
      .sort({ version: -1 })
      .skip(MAX_SNAPSHOTS_PER_SPACE)
      .select('_id')
      .lean();
    if (stale.length > 0) {
      await DocumentSnapshot.deleteMany({ _id: { $in: stale.map((s) => s._id) } });
    }
  } catch (err) {
    console.error(`Yjs: snapshot failed for ${docName}:`, err.message);
    // Let the next save try again rather than waiting a full interval
    lastSnapshotAt.set(docName, previous || 0);
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
  const docName = url.pathname.slice(1); // strip the leading '/'
  const spaceId = spaceIdFor(docName);

  if (!spaceId) {
    return { ok: false, reason: 'Unknown document' };
  }

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

module.exports = { initYjs };
