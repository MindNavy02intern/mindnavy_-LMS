const svc = require("../services/content.service");
const {
  validateId,
  validateSign,
  validateConfirm,
  validateUpdate,
  validateListQuery,
} = require("../validators/content.validator");

// ── Helpers (same pattern as quizzes.controller) ────────────────────────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "CONTENT_NOT_FOUND": return notFound(res, "Content item not found.");
    case "COURSE_NOT_FOUND":  return badRequest(res, "Referenced course does not exist.");
    case "BAD_PATH":          return badRequest(res, "Invalid path.");
    case "OBJECT_NOT_FOUND":  return badRequest(res, "No uploaded file found at this path — upload it first, then confirm.");
    case "FILE_TOO_LARGE":    return badRequest(res, "The uploaded file exceeds the size limit.");
    case "BAD_FILE_TYPE":     return badRequest(res, "The uploaded file type is not allowed.");
    case "STORAGE_NOT_CONFIGURED":
      return res.status(503).json({ success: false, message: "File storage is not configured on the server." });
    case "STORAGE_SIGN_FAILED":
    case "STORAGE_LIST_FAILED":
    case "STORAGE_DELETE_FAILED":
      // Likely the library bucket doesn't exist yet — actionable, not a 500.
      return res.status(502).json({ success: false, message: "Storage error — check that the content-library bucket exists." });
    default: return null;
  }
}

function serverError(res, err) {
  console.error("[ContentController]", err);
  if (err.code === "P2025") return notFound(res, "Record not found.");
  if (err.code === "P2003") return badRequest(res, "Invalid reference: one or more IDs do not exist.");
  if (err.code === "P2021") {
    return res.status(503).json({ success: false, message: "Database not migrated yet. Run `npx prisma db push`." });
  }
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

// ── Handlers ────────────────────────────────────────────────────────────────────

const listContent = run(async (req, res) => {
  const v = validateListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.listContent(v.data);
  return res.json({ success: true, data: result });
});

const sign = run(async (req, res) => {
  const v = validateSign(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.signUpload(v.data);
  return res.json({ success: true, data: result });
});

const confirm = run(async (req, res) => {
  const v = validateConfirm(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const item = await svc.confirmUpload(v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Content added to the library.", data: item });
});

const updateContent = run(async (req, res) => {
  const idErr = validateId(req.params.id, "contentId");
  if (idErr) return badRequest(res, idErr);
  const v = validateUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const item = await svc.updateContent(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Content updated.", data: item });
});

const deleteContent = run(async (req, res) => {
  const idErr = validateId(req.params.id, "contentId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteContent(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Content deleted.", data: result });
});

module.exports = {
  listContent,
  sign,
  confirm,
  updateContent,
  deleteContent,
};
