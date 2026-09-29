const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    spaceId: {
      type: mongoose.Schema.ObjectId,
      ref: 'StudySpace',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: [true, 'Message content cannot be empty'],
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
      trim: true,
    },
    clientId: {
      // Unique ID generated on the client for optimistic deduplication
      type: String,
      index: true,
    },
    // Resources posted alongside the message (the "share a solution" flow, PRD §15)
    attachments: [
      {
        resourceId: { type: mongoose.Schema.ObjectId, ref: 'Resource' },
        type: { type: String, enum: ['link', 'image', 'pdf', 'document', 'code', 'file'] },
        url: { type: String },
        title: { type: String },
      },
    ],
    replyTo: {
      type: mongoose.Schema.ObjectId,
      ref: 'Message',
      default: null,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },
    // Soft delete: the row stays so pins and replies pointing at it still resolve
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient message history queries (newest first)
messageSchema.index({ spaceId: 1, createdAt: -1 });
// Supports the MVP message search
messageSchema.index({ content: 'text' });

module.exports = mongoose.model('Message', messageSchema);
