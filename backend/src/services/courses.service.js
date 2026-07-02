const prisma = require("../config/prisma");

// ── Courses tab service (CRUD over the shared `courses` table) ──────────────────
//
// Same table the LM Overview reads. Reads use safe() fallbacks (empty data, no 500
// before `prisma db push`). Writes validate + verify foreign keys first, so a bad
// request is a clean 400/404 — never an orphan row or a 500. Deletes are soft
// (status → Archived); rows are never physically removed.

const LEVEL_ENUM   = { Beginner: "BEGINNER", Intermediate: "INTERMEDIATE", Advanced: "ADVANCED" };
const STATUS_ENUM  = { Draft: "DRAFT", Pending: "PENDING", Published: "PUBLISHED", Archived: "ARCHIVED" };
const LEVEL_LABEL  = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" };
const STATUS_LABEL = { DRAFT: "Draft", PENDING: "Pending", PUBLISHED: "Published", ARCHIVED: "Archived" };

const DEFAULT_CATEGORY = "Uncategorized";

async function safe(fn, fallback) {
  try { return await fn(); } catch (err) { return fallback; }
}

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

function paginate(page, limit) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 10));
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}
function buildPagination(total, page, limit) {
  return { total, page, limit, pages: Math.ceil(total / limit) || 1 };
}

// Verify the instructor exists AND is actually an INSTRUCTOR, so the controller
// can return a clean 400/404 instead of a raw Prisma FK failure or a bad row.
async function assertInstructorExists(instructorId) {
  const user = await prisma.appUser.findUnique({
    where: { id: instructorId },
    select: { id: true, role: true },
  });
  if (!user) throw Object.assign(new Error("INSTRUCTOR_NOT_FOUND"), { code: "INSTRUCTOR_NOT_FOUND" });
  if (user.role !== "INSTRUCTOR") throw Object.assign(new Error("NOT_AN_INSTRUCTOR"), { code: "NOT_AN_INSTRUCTOR" });
}

// Best-effort audit — never breaks the primary write (mirrors accessPolicies.service).
async function courseAuditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: adminId ?? null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

const ROW_SELECT = {
  id: true, title: true, category: true, level: true, status: true,
  thumbnail: true, updatedAt: true, instructorId: true,
  instructor: { select: { fullName: true } },
};

const FULL_SELECT = {
  ...ROW_SELECT,
  subtitle: true, description: true, language: true, tags: true,
  createdBy: true, createdAt: true,
};

function mapRow(c, enrolledCount = 0) {
  return {
    id:           c.id,
    title:        c.title,
    instructor:   c.instructor?.fullName ?? "—",
    instructorId: c.instructorId ?? null,
    category:     c.category ?? null,
    level:        LEVEL_LABEL[c.level]   ?? c.level,
    enrolledCount,
    status:       STATUS_LABEL[c.status] ?? c.status,
    thumbnail:    c.thumbnail ?? null,
    updatedAt:    iso(c.updatedAt),
  };
}

function mapFull(c, enrolledCount = 0) {
  return {
    ...mapRow(c, enrolledCount),
    subtitle:    c.subtitle    ?? null,
    description: c.description ?? null,
    language:    c.language    ?? null,
    tags:        c.tags        ?? [],
    createdBy:   c.createdBy   ?? null,
    createdAt:   iso(c.createdAt),
  };
}

// ── List + status counts + pagination + filters ─────────────────────────────────

