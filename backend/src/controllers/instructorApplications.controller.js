const svc = require("../services/instructorApplications.service");
const {
  validateId,
  validateApplicationSubmit,
  validateApprove,
  validateReject,
  validateRequestChanges,
  validateListQuery,
} = require("../validators/instructorApplications.validator");

// ── Helpers (same pattern as instructors.controller) ────────────────────────────

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
    case "APPLICATION_NOT_FOUND":
      return notFound(res, "Application not found.");
    case "APPLICATION_ALREADY_DECIDED":
      return conflict(res, "This application has already been decided.");
    case "EMAIL_TAKEN":
      return conflict(res, "A user with this email already exists — the application cannot be approved.");
    default:
      return null;
  }
}

function serverError(res, err) {
  console.error("[InstructorApplicationsController]", err);
  if (err.code === "P2025") return notFound(res, "Record not found.");
  if (err.code === "P2002") return conflict(res, "This application has already been approved.");
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

// ── Admin handlers ──────────────────────────────────────────────────────────────

const listApplications = run(async (req, res) => {
  const v = validateListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.listApplications(v.data);
  return res.json({ success: true, data: result });
});

const getApplication = run(async (req, res) => {
  const idErr = validateId(req.params.id, "applicationId");
  if (idErr) return badRequest(res, idErr);
  const application = await svc.getApplication(req.params.id);
  return res.json({ success: true, data: application });
});

const approveApplication = run(async (req, res) => {
  const idErr = validateId(req.params.id, "applicationId");
  if (idErr) return badRequest(res, idErr);
  const v = validateApprove(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.approveApplication(req.params.id, v.data, req.admin?.id);
  return res.json({
    success: true,
    message: "Application approved — instructor account created.",
    data: result,
  });
});

const rejectApplication = run(async (req, res) => {
  const idErr = validateId(req.params.id, "applicationId");
  if (idErr) return badRequest(res, idErr);
  const v = validateReject(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const application = await svc.rejectApplication(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Application rejected.", data: application });
});

const requestChanges = run(async (req, res) => {
  const idErr = validateId(req.params.id, "applicationId");
  if (idErr) return badRequest(res, idErr);
  const v = validateRequestChanges(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const application = await svc.requestChanges(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Changes requested from the applicant.", data: application });
});

// ── Public submit (UNAUTHENTICATED) ─────────────────────────────────────────────
//
// The response is deliberately uniform and id-free: the same 202 body for a new
// application, a resubmission, a duplicate, and a honeypot hit. An anonymous
// caller can therefore learn nothing about which addresses have applied or been
// approved. Validation errors are still returned (the real form needs them),
// but they never reference stored data.
const PUBLIC_ACK = {
  success: true,
  message: "Your application has been received. We'll email you once it has been reviewed.",
};

const submitApplication = run(async (req, res) => {
  const v = validateApplicationSubmit(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);

  // Honeypot filled = bot. Answer exactly like a success and store nothing.
  if (v.spam) return res.status(202).json(PUBLIC_ACK);

  await svc.submitApplication(v.data);
  return res.status(202).json(PUBLIC_ACK);
});

module.exports = {
  listApplications,
  getApplication,
  approveApplication,
  rejectApplication,
  requestChanges,
  submitApplication,
};
