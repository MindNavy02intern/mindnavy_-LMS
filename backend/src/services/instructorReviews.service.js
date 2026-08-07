const prisma = require("../config/prisma");

// ── Instructor reviews service (moderation queue) ────────────────────────────────
//
// NOTE: INSTRUCTORS_CONTRACT.md v1 documents "no Review model" as a deliberate
// gap — see instructors.prisma InstructorReview for the full note. This module
// ships it at the user's explicit direction.
//
// Conventions match instructors.service: domain errors carry a `code` the
// controller maps to a clean 4xx; audit is best-effort so it never breaks the
// primary write; assertIsInstructor keeps a LEARNER id indistinguishable from a
// missing one.

function domainError(code) { return Object.assign(new Error(code), { code }); }

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[instructorReviews.service] query failed:", err.message);
    return fallback;
  }
}

async function auditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: adminId ?? null,
        targetUserId: typeof details?.instructorId === "string" ? details.instructorId : null,
        action,
        details: details ?? null,
      },
    });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

async function assertIsInstructor(id) {
  const user = await prisma.appUser.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "INSTRUCTOR") throw domainError("INSTRUCTOR_NOT_FOUND");
  return user;
}

// Scoping the lookup to instructorId means a reviewId belonging to a different
// instructor answers 404, same rule as instructorDocuments.assertDocumentOf.
async function assertReviewOf(instructorId, reviewId) {
  const review = await prisma.instructorReview.findFirst({
    where: { id: reviewId, instructorId },
  });
  if (!review) throw domainError("REVIEW_NOT_FOUND");
  return review;
}

function mapReview(r) {
  return {
    id:           r.id,
    instructorId: r.instructorId,
    studentId:    r.studentId,
    studentName:  r.student?.fullName ?? null,
    courseId:     r.courseId,
    courseTitle:  r.course?.title ?? null,
    rating:       r.rating,
    comment:      r.comment ?? null,
    status:       r.status,
    createdAt:    iso(r.createdAt),
    updatedAt:    iso(r.updatedAt),
  };
}

const REVIEW_SELECT = {
  id: true, instructorId: true, studentId: true, courseId: true,
  rating: true, comment: true, status: true, createdAt: true, updatedAt: true,
  student: { select: { fullName: true } },
  course:  { select: { title: true } },
};

// ── List ────────────────────────────────────────────────────────────────────────

async function listReviews(instructorId, { page = 1, limit = 20, status } = {}) {
  await assertIsInstructor(instructorId);

  const where = { instructorId, ...(status ? { status } : {}) };
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    safe(() => prisma.instructorReview.count({ where }), 0),
    safe(() => prisma.instructorReview.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: REVIEW_SELECT,
    }), []),
  ]);

  return {
    reviews: rows.map(mapReview),
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

// ── Moderation actions ────────────────────────────────────────────────────────────

async function moderateReview(instructorId, reviewId, status, action, adminId) {
  await assertReviewOf(instructorId, reviewId);

  const review = await prisma.instructorReview.update({
    where: { id: reviewId },
    data: { status },
    select: REVIEW_SELECT,
  });

  await auditLog(adminId, action, { instructorId, reviewId, status });

  return mapReview(review);
}

async function approveReview(instructorId, reviewId, adminId) {
  return moderateReview(instructorId, reviewId, "APPROVED", "REVIEW_APPROVED", adminId);
}

async function removeReview(instructorId, reviewId, adminId) {
  return moderateReview(instructorId, reviewId, "REMOVED", "REVIEW_REMOVED", adminId);
}

async function flagReview(instructorId, reviewId, adminId) {
  return moderateReview(instructorId, reviewId, "FLAGGED", "REVIEW_FLAGGED", adminId);
}

module.exports = {
  listReviews,
  approveReview,
  removeReview,
  flagReview,
};
