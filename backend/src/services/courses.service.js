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

// "Rejected" is a VIEW over Draft, not a status — CourseStatus has no REJECTED
// member. rejectCourse() returns the course to DRAFT and stores the reason, so a
// rejected course is exactly `DRAFT AND rejectionReason IS NOT NULL`.
//
// The two Prisma fragments below keep Draft and Rejected a clean partition of the
// DRAFT rows: a rejected course must appear in the Rejected tab and NOT in Draft,
// or the sub-tab counts would double-count it against the total.
const REJECTED_WHERE = { status: "DRAFT", rejectionReason: { not: null } };
const PLAIN_DRAFT_WHERE = { status: "DRAFT", rejectionReason: null };

const DEFAULT_CATEGORY = "Uncategorized";

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    // Observability only — message only (no full error / stack / meta / secrets).
    console.error("[courses.service] query failed:", err.message);
    return fallback;
  }
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
  // Approval state on every row: the Instructor Courses tab renders Draft /
  // Pending / Published / Archived / Rejected from one list, and Rejected is only
  // distinguishable by rejectionReason. submittedAt is the truthful "waiting
  // since" for the Pending view (updatedAt is overwritten by any later edit).
  rejectionReason: true, submittedAt: true, reviewedAt: true,
};

const VISIBILITY_ENUM  = { Public: "PUBLIC", Private: "PRIVATE", Unlisted: "UNLISTED" };
const VISIBILITY_LABEL = { PUBLIC: "Public", PRIVATE: "Private", UNLISTED: "Unlisted" };

const FULL_SELECT = {
  ...ROW_SELECT,
  subtitle: true, description: true, language: true, tags: true,
  createdBy: true, createdAt: true,
  // Step 4 settings + approval state + category link — the course detail is the
  // single read the wizard prefills every step from.
  isFree: true, price: true, currency: true, enrollmentLimit: true,
  visibility: true, certificateEnabled: true, dripContentEnabled: true,
  accessRules: true, seoTitle: true, seoDescription: true,
  categoryId: true,
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
    // Stays "Draft" for a rejected course, because that is what it is — it is
    // editable and resubmittable again. `isRejected` is the derived flag the
    // Rejected tab badges on; overloading `status` with a value the enum does
    // not have would make this row disagree with the database.
    status:       STATUS_LABEL[c.status] ?? c.status,
    isRejected:   c.status === "DRAFT" && Boolean(c.rejectionReason),
    rejectionReason: c.rejectionReason ?? null,
    submittedAt:  iso(c.submittedAt),
    reviewedAt:   iso(c.reviewedAt),
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
    categoryId:  c.categoryId  ?? null,
    settings: {
      isFree:             c.isFree ?? true,
      price:              c.price ?? null,
      currency:           c.currency ?? null,
      enrollmentLimit:    c.enrollmentLimit ?? null,
      visibility:         VISIBILITY_LABEL[c.visibility] ?? "Public",
      certificateEnabled: c.certificateEnabled ?? false,
      dripContentEnabled: c.dripContentEnabled ?? false,
      accessRules:        c.accessRules ?? null,
      seoTitle:           c.seoTitle ?? null,
      seoDescription:     c.seoDescription ?? null,
    },
    // rejectionReason / submittedAt / reviewedAt / isRejected come from mapRow —
    // one definition, so the list row and the detail can never disagree.
  };
}

