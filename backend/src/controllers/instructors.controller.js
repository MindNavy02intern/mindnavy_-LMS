const svc = require("../services/instructors.service");
const {
  validateId,
  validateInstructorCreate,
  validateInstructorUpdate,
  validateSuspend,
  validateListQuery,
} = require("../validators/instructors.validator");

// ── Helpers (same pattern as liveSessions.controller) ───────────────────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function conflict(res, msg, data) {
  return res.status(409).json({ success: false, message: msg, ...(data ? { data } : {}) });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "INSTRUCTOR_NOT_FOUND":
      return notFound(res, "Instructor not found.");
    case "EMAIL_TAKEN":
      return conflict(res, "A user with this email already exists.");
    case "INSTRUCTOR_SUSPENDED":
      return conflict(res, "This instructor is suspended. Reactivate the account before verifying it.");
    case "INSTRUCTOR_HAS_CONTENT":
      return conflict(
        res,
        "This instructor still owns courses or live sessions. Reassign them before archiving.",
        err.blockers,
      );
    default:
      return null;
  }
}

// users.service throws makeError(message, statusCode) — those are already
// contract-shaped, so pass them straight through instead of masking them as 500s.
function handleDelegatedError(res, err) {
  if (typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 500) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  return null;
}

function serverError(res, err) {
  console.error("[InstructorsController]", err);
  if (err.code === "P2025") return notFound(res, "Record not found.");
  if (err.code === "P2002") return conflict(res, "A user with this email already exists.");
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
      return handleDomainError(res, err) ?? handleDelegatedError(res, err) ?? serverError(res, err);
    }
  };
}

// ── Handlers ────────────────────────────────────────────────────────────────────

const listInstructors = run(async (req, res) => {
  const v = validateListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.listInstructors(v.data);
  return res.json({ success: true, data: result });
});

// Registered BEFORE /:id in the router — "stats" must never be read as an id.
const getStats = run(async (req, res) => {
  const stats = await svc.getStats();
  return res.json({ success: true, data: stats });
});

const getInstructor = run(async (req, res) => {
  const idErr = validateId(req.params.id, "instructorId");
  if (idErr) return badRequest(res, idErr);
  const instructor = await svc.getInstructor(req.params.id);
  return res.json({ success: true, data: instructor });
});

const createInstructor = run(async (req, res) => {
  const v = validateInstructorCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const instructor = await svc.createInstructor(v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Instructor created.", data: instructor });
});

const updateInstructor = run(async (req, res) => {
  const idErr = validateId(req.params.id, "instructorId");
  if (idErr) return badRequest(res, idErr);
  const v = validateInstructorUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const instructor = await svc.updateInstructor(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Instructor updated.", data: instructor });
});

const verifyInstructor = run(async (req, res) => {
  const idErr = validateId(req.params.id, "instructorId");
  if (idErr) return badRequest(res, idErr);
  const instructor = await svc.verifyInstructor(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Instructor verified.", data: instructor });
});

const suspendInstructor = run(async (req, res) => {
  const idErr = validateId(req.params.id, "instructorId");
  if (idErr) return badRequest(res, idErr);
  const v = validateSuspend(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const instructor = await svc.suspendInstructor(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Instructor suspended.", data: instructor });
});

const reactivateInstructor = run(async (req, res) => {
  const idErr = validateId(req.params.id, "instructorId");
  if (idErr) return badRequest(res, idErr);
  const instructor = await svc.reactivateInstructor(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Instructor reactivated.", data: instructor });
});

const deleteInstructor = run(async (req, res) => {
  const idErr = validateId(req.params.id, "instructorId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteInstructor(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Instructor archived.", data: result });
});

module.exports = {
  listInstructors,
  getStats,
  getInstructor,
  createInstructor,
  updateInstructor,
  verifyInstructor,
  suspendInstructor,
  reactivateInstructor,
  deleteInstructor,
};
