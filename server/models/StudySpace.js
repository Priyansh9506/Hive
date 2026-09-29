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
    // Optional invite constraints (PRD §10.2). Null means "no limit".
    joinCodeExpiresAt: {
      type: Date,
      default: null,
    },
    joinCodeMaxUses: {
      type: Number,
      default: null,
      min: [1, 'Maximum uses must be at least 1'],
    },
    joinCodeUses: {
      type: Number,
      default: 0,
    },
    notesContent: {
      type: String,
      default: '',
    },
    lastSavedAt: {
      type: Date,
      default: Date.now,
    },
    // Binary Yjs state of the shared notes, read/written by config/yjs.js.
    // Hidden from API responses; notesContent (HTML) is the readable copy.
    notesState: {
      type: Buffer,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Supports the MVP search across space names and descriptions
studySpaceSchema.index({ name: 'text', description: 'text' });

// Virtual for getting members via the Membership collection
studySpaceSchema.virtual('memberships', {
  ref: 'Membership',
  localField: '_id',
  foreignField: 'spaceId',
  justOne: false
});

module.exports = mongoose.model('StudySpace', studySpaceSchema);
