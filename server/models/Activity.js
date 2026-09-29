const mongoose = require('mongoose');

// Chronological record of what happened in a space (PRD §19). Written through
// utils/logActivity.js so every producer stores the same shape.
const activitySchema = new mongoose.Schema(
  {
    spaceId: {
      type: mongoose.Schema.ObjectId,
      ref: 'StudySpace',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    // Denormalised so the feed renders without an extra populate, and still
    // reads correctly after the actor leaves the space.
    userName: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'space_created',
        'space_updated',
        'member_joined',
        'member_left',
        'member_removed',
        'notes_edited',
        'resource_added',
        'resource_deleted',
        'message_pinned',
        'message_unpinned',
        'highlight_created',
        'highlight_deleted',
        'invite_sent',
        'invite_regenerated',
        'snapshot_created',
        'snapshot_restored',
      ],
    },
    // Short human-readable line, e.g. "added DBMS notes"
    summary: {
      type: String,
      required: true,
      maxlength: [300, 'Summary cannot exceed 300 characters'],
    },
    targetType: {
      type: String,
      enum: ['space', 'message', 'resource', 'highlight', 'notes', 'member', 'snapshot'],
      default: 'space',
    },
    targetId: {
      type: mongoose.Schema.ObjectId,
      default: null,
    },
  },
  { timestamps: true }
);

// Feed queries are always "latest activity in this space"
activitySchema.index({ spaceId: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
