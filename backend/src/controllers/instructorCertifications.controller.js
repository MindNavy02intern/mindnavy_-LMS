const svc = require("../services/instructorCertifications.service");
const { validateId } = require("../validators/instructors.validator");
const {
  validateSign,
  validateCreate,
  validateListQuery,
} = require("../validators/instructorCertifications.validator");

// ── Helpers (same shape as instructorDocuments.controller) ─────────────────────

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
    case "CERTIFICATION_NOT_FOUND":
      return notFound(res, "Certification not found.");
    case "BAD_PATH":
      return badRequest(res, "Invalid upload path.");
    case "OBJECT_NOT_FOUND":
      return badRequest(res, "The upload did not complete — no file was found at that path.");
    case "FILE_TOO_LARGE":
      return badRequest(res, `File exceeds the ${Math.round(svc.MAX_BYTES / (1024 * 1024))}MB limit.`);
    case "BAD_FILE_TYPE":
      return badRequest(res, "That file type is not allowed. Upload a PDF, PNG, JPEG or WEBP.");
    case "STORAGE_NOT_CONFIGURED":
      return res.status(503).json({ success: false, message: "Certification storage is not configured yet." });
    default:
      return null;
  }
}

function serverError(res, err) {
  console.error("[InstructorCertificationsController]", err);
  if (err.code === "P2025") return notFound(res, "Certification not found.");
  if (err.code === "P2003") return badRequest(res, "Invalid reference: one or more IDs do not exist.");
  if (err.code === "P2021" || err.code === "P2022") {
    return res.status(503).json({ success: false, message: "Database not migrated yet. Run `npx prisma db push`." });
  }
  return res.status(500).json({ success: false, message: "Internal server error." });
}

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

const listCertifications = run(async (req, res) => {
  const v = validateListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.listCertifications(req.params.id, v.data);
  return res.json({ success: true, data: result });
});

const signUpload = run(async (req, res) => {
  const v = validateSign(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.signCertificationUpload(req.params.id, v.data);
  return res.json({ success: true, data: result });
});

const createCertification = run(async (req, res) => {
  const v = validateCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const cert = await svc.createCertification(req.params.id, v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Certification created.", data: cert });
});

function certIdErr(req, res) {
  const err = validateId(req.params.certId, "certId");
  if (err) { badRequest(res, err); return true; }
  return false;
}

const verifyCertification = run(async (req, res) => {
  if (certIdErr(req, res)) return;
  const cert = await svc.verifyCertification(req.params.id, req.params.certId, req.admin?.id);
  return res.json({ success: true, message: "Certification verified.", data: cert });
});

const rejectCertification = run(async (req, res) => {
  if (certIdErr(req, res)) return;
  const cert = await svc.rejectCertification(req.params.id, req.params.certId, req.admin?.id);
  return res.json({ success: true, message: "Certification rejected.", data: cert });
});

const deleteCertification = run(async (req, res) => {
  if (certIdErr(req, res)) return;
  const result = await svc.deleteCertification(req.params.id, req.params.certId, req.admin?.id);
  return res.json({ success: true, message: "Certification deleted.", data: result });
});

module.exports = {
  listCertifications,
  signUpload,
  createCertification,
  verifyCertification,
  rejectCertification,
  deleteCertification,
};
