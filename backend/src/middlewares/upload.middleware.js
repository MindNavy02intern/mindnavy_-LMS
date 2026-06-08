const multer = require("multer");

const ALLOWED_MIME_TYPES = new Set(["text/csv", "application/vnd.ms-excel"]);

const storage = multer.memoryStorage();

function csvFileFilter(req, file, cb) {
  if (
    !ALLOWED_MIME_TYPES.has(file.mimetype) ||
    !file.originalname.toLowerCase().endsWith(".csv")
  ) {
    req.uploadError = "Only CSV files are allowed.";
    return cb(null, false);
  }
  cb(null, true);
}

const _upload = multer({
  storage,
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: csvFileFilter,
});

// Wraps multer.single() so MulterErrors are attached to req instead of passed to next().
// This lets the controller return the 400 response directly.
function uploadUsersCsv(req, res, next) {
  _upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        req.uploadError = "File size exceeds 1MB limit.";
      } else {
        req.uploadError = "File upload error.";
      }
    } else if (err) {
      req.uploadError = "Only CSV files are allowed.";
    }
    next();
  });
}

module.exports = { uploadUsersCsv };
