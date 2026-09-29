const mongoose = require('mongoose');

// Marks a piece of content as useful, with a study-oriented category (PRD §16).
// Highlights are filterable, which is the point of the `type` field.
const highlightSchema = new mongoose.Schema(
  {
    spaceId: {
      type: mongoose.Schema.ObjectId,
      ref: 'StudySpace',
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: ['message', 'resource', 'notes'],
      required: true,
    },
    // The message/resource being highlighted. Null for a free-standing note
    // highlight, where `label` carries the selected text.
    sourceId: {
      type: mongoose.Schema.ObjectId,
      default: null,
    },
    type: {
      type: String,
      enum: ['important', 'exam-important', 'doubt', 'solution', 'reference', 'todo'],
      required: true,
    },
    // The highlighted text (or a note about why it matters)
    label: {
      type: String,
      required: [true, 'A highlight needs some text'],
      trim: true,
      maxlength: [2000, 'Highlight cannot exceed 2000 characters'],
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    createdByName: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

highlightSchema.index({ spaceId: 1, createdAt: -1 });
highlightSchema.index({ spaceId: 1, type: 1 });
highlightSchema.index({ label: 'text' });

module.exports = mongoose.model('Highlight', highlightSchema);
