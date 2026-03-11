const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Allowed MIME types — validated on the mimetype field set by multer
const ALLOWED_MIMETYPES = new Set([
  'image/jpeg',
  'image/png',
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
]);

const MAX_FILE_SIZE =
  (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 50) * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    // Random UUID filename — strips any user-supplied filename metadata
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMETYPES.has(file.mimetype)) {
    return cb(null, true);
  }
  const err = new Error('Invalid file type. Allowed: jpg, png, mp4, webm, mov');
  err.code = 'INVALID_FILE_TYPE';
  cb(err, false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 5,
  },
});

/**
 * Wraps a multer handler and converts its errors into JSON responses.
 *
 * @param {Function} multerHandler  e.g. upload.array('media', 5)
 */
function handleUpload(multerHandler) {
  return (req, res, next) => {
    multerHandler(req, res, (err) => {
      if (!err) return next();

      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: `File too large (max ${process.env.MAX_FILE_SIZE_MB || 50} MB)`,
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Too many files (max 5)' });
      }
      if (err.code === 'INVALID_FILE_TYPE') {
        return res.status(415).json({ error: err.message });
      }
      next(err);
    });
  };
}

module.exports = { upload, handleUpload };
