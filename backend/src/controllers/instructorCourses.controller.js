const svc = require("../services/instructorCourses.service");
const { forceOwnInstructorId } = require("../utils/selfScope");

const {
  validateId,
  validateListQuery,
  validateCreate,
  validateUpdate,
  validateSettings,
} = require("../validators/courses.validator");
const {
  validateSectionCreate,
  validateSectionUpdate,
  validateLessonCreate,
  validateLessonUpdate,
  validateReorder,
} = require("../validators/courseBuilder.validator");
const {
  validateSign,
  validateConfirm,
  validateDelete,
} = require("../validators/uploads.validator");

// Error-code union of courses.controller + courseWorkflow.controller +
// courseBuilder.controller + the new ownership/business-rule codes this
// phase introduces (FORBIDDEN_NOT_OWNER, NOT_SELF_ARCHIVABLE).

function badRequest(res, msg, extra) {
  return res.status(400).json({ success: false, message: msg, ...extra });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function forbidden(res, msg) {
  return res.status(403).json({ success: false, message: msg });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "FORBIDDEN_NOT_OWNER":
      return forbidden(res, "You do not have access to this course.");
    case "COURSE_NOT_FOUND":
      return notFound(res, "Course not found.");
    case "SECTION_NOT_FOUND":
      return notFound(res, "Section not found.");
    case "LESSON_NOT_FOUND":
      return notFound(res, "Lesson not found.");
    case "SECTION_NOT_IN_COURSE":
      return badRequest(res, "A section does not belong to this course.");
    case "LESSON_NOT_IN_COURSE":
      return badRequest(res, "A lesson does not belong to this course.");
    case "BAD_VIDEO_URL":
      return badRequest(res, "content must be a valid http(s) URL for a VIDEO_URL lesson.");
    case "NOT_AN_INSTRUCTOR":
      return badRequest(res, "The selected user is not an instructor.");
    case "CATEGORY_NOT_FOUND":
      return notFound(res, "Category not found.");
    case "ONLY_ARCHIVED_RESTORABLE":
      return badRequest(res, "Only archived courses can be restored.");
    case "NOT_SELF_ARCHIVABLE":
      return badRequest(res, "Only Draft or Pending courses can be archived here — a Published course must be unpublished by an admin first.");
    case "PRICE_REQUIRED":
      return badRequest(res, "price (integer cents, > 0) is required when isFree is false.");
    case "ONLY_DRAFT_SUBMITTABLE":
      return badRequest(res, `Only Draft courses can be submitted (course is ${err.status}).`);
    case "SUBMIT_CHECKS_FAILED":
      return badRequest(res, "Course is not ready to submit.", { errors: err.errors });
    case "STATE_CHANGED":
      return badRequest(res, "Course status changed in the meantime — refresh and try again.");
    // ── Uploads (uploads.controller.js error-code union) ──────────────────────
    case "OBJECT_NOT_FOUND":
      return badRequest(res, "The file was not found in storage — the upload did not complete.");
    case "BAD_PATH":
      return badRequest(res, "Invalid file path.");
    case "LESSON_ID_REQUIRED":
      return badRequest(res, "lessonId is required for video uploads.");
    case "LESSON_COURSE_MISMATCH":
      return badRequest(res, "That lesson does not belong to this course.");
    case "LESSON_NOT_VIDEO":
      return badRequest(res, "The target lesson is not a video lesson.");
    case "FILE_TOO_LARGE":
      return badRequest(res, "The uploaded file exceeds the maximum allowed size.");
    case "BAD_FILE_TYPE":
      return badRequest(res, "The uploaded file type is not allowed.");
    case "STORAGE_NOT_CONFIGURED":
      return res.status(503).json({ success: false, message: "File storage is not configured yet." });
    case "STORAGE_SIGN_FAILED":
    case "STORAGE_LIST_FAILED":
    case "STORAGE_DELETE_FAILED":
      return res.status(502).json({ success: false, message: "Storage service error. Please try again." });
    default:
      return null;
  }
}

function serverError(res, err) {
  console.error("[InstructorCoursesController]", err);
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

// ── Courses ───────────────────────────────────────────────────────────────────

const listCourses = run(async (req, res) => {
  const v = validateListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.listMyCourses(req.instructor.id, v.data);
  return res.json({ success: true, data: result });
});

const getCourse = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId");
  if (idErr) return badRequest(res, idErr);
  const course = await svc.getMyCourse(req.instructor.id, req.params.id);
  return res.json({ success: true, data: course });
});

const createCourse = run(async (req, res) => {
  // Forced into the RAW body before validation, so validateCreate's own
  // "instructorId is required" rule is satisfied naturally by the server
  // value — never the client's.
  const body = forceOwnInstructorId(req.body, req.instructor.id);
  const v = validateCreate(body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const course = await svc.createMyCourse(v.data);
  return res.status(201).json({ success: true, message: "Course created as Draft.", data: course });
});

const updateCourse = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId");
  if (idErr) return badRequest(res, idErr);
  const v = validateUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const course = await svc.updateMyCourse(req.instructor.id, req.params.id, v.data);
  return res.json({ success: true, message: "Course updated.", data: course });
});

