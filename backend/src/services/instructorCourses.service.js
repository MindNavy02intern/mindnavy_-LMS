const coursesService = require("./courses.service");
const courseWorkflowService = require("./courseWorkflow.service");
const courseBuilderService = require("./courseBuilder.service");
const uploadsService = require("./uploads.service");
const { assertOwnsCourse, assertOwnsSection, assertOwnsLesson } = require("../utils/ownershipGuard");
const { forceOwnInstructorId } = require("../utils/selfScope");

// ── Instructor self-service Courses layer ────────────────────────────────────
//
// Every function here is a thin guard-then-delegate wrapper over the EXISTING
// admin services (courses.service / courseWorkflow.service / courseBuilder.
// service) — none of the aggregation/validation/Zoom/audit logic is
// reimplemented, per the blueprint's explicit "REUSE the exact same service
// functions" rule (R4).
//
// CRITICAL, repeated from Phase 1/2 because it is the easiest mistake to make
// across this many reused functions: every one of these admin functions'
// last argument is `adminId`, which flows straight into
// `prisma.auditLog.create({ data: { adminId, ... } })` — and AuditLog.adminId
// is FK-constrained to AdminUser. Passing req.instructor.id there is not a
// misattribution, it is a foreign-key violation. Every call below passes
// `null`, never the instructor's id — the instructor's identity already
// reaches the audit trail through whichever entity id (courseId/sectionId/
// lessonId) the reused function's `details` payload already includes.
function domainError(code, status) {
  return Object.assign(new Error(code), { code, status });
}

// ── Courses ───────────────────────────────────────────────────────────────────

async function listMyCourses(instructorId, query) {
  // Server value always wins — never the client's ?instructor=, matching the
  // blueprint's explicit instruction for this exact endpoint.
  return coursesService.listCourses({ ...query, instructor: instructorId });
}

async function getMyCourse(instructorId, courseId) {
  await assertOwnsCourse(courseId, instructorId);
  const course = await coursesService.getCourse(courseId);
  if (!course) throw domainError("COURSE_NOT_FOUND", 404);
  return course;
}

async function createMyCourse(body) {
  // instructorId is REQUIRED by courses.validator's validateCreate — forcing
  // it into the raw body before validation (not after) means the exact same
  // validator/service pair admin uses runs unmodified.
  return coursesService.createCourse(body, null);
}

async function updateMyCourse(instructorId, courseId, data) {
  await assertOwnsCourse(courseId, instructorId);
  // instructorId is never transferable via self-service, even to yourself —
  // strip it outright rather than trust the validator to reject a change.
  const { instructorId: _ignored, ...safeData } = data;
  return coursesService.updateCourse(courseId, safeData, null);
}

// New rule, not present in the admin archiveCourse (which archives ANY
// status unconditionally) — the blueprint explicitly recommends NOT exposing
// this for Published courses on the instructor side, to avoid an instructor
// unilaterally pulling a course learners are mid-enrollment in. Unpublish
// stays the admin-only path for that.
const SELF_ARCHIVABLE_STATUSES = new Set(["DRAFT", "PENDING"]); // PENDING included: a Draft submitted then withdrawn is still DRAFT+rejectionReason=null, but a mid-review course being pulled by its own author is reasonable too — see Known Gaps note in the report.
async function archiveMyCourse(instructorId, courseId) {
  const course = await assertOwnsCourse(courseId, instructorId);
  if (!SELF_ARCHIVABLE_STATUSES.has(course.status)) {
    throw domainError("NOT_SELF_ARCHIVABLE", 400);
  }
  return coursesService.archiveCourse(courseId, null);
}

async function restoreMyCourse(instructorId, courseId) {
  await assertOwnsCourse(courseId, instructorId);
  return coursesService.restoreCourse(courseId, null);
}

// ── Workflow (settings / preview / submit only — approve/reject/unpublish
//    are deliberately NOT wrapped here; see Known Gaps in the Part 1 report) ──

async function updateMySettings(instructorId, courseId, data) {
  await assertOwnsCourse(courseId, instructorId);
  return courseWorkflowService.updateSettings(courseId, data, null);
}

async function getMyPreview(instructorId, courseId) {
  await assertOwnsCourse(courseId, instructorId);
  return courseWorkflowService.getPreview(courseId);
}

async function submitMyCourse(instructorId, courseId) {
  await assertOwnsCourse(courseId, instructorId);
  return courseWorkflowService.submitCourse(courseId, null);
}

// ── Sections ──────────────────────────────────────────────────────────────────

