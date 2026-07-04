const svc = require("../services/courseBuilder.service");
const {
  validateId,
  validateSectionCreate,
  validateSectionUpdate,
  validateLessonCreate,
  validateLessonUpdate,
  validateReorder,
} = require("../validators/courseBuilder.validator");

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
    case "COURSE_NOT_FOUND":     return notFound(res, "Course not found.");
    case "SECTION_NOT_FOUND":    return notFound(res, "Section not found.");
    case "LESSON_NOT_FOUND":     return notFound(res, "Lesson not found.");
    case "SECTION_NOT_IN_COURSE":return badRequest(res, "A section does not belong to this course.");
    case "LESSON_NOT_IN_COURSE": return badRequest(res, "A lesson does not belong to this course.");
    case "BAD_VIDEO_URL":        return badRequest(res, "content must be a valid http(s) URL for a VIDEO_URL lesson.");
    default:                     return null;
  }
}

function serverError(res, err) {
  console.error("[CourseBuilderController]", err);
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

// ── Sections ─────────────────────────────────────────────────────────────────────

const listSections = run(async (req, res) => {
  const idErr = validateId(req.params.courseId, "courseId");
  if (idErr) return badRequest(res, idErr);
  const sections = await svc.listSections(req.params.courseId);
  return res.json({ success: true, data: sections });
});

const createSection = run(async (req, res) => {
  const idErr = validateId(req.params.courseId, "courseId");
  if (idErr) return badRequest(res, idErr);
  const v = validateSectionCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const section = await svc.createSection(req.params.courseId, v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Section created.", data: section });
});

const updateSection = run(async (req, res) => {
  const idErr = validateId(req.params.id, "sectionId");
  if (idErr) return badRequest(res, idErr);
  const v = validateSectionUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const section = await svc.updateSection(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Section updated.", data: section });
});

const deleteSection = run(async (req, res) => {
  const idErr = validateId(req.params.id, "sectionId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteSection(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Section deleted.", data: result });
});

// ── Lessons ──────────────────────────────────────────────────────────────────────

const createLesson = run(async (req, res) => {
  const idErr = validateId(req.params.sectionId, "sectionId");
  if (idErr) return badRequest(res, idErr);
  const v = validateLessonCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const lesson = await svc.createLesson(req.params.sectionId, v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Lesson created.", data: lesson });
});

const updateLesson = run(async (req, res) => {
  const idErr = validateId(req.params.id, "lessonId");
  if (idErr) return badRequest(res, idErr);
  const v = validateLessonUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const lesson = await svc.updateLesson(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Lesson updated.", data: lesson });
});

const deleteLesson = run(async (req, res) => {
  const idErr = validateId(req.params.id, "lessonId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteLesson(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Lesson deleted.", data: result });
});

// ── Reorder ────────────────────────────────────────────────────────────────────────

const reorder = run(async (req, res) => {
  const idErr = validateId(req.params.courseId, "courseId");
  if (idErr) return badRequest(res, idErr);
  const v = validateReorder(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const sections = await svc.reorder(req.params.courseId, v.data, req.admin?.id);
  return res.json({ success: true, message: "Order updated.", data: sections });
});

module.exports = {
  listSections,
  createSection,
  updateSection,
  deleteSection,
  createLesson,
  updateLesson,
  deleteLesson,
  reorder,
};
