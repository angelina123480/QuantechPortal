const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  ALLOWED_UPLOAD_MIME_TYPES,
} = require('../config/constants');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // Never trust the original filename for the on-disk name — only for display.
    const ext = path.extname(file.originalname).slice(0, 10);
    cb(null, `${uuidv4()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_UPLOAD_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error('UNSUPPORTED_FILE_TYPE'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_UPLOAD_FILES },
});

function toAttachmentRecord(file) {
  return {
    filename: file.filename,
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
    uploadedAt: new Date(),
    url: `/uploads/${file.filename}`,
  };
}

module.exports = { upload, toAttachmentRecord, UPLOAD_DIR };
