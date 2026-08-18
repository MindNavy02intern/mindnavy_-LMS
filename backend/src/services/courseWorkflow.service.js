const { Prisma } = require("@prisma/client");

const prisma = require("../config/prisma");
const coursesService = require("./courses.service");
const courseBuilderService = require("./courseBuilder.service");

// ── Course Wizard workflow service (settings · preview · submit · approve/reject) ──
//
// Same conventions as courses.service: domain errors carry a `code` the controller
// maps to a clean 400/404, audit is best-effort, status labels are title-case.
//
// Security notes:
// - Settings fields are owned ONLY by updateSettings — the generic course PATCH
//   validator rejects them, so there is exactly one writer per field.
// - Every status transition is an ATOMIC conditional write (updateMany filtered on
//   the expected current status), so two admins racing each other can never
//   double-apply a transition — the loser gets a clean 400, not a silent overwrite.

const STATUS_LABEL     = { DRAFT: "Draft", PENDING: "Pending", PUBLISHED: "Published", ARCHIVED: "Archived" };
const VISIBILITY_ENUM  = { Public: "PUBLIC", Private: "PRIVATE", Unlisted: "UNLISTED" };
const VISIBILITY_LABEL = { PUBLIC: "Public", PRIVATE: "Private", UNLISTED: "Unlisted" };

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

function domainError(code, extra) { return Object.assign(new Error(code), { code, ...extra }); }

// Best-effort audit — never breaks the primary write (mirrors courses.service).
async function auditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: adminId ?? null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

const SETTINGS_SELECT = {
  id: true, isFree: true, price: true, currency: true, enrollmentLimit: true,
  visibility: true, certificateEnabled: true, dripContentEnabled: true,
  accessRules: true, seoTitle: true, seoDescription: true, updatedAt: true,
};

function mapSettings(c) {
  return {
    id:                 c.id,
    isFree:             c.isFree,
    price:              c.price ?? null,
    currency:           c.currency ?? null,
    enrollmentLimit:    c.enrollmentLimit ?? null,
    visibility:         VISIBILITY_LABEL[c.visibility] ?? "Public",
    certificateEnabled: c.certificateEnabled,
    dripContentEnabled: c.dripContentEnabled,
    accessRules:        c.accessRules ?? null,
    seoTitle:           c.seoTitle ?? null,
    seoDescription:     c.seoDescription ?? null,
    updatedAt:          iso(c.updatedAt),
  };
}

async function getCourseOrThrow(id, select) {
  const course = await prisma.course.findUnique({ where: { id }, select });
  if (!course) throw domainError("COURSE_NOT_FOUND");
  return course;
}

// ── Step 4: Settings ─────────────────────────────────────────────────────────────

async function updateSettings(id, data, adminId) {
  const current = await getCourseOrThrow(id, { id: true, isFree: true, price: true });

  // Cross-field check against the MERGED result (mirrors updateLesson's URL guard):
  // a paid course must always end up with a positive price, whichever of the two
  // fields this PATCH actually touches.
  const effectiveIsFree = data.isFree !== undefined ? data.isFree : current.isFree;
  const effectivePrice  = data.price  !== undefined ? data.price  : current.price;
  if (!effectiveIsFree && !(Number.isInteger(effectivePrice) && effectivePrice > 0)) {
    throw domainError("PRICE_REQUIRED");
  }

  const patch = { ...data };
  if (patch.visibility !== undefined) patch.visibility = VISIBILITY_ENUM[patch.visibility];
  if (effectiveIsFree) patch.price = null; // free course never keeps a stale price
  // Prisma rejects raw JS null for Json columns — clearing needs DbNull.
  if (patch.accessRules === null) patch.accessRules = Prisma.DbNull;

  const course = await prisma.course.update({ where: { id }, data: patch, select: SETTINGS_SELECT });
  await auditLog(adminId, "COURSE_SETTINGS_UPDATED", { courseId: id, fields: Object.keys(data) });
  return mapSettings(course);
}

// ── Step 5: Preview ──────────────────────────────────────────────────────────────

// Thin composition of the two existing reads — no new queries or mapping logic.
async function getPreview(id) {
  const course = await coursesService.getCourse(id);
  if (!course) throw domainError("COURSE_NOT_FOUND");
  const sections = await courseBuilderService.listSections(id);
  return { course, sections };
}

// ── Step 6: Submit for approval ──────────────────────────────────────────────────

