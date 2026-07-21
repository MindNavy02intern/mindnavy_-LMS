const prisma = require("../config/prisma");

// ── Enrollments service (admin-side enrollment management) ──────────────────────
//
// Built on the EXISTING CourseEnrollment model — the same table that feeds the
// LM KPIs, trend chart, top-courses and course enrolledCount (one table, one
// owner — IMPACT_MAP B2). No schema change was needed.
//
// Decisions (documented in the contract):
//  - progress is learner-derived: admins can only PATCH status. Marking
//    COMPLETED stamps completedAt; leaving COMPLETED clears it.
//  - course.enrollmentLimit (Wizard Step 4) IS enforced on enroll — the count
//    and insert run inside one transaction so the limit can't be raced past.
//  - Unenroll (DELETE) does NOT revoke an issued Certificate — certificates
//    have their own revoke flow.

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[enrollments.service] query failed:", err.message);
    return fallback;
  }
}

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

function domainError(code) { return Object.assign(new Error(code), { code }); }

function paginate(page, limit) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 10));
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}
function buildPagination(total, page, limit) {
  return { total, page, limit, pages: Math.ceil(total / limit) || 1 };
}

const ENROLLMENT_SELECT = {
  id: true, courseId: true, userId: true,
  progress: true, status: true, completedAt: true,
  createdAt: true, updatedAt: true,
  user: { select: { fullName: true, email: true, avatar: true } },
  course: { select: { title: true } },
};

function mapEnrollment(e) {
  return {
    id:          e.id,
    courseId:    e.courseId,
    courseTitle: e.course?.title ?? null,
    userId:      e.userId,
    userName:    e.user?.fullName ?? null,
    userEmail:   e.user?.email ?? null,
    userAvatar:  e.user?.avatar ?? null,
    progress:    e.progress,
    status:      e.status,
    enrolledAt:  iso(e.createdAt),
    completedAt: iso(e.completedAt),
    updatedAt:   iso(e.updatedAt),
  };
}

// Best-effort audit — never breaks the primary write.
async function auditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: adminId ?? null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

async function getEnrollmentOrThrow(id) {
  const e = await prisma.courseEnrollment.findUnique({ where: { id }, select: { id: true, courseId: true, userId: true, status: true, completedAt: true } });
  if (!e) throw domainError("ENROLLMENT_NOT_FOUND");
  return e;
}

// ── List (filterable + paginated + status counts for the filter chips) ──────────

async function listEnrollments({ courseId, userId, status, search, page, limit } = {}) {
  // search matches the learner (name/email) or the course title.
  const baseWhere = {
    ...(courseId ? { courseId } : {}),
    ...(userId ? { userId } : {}),
    ...(search
      ? {
          OR: [
            { user: { fullName: { contains: search, mode: "insensitive" } } },
            { user: { email: { contains: search, mode: "insensitive" } } },
            { course: { title: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const where = { ...baseWhere, ...(status ? { status } : {}) };

  const { skip, take, page: p, limit: l } = paginate(page, limit);

  const [total, rows, statusGroups] = await Promise.all([
    safe(() => prisma.courseEnrollment.count({ where }), 0),
    safe(() => prisma.courseEnrollment.findMany({
      where, skip, take, orderBy: { createdAt: "desc" }, select: ENROLLMENT_SELECT,
    }), []),
    // Chips share every filter EXCEPT status (same pattern as the courses tab).
    safe(() => prisma.courseEnrollment.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } }), []),
  ]);

  const statusCounts = { All: 0, NOT_STARTED: 0, IN_PROGRESS: 0, COMPLETED: 0, OVERDUE: 0 };
  for (const g of statusGroups) {
    statusCounts[g.status] = g._count._all;
    statusCounts.All += g._count._all;
  }

  return {
    enrollments: rows.map(mapEnrollment),
    pagination: buildPagination(total, p, l),
    statusCounts,
  };
}

// ── Enroll ──────────────────────────────────────────────────────────────────────

async function createEnrollment({ courseId, userId }, adminId) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { id: true, status: true, enrollmentLimit: true },
  });
  if (!course) throw domainError("COURSE_NOT_FOUND");
  if (course.status === "ARCHIVED") throw domainError("COURSE_ARCHIVED");

  const user = await prisma.appUser.findUnique({ where: { id: userId }, select: { id: true, status: true } });
  if (!user || user.status === "ARCHIVED") throw domainError("USER_NOT_FOUND");

  // Fast, friendly duplicate check up front; the DB unique constraint (caught as
  // P2002 below) stays the real guarantee under concurrency.
  const existing = await prisma.courseEnrollment.findUnique({
    where: { courseId_userId: { courseId, userId } },
    select: { id: true },
  });
  if (existing) throw domainError("ALREADY_ENROLLED");

  let enrollment;
  try {
    // Limit check + insert in ONE transaction so parallel enrolls can't sail
    // past enrollmentLimit between the count and the create.
    enrollment = await prisma.$transaction(async (tx) => {
      if (course.enrollmentLimit != null) {
        const count = await tx.courseEnrollment.count({ where: { courseId } });
        if (count >= course.enrollmentLimit) throw domainError("COURSE_FULL");
      }
      return tx.courseEnrollment.create({
        data: { courseId, userId },
        select: ENROLLMENT_SELECT,
      });
    });
  } catch (err) {
    if (err.code === "P2002") throw domainError("ALREADY_ENROLLED");
    throw err;
  }

  await auditLog(adminId, "ENROLLMENT_CREATED", { enrollmentId: enrollment.id, courseId, userId });
  return mapEnrollment(enrollment);
}

// ── Status update (the only admin-writable field) ───────────────────────────────

async function updateEnrollment(id, { status }, adminId) {
  const current = await getEnrollmentOrThrow(id);

  // completedAt follows status: stamped on COMPLETED (kept if already set),
  // cleared when leaving COMPLETED. progress is never touched here.
  const completedAt = status === "COMPLETED" ? (current.completedAt ?? new Date()) : null;

  const enrollment = await prisma.courseEnrollment.update({
    where: { id },
    data: { status, completedAt },
    select: ENROLLMENT_SELECT,
  });

  await auditLog(adminId, "ENROLLMENT_STATUS_UPDATED", {
    enrollmentId: id, from: current.status, to: status,
  });
  return mapEnrollment(enrollment);
}

// ── Unenroll ────────────────────────────────────────────────────────────────────

async function deleteEnrollment(id, adminId) {
  const current = await getEnrollmentOrThrow(id);
  await prisma.courseEnrollment.delete({ where: { id } });
  await auditLog(adminId, "ENROLLMENT_DELETED", {
    enrollmentId: id, courseId: current.courseId, userId: current.userId,
  });
  return { id };
}

module.exports = {
  listEnrollments,
  createEnrollment,
  updateEnrollment,
  deleteEnrollment,
};
