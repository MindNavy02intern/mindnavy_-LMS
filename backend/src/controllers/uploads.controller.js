const svc = require("../services/uploads.service");
const {
  validateSign,
  validateConfirm,
  validateDelete,
} = require("../validators/uploads.validator");

// ── Helpers ────────────────────────────────────────────────────────────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "COURSE_NOT_FOUND":
      return notFound(res, "Course not found.");
    case "OBJECT_NOT_FOUND":
      return badRequest(res, "The file was not found in storage — the upload did not complete.");
    case "BAD_PATH":
      return badRequest(res, "Invalid file path.");
    case "VIDEO_UPLOAD_NOT_ENABLED":
      return badRequest(res, "Video upload is coming soon — use a video URL for now.");
    case "STORAGE_NOT_CONFIGURED":
      return res.status(503).json({ success: false, message: "File storage is not configured yet." });
    case "STORAGE_SIGN_FAILED":
    case "STORAGE_LIST_FAILED":
    case "STORAGE_DELETE_FAILED":
      return res.status(502).json({ success: false, message: "Storage service error. Please try again." });
    default:
      return null;
  }
}

function serverError(res, err) {
  console.error("[UploadsController]", err);
  return res.status(500).json({ success: false, message: "Internal server error." });
}

function run(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      return handleDomainError(res, err) ?? serverError(res, err);
    }
  };
}

// ── Endpoints ────────────────────────────────────────────────────────────────────

const sign = run(async (req, res) => {
  const v = validateSign(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const data = await svc.signUpload(v.data);
  return res.json({ success: true, message: "Signed upload URL issued.", data });
});

const confirm = run(async (req, res) => {
  const v = validateConfirm(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const data = await svc.confirmUpload(v.data);
  return res.json({ success: true, message: "Upload confirmed.", data });
});

const remove = run(async (req, res) => {
  const v = validateDelete(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const data = await svc.deleteUpload(v.data);
  return res.json({ success: true, message: "File deleted.", data });
});

module.exports = { sign, confirm, remove };
