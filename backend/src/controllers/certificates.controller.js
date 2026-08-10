const svc = require("../services/certificates.service");
const { renderCertificatePdf } = require("../services/certificatePdf.service");
const {
  validateId,
  isValidCodeFormat,
  validateTemplateCreate,
  validateTemplateUpdate,
  validateIssue,
  validateReissue,
  validateRevoke,
  validateListQuery,
} = require("../validators/certificates.validator");

// ── Helpers ────────────────────────────────────────────────────────────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

// Domain errors thrown by the service → clean HTTP status + message.
function handleDomainError(res, err) {
  switch (err.code) {
    case "TEMPLATE_NOT_FOUND":     return notFound(res, "Certificate template not found.");
    case "CERT_NOT_FOUND":         return notFound(res, "Certificate not found.");
    case "USER_NOT_FOUND":         return badRequest(res, "Referenced user does not exist.");
    case "COURSE_NOT_FOUND":       return badRequest(res, "Referenced course does not exist.");
    case "TEMPLATE_REF_NOT_FOUND": return badRequest(res, "Referenced template does not exist.");
    case "CERT_DISABLED":          return badRequest(res, "Certificates are not enabled for this course (enable them in course settings).");
    case "ALREADY_ISSUED":         return badRequest(res, "A certificate for this user and course already exists — reissue it instead.");
    case "ALREADY_REVOKED":        return badRequest(res, "Certificate is already revoked.");
    case "CERT_REVOKED":           return badRequest(res, "Certificate is revoked — reissue it to enable downloads again.");
    default:                       return null;
  }
}

function serverError(res, err) {
  console.error("[CertificatesController]", err);
  // The PDF endpoint streams: if headers are already out we can't send JSON —
  // kill the socket so the client sees a broken download, not a hung request.
  if (res.headersSent) return res.destroy(err);
  if (err.code === "P2025") return notFound(res, "Record not found.");
  if (err.code === "P2003") return badRequest(res, "Invalid reference: one or more IDs do not exist.");
  // Table missing → migration not run yet. A clean 503 makes the cause obvious.
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

// ── Templates ────────────────────────────────────────────────────────────────────

const listTemplates = run(async (req, res) => {
  const templates = await svc.listTemplates();
  return res.json({ success: true, data: templates });
});

const getTemplate = run(async (req, res) => {
  const idErr = validateId(req.params.id, "templateId");
  if (idErr) return badRequest(res, idErr);
  const template = await svc.getTemplate(req.params.id);
  return res.json({ success: true, data: template });
});

const createTemplate = run(async (req, res) => {
  const v = validateTemplateCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const template = await svc.createTemplate(v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Template created.", data: template });
});

const updateTemplate = run(async (req, res) => {
  const idErr = validateId(req.params.id, "templateId");
  if (idErr) return badRequest(res, idErr);
  const v = validateTemplateUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const template = await svc.updateTemplate(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Template updated.", data: template });
});

const deleteTemplate = run(async (req, res) => {
  const idErr = validateId(req.params.id, "templateId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteTemplate(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Template deleted. Issued certificates were kept.", data: result });
});

// ── Issued certificates ───────────────────────────────────────────────────────────

const listCertificates = run(async (req, res) => {
  const v = validateListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const page = await svc.listCertificates(v.data);
  return res.json({ success: true, data: page });
});

const issueCertificate = run(async (req, res) => {
  const v = validateIssue(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const cert = await svc.issueCertificate(v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Certificate issued.", data: cert });
});

const revokeCertificate = run(async (req, res) => {
  const idErr = validateId(req.params.id, "certificateId");
  if (idErr) return badRequest(res, idErr);
  const v = validateRevoke(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const cert = await svc.revokeCertificate(req.params.id, req.admin?.id, v.data.reason);
  return res.json({ success: true, message: "Certificate revoked.", data: cert });
});

const reissueCertificate = run(async (req, res) => {
  const idErr = validateId(req.params.id, "certificateId");
  if (idErr) return badRequest(res, idErr);
  const v = validateReissue(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const cert = await svc.reissueCertificate(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Certificate reissued with a new verification code.", data: cert });
});

// PDF — headers/stream are written by the renderer, so all lookups (and their
// clean 400/404s) happen strictly before any byte goes out.
const downloadPdf = run(async (req, res) => {
  const idErr = validateId(req.params.id, "certificateId");
  if (idErr) return badRequest(res, idErr);
  const cert = await svc.getCertificateForPdf(req.params.id);
  await renderCertificatePdf(res, cert);
});

// ── Public verify (no auth — mounted under /api/public) ──────────────────────────

const verifyCertificate = run(async (req, res) => {
  const code = String(req.params.code || "").trim().toLowerCase();
  // Malformed codes never touch the DB.
  if (!isValidCodeFormat(code)) {
    return res.json({ success: true, data: { status: "not_found" } });
  }
  const result = await svc.verifyByCode(code);
  return res.json({ success: true, data: result });
});

module.exports = {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  listCertificates,
  issueCertificate,
  revokeCertificate,
  reissueCertificate,
  downloadPdf,
  verifyCertificate,
};
