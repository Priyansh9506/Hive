const mongoose = require('mongoose');

// In-app notifications (PRD §24). Deliberately narrow: an invite received, and
// a join reported to the space owner. Edits never produce notifications — the
// PRD is explicit that a noisy collaboration product becomes unusable.
const notificationSchema = new mongoose.Schema(
  {
    // Recipient
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    spaceId: {
      type: mongoose.Schema.ObjectId,
      ref: 'StudySpace',
      default: null,
    },
    type: {
      type: String,
      enum: ['invite_received', 'member_joined', 'removed_from_space', 'mentioned'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: [150, 'Title cannot exceed 150 characters'],
    },
    body: {
      type: String,
      default: '',
      maxlength: [500, 'Body cannot exceed 500 characters'],
    },
    // Client-side route to open, e.g. `/spaces/<id>` or `/join/ABC-123`
    link: {
      type: String,
      default: '',
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// "My unread notifications, newest first"
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
