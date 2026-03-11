/**
 * Media processor — strips metadata from uploaded files.
 *
 * Privacy rule: media is accepted only if metadata stripping succeeds.
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

function safeUnlink(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {
    /* ignore cleanup errors */
  }
}

/**
 * Re-encodes an image through sharp, which strips all metadata (EXIF, GPS,
 * XMP, IPTC) by default unless .withMetadata() is explicitly called.
 *
 * @param {string} filePath  Absolute path to the uploaded image file.
 */
async function stripImageMetadata(filePath) {
  const tmpPath = `${filePath}.tmp`;
  try {
    await sharp(filePath)
      // No .withMetadata() call → metadata is stripped automatically
      .rotate()
      .toFile(tmpPath);
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    safeUnlink(tmpPath);
    throw err;
  }
}

/**
 * Attempts to strip metadata from a video using fluent-ffmpeg.
 * Requires ffmpeg to be installed on the host system.
 *
 * @param {string} filePath  Absolute path to the uploaded video file.
 */
async function stripVideoMetadata(filePath) {
  return new Promise((resolve, reject) => {
    let ffmpeg;
    try {
      ffmpeg = require('fluent-ffmpeg'); // optional dependency
    } catch (err) {
      return reject(new Error('Video metadata sanitizer is not available. Install fluent-ffmpeg and ffmpeg to accept video uploads safely.'));
    }

    const ext = path.extname(filePath);
    const tmpPath = `${filePath}.tmp${ext}`;

    ffmpeg(filePath)
      .outputOptions([
        '-map_metadata -1', // strip all metadata
        '-c:v copy',        // copy video stream (fast, no re-encode)
        '-c:a copy',        // copy audio stream
      ])
      .save(tmpPath)
      .on('end', () => {
        try {
          fs.renameSync(tmpPath, filePath);
        } catch (err) {
          safeUnlink(tmpPath);
          return reject(new Error(`Failed to finalize sanitized video: ${err.message}`));
        }
        resolve();
      })
      .on('error', (err) => {
        safeUnlink(tmpPath);
        reject(new Error(`Failed to sanitize video metadata: ${err.message}`));
      });
  });
}

/**
 * Entry point — dispatches to the correct handler based on MIME type.
 *
 * @param {string} filePath  Absolute path to the uploaded file.
 * @param {string} mimetype  MIME type reported by multer.
 */
async function processMedia(filePath, mimetype) {
  if (mimetype.startsWith('image/')) {
    await stripImageMetadata(filePath);
  } else if (mimetype.startsWith('video/')) {
    await stripVideoMetadata(filePath);
  } else {
    throw new Error('Unsupported media type');
  }
}

module.exports = { processMedia };
