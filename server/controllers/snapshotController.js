const DocumentSnapshot = require('../models/DocumentSnapshot');
const StudySpace = require('../models/StudySpace');
const logActivity = require('../utils/logActivity');

// A lean query returns the stored state as a BSON Binary, a hydrated document
// as a Node Buffer. Either way, hand Yjs a Uint8Array over exactly those bytes
// (a Buffer's `.buffer` can be a larger shared pool, so it is not used).
const toBytes = (data) => (Buffer.isBuffer(data) ? new Uint8Array(data) : new Uint8Array(data.buffer));

const parseVersion = (raw) => {
  const version = Number(raw);
  return Number.isInteger(version) && version >= 1 ? version : null;
};

// @desc    List saved versions of a space's shared notes (PRD §20)
// @route   GET /api/spaces/:spaceId/versions
// @access  Private (Member only)
const getVersions = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 25, 50);

    // `snapshotData` is `select: false`, so listings stay small by default
    const [versions, space] = await Promise.all([
      DocumentSnapshot.find({ spaceId: req.spaceId })
        .sort({ version: -1 })
        .limit(limit)
        .lean(),
      StudySpace.findById(req.spaceId).select('lastSavedAt'),
    ]);

    res.status(200).json({
      success: true,
      count: versions.length,
      lastSavedAt: space?.lastSavedAt || null,
      versions,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Read one version's full text
// @route   GET /api/spaces/:spaceId/versions/:version
// @access  Private (Member only)
const getVersion = async (req, res, next) => {
  try {
    const version = parseVersion(req.params.version);
    if (!version) {
      return res.status(400).json({ success: false, message: 'Invalid version number' });
    }

    const snapshot = await DocumentSnapshot.findOne({ spaceId: req.spaceId, version })
      .select('+snapshotData')
      .lean();

    if (!snapshot) {
      return res.status(404).json({ success: false, message: 'Version not found' });
    }

    // Decode the Yjs state into readable text. Required here rather than at the
    // top of the file to keep yjs out of the module graph for every other route.
    const Y = require('yjs');
    const doc = new Y.Doc();
    Y.applyUpdate(doc, toBytes(snapshot.snapshotData));
    const text = doc.getText('quill').toString();
    doc.destroy();

    res.status(200).json({
      success: true,
      version: {
        version: snapshot.version,
        preview: snapshot.preview,
        charCount: snapshot.charCount,
        createdBy: snapshot.createdBy,
        createdByName: snapshot.createdByName,
        createdAt: snapshot.createdAt,
        text,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Restore the shared notes to a saved version
// @route   POST /api/spaces/:spaceId/versions/:version/restore
// @access  Private (Member only)
const restoreVersion = async (req, res, next) => {
  try {
    const version = parseVersion(req.params.version);
    if (!version) {
      return res.status(400).json({ success: false, message: 'Invalid version number' });
    }

    const snapshot = await DocumentSnapshot.findOne({ spaceId: req.spaceId, version })
      .select('+snapshotData')
      .lean();

    if (!snapshot) {
      return res.status(404).json({ success: false, message: 'Version not found' });
    }

    // Lazy for the same reason as in getVersion: keeps the Yjs server module out
    // of the graph until a restore actually happens.
    const { restoreSnapshot } = require('../config/yjs');
    await restoreSnapshot(req.spaceId, toBytes(snapshot.snapshotData), {
      id: String(req.user.id),
      name: req.user.name,
    });

    await logActivity({
      spaceId: req.spaceId,
      user: req.user,
      type: 'snapshot_restored',
      summary: `restored the shared notes to version ${version}`,
      targetType: 'snapshot',
      targetId: snapshot._id,
    });

    res.status(200).json({ success: true, message: `Notes restored to version ${version}` });
  } catch (error) {
    next(error);
  }
};

module.exports = { getVersions, getVersion, restoreVersion };
