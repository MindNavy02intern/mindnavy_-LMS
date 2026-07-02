const prisma = require("../config/prisma");

// ── Learning Management Overview service ───────────────────────────────────────
//
// Every query is wrapped in `safe()` so a missing table (before `prisma db push`)
// or a transient DB error degrades to empty/zero data instead of a 500 — the same
// defensive pattern used by dashboard.service. All aggregation is done with
// count/groupBy/aggregate (never per-row loops) and independent queries run in
// parallel, so each endpoint is a small, bounded number of round-trips.

const LEVEL_LABEL  = { BEGINNER: "Beginner", INTERMEDIATE: "Intermediate", ADVANCED: "Advanced" };
const STATUS_LABEL = { PUBLISHED: "Published", DRAFT: "Draft", PENDING: "Pending", ARCHIVED: "Archived" };
const SERIES_BY_STATUS = {
  COMPLETED:   "completed",
  IN_PROGRESS: "inProgress",
  NOT_STARTED: "notStarted",
  OVERDUE:     "overdue",
};

// Run a query; on ANY error (incl. table-not-yet-created) return the fallback.
async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    return fallback;
  }
}

function iso(d) { return d instanceof Date ? d.toISOString() : String(d); }
function ymd(d) { return (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10); }

function monthBounds(now = new Date()) {
  return {
    thisMonth: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(),     1)),
    prevMonth: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
  };
}