// Readiness checks (SCORM checks stay deferred — that system doesn't exist yet).
// ALL failures are returned at once so the frontend can render the full list inline.
async function submitCourse(id, adminId) {
  const course = await getCourseOrThrow(id, {
    id: true, status: true, title: true, description: true, thumbnail: true,
  });

  if (course.status !== "DRAFT") {
    throw domainError("ONLY_DRAFT_SUBMITTABLE", { status: STATUS_LABEL[course.status] });
  }

  const errors = [];
  if (!course.title?.trim())       errors.push("Course needs a title.");
  if (!course.description?.trim()) errors.push("Course needs a description.");
  if (!course.thumbnail?.trim())   errors.push("Course needs a thumbnail image.");

  const sections = await prisma.courseSection.findMany({
    where: { courseId: id },
    select: { _count: { select: { lessons: true } } },
  });
  const lessonCount = sections.reduce((sum, s) => sum + s._count.lessons, 0);
  if (sections.length === 0)  errors.push("Course needs at least one section.");
  else if (lessonCount === 0) errors.push("Course needs at least one lesson.");

  // Any quiz attached to this course must have at least one question — an
  // empty quiz would publish as an unwinnable/unpassable assessment.
  const quizzes = await prisma.quiz.findMany({
    where: { courseId: id },
    select: { title: true, _count: { select: { questions: true } } },
  });
  for (const quiz of quizzes) {
    if (quiz._count.questions === 0) errors.push(`Quiz "${quiz.title}" has no questions.`);
  }

  if (errors.length > 0) throw domainError("SUBMIT_CHECKS_FAILED", { errors });

  // Atomic transition: only fires if the course is still DRAFT right now.
  // submittedAt is re-stamped on every submit (a resubmit after rejection
  // restarts the wait), so "longest waiting first" queues stay honest.
  const { count } = await prisma.course.updateMany({
    where: { id, status: "DRAFT" },
    data:  { status: "PENDING", rejectionReason: null, submittedAt: new Date() },
  });
  if (count === 0) throw domainError("STATE_CHANGED");

  await auditLog(adminId, "COURSE_SUBMITTED", { courseId: id, title: course.title });
  return { id, status: "Pending" };
}

// ── Approval workflow: approve / reject ──────────────────────────────────────────

async function approveCourse(id, adminId) {
  const course = await getCourseOrThrow(id, { id: true, status: true, title: true });
  if (course.status !== "PENDING") {
    throw domainError("ONLY_PENDING_DECIDABLE", { status: STATUS_LABEL[course.status] });
  }

  const reviewedAt = new Date();
  const { count } = await prisma.course.updateMany({
    where: { id, status: "PENDING" },
    data:  { status: "PUBLISHED", rejectionReason: null, reviewedById: adminId ?? null, reviewedAt },
  });
  if (count === 0) throw domainError("STATE_CHANGED");

  await auditLog(adminId, "COURSE_APPROVED", { courseId: id, title: course.title });
  return { id, status: "Published", reviewedAt: iso(reviewedAt) };
}

// "Request Changes" = reject in v1: the course returns to Draft with the reason
// stored on it (visible on GET /courses/:id as `rejectionReason`).
async function rejectCourse(id, reason, adminId) {
  const course = await getCourseOrThrow(id, { id: true, status: true, title: true });
  if (course.status !== "PENDING") {
    throw domainError("ONLY_PENDING_DECIDABLE", { status: STATUS_LABEL[course.status] });
  }

  const reviewedAt = new Date();
  const { count } = await prisma.course.updateMany({
    where: { id, status: "PENDING" },
    data:  { status: "DRAFT", rejectionReason: reason, reviewedById: adminId ?? null, reviewedAt },
  });
  if (count === 0) throw domainError("STATE_CHANGED");

  await auditLog(adminId, "COURSE_REJECTED", { courseId: id, title: course.title, reason });
  return { id, status: "Draft", rejectionReason: reason, reviewedAt: iso(reviewedAt) };
}

// Take a live course off the catalogue: PUBLISHED → DRAFT.
//
// Not the inverse of approve — it is the inverse of PUBLISHING. The course goes
// back to Draft so the instructor can fix it and resubmit through the normal
// submit → approve path; there is no way to jump straight back to Published.
//
// reviewedAt / reviewedById are deliberately KEPT: they record that this course
// was approved once, and the stats month-over-month figures read reviewedAt as
// the publish date. Clearing them would silently rewrite that history.
//
// rejectionReason is also untouched: it is null on a published course, and
// unpublishing is not a rejection — a course pulled for maintenance must not
// show up in the Rejected tab.
async function unpublishCourse(id, adminId) {
  const course = await getCourseOrThrow(id, { id: true, status: true, title: true });
  if (course.status !== "PUBLISHED") {
    throw domainError("ONLY_PUBLISHED_UNPUBLISHABLE", { status: STATUS_LABEL[course.status] });
  }

  // Atomic transition, same guard as approve/reject: two admins clicking at once
  // cannot both apply it.
  const { count } = await prisma.course.updateMany({
    where: { id, status: "PUBLISHED" },
    data:  { status: "DRAFT" },
  });
  if (count === 0) throw domainError("STATE_CHANGED");

  await auditLog(adminId, "COURSE_UNPUBLISHED", { courseId: id, title: course.title });
  return { id, status: "Draft" };
}

module.exports = { updateSettings, getPreview, submitCourse, approveCourse, rejectCourse, unpublishCourse };
