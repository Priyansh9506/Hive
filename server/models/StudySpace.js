const mongoose = require('mongoose');

const studySpaceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a space name'],
      trim: true,
      maxlength: [100, 'Name cannot be more than 100 characters'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description cannot be more than 500 characters'],
      default: '',
    },
    ownerId: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    joinCode: {
      type: String,
      unique: true,
      required: true,
    },
    icon: {
      type: String,
      enum: ['book', 'code', 'flask', 'calculator', 'pen', 'globe', 'lightbulb', 'music', 'palette', 'rocket', 'brain', 'graduation'],
      default: 'book',
    },
    color: {
      type: String,
      match: [/^#([A-Fa-f0-9]{6})$/, 'Please provide a valid hex color'],
      default: '#6366f1', // indigo
    },
    inviteEnabled: {
      type: Boolean,
      default: true,
    },
    notesContent: {
      type: String,
      default: '',
    },
    lastSavedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for getting members via the Membership collection
studySpaceSchema.virtual('memberships', {
  ref: 'Membership',
  localField: '_id',
  foreignField: 'spaceId',
  justOne: false
});

module.exports = mongoose.model('StudySpace', studySpaceSchema);
