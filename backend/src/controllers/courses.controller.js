const svc = require("../services/courses.service");
const {
  validateId,
  validateListQuery,
  validateCreate,
  validateUpdate,
} = require("../validators/courses.validator");

// ── Helpers ────────────────────────────────────────────────────────────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

// Domain errors thrown by the service (bad instructor reference).
function handleDomainError(res, err) {
  if (err.code === "INSTRUCTOR_NOT_FOUND") return notFound(res, "Instructor not found.");
  if (err.code === "NOT_AN_INSTRUCTOR")    return badRequest(res, "The selected user is not an instructor.");
  return null;
}

function serverError(res, err) {
  console.error("[CoursesController]", err);
  if (err.code === "P2025") return notFound(res, "Course not found.");
  if (err.code === "P2003") return badRequest(res, "Invalid reference: one or more IDs do not exist.");
  return res.status(500).json({ success: false, message: "Internal server error." });
}

// ── Endpoints ────────────────────────────────────────────────────────────────────

async function listCourses(req, res) {
  try {
    const v = validateListQuery(req.query);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    return res.json({ success: true, data: await svc.listCourses(v.data) });
  } catch (err) { return serverError(res, err); }
}

async function getCourse(req, res) {
  try {
    const idErr = validateId(req.params.id, "courseId");
    if (idErr) return badRequest(res, idErr);
    const course = await svc.getCourse(req.params.id);
    if (!course) return notFound(res, "Course not found.");
    return res.json({ success: true, data: course });
  } catch (err) { return serverError(res, err); }
}

async function createCourse(req, res) {
  try {
    const v = validateCreate(req.body);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    const course = await svc.createCourse(v.data, req.admin?.id);
    return res.status(201).json({ success: true, message: "Course created as Draft.", data: course });
  } catch (err) {
    return handleDomainError(res, err) ?? serverError(res, err);
  }
}

async function updateCourse(req, res) {
  try {
    const idErr = validateId(req.params.id, "courseId");
    if (idErr) return badRequest(res, idErr);
    const v = validateUpdate(req.body);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    const course = await svc.updateCourse(req.params.id, v.data, req.admin?.id);
    return res.json({ success: true, message: "Course updated.", data: course });
  } catch (err) {
    return handleDomainError(res, err) ?? serverError(res, err);
  }
}

async function archiveCourse(req, res) {
  try {
    const idErr = validateId(req.params.id, "courseId");
    if (idErr) return badRequest(res, idErr);
    const result = await svc.archiveCourse(req.params.id, req.admin?.id);
    return res.json({ success: true, message: "Course archived.", data: result });
  } catch (err) { return serverError(res, err); }
}

module.exports = {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  archiveCourse,
};
