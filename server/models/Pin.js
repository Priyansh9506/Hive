const mongoose = require('mongoose');

// Pinned content surfaces in a dedicated panel so useful information does not
// get buried in chat history (PRD §17). The pinned source keeps its own
// `isPinned` flag as well, so chat and the library can render the badge without
// joining against this collection.
const pinSchema = new mongoose.Schema(
  {
    spaceId: {
      type: mongoose.Schema.ObjectId,
      ref: 'StudySpace',
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ['message', 'resource', 'note', 'announcement'],
      required: true,
    },
    // Null for `announcement` pins, which are free text rather than a reference
    sourceId: {
      type: mongoose.Schema.ObjectId,
      default: null,
    },
    // Snapshot of what was pinned, so the panel reads correctly even if the
    // original is later edited or deleted
    label: {
      type: String,
      required: [true, 'A pin needs a label'],
      trim: true,
      maxlength: [500, 'Pin label cannot exceed 500 characters'],
    },
    pinnedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    pinnedByName: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

pinSchema.index({ spaceId: 1, createdAt: -1 });
// One pin per piece of content. `announcement` pins have sourceId null and are
// exempt: a partial filter keeps the unique constraint off them.
pinSchema.index(
  { spaceId: 1, sourceType: 1, sourceId: 1 },
  { unique: true, partialFilterExpression: { sourceId: { $type: 'objectId' } } }
);
pinSchema.index({ label: 'text' });

module.exports = mongoose.model('Pin', pinSchema);