// % change vs last month. Returns null when there is no prior-month baseline,
// so the UI shows "—" instead of a fake arrow (per the API contract).
function growthPct(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// { value, growth } for a count, where growth = this-month vs last-month by `dateField`.
async function countWithGrowth(model, where = {}, dateField = "createdAt") {
  const { thisMonth, prevMonth } = monthBounds();
  const [value, current, previous] = await Promise.all([
    safe(() => model.count({ where }), 0),
    safe(() => model.count({ where: { ...where, [dateField]: { gte: thisMonth } } }), 0),
    safe(() => model.count({ where: { ...where, [dateField]: { gte: prevMonth, lt: thisMonth } } }), 0),
  ]);
  return { value, growth: growthPct(current, previous) };
}

async function avgCompletionRate() {
  const { thisMonth, prevMonth } = monthBounds();
  const avg = (where) =>
    safe(() => prisma.courseEnrollment.aggregate({ _avg: { progress: true }, where }), { _avg: { progress: null } });
  const [all, cur, prev] = await Promise.all([
    avg(undefined),
    avg({ createdAt: { gte: thisMonth } }),
    avg({ createdAt: { gte: prevMonth, lt: thisMonth } }),
  ]);
  const round = (v) => Math.round(v ?? 0);
  return {
    value:  round(all._avg.progress),
    growth: growthPct(round(cur._avg.progress), round(prev._avg.progress)),
  };
}

// ── 1. KPI stats ───────────────────────────────────────────────────────────────

async function getStats() {
  const [
    totalCourses,
    activeCourses,
    totalEnrollments,
    coursesCompleted,
    certificatesIssued,
    avgRate,
  ] = await Promise.all([
    countWithGrowth(prisma.course, {}),
    countWithGrowth(prisma.course, { status: "PUBLISHED" }),
    countWithGrowth(prisma.courseEnrollment, {}),
    countWithGrowth(prisma.courseEnrollment, { status: "COMPLETED" }, "completedAt"),
    countWithGrowth(prisma.certificate, {}, "issuedAt"),
    avgCompletionRate(),
  ]);

  return {
    totalCourses,
    activeCourses,
    totalEnrollments,
    coursesCompleted,
    avgCompletionRate: avgRate,
    certificatesIssued,
  };
}

// ── 2. Category distribution ─────────────────────────────────────────────────────

async function getDistribution() {
  const groups = await safe(
    () => prisma.course.groupBy({ by: ["category"], _count: { _all: true } }),
    [],
  );

  const total = groups.reduce((sum, g) => sum + g._count._all, 0);
  const items = groups
    .filter((g) => g.category)
    .map((g) => ({
      category:   g.category,
      count:      g._count._all,
      percentage: total > 0 ? Math.round((g._count._all / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return { total, items };
}

// ── 3. Progress over time ────────────────────────────────────────────────────────

function buildDayBuckets(start, end) {
  const out = [];
  const cur  = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(),   end.getUTCMonth(),   end.getUTCDate()));
  while (cur <= last) {
    out.push(ymd(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function buildMonthBuckets(start, end) {
  const out = [];
  const cur  = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const last = new Date(Date.UTC(end.getUTCFullYear(),   end.getUTCMonth(),   1));
  while (cur <= last) {
    out.push(ymd(cur));
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out;
}

// Enrollments bucketed by their createdAt and split into the 4 status series.
// Empty buckets are returned as zeros so the chart axis always renders.
async function getProgress(range) {
  const now = new Date();
  let start;
  let granularity;
  let bucketKeys;

  if (range === "week") {
    start = new Date(now.getTime() - 6 * 86400000);
    granularity = "day";
    bucketKeys = buildDayBuckets(start, now);
  } else if (range === "year") {
    start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
    granularity = "month";
    bucketKeys = buildMonthBuckets(start, now);
  } else {
    start = new Date(now.getTime() - 29 * 86400000);
    granularity = "day";
    bucketKeys = buildDayBuckets(start, now);
  }

  // date_trunc + status are bound parameters → safe, parameterized SQL.
  const rows = await safe(
    () => prisma.$queryRaw`
      SELECT date_trunc(${granularity}, "createdAt") AS bucket, "status" AS status, COUNT(*)::int AS count
      FROM "course_enrollments"
      WHERE "createdAt" >= ${start}
      GROUP BY bucket, "status"
    `,
    [],
  );

  const map = new Map(
    bucketKeys.map((k) => [k, { date: k, completed: 0, inProgress: 0, notStarted: 0, overdue: 0 }]),
  );

  for (const row of rows) {
    const point  = map.get(ymd(row.bucket));
    const series = SERIES_BY_STATUS[row.status];
    if (point && series) point[series] += Number(row.count);
  }

  return Array.from(map.values());
}

// ── 4. Top performing courses ────────────────────────────────────────────────────

async function getTopCourses(limit) {
  // One grouped query gives avg progress + enrolled count per course; we then
  // batch-load the course metadata for just the top `limit` ids (no N+1).
  const grouped = await safe(
    () => prisma.courseEnrollment.groupBy({
      by: ["courseId"],
      _avg: { progress: true },
      _count: { _all: true },
    }),
    [],
  );

  grouped.sort((a, b) => (b._avg.progress ?? 0) - (a._avg.progress ?? 0));
  const top = grouped.slice(0, limit);
  if (top.length === 0) return [];

  const ids = top.map((g) => g.courseId);
  const courses = await safe(
    () => prisma.course.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, thumbnail: true, instructor: { select: { fullName: true } } },
    }),
    [],
  );
  const byId = new Map(courses.map((c) => [c.id, c]));

  return top
    .map((g) => {
      const c = byId.get(g.courseId);
      if (!c) return null;
      return {
        id:             c.id,
        title:          c.title,
        instructor:     c.instructor?.fullName ?? "—",
        completionRate: Math.round(g._avg.progress ?? 0),
        enrolledCount:  g._count._all,
        thumbnail:      c.thumbnail ?? null,
      };
    })
    .filter(Boolean);
}

// ── 5. Content statistics ────────────────────────────────────────────────────────

async function getContentStats() {
  const groups = await safe(
    () => prisma.courseContent.groupBy({ by: ["type"], _count: { _all: true } }),
    [],
  );

  const by = Object.fromEntries(groups.map((g) => [g.type, g._count._all]));
  const total = groups.reduce((sum, g) => sum + g._count._all, 0);

  return {
    totalContentItems: total,
    videoLessons:      by.VIDEO    ?? 0,
    documents:         by.DOCUMENT ?? 0,
    pdfFiles:          by.PDF      ?? 0,
    quizzes:           by.QUIZ     ?? 0,
    scormPackages:     by.SCORM    ?? 0,
  };
}

// ── 6. Courses table (paginated + filtered) ──────────────────────────────────────

async function getCourses({ page, limit, category, instructor }) {
  const where = {};
  if (category)   where.category     = category;
  if (instructor) where.instructorId = instructor;

  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    safe(() => prisma.course.count({ where }), 0),
    safe(() => prisma.course.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, title: true, category: true, level: true, status: true, thumbnail: true,
        instructorId: true,
        instructor: { select: { fullName: true } },
      },
    }), []),
  ]);

  // Enrolled count + avg progress for just this page's courses (one grouped query).
  const ids = rows.map((r) => r.id);
  const agg = ids.length
    ? await safe(() => prisma.courseEnrollment.groupBy({
        by: ["courseId"],
        where: { courseId: { in: ids } },
        _avg: { progress: true },
        _count: { _all: true },
      }), [])
    : [];
  const aggById = new Map(agg.map((a) => [a.courseId, { count: a._count._all, avg: Math.round(a._avg.progress ?? 0) }]));

  const courses = rows.map((c) => {
    const a = aggById.get(c.id) ?? { count: 0, avg: 0 };
    return {
      id:            c.id,
      title:         c.title,
      instructor:    c.instructor?.fullName ?? "—",
      instructorId:  c.instructorId ?? null,
      category:      c.category,
      level:         LEVEL_LABEL[c.level]   ?? c.level,
      enrolledCount: a.count,
      progress:      a.avg,
      status:        STATUS_LABEL[c.status] ?? c.status,
      thumbnail:     c.thumbnail ?? null,
    };
  });

  return {
    courses,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
  };
}

// ── 7. Recent activities ─────────────────────────────────────────────────────────

// Derived from recent rows across the LM tables (no separate activity table):
// new courses, issued certificates, uploaded content, completed live sessions.
async function getActivities(limit) {
  const [courses, certs, contents, sessions] = await Promise.all([
    safe(() => prisma.course.findMany({
      take: limit, orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true, instructor: { select: { fullName: true } } },
    }), []),
    safe(() => prisma.certificate.findMany({
      take: limit, orderBy: { issuedAt: "desc" },
      select: { id: true, issuedAt: true, course: { select: { title: true } }, user: { select: { fullName: true } } },
    }), []),
    safe(() => prisma.courseContent.findMany({
      take: limit, orderBy: { createdAt: "desc" },
      select: { id: true, title: true, createdAt: true, course: { select: { title: true } } },
    }), []),
    safe(() => prisma.liveSession.findMany({
      take: limit, where: { status: "ENDED" }, orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, updatedAt: true },
    }), []),
  ]);

  const items = [
    ...courses.map((c) => ({
      id: `course_${c.id}`, type: "course_created",
      title: `New course "${c.title}" was created`,
      actorName: c.instructor?.fullName ?? "System", createdAt: iso(c.createdAt),
    })),
    ...certs.map((c) => ({
      id: `cert_${c.id}`, type: "certificate_issued",
      title: `Certificate issued for "${c.course?.title ?? "a course"}"`,
      actorName: c.user?.fullName ?? "System", createdAt: iso(c.issuedAt),
    })),
    ...contents.map((c) => ({
      id: `content_${c.id}`, type: "content_uploaded",
      title: `Content "${c.title}" uploaded to "${c.course?.title ?? "a course"}"`,
      actorName: "System", createdAt: iso(c.createdAt),
    })),
    ...sessions.map((s) => ({
      id: `session_${s.id}`, type: "session_completed",
      title: `Live session "${s.title}" completed`,
      actorName: "System", createdAt: iso(s.updatedAt),
    })),
  ];

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return items.slice(0, limit);
}

