const DocumentSnapshot = require('../models/DocumentSnapshot');
const StudySpace = require('../models/StudySpace');

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
    const version = Number(req.params.version);
    if (!Number.isInteger(version) || version < 1) {
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
    Y.applyUpdate(doc, new Uint8Array(snapshot.snapshotData));
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

module.exports = { getVersions, getVersion };