async function listCourses({ page, limit, status, category, instructor, search }) {
  // Filters other than `status` also constrain the tab counts, so they share a base.
  const baseWhere = {};
  if (category)   baseWhere.category     = category;
  if (instructor) baseWhere.instructorId = instructor;
  if (search)     baseWhere.title        = { contains: search, mode: "insensitive" };

  const where = { ...baseWhere };
  // "All" shows every status EXCEPT Archived — archived courses live only in the
  // Archived tab. A specific status filters to exactly that status.
  if (status === "All") where.status = { not: "ARCHIVED" };
  else if (status)      where.status = STATUS_ENUM[status];

  const { skip, take, page: p, limit: l } = paginate(page, limit);

  const [total, rows, statusGroups] = await Promise.all([
    safe(() => prisma.course.count({ where }), 0),
    safe(() => prisma.course.findMany({ where, skip, take, orderBy: { updatedAt: "desc" }, select: ROW_SELECT }), []),
    safe(() => prisma.course.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } }), []),
  ]);

  // Enrolled count per course for just this page (one grouped query — no N+1).
  const ids = rows.map((r) => r.id);
  const agg = ids.length
    ? await safe(() => prisma.courseEnrollment.groupBy({ by: ["courseId"], where: { courseId: { in: ids } }, _count: { _all: true } }), [])
    : [];
  const countById = new Map(agg.map((a) => [a.courseId, a._count._all]));

  const byStatus  = Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all]));
  const draft     = byStatus.DRAFT     ?? 0;
  const pending   = byStatus.PENDING   ?? 0;
  const published = byStatus.PUBLISHED ?? 0;
  const archived  = byStatus.ARCHIVED  ?? 0;
  const statusCounts = {
    all: draft + pending + published, // excludes Archived — matches the "All" tab list
    draft,
    pending,
    published,
    archived,
  };

  return {
    courses: rows.map((c) => mapRow(c, countById.get(c.id) ?? 0)),
    pagination: buildPagination(total, p, l),
    statusCounts,
  };
}

async function getCourse(id) {
  const c = await safe(() => prisma.course.findUnique({ where: { id }, select: FULL_SELECT }), null);
  if (!c) return null;
  const count = await safe(() => prisma.courseEnrollment.count({ where: { courseId: id } }), 0);
  return mapFull(c, count);
}

// ── Create / Update / Archive ────────────────────────────────────────────────────

async function createCourse(data, adminId) {
  await assertInstructorExists(data.instructorId);

  const course = await prisma.course.create({
    data: {
      title:        data.title,
      subtitle:     data.subtitle,
      description:  data.description,
      category:     data.category || DEFAULT_CATEGORY, // column is non-null
      language:     data.language,
      level:        LEVEL_ENUM[data.level] ?? "BEGINNER",
      status:       "DRAFT",                            // always Draft on create
      thumbnail:    data.thumbnail,
      tags:         data.tags ?? [],
      instructorId: data.instructorId,
      createdBy:    adminId ?? null,
    },
    select: FULL_SELECT,
  });

  await courseAuditLog(adminId, "COURSE_CREATED", { courseId: course.id, title: course.title });
  return mapFull(course, 0);
}

async function updateCourse(id, data, adminId) {
  if (data.instructorId !== undefined) await assertInstructorExists(data.instructorId);

  const patch = { ...data };
  if (patch.category === null)      patch.category = DEFAULT_CATEGORY; // keep column non-null
  if (patch.level    !== undefined) patch.level    = LEVEL_ENUM[patch.level];
  if (patch.status   !== undefined) patch.status   = STATUS_ENUM[patch.status];

  const course = await prisma.course.update({ where: { id }, data: patch, select: FULL_SELECT });
  await courseAuditLog(adminId, "COURSE_UPDATED", { courseId: id, fields: Object.keys(data) });

  const count = await safe(() => prisma.courseEnrollment.count({ where: { courseId: id } }), 0);
  return mapFull(course, count);
}

async function archiveCourse(id, adminId) {
  // Soft delete — never physically remove the row.
  const course = await prisma.course.update({
    where: { id },
    data: { status: "ARCHIVED" },
    select: { id: true, status: true },
  });
  await courseAuditLog(adminId, "COURSE_ARCHIVED", { courseId: id });
  return { id: course.id, status: STATUS_LABEL[course.status] ?? course.status };
}

module.exports = { listCourses, getCourse, createCourse, updateCourse, archiveCourse };
