const svc = require("../services/instructorStudents.service");

// Same helper shapes as instructorCourses.controller.js.

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function forbidden(res, msg) {
  return res.status(403).json({ success: false, message: msg });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "STUDENT_NOT_FOUND":
      return notFound(res, "Student not found.");
    case "FORBIDDEN_NOT_OWNER":
      return forbidden(res, "You do not have access to this student.");
    default:
      return null;
  }
}

function serverError(res, err) {
  console.error("[InstructorStudentsController]", err);
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

function validateId(id, label) {
  if (!id || typeof id !== "string" || !id.trim()) return `${label} is required.`;
  return null;
}

const ENROLLMENT_STATUSES = new Set(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "OVERDUE"]);

function str(v) {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}
function num(v) {
  return v !== undefined ? Number(v) : undefined;
}

// ── Handlers ─────────────────────────────────────────────────────────────────────

const listStudents = run(async (req, res) => {
  const status = str(req.query.status);
  if (status && !ENROLLMENT_STATUSES.has(status)) {
    return badRequest(res, "status must be one of NOT_STARTED, IN_PROGRESS, COMPLETED, OVERDUE.");
  }
  const result = await svc.listMyStudents(req.instructor.id, {
    search: str(req.query.search),
    courseId: str(req.query.courseId),
    status,
    page: num(req.query.page),
    limit: num(req.query.limit),
  });
  return res.json({ success: true, data: result });
});

const getStudent = run(async (req, res) => {
  const idErr = validateId(req.params.id, "studentId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.getMyStudent(req.instructor.id, req.params.id);
  return res.json({ success: true, data: result });
});

const getAssessments = run(async (req, res) => {
  const idErr = validateId(req.params.id, "studentId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.getMyStudentAssessments(req.instructor.id, req.params.id, {
    page: num(req.query.page),
    limit: num(req.query.limit),
  });
  return res.json({ success: true, data: result });
});

const getAttendance = run(async (req, res) => {
  const idErr = validateId(req.params.id, "studentId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.getMyStudentAttendance(req.instructor.id, req.params.id, {
    page: num(req.query.page),
    limit: num(req.query.limit),
  });
  return res.json({ success: true, data: result });
});

module.exports = {
  listStudents,
  getStudent,
  getAssessments,
  getAttendance,
};
