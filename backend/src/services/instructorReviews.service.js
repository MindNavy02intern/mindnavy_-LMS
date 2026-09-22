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

// ── Self-service (Phase 5, blueprint 2.6) ───────────────────────────────────────
//
// Mounted separately at /api/instructor/reviews (instructorReviewsSelf.routes.js
// — a distinct file name/route from this module's admin-console routes above,
// since "instructorReviews" was already taken by the admin viewer). Reuses
// listReviews()'s exact query shape rather than forking it — the only real
// difference is the blueprint's own rule: "Removed reviews are hidden
// entirely" for the instructor's own view, which listReviews() alone doesn't
// enforce (the admin console legitimately needs to see REMOVED rows).

const SELF_VISIBLE_STATUSES = new Set(["PENDING", "APPROVED", "FLAGGED"]);

async function listMyReviews(instructorId, { page, limit, status } = {}) {
  // A status filter of REMOVED (or anything else invalid) must never leak a
  // removed review — silently drop it back to "no filter" rather than 400,
  // same tolerance listReviews() already has for an absent status.
  const safeStatus = status && SELF_VISIBLE_STATUSES.has(status) ? status : undefined;

  if (safeStatus) return listReviews(instructorId, { page, limit, status: safeStatus });

  // No status filter → still must exclude REMOVED. listReviews()'s where-
  // builder only supports an exact status match, not `not`, so this one case
  // queries directly rather than bending that function's signature.
  await assertIsInstructor(instructorId);

  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const where = { instructorId, status: { in: [...SELF_VISIBLE_STATUSES] } };
  const skip = (p - 1) * l;

  const [total, rows] = await Promise.all([
    safe(() => prisma.instructorReview.count({ where }), 0),
    safe(() => prisma.instructorReview.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take: l, select: REVIEW_SELECT,
    }), []),
  ]);

  return {
    reviews: rows.map(mapReview),
    pagination: { total, page: p, limit: l, pages: Math.max(1, Math.ceil(total / l)) },
  };
}

// Same aggregate SHAPE as instructorSelf.service.js's getMyStats ratingAgg —
// duplicated here (not imported) because that file is Dashboard-specific
// (see its own header comment) and this is a different page's KPI card.
async function getMyReviewStats(instructorId) {
  await assertIsInstructor(instructorId);

  const [ratingAgg, totalReviews] = await Promise.all([
    safe(
      () => prisma.instructorReview.aggregate({
        where: { instructorId, status: "APPROVED" },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      { _avg: { rating: null }, _count: { _all: 0 } },
    ),
    safe(() => prisma.instructorReview.count({ where: { instructorId, status: { not: "REMOVED" } } }), 0),
  ]);

  return {
    avgRating: ratingAgg._count._all > 0
      ? { value: Math.round(ratingAgg._avg.rating * 10) / 10, available: true }
      : { value: null, available: false, reason: "No approved reviews yet." },
    totalReviews,
  };
}

module.exports = {
  listReviews,
  approveReview,
  removeReview,
  flagReview,
  listMyReviews,
  getMyReviewStats,
};
