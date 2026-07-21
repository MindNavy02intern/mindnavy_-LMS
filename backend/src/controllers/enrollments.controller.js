const svc = require("../services/enrollments.service");
const {
  validateId,
  validateEnrollCreate,
  validateEnrollUpdate,
  validateListQuery,
} = require("../validators/enrollments.validator");

// ── Helpers (same pattern as quizzes.controller) ────────────────────────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "ENROLLMENT_NOT_FOUND": return notFound(res, "Enrollment not found.");
    case "COURSE_NOT_FOUND":     return badRequest(res, "Referenced course does not exist.");
    case "COURSE_ARCHIVED":      return badRequest(res, "Cannot enroll into an archived course.");
    case "USER_NOT_FOUND":       return badRequest(res, "Referenced user does not exist (or is archived).");
    case "ALREADY_ENROLLED":     return badRequest(res, "This user is already enrolled in this course.");
    case "COURSE_FULL":          return badRequest(res, "Course is full: its enrollment limit has been reached.");
    default:                     return null;
  }
}

function serverError(res, err) {
  console.error("[EnrollmentsController]", err);
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

const listEnrollments = run(async (req, res) => {
  const v = validateListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.listEnrollments(v.data);
  return res.json({ success: true, data: result });
});

const createEnrollment = run(async (req, res) => {
  const v = validateEnrollCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const enrollment = await svc.createEnrollment(v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "User enrolled.", data: enrollment });
});

const updateEnrollment = run(async (req, res) => {
  const idErr = validateId(req.params.id, "enrollmentId");
  if (idErr) return badRequest(res, idErr);
  const v = validateEnrollUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const enrollment = await svc.updateEnrollment(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Enrollment updated.", data: enrollment });
});

const deleteEnrollment = run(async (req, res) => {
  const idErr = validateId(req.params.id, "enrollmentId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteEnrollment(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "User unenrolled.", data: result });
});

module.exports = {
  listEnrollments,
  createEnrollment,
  updateEnrollment,
  deleteEnrollment,
};