// ── 8. Live sessions ─────────────────────────────────────────────────────────────

async function getLiveSessions(status) {
  const sessions = await safe(
    () => prisma.liveSession.findMany({
      where: { status: status.toUpperCase() },
      orderBy: { startTime: "asc" },
      take: 50,
      select: {
        id: true, title: true, startTime: true, status: true,
        course: {
          select: {
            title: true,
            instructor: { select: { fullName: true } },
            _count: { select: { enrollments: true } },
          },
        },
      },
    }),
    [],
  );

  return sessions.map((s) => ({
    id:            s.id,
    title:         s.title,
    instructor:    s.course?.instructor?.fullName ?? null,
    startTime:     iso(s.startTime),
    status:        String(s.status).toLowerCase(),
    enrolledCount: s.course?._count.enrollments ?? 0,
    relatedCourse: s.course?.title ?? null,
  }));
}

// ── 9. Filter options (feeds the courses table dropdowns) ────────────────────────

async function getFilterOptions() {
  const [categoryGroups, instructors] = await Promise.all([
    safe(() => prisma.course.groupBy({ by: ["category"] }), []),
    safe(() => prisma.appUser.findMany({
      where: { role: "INSTRUCTOR", status: { not: "ARCHIVED" } },
      select: { id: true, fullName: true },
      orderBy: { fullName: "asc" },
      take: 200,
    }), []),
  ]);

  return {
    categories:  categoryGroups.map((g) => g.category).filter(Boolean).sort(),
    instructors: instructors.map((u) => ({ id: u.id, name: u.fullName })),
  };
}

module.exports = {
  getStats,
  getDistribution,
  getProgress,
  getTopCourses,
  getContentStats,
  getCourses,
  getActivities,
  getLiveSessions,
  getFilterOptions,
};
