const mongoose = require('mongoose');

// Lightweight resource library per space (PRD §18). A resource is either an
// external link or an uploaded file served from /uploads.
const resourceSchema = new mongoose.Schema(
  {
    spaceId: {
      type: mongoose.Schema.ObjectId,
      ref: 'StudySpace',
      required: true,
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    uploadedByName: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide a title'],
      trim: true,
      maxlength: [150, 'Title cannot be more than 150 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot be more than 1000 characters'],
      default: '',
    },
    type: {
      type: String,
      enum: ['link', 'image', 'pdf', 'document', 'code', 'file'],
      required: true,
    },
    // External URL for `link` resources, or the served path for uploads
    url: {
      type: String,
      required: true,
    },
    metadata: {
      // Original filename, byte size, mime type — absent for link resources
      fileName: { type: String, default: '' },
      size: { type: Number, default: 0 },
      mimeType: { type: String, default: '' },
      // Stored filename on disk, used to delete the file when the resource goes
      storedName: { type: String, default: '' },
      // Inline body for `code` resources
      code: { type: String, default: '' },
      language: { type: String, default: '' },
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

resourceSchema.index({ spaceId: 1, createdAt: -1 });
// Supports the MVP search across resource titles and descriptions
resourceSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Resource', resourceSchema);
