const path = require('path');
const multer = require('multer');
const { put } = require('@vercel/blob');
const { v4: uuidv4 } = require('uuid');
const {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  ALLOWED_UPLOAD_MIME_TYPES,
} = require('../config/constants');

function fileFilter(req, file, cb) {
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error('UNSUPPORTED_FILE_TYPE'));
  }
  cb(null, true);
}

// In-memory storage — files are uploaded straight to Vercel Blob rather than
// written to local disk, which is read-only once deployed on Vercel.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_UPLOAD_FILES },
});

async function uploadAttachment(file) {
  // Never trust the original filename for the stored blob path — only for display.
  const ext = path.extname(file.originalname).slice(0, 10);
  const filename = `${uuidv4()}${ext}`;

  const blob = await put(`attachments/${filename}`, file.buffer, {
    access: 'public',
    contentType: file.mimetype,
  });

  return {
    filename,
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
    uploadedAt: new Date(),
    url: blob.url,
  };
}

function uploadAttachments(files) {
  return Promise.all((files || []).map(uploadAttachment));
}

module.exports = { upload, uploadAttachments };
