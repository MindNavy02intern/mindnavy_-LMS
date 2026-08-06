const svc = require("../services/instructorDocuments.service");
const { validateId } = require("../validators/instructors.validator");
const {
  validateSign,
  validateConfirm,
  validateReject,
  validateListQuery,
} = require("../validators/instructorDocuments.validator");

// ── Helpers (same shape as instructors.controller) ──────────────────────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "INSTRUCTOR_NOT_FOUND":
      return notFound(res, "Instructor not found.");
    // Deliberately the same answer as a missing id: a document belonging to
    // another instructor must not be distinguishable from one that never existed.
    case "DOCUMENT_NOT_FOUND":
      return notFound(res, "Document not found.");
    case "DOCUMENT_ARCHIVED":
      return res.status(409).json({
        success: false,
        message: "This document is archived. Upload a replacement instead.",
      });
    case "BAD_PATH":
      return badRequest(res, "Invalid upload path.");
    case "OBJECT_NOT_FOUND":
      return badRequest(res, "The upload did not complete — no file was found at that path.");
    case "FILE_TOO_LARGE":
      return badRequest(res, `File exceeds the ${Math.round(svc.MAX_BYTES / (1024 * 1024))}MB limit.`);
    case "BAD_FILE_TYPE":
      return badRequest(res, "That file type is not allowed. Upload a PDF, PNG, JPEG or WEBP.");
    case "STORAGE_NOT_CONFIGURED":
      return res.status(503).json({
        success: false,
        message: "Document storage is not configured yet.",
      });
    default:
      return null;
  }
}

function serverError(res, err) {
  console.error("[InstructorDocumentsController]", err);
  if (err.code === "P2025") return notFound(res, "Document not found.");
  if (err.code === "P2003") return badRequest(res, "Invalid reference: one or more IDs do not exist.");
  if (err.code === "P2021" || err.code === "P2022") {
    return res.status(503).json({ success: false, message: "Database not migrated yet. Run `npx prisma db push`." });
  }
  return res.status(500).json({ success: false, message: "Internal server error." });
}

// One wrapper per endpoint: validate the instructor id, run, map domain errors.
function run(handler) {
  return async (req, res) => {
    try {
      const idErr = validateId(req.params.id, "instructorId");
      if (idErr) return badRequest(res, idErr);
      return await handler(req, res);
    } catch (err) {
      return handleDomainError(res, err) ?? serverError(res, err);
    }
  };
}

// ── Handlers ────────────────────────────────────────────────────────────────────

const listDocuments = run(async (req, res) => {
  const v = validateListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.listDocuments(req.params.id, v.data);
  return res.json({ success: true, data: result });
});

const signUpload = run(async (req, res) => {
  const v = validateSign(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.signDocumentUpload(req.params.id, v.data);
  return res.json({ success: true, data: result });
});

const confirmUpload = run(async (req, res) => {
  const v = validateConfirm(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const doc = await svc.confirmDocumentUpload(req.params.id, v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Document uploaded.", data: doc });
});

const verifyDocument = run(async (req, res) => {
  const docErr = validateId(req.params.docId, "docId");
  if (docErr) return badRequest(res, docErr);
  const doc = await svc.verifyDocument(req.params.id, req.params.docId, req.admin?.id);
  return res.json({ success: true, message: "Document verified.", data: doc });
});

const rejectDocument = run(async (req, res) => {
  const docErr = validateId(req.params.docId, "docId");
  if (docErr) return badRequest(res, docErr);
  const v = validateReject(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const doc = await svc.rejectDocument(req.params.id, req.params.docId, v.data.reason, req.admin?.id);
  return res.json({ success: true, message: "Document rejected.", data: doc });
});

const archiveDocument = run(async (req, res) => {
  const docErr = validateId(req.params.docId, "docId");
  if (docErr) return badRequest(res, docErr);
  const doc = await svc.archiveDocument(req.params.id, req.params.docId, req.admin?.id);
  return res.json({ success: true, message: "Document archived.", data: doc });
});

module.exports = {
  listDocuments,
  signUpload,
  confirmUpload,
  verifyDocument,
  rejectDocument,
  archiveDocument,
};