// Resolve the category link for create/update. Explicit `categoryId: null` is an
// unlink and always wins (the string stays as display text). A given categoryId
// must exist — the legacy `category` string is synced from its name so both
// representations stay consistent during the migration. A bare string is linked
// to an existing Category by case-insensitive name when one matches.
async function resolveCategoryLink(patch) {
  if (patch.categoryId === null) return patch;
  if (patch.categoryId !== undefined) {
    const cat = await prisma.category.findUnique({ where: { id: patch.categoryId }, select: { id: true, name: true } });
    if (!cat) throw Object.assign(new Error("CATEGORY_NOT_FOUND"), { code: "CATEGORY_NOT_FOUND" });
    patch.category = cat.name;
  } else if (typeof patch.category === "string" && patch.category !== DEFAULT_CATEGORY) {
    const cat = await safe(
      () => prisma.category.findFirst({ where: { name: { equals: patch.category, mode: "insensitive" } }, select: { id: true } }),
      null,
    );
    if (cat) patch.categoryId = cat.id;
  }
  return patch;
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
  // Archived tab. A specific status filters to exactly that status, except for
  // the two halves of DRAFT (see REJECTED_WHERE): Rejected selects the drafts
  // carrying a rejection reason, Draft selects the ones that do not.
  if (status === "All")           where.status = { not: "ARCHIVED" };
  else if (status === "Rejected") Object.assign(where, REJECTED_WHERE);
  else if (status === "Draft")    Object.assign(where, PLAIN_DRAFT_WHERE);
  else if (status)                where.status = STATUS_ENUM[status];

  const { skip, take, page: p, limit: l } = paginate(page, limit);

  const [total, rows, statusGroups, rejected] = await Promise.all([
    safe(() => prisma.course.count({ where }), 0),
    safe(() => prisma.course.findMany({ where, skip, take, orderBy: { updatedAt: "desc" }, select: ROW_SELECT }), []),
    safe(() => prisma.course.groupBy({ by: ["status"], where: baseWhere, _count: { _all: true } }), []),
    // groupBy cannot express "DRAFT with a reason", so the rejected slice needs
    // its own count. Same baseWhere as the group, so every filter applies to it.
    safe(() => prisma.course.count({ where: { ...baseWhere, ...REJECTED_WHERE } }), 0),
  ]);

  // Enrolled count per course for just this page (one grouped query — no N+1).
  const ids = rows.map((r) => r.id);
  const agg = ids.length
    ? await safe(() => prisma.courseEnrollment.groupBy({ by: ["courseId"], where: { courseId: { in: ids } }, _count: { _all: true } }), [])
    : [];
  const countById = new Map(agg.map((a) => [a.courseId, a._count._all]));

  const byStatus  = Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all]));
  const allDrafts = byStatus.DRAFT     ?? 0;
  const pending   = byStatus.PENDING   ?? 0;
  const published = byStatus.PUBLISHED ?? 0;
  const archived  = byStatus.ARCHIVED  ?? 0;
  // Rejected courses ARE drafts in the database, so they must come out of the
  // draft count — otherwise draft + rejected exceeds the number of rows the two
  // tabs actually list between them. Clamped at 0 in case the two queries land
  // either side of a concurrent rejection.
  const draft = Math.max(0, allDrafts - rejected);
  const statusCounts = {
    all: allDrafts + pending + published, // excludes Archived — matches the "All" tab list
    draft,
    pending,
    published,
    archived,
    rejected,
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

  const patch = await resolveCategoryLink({ categoryId: data.categoryId, category: data.category || DEFAULT_CATEGORY });

  const course = await prisma.course.create({
    data: {
      title:        data.title,
      subtitle:     data.subtitle,
      description:  data.description,
      category:     patch.category,                     // column is non-null
      categoryId:   patch.categoryId ?? null,
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

  let patch = { ...data };
  if (patch.category === null) patch.category = DEFAULT_CATEGORY; // keep column non-null
  if (patch.level !== undefined) patch.level = LEVEL_ENUM[patch.level];
  // `status` never reaches here — the validator rejects it (transitions go
  // through submit/approve/reject/archive only).
  if (patch.categoryId !== undefined || patch.category !== undefined) {
    patch = await resolveCategoryLink(patch);
  }

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

async function restoreCourse(id, adminId) {
  const current = await prisma.course.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!current) throw Object.assign(new Error("COURSE_NOT_FOUND"), { code: "COURSE_NOT_FOUND" });
  if (current.status !== "ARCHIVED") {
    throw Object.assign(new Error("ONLY_ARCHIVED_RESTORABLE"), {
      code: "ONLY_ARCHIVED_RESTORABLE",
      status: STATUS_LABEL[current.status] ?? current.status,
    });
  }
  const course = await prisma.course.update({
    where: { id },
    data: { status: "DRAFT" },
    select: { id: true, status: true },
  });
  await courseAuditLog(adminId, "COURSE_RESTORED", { courseId: id });
  return { id: course.id, status: STATUS_LABEL[course.status] ?? course.status };
}

module.exports = { listCourses, getCourse, createCourse, updateCourse, archiveCourse, restoreCourse };
