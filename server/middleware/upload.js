const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const MAX_FILE_SIZE = Number(process.env.MAX_UPLOAD_MB || 10) * 1024 * 1024;

// Created synchronously at load: multer needs the directory to exist before the
// first request, not after the first await.
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Only formats a study group actually shares (PRD §15). Everything else is
// rejected rather than stored and served back to other members.
const ALLOWED_MIME = {
  'image/png': { ext: '.png', type: 'image' },
  'image/jpeg': { ext: '.jpg', type: 'image' },
  'image/gif': { ext: '.gif', type: 'image' },
  'image/webp': { ext: '.webp', type: 'image' },
  'application/pdf': { ext: '.pdf', type: 'pdf' },
  'text/plain': { ext: '.txt', type: 'document' },
  'text/markdown': { ext: '.md', type: 'document' },
  'text/csv': { ext: '.csv', type: 'document' },
  'application/msword': { ext: '.doc', type: 'document' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    ext: '.docx',
    type: 'document',
  },
  'application/vnd.ms-powerpoint': { ext: '.ppt', type: 'document' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    ext: '.pptx',
    type: 'document',
  },
  'application/vnd.ms-excel': { ext: '.xls', type: 'document' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    ext: '.xlsx',
    type: 'document',
  },
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Never reuse the client's filename on disk: it can carry path traversal,
    // a misleading double extension, or collide with another upload.
    const { ext } = ALLOWED_MIME[file.mimetype] || { ext: '' };
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME[file.mimetype]) {
      return cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

// Wraps the single-file middleware so multer's errors come back as the same
// JSON shape as the rest of the API instead of a 500 from the error handler.
const uploadSingle = (field = 'file') => (req, res, next) => {
  upload.single(field)(req, res, (err) => {
    if (!err) return next();

    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: `File is too large. The maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB.`,
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ success: false, message: 'Please upload one file at a time' });
    }
    return res.status(400).json({ success: false, message: err.message });
  });
};

module.exports = { uploadSingle, UPLOAD_DIR, MAX_FILE_SIZE, ALLOWED_MIME };