const archiveCourse = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.archiveMyCourse(req.instructor.id, req.params.id);
  return res.json({ success: true, message: "Course archived.", data: result });
});

const restoreCourse = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.restoreMyCourse(req.instructor.id, req.params.id);
  return res.json({ success: true, message: "Course restored to Draft.", data: result });
});

// ── Workflow ────────────────────────────────────────────────────────────────

const updateSettings = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId");
  if (idErr) return badRequest(res, idErr);
  const v = validateSettings(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const settings = await svc.updateMySettings(req.instructor.id, req.params.id, v.data);
  return res.json({ success: true, message: "Course settings updated.", data: settings });
});

const getPreview = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId");
  if (idErr) return badRequest(res, idErr);
  const preview = await svc.getMyPreview(req.instructor.id, req.params.id);
  return res.json({ success: true, data: preview });
});

const submitCourse = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.submitMyCourse(req.instructor.id, req.params.id);
  return res.json({ success: true, message: "Course submitted for approval.", data: result });
});

// ── Sections ──────────────────────────────────────────────────────────────────

const listSections = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId");
  if (idErr) return badRequest(res, idErr);
  const sections = await svc.listMySections(req.instructor.id, req.params.id);
  return res.json({ success: true, data: sections });
});

const createSection = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId");
  if (idErr) return badRequest(res, idErr);
  const v = validateSectionCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const section = await svc.createMySection(req.instructor.id, req.params.id, v.data);
  return res.status(201).json({ success: true, message: "Section created.", data: section });
});

const updateSection = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId") || validateId(req.params.sectionId, "sectionId");
  if (idErr) return badRequest(res, idErr);
  const v = validateSectionUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const section = await svc.updateMySection(req.instructor.id, req.params.id, req.params.sectionId, v.data);
  return res.json({ success: true, message: "Section updated.", data: section });
});

const deleteSection = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId") || validateId(req.params.sectionId, "sectionId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteMySection(req.instructor.id, req.params.id, req.params.sectionId);
  return res.json({ success: true, message: "Section deleted.", data: result });
});

// ── Lessons ───────────────────────────────────────────────────────────────────

const createLesson = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId") || validateId(req.params.sectionId, "sectionId");
  if (idErr) return badRequest(res, idErr);
  const v = validateLessonCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const lesson = await svc.createMyLesson(req.instructor.id, req.params.id, req.params.sectionId, v.data);
  return res.status(201).json({ success: true, message: "Lesson created.", data: lesson });
});

const updateLesson = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId") || validateId(req.params.lessonId, "lessonId");
  if (idErr) return badRequest(res, idErr);
  const v = validateLessonUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const lesson = await svc.updateMyLesson(req.instructor.id, req.params.id, req.params.lessonId, v.data);
  return res.json({ success: true, message: "Lesson updated.", data: lesson });
});

const deleteLesson = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId") || validateId(req.params.lessonId, "lessonId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteMyLesson(req.instructor.id, req.params.id, req.params.lessonId);
  return res.json({ success: true, message: "Lesson deleted.", data: result });
});

// ── Uploads ───────────────────────────────────────────────────────────────────
// Same sign→PUT→confirm pattern as /api/admin/uploads, scoped to the caller's
// own course. courseId is forced into the body from the URL's :id BEFORE
// validation (validateSign/validateConfirm both require courseId present) —
// the client never supplies it, exactly the "force before validate" fix
// already applied to createCourse/createSession.

const signUpload = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId");
  if (idErr) return badRequest(res, idErr);
  const body = { ...req.body, courseId: req.params.id };
  const v = validateSign(body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const data = await svc.signMyUpload(req.instructor.id, req.params.id, v.data);
  return res.json({ success: true, message: "Signed upload URL issued.", data });
});

const confirmUpload = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId");
  if (idErr) return badRequest(res, idErr);
  const body = { ...req.body, courseId: req.params.id };
  const v = validateConfirm(body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const data = await svc.confirmMyUpload(req.instructor.id, req.params.id, v.data);
  return res.json({ success: true, message: "Upload confirmed.", data });
});

const deleteUpload = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId");
  if (idErr) return badRequest(res, idErr);
  const v = validateDelete(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const data = await svc.deleteMyUpload(req.instructor.id, req.params.id, v.data);
  return res.json({ success: true, message: "File deleted.", data });
});

// ── Reorder ────────────────────────────────────────────────────────────────────

const reorder = run(async (req, res) => {
  const idErr = validateId(req.params.id, "courseId");
  if (idErr) return badRequest(res, idErr);
  const v = validateReorder(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const sections = await svc.reorderMyCourse(req.instructor.id, req.params.id, v.data);
  return res.json({ success: true, message: "Order updated.", data: sections });
});

module.exports = {
  listCourses,
  getCourse,
  createCourse,
  updateCourse,
  archiveCourse,
  restoreCourse,
  updateSettings,
  getPreview,
  submitCourse,
  listSections,
  createSection,
  updateSection,
  deleteSection,
  createLesson,
  updateLesson,
  deleteLesson,
  signUpload,
  confirmUpload,
  deleteUpload,
  reorder,
};
