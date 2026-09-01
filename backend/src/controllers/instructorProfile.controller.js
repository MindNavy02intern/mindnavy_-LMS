const profileSvc = require("../services/instructorProfile.service");
const docsSvc = require("../services/instructorDocuments.service");
const certsSvc = require("../services/instructorCertifications.service");

const { validateId } = require("../validators/instructors.validator");
const { validateInstructorSelfProfileUpdate } = require("../validators/instructorSelf.validator");
const {
  validateSign: validateDocSign,
  validateConfirm: validateDocConfirm,
  validateListQuery: validateDocListQuery,
} = require("../validators/instructorDocuments.validator");
const {
  validateSign: validateCertSign,
  validateCreate: validateCertCreate,
  validateListQuery: validateCertListQuery,
} = require("../validators/instructorCertifications.validator");

// Same error-code-to-HTTP-status conventions as instructorDocuments.controller
// and instructorCertifications.controller (merged here since both live under
// one self-service surface) — no req.params.id validation anywhere in this
// file, because there is no :id: every handler is scoped to req.instructor.id,
// set by requireInstructorAuth. A client cannot pass a different instructorId
// no matter what the request body/query contains.

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function conflict(res, msg) {
  return res.status(409).json({ success: false, message: msg });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "INSTRUCTOR_NOT_FOUND":
      return notFound(res, "Instructor account not found.");
    case "DOCUMENT_NOT_FOUND":
      return notFound(res, "Document not found.");
    case "DOCUMENT_ARCHIVED":
      return conflict(res, "This document is already archived.");
    case "DOCUMENT_NOT_WITHDRAWABLE":
      return conflict(res, "Only a pending document can be withdrawn — this one has already been reviewed.");
    case "CERTIFICATION_NOT_FOUND":
      return notFound(res, "Certification not found.");
    case "BAD_PATH":
      return badRequest(res, "Invalid upload path.");
    case "OBJECT_NOT_FOUND":
      return badRequest(res, "The upload did not complete — no file was found at that path.");
    case "FILE_TOO_LARGE":
      return badRequest(res, "File exceeds the upload size limit.");
    case "BAD_FILE_TYPE":
      return badRequest(res, "That file type is not allowed. Upload a PDF, PNG, JPEG or WEBP.");
    case "STORAGE_NOT_CONFIGURED":
      return res.status(503).json({ success: false, message: "Document storage is not configured yet." });
    default:
      return null;
  }
}

function serverError(res, err) {
  console.error("[InstructorProfileController]", err);
  if (err.code === "P2025") return notFound(res, "Record not found.");
  if (err.code === "P2003") return badRequest(res, "Invalid reference: one or more IDs do not exist.");
  if (err.code === "P2021" || err.code === "P2022") {
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

// ── Profile ─────────────────────────────────────────────────────────────────

const getProfile = run(async (req, res) => {
  const profile = await profileSvc.getMyProfile(req.instructor.id);
  return res.json({ success: true, data: profile });
});

const updateProfile = run(async (req, res) => {
  const v = validateInstructorSelfProfileUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const profile = await profileSvc.updateMyProfile(req.instructor.id, v.data.profile);
  return res.json({ success: true, message: "Profile updated.", data: profile });
});

// ── Documents ───────────────────────────────────────────────────────────────

const listDocuments = run(async (req, res) => {
  const v = validateDocListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await docsSvc.listDocuments(req.instructor.id, v.data);
  return res.json({ success: true, data: result });
});

const signDocumentUpload = run(async (req, res) => {
  const v = validateDocSign(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await docsSvc.signDocumentUpload(req.instructor.id, v.data);
  return res.json({ success: true, data: result });
});

const confirmDocumentUpload = run(async (req, res) => {
  const v = validateDocConfirm(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  // adminId (3rd arg) is ALWAYS null on self-service writes — see
  // instructorProfile.service.js's header note on why (AuditLog.adminId is
  // FK-constrained to AdminUser; an AppUser id there would violate it).
  const doc = await docsSvc.confirmDocumentUpload(req.instructor.id, v.data, null);
  return res.status(201).json({ success: true, message: "Document uploaded.", data: doc });
});

const withdrawDocument = run(async (req, res) => {
  const docErr = validateId(req.params.docId, "docId");
  if (docErr) return badRequest(res, docErr);
  await profileSvc.assertDocumentIsWithdrawable(req.instructor.id, req.params.docId);
  const doc = await docsSvc.archiveDocument(req.instructor.id, req.params.docId, null);
  return res.json({ success: true, message: "Document withdrawn.", data: doc });
});

// ── Certifications ──────────────────────────────────────────────────────────

const listCertifications = run(async (req, res) => {
  const v = validateCertListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await certsSvc.listCertifications(req.instructor.id, v.data);
  return res.json({ success: true, data: result });
});

const signCertificationUpload = run(async (req, res) => {
  const v = validateCertSign(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await certsSvc.signCertificationUpload(req.instructor.id, v.data);
  return res.json({ success: true, data: result });
});

const createCertification = run(async (req, res) => {
  const v = validateCertCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const cert = await certsSvc.createCertification(req.instructor.id, v.data, null);
  return res.status(201).json({ success: true, message: "Certification created.", data: cert });
});

module.exports = {
  getProfile,
  updateProfile,
  listDocuments,
  signDocumentUpload,
  confirmDocumentUpload,
  withdrawDocument,
  listCertifications,
  signCertificationUpload,
  createCertification,
};