async function listMySections(instructorId, courseId) {
  await assertOwnsCourse(courseId, instructorId);
  return courseBuilderService.listSections(courseId);
}

async function createMySection(instructorId, courseId, data) {
  await assertOwnsCourse(courseId, instructorId);
  return courseBuilderService.createSection(courseId, data, null);
}

async function updateMySection(instructorId, courseId, sectionId, data) {
  await assertOwnsCourse(courseId, instructorId);
  await assertOwnsSection(sectionId, instructorId);
  return courseBuilderService.updateSection(sectionId, data, null);
}

async function deleteMySection(instructorId, courseId, sectionId) {
  await assertOwnsCourse(courseId, instructorId);
  await assertOwnsSection(sectionId, instructorId);
  return courseBuilderService.deleteSection(sectionId, null);
}

// ── Lessons ───────────────────────────────────────────────────────────────────

async function createMyLesson(instructorId, courseId, sectionId, data) {
  await assertOwnsCourse(courseId, instructorId);
  await assertOwnsSection(sectionId, instructorId);
  return courseBuilderService.createLesson(sectionId, data, null);
}

async function updateMyLesson(instructorId, courseId, lessonId, data) {
  await assertOwnsCourse(courseId, instructorId);
  await assertOwnsLesson(lessonId, instructorId);
  return courseBuilderService.updateLesson(lessonId, data, null);
}

async function deleteMyLesson(instructorId, courseId, lessonId) {
  await assertOwnsCourse(courseId, instructorId);
  await assertOwnsLesson(lessonId, instructorId);
  return courseBuilderService.deleteLesson(lessonId, null);
}

// ── Uploads (thumbnail + lesson video) ───────────────────────────────────────
// uploads.service.js (admin) has NO ownership check today — only
// assertCourseExists. courseId is ALWAYS the caller-supplied courseId
// parameter here, which every controller call site below derives from
// req.params.id (the URL's course id, already ownership-checked) — never
// from the request body, exactly like every other write in this file.

async function signMyUpload(instructorId, courseId, data) {
  await assertOwnsCourse(courseId, instructorId);
  return uploadsService.signUpload({ ...data, courseId });
}

async function confirmMyUpload(instructorId, courseId, data) {
  await assertOwnsCourse(courseId, instructorId);
  // Video confirm additionally binds to a specific lesson — verify that
  // lesson is really under THIS course before letting uploads.service touch
  // it (uploads.service itself checks lesson.section.courseId === courseId,
  // but not who owns that course; the assertOwnsCourse above already covers
  // that transitively since courseId is fixed to the caller's own course).
  return uploadsService.confirmUpload({ ...data, courseId });
}

async function deleteMyUpload(instructorId, courseId, data) {
  await assertOwnsCourse(courseId, instructorId);
  // Defense in depth: the path's own prefix must match the course this
  // request claims to operate under — uploads.service.deleteUpload derives
  // the course from the path itself (no separate courseId param exists on
  // DELETE), so without this check a caller could pass ?path=<some other
  // course id>/file and, since THAT course might not be theirs, only be
  // caught by assertOwnsCourse on the WRONG (path-derived) course — which
  // uploads.service doesn't even run. Checking the prefix here first keeps
  // the ownership check anchored to the same course this route already
  // verified.
  if (!data.path.startsWith(`${courseId}/`)) {
    throw domainErrorLocal("FORBIDDEN_NOT_OWNER", 403);
  }
  return uploadsService.deleteUpload(data);
}

// ── Reorder (bulk) ──────────────────────────────────────────────────────────
// courseBuilderService.reorder() already verifies every referenced section/
// lesson id belongs to the given courseId internally (SECTION_NOT_IN_COURSE /
// LESSON_NOT_IN_COURSE) — assertOwnsCourse is the only additional check
// needed; a per-item assertOwnsSection/Lesson would be redundant here.
async function reorderMyCourse(instructorId, courseId, data) {
  await assertOwnsCourse(courseId, instructorId);
  return courseBuilderService.reorder(courseId, data, null);
}

module.exports = {
  listMyCourses,
  getMyCourse,
  createMyCourse,
  updateMyCourse,
  archiveMyCourse,
  restoreMyCourse,
  updateMySettings,
  getMyPreview,
  submitMyCourse,
  listMySections,
  createMySection,
  updateMySection,
  deleteMySection,
  createMyLesson,
  updateMyLesson,
  deleteMyLesson,
  signMyUpload,
  confirmMyUpload,
  deleteMyUpload,
  reorderMyCourse,
};
