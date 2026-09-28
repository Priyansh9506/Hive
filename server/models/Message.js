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
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient message history queries (newest first)
messageSchema.index({ spaceId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);
