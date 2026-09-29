const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema(
  {
    spaceId: {
      type: mongoose.Schema.ObjectId,
      ref: 'StudySpace',
      required: true,
    },
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'member'],
      default: 'member',
    },
    // When this member last caught up on the discussion; messages after it
    // count as unread (PRD §14). Null means "since they joined".
    lastReadAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent a user from joining the same space multiple times
membershipSchema.index({ spaceId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Membership', membershipSchema);
