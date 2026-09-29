const mongoose = require('mongoose');

// Periodic point-in-time copy of a space's shared notes (PRD §20). Written by
// config/yjs.js on a fixed interval while the document is being edited, so the
// history stays useful without a snapshot per keystroke.
const documentSnapshotSchema = new mongoose.Schema(
  {
    spaceId: {
      type: mongoose.Schema.ObjectId,
      ref: 'StudySpace',
      required: true,
      index: true,
    },
    // Yjs room name, e.g. `studysync-room-<spaceId>`. A space has one shared
    // document today; this leaves room for more.
    documentId: {
      type: String,
      required: true,
    },
    // Binary Yjs state at snapshot time. Hidden by default so version listings
    // stay small — the restore endpoint selects it explicitly.
    snapshotData: {
      type: Buffer,
      required: true,
      select: false,
    },
    // Monotonic per space, starting at 1
    version: {
      type: Number,
      required: true,
    },
    // Plain text preview so a version can be identified without decoding the doc
    preview: {
      type: String,
      default: '',
      maxlength: [300, 'Preview cannot exceed 300 characters'],
    },
    charCount: {
      type: Number,
      default: 0,
    },
    // sha256 of the content with its formatting, so "has anything changed since
    // this version?" is one string comparison. Null on versions saved before it
    // existed; config/yjs.js computes those on demand.
    contentHash: {
      type: String,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      default: null,
    },
    createdByName: {
      type: String,
      default: 'Unknown',
    },
  },
  { timestamps: true }
);

documentSnapshotSchema.index({ spaceId: 1, version: -1 }, { unique: true });

module.exports = mongoose.model('DocumentSnapshot', documentSnapshotSchema);
