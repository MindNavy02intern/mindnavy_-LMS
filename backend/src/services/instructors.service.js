const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const usersService = require("./users.service");
const { TAB_STATUS_SCOPE } = require("../validators/instructors.validator");

// ── Instructors service ─────────────────────────────────────────────────────────
//
// Reads are driven by AppUser (role = INSTRUCTOR) with the profile LEFT-JOINED,
// never by InstructorProfile: every instructor that existed before this module
// has no profile row and must still appear here, or this table and the LM
// instructor dropdown would disagree about who exists.
//
// OWNERSHIP (IMPACT_MAP B2 — one field, one owner):
//   • status / verificationState are written ONLY by users.service. verify,
//     suspend and reactivate delegate to it, which is also why they emit the
//     USER_* audit actions rather than INSTRUCTOR_* ones — one action, one
//     audit row, so the activity feed doesn't show the same event twice.
//   • Course / LiveSession counts are computed live from those tables (B1).
//   • Rating and revenue have NO source table in this system (no Review, no
//     Payment/Transaction model) — they are returned as null with an explicit
//     `available: false`, never as 0. A 0 renders as a confident "$0.00".
//
// Conventions match liveSessions.service: reads use safe() so the tab renders
// empty instead of 500ing before `prisma db push`; writes verify references
// first so the controller can answer a clean 400/404/409.

const { STATUS_MAP, VERIFICATION_MAP } = usersService;

// Bounded candidate set for the in-memory "students" ranking (see listInstructors).
const RANKING_CEILING = 1000;

// Detail-view bounds: newest N per activity source before merging, and the
// window of the performance chart.
const ACTIVITY_LIMIT = 10;
const CHART_MONTHS   = 12;

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[instructors.service] query failed:", err.message);
    return fallback;
  }
}

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

function domainError(code) { return Object.assign(new Error(code), { code }); }

// Best-effort audit — never breaks the primary write (mirrors liveSessions.service).
async function auditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: adminId ?? null,
        targetUserId: typeof details?.userId === "string" ? details.userId : null,
        action,
        details: details ?? null,
      },
    });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

const INSTRUCTOR_SELECT = {
  id: true,
  fullName: true,
  email: true,
  avatar: true,
  phone: true,
  status: true,
  verificationState: true,
  skills: true,
  department: true,
  branch: true,
  lastActivityAt: true,
  suspendedAt: true,
  createdAt: true,
  updatedAt: true,
  instructorProfile: {
    select: {
      specialization: true,
      headline: true,
      bio: true,
      yearsExperience: true,
      websiteUrl: true,
      linkedinUrl: true,
      revenueShareBps: true,
      verifiedAt: true,
      verifiedById: true,
    },
  },
};

// `id` IS the AppUser id — the same value stored in Course.instructorId and
// LiveSession.instructorId, so the frontend can cross-link with one identifier.
// status / verificationState use the Users module's lowercase mapping (imported,
// not re-declared) so the same row never reads differently in two tables.
function mapInstructor(u, agg = {}) {
  const p = u.instructorProfile ?? null;
  return {
    id:                u.id,
    userId:            u.id,
    fullName:          u.fullName,
    email:             u.email,
    avatar:            u.avatar ?? null,
    phone:             u.phone ?? null,
    status:            STATUS_MAP[u.status] ?? String(u.status).toLowerCase(),
    verificationState: VERIFICATION_MAP[u.verificationState] ?? String(u.verificationState).toLowerCase(),
    skills:            u.skills ?? [],
    department:        u.department ?? null,
    branch:            u.branch ?? null,

    specialization:  p?.specialization  ?? null,
    headline:        p?.headline        ?? null,
    bio:             p?.bio             ?? null,
    yearsExperience: p?.yearsExperience ?? null,
    websiteUrl:      p?.websiteUrl      ?? null,
    linkedinUrl:     p?.linkedinUrl     ?? null,
    revenueShareBps: p?.revenueShareBps ?? null,
    hasProfile:      Boolean(p),

    coursesCount:          agg.coursesCount          ?? 0,
    publishedCoursesCount: agg.publishedCoursesCount ?? 0,
    studentsCount:         agg.studentsCount         ?? 0,

    // No Review table and no Payment/Transaction table exist in this system.
    // null + available:false, never 0 — see the ownership note at the top.
    rating:  null,
    revenue: null,

    verifiedAt:     iso(p?.verifiedAt),
    verifiedById:   p?.verifiedById ?? null,
    lastActivityAt: iso(u.lastActivityAt),
    suspendedAt:    iso(u.suspendedAt),
    createdAt:      iso(u.createdAt),
    updatedAt:      iso(u.updatedAt),
  };
}

// ── Aggregates (computed live — never stored, R3/B1) ────────────────────────────

// Course totals per instructor for one page of rows: a single grouped query
// instead of N per-row counts.
async function courseCountsFor(instructorIds) {
  if (instructorIds.length === 0) return new Map();
  const groups = await safe(
    () => prisma.course.groupBy({
      by: ["instructorId", "status"],
      where: { instructorId: { in: instructorIds } },
      _count: { _all: true },
    }),
    [],
  );
  const map = new Map();
  for (const g of groups) {
    const entry = map.get(g.instructorId) ?? { coursesCount: 0, publishedCoursesCount: 0 };
    // "Courses" excludes archived ones, matching the Courses tab's "All" view.
    if (g.status !== "ARCHIVED") entry.coursesCount += g._count._all;
    if (g.status === "PUBLISHED") entry.publishedCoursesCount += g._count._all;
    map.set(g.instructorId, entry);
  }
  return map;
}

// Distinct learners across an instructor's courses. Raw SQL because this is a
// COUNT(DISTINCT …) over a join, which Prisma's groupBy cannot express; the id
// list is passed as a bound parameter array (never interpolated).
async function studentCountsFor(instructorIds) {
  if (instructorIds.length === 0) return new Map();
  const rows = await safe(
    () => prisma.$queryRaw`
      SELECT c."instructorId" AS id, COUNT(DISTINCT e."userId")::int AS students
      FROM "courses" c
      JOIN "course_enrollments" e ON e."courseId" = c."id"
      WHERE c."instructorId" = ANY(${instructorIds}::text[])
      GROUP BY c."instructorId"`,
    [],
  );
  return new Map(rows.map((r) => [r.id, Number(r.students) || 0]));
}

// The ONE definition of "top instructor" in this module: the globally highest
// distinct-student counts. The `topInstructor` badge, the Top Instructors chart
// and the ?tab=top ordering all rank on this same metric, so a badge can never
// contradict the list it links to. Ranking happens in Postgres (not JS) and is
// capped by LIMIT, so it stays cheap as the table grows.
const TOP_INSTRUCTOR_LIMIT = 10;

async function getTopInstructorIds(limit = TOP_INSTRUCTOR_LIMIT) {
  const rows = await safe(
    () => prisma.$queryRaw`
      SELECT c."instructorId" AS id, COUNT(DISTINCT e."userId")::int AS students
      FROM "courses" c
      JOIN "course_enrollments" e ON e."courseId" = c."id"
      JOIN "app_users" u ON u."id" = c."instructorId"
      WHERE u."role" = 'INSTRUCTOR' AND u."status" <> 'ARCHIVED'
      GROUP BY c."instructorId"
      ORDER BY students DESC
      LIMIT ${limit}`,
    [],
  );
  return rows.map((r) => r.id);
}

// The ONE implementation of "how many instructor applications are waiting".
// Both the Pending tab badge (list) and the Pending Approval card (stats) call
// this, so the two numbers cannot drift (B4: pending items live in queryable
// states, not copies).
async function countPendingApplications() {
  return safe(
    () => prisma.instructorApplication.count({
      where: { status: { in: ["PENDING", "CHANGES_REQUESTED"] } },
    }),
    0,
  );
}

// ── Where-clause builders ───────────────────────────────────────────────────────

function buildWhere({ tab = "all", search, specialization, categoryId }) {
  const where = { role: "INSTRUCTOR", status: TAB_STATUS_SCOPE[tab] ?? TAB_STATUS_SCOPE.all };

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email:    { contains: search, mode: "insensitive" } },
    ];
  }
  if (specialization) {
    where.instructorProfile = { specialization: { equals: specialization, mode: "insensitive" } };
  }
  if (categoryId) {
    where.coursesInstructed = { some: { categoryId } };
  }
  return where;
}

const ORDER_BY = {
  recent:  { createdAt: "desc" },
  name:    { fullName: "asc" },
  courses: { coursesInstructed: { _count: "desc" } },
};

// ── Reads ───────────────────────────────────────────────────────────────────────

async function listInstructors(query) {
  const { page, limit, tab, sort, search, specialization, categoryId } = query;
  const where = buildWhere({ tab, search, specialization, categoryId });
  const skip = (page - 1) * limit;

  let total;
  let rows;

  if (sort === "students") {
    // Distinct-student ranking cannot be expressed as a Prisma orderBy, and
    // ordering only the current page would be wrong (page 1 would not hold the
    // real top performers). So: rank the filtered candidate set, then page over
    // the ranked ids. Bounded by RANKING_CEILING — documented in the contract.
    const candidates = await safe(
      () => prisma.appUser.findMany({ where, select: { id: true }, take: RANKING_CEILING }),
      [],
    );
    const ids = candidates.map((c) => c.id);
    const students = await studentCountsFor(ids);
    const ranked = ids.sort((a, b) => (students.get(b) ?? 0) - (students.get(a) ?? 0));

    total = ranked.length;
    const pageIds = ranked.slice(skip, skip + limit);
    const unordered = await safe(
      () => prisma.appUser.findMany({ where: { id: { in: pageIds } }, select: INSTRUCTOR_SELECT }),
      [],
    );
    const byId = new Map(unordered.map((u) => [u.id, u]));
    rows = pageIds.map((id) => byId.get(id)).filter(Boolean);
  } else {
    [total, rows] = await Promise.all([
      safe(() => prisma.appUser.count({ where }), 0),
      safe(() => prisma.appUser.findMany({
        where,
        skip,
        take: limit,
        orderBy: ORDER_BY[sort] ?? ORDER_BY.recent,
        select: INSTRUCTOR_SELECT,
      }), []),
    ]);
  }

  const ids = rows.map((r) => r.id);
  const [courses, students, tabCounts] = await Promise.all([
    courseCountsFor(ids),
    studentCountsFor(ids),
    getTabCounts(),
  ]);

  const instructors = rows.map((r) => mapInstructor(r, {
    ...(courses.get(r.id) ?? {}),
    studentsCount: students.get(r.id) ?? 0,
  }));

  return {
    instructors,
    tabCounts,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
  };
}

// Tab badge counts. `pending` is the applications queue — a different table, on
// purpose: the Pending tab shows people who are not instructors yet.
async function getTabCounts() {
  const base = { role: "INSTRUCTOR" };
  const [all, active, inactive, suspended, pending] = await Promise.all([
    safe(() => prisma.appUser.count({ where: { ...base, status: TAB_STATUS_SCOPE.all } }), 0),
    safe(() => prisma.appUser.count({ where: { ...base, status: TAB_STATUS_SCOPE.active } }), 0),
    safe(() => prisma.appUser.count({ where: { ...base, status: TAB_STATUS_SCOPE.inactive } }), 0),
    safe(() => prisma.appUser.count({ where: { ...base, status: TAB_STATUS_SCOPE.suspended } }), 0),
    countPendingApplications(),
  ]);
  return { all, active, inactive, suspended, pending };
}

// Resolves by AppUser id and refuses non-instructors, so /instructors/:id can
// never be used to read an arbitrary user record. The role predicate lives in
// the query (not a post-check) so a LEARNER id and an unknown id are
// indistinguishable from the outside — both 404.
async function getInstructorRow(id) {
  const user = await prisma.appUser.findFirst({
    where: { id, role: "INSTRUCTOR" },
    select: INSTRUCTOR_SELECT,
  });
  if (!user) throw domainError("INSTRUCTOR_NOT_FOUND");
  return user;
}

async function assertIsInstructor(id) {
  const user = await prisma.appUser.findUnique({
    where: { id },
    select: { id: true, role: true, status: true },
  });
  if (!user || user.role !== "INSTRUCTOR") throw domainError("INSTRUCTOR_NOT_FOUND");
  return user;
}

// Detail read. Every query below runs in ONE parallel batch — the side panel
// opens on a single request, so nothing here may wait on anything else.
async function getInstructor(id) {
  const user = await getInstructorRow(id);

  const [
    courseRows, liveSessionsCount, students, counts,
    pendingCourses, recentSessions, recentCerts, auditRows,
    enrollmentsByMonth, topIds,
  ] = await Promise.all([
    safe(() => prisma.course.findMany({
      where: { instructorId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true, title: true, status: true, category: true, thumbnail: true,
        createdAt: true, _count: { select: { enrollments: true } },
      },
    }), []),
    safe(() => prisma.liveSession.count({ where: { instructorId: id } }), 0),
    studentCountsFor([id]),
    courseCountsFor([id]),

    // Own query rather than filtering the 50 rows above: a prolific instructor
    // could have pending courses past that cap, and an approval queue that
    // silently drops items is worse than one extra indexed count.
    safe(() => prisma.course.findMany({
      where: { instructorId: id, status: "PENDING" },
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }], // longest waiting first
      take: 20,
      select: { id: true, title: true, category: true, submittedAt: true, createdAt: true },
    }), []),
    safe(() => prisma.liveSession.findMany({
      where: { instructorId: id },
      orderBy: { createdAt: "desc" },
      take: ACTIVITY_LIMIT,
      select: { id: true, title: true, createdAt: true },
    }), []),
    safe(() => prisma.certificate.findMany({
      where: { course: { instructorId: id } },
      orderBy: { issuedAt: "desc" },
      take: ACTIVITY_LIMIT,
      select: { id: true, issuedAt: true, course: { select: { title: true } } },
    }), []),
    safe(() => prisma.auditLog.findMany({
      where: { targetUserId: id },
      orderBy: { createdAt: "desc" },
      take: ACTIVITY_LIMIT,
      select: { id: true, action: true, createdAt: true },
    }), []),

    enrollmentsByMonthFor(id),
    getTopInstructorIds(),
  ]);

  return {
    ...mapInstructor(user, { ...(counts.get(id) ?? {}), studentsCount: students.get(id) ?? 0 }),
    liveSessionsCount,

    // Derived, never stored — the badges system itself is blueprint 05 §15
    // [phase-later], but these three are all computable from data we hold.
    badges: {
      active:        user.status === "ACTIVE",
      verified:      user.verificationState === "VERIFIED",
      topInstructor: topIds.includes(id),
    },

    courses: courseRows.map((c) => ({
      id:            c.id,
      title:         c.title,
      status:        c.status,
      category:      c.category ?? null,
      thumbnail:     c.thumbnail ?? null,
      enrolledCount: c._count.enrollments,
      createdAt:     iso(c.createdAt),
    })),

    // Read-only here. Deciding these uses the EXISTING course endpoints
    // (POST /api/admin/courses/:id/approve | /reject) — blueprint 05 §6:
    // same mutation IDs as the Courses module, never an instructor-scoped fork.
    pendingApprovals: pendingCourses.map((c) => ({
      id:          c.id,
      title:       c.title,
      category:    c.category ?? null,
      // Null on courses submitted before the column existed (learning.prisma).
      submittedAt: iso(c.submittedAt),
      createdAt:   iso(c.createdAt),
    })),

    recentActivities: buildActivityFeed({ courseRows, recentSessions, recentCerts, auditRows }),
    performanceChart: buildPerformanceChart(enrollmentsByMonth),
  };
}

// ── Detail sub-builders ─────────────────────────────────────────────────────────

// Instructors do not write audit entries — there is no instructor-facing app —
// so this feed is "what happened to and around this instructor": content they
// own appearing, and admin actions taken on their account. Item shape matches
// lm.service.getActivities() so the frontend reuses one row component.
const AUDIT_ACTIVITY_TITLE = {
  USER_SUSPENDED:             "Account suspended by an admin",
  USER_REACTIVATED:           "Account reactivated by an admin",
  USER_VERIFICATION_APPROVED: "Verification approved",
  USER_VERIFICATION_REJECTED: "Verification rejected",
  USER_ROLE_ASSIGNED:         "Role changed by an admin",
  USER_FORCE_LOGOUT:          "Sessions revoked by an admin",
  INSTRUCTOR_CREATED:         "Instructor account created",
  INSTRUCTOR_PROFILE_UPDATED: "Profile updated by an admin",
};

function buildActivityFeed({ courseRows, recentSessions, recentCerts, auditRows }) {
  return [
    // Reuses the already-fetched course page — no extra query for this slice.
    ...courseRows.slice(0, ACTIVITY_LIMIT).map((c) => ({
      id: `course_${c.id}`, type: "course_created",
      title: `Course "${c.title}" was created`, createdAt: iso(c.createdAt),
    })),
    ...recentSessions.map((s) => ({
      id: `session_${s.id}`, type: "session_scheduled",
      title: `Live session "${s.title}" was scheduled`, createdAt: iso(s.createdAt),
    })),
    ...recentCerts.map((c) => ({
      id: `cert_${c.id}`, type: "certificate_issued",
      title: `Certificate issued for "${c.course?.title ?? "a course"}"`, createdAt: iso(c.issuedAt),
    })),
    ...auditRows.map((a) => ({
      id: `audit_${a.id}`, type: "admin_action",
      title: AUDIT_ACTIVITY_TITLE[a.action] ?? a.action.replace(/_/g, " ").toLowerCase(),
      createdAt: iso(a.createdAt),
    })),
  ]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, ACTIVITY_LIMIT);
}

// Monthly enrollment counts. Raw SQL because Prisma groupBy cannot bucket by
// month; the instructor id is a bound parameter, never interpolated.
async function enrollmentsByMonthFor(instructorId) {
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (CHART_MONTHS - 1), 1));
  const rows = await safe(
    () => prisma.$queryRaw`
      SELECT to_char(date_trunc('month', e."createdAt"), 'YYYY-MM') AS month,
             COUNT(*)::int AS enrollments
      FROM "course_enrollments" e
      JOIN "courses" c ON c."id" = e."courseId"
      WHERE c."instructorId" = ${instructorId} AND e."createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1`,
    [],
  );
  return new Map(rows.map((r) => [r.month, Number(r.enrollments) || 0]));
}

// Dense 12-month series: months with no enrollments come back MISSING from the
// query, and a sparse array would silently misalign labels[] against data[].
// Zero-filled here so the chart plots what actually happened.
function buildPerformanceChart(byMonth) {
  const now = new Date();
  const labels = [];
  const enrollments = [];
  for (let i = CHART_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    labels.push(key);
    enrollments.push(byMonth.get(key) ?? 0);
  }
  return {
    labels,
    enrollments,
    // No Payment/Transaction model — see the ownership note at the top.
    revenue: null,
    revenueAvailable: false,
  };
}

// ── Stats (task 105) ────────────────────────────────────────────────────────────

function calcChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

// Uniform envelope so one card component renders all six tiles. `available:false`
// means "no source table exists yet", NOT "the value is zero".
function metric(value, changePercent = null) {
  return { value, changePercent, available: true };
}
function unavailable(reason) {
  return { value: null, changePercent: null, available: false, reason };
}

async function getStats() {
  const now = new Date();
  const startOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const thisMonth = { gte: startOfThisMonth };
  const lastMonth = { gte: startOfLastMonth, lt: startOfThisMonth };

  const instructor = { role: "INSTRUCTOR" };
  const live       = { status: { not: "ARCHIVED" } };
  const pendingApplicationStates = { status: { in: ["PENDING", "CHANGES_REQUESTED"] } };
  // A course's publish date is `reviewedAt` (stamped by the approval workflow).
  // Courses published before that workflow existed have none and simply do not
  // count toward a month — more truthful than pretending createdAt is a publish date.
  const publishedCourses = { status: "PUBLISHED", instructorId: { not: null } };

  const [
    totalInstructors, totalThisMonth, totalLastMonth,
    activeInstructors, activeThisMonth, activeLastMonth,
    suspendedInstructors,
    pendingApproval, pendingThisMonth, pendingLastMonth,
    coursesPublished, coursesThisMonth, coursesLastMonth,
  ] = await Promise.all([
    safe(() => prisma.appUser.count({ where: { ...instructor, ...live } }), 0),
    safe(() => prisma.appUser.count({ where: { ...instructor, ...live, createdAt: thisMonth } }), 0),
    safe(() => prisma.appUser.count({ where: { ...instructor, ...live, createdAt: lastMonth } }), 0),

    safe(() => prisma.appUser.count({ where: { ...instructor, status: "ACTIVE" } }), 0),
    safe(() => prisma.appUser.count({ where: { ...instructor, status: "ACTIVE", createdAt: thisMonth } }), 0),
    safe(() => prisma.appUser.count({ where: { ...instructor, status: "ACTIVE", createdAt: lastMonth } }), 0),

    safe(() => prisma.appUser.count({ where: { ...instructor, status: "SUSPENDED" } }), 0),

    countPendingApplications(),
    safe(() => prisma.instructorApplication.count({ where: { ...pendingApplicationStates, createdAt: thisMonth } }), 0),
    safe(() => prisma.instructorApplication.count({ where: { ...pendingApplicationStates, createdAt: lastMonth } }), 0),

    safe(() => prisma.course.count({ where: publishedCourses }), 0),
    safe(() => prisma.course.count({ where: { ...publishedCourses, reviewedAt: thisMonth } }), 0),
    safe(() => prisma.course.count({ where: { ...publishedCourses, reviewedAt: lastMonth } }), 0),
  ]);

  return {
    totalInstructors:     metric(totalInstructors,  calcChange(totalThisMonth, totalLastMonth)),
    activeInstructors:    metric(activeInstructors, calcChange(activeThisMonth, activeLastMonth)),
    suspendedInstructors: metric(suspendedInstructors),
    pendingApproval:      metric(pendingApproval,   calcChange(pendingThisMonth, pendingLastMonth)),
    coursesPublished:     metric(coursesPublished,  calcChange(coursesThisMonth, coursesLastMonth)),
    totalRevenue:         unavailable("No Payment/Transaction model exists yet — ships with the Finance module."),
    avgRating:            unavailable("No Review/Rating model exists yet — ships with instructor reviews."),
  };
}

// ── Analytics (task 111) ────────────────────────────────────────────────────────

// Largest-remainder rounding to one decimal, so a donut's slices add up to
// exactly 100.0 instead of 99.8. The frontend renders these verbatim and never
// recomputes them from counts (R1).
function withPercentages(items) {
  const total = items.reduce((sum, i) => sum + i.count, 0);
  if (total === 0) return items.map((i) => ({ ...i, percentage: 0 }));

  const tenths = items.map((i) => (i.count / total) * 1000);
  const floors = tenths.map(Math.floor);
  const missing = 1000 - floors.reduce((sum, v) => sum + v, 0);
  const byRemainder = tenths
    .map((v, idx) => ({ idx, remainder: v - Math.floor(v) }))
    .sort((a, b) => b.remainder - a.remainder);

  for (let k = 0; k < missing; k++) floors[byRemainder[k % byRemainder.length].idx] += 1;
  return items.map((item, idx) => ({ ...item, percentage: floors[idx] / 10 }));
}

// Same population as stats.totalInstructors (role=INSTRUCTOR, not ARCHIVED), so
// the donut total always equals the Total Instructors card. Instructors with no
// profile row — the majority before this module existed — land in "Unspecified"
// rather than being dropped, which would make the chart under-count silently.
const UNSPECIFIED = "Unspecified";

async function specializationDistribution() {
  const rows = await safe(
    () => prisma.$queryRaw`
      SELECT COALESCE(NULLIF(TRIM(ip."specialization"), ''), ${UNSPECIFIED}) AS name,
             COUNT(*)::int AS count
      FROM "app_users" u
      LEFT JOIN "instructor_profiles" ip ON ip."userId" = u."id"
      WHERE u."role" = 'INSTRUCTOR' AND u."status" <> 'ARCHIVED'
      GROUP BY 1
      ORDER BY count DESC, name ASC`,
    [],
  );
  return withPercentages(rows.map((r) => ({ name: r.name, count: Number(r.count) || 0 })));
}

async function getAnalytics() {
  const [distribution, statusGroups, topIds] = await Promise.all([
    specializationDistribution(),
    // ARCHIVED excluded to match `coursesCount` on every instructor row — one
    // meaning for "their courses" across the whole module.
    safe(() => prisma.course.groupBy({
      by: ["status"],
      where: { instructorId: { not: null }, status: { not: "ARCHIVED" } },
      _count: { _all: true },
    }), []),
    getTopInstructorIds(),
  ]);

  const [topUsers, topStudents, topCourses] = await Promise.all([
    safe(() => prisma.appUser.findMany({
      where: { id: { in: topIds } },
      select: { id: true, fullName: true, avatar: true },
    }), []),
    studentCountsFor(topIds),
    courseCountsFor(topIds),
  ]);
  const byId = new Map(topUsers.map((u) => [u.id, u]));

  return {
    distributionBySpecialization: { available: true, items: distribution },

    coursesByStatus: {
      available: true,
      items: withPercentages(
        statusGroups
          .map((g) => ({ status: g.status, count: g._count._all }))
          .sort((a, b) => b.count - a.count),
      ),
    },

    // Ranked by distinct students — the same metric behind the `topInstructor`
    // badge and ?tab=top. `rankedBy` ships in the payload so the UI labels the
    // column honestly instead of implying a rating ranking.
    topInstructors: {
      available: true,
      rankedBy: "students",
      limit: TOP_INSTRUCTOR_LIMIT,
      items: topIds
        .map((id) => {
          const user = byId.get(id);
          if (!user) return null;
          return {
            id,
            name:                  user.fullName,
            photo:                 user.avatar ?? null,
            studentsCount:         topStudents.get(id) ?? 0,
            publishedCoursesCount: topCourses.get(id)?.publishedCoursesCount ?? 0,
            rating:                null,
            revenue:               null,
          };
        })
        .filter(Boolean),
    },

    // Deliberately NOT zeroed chartData: an all-zero bar chart claims "no sales",
    // which is a different statement from "this cannot be measured yet".
    earningsOverview: unavailable(
      "No Payment/Transaction model exists yet — ships with the Finance module.",
    ),
  };
}

// ── Writes ──────────────────────────────────────────────────────────────────────

// Creates the AppUser and its profile in ONE nested write, so a failure can
// never leave a half-made instructor behind. Role is forced to INSTRUCTOR here
// and is not readable from the request body (see the validator).
async function createInstructor({ user, profile }, adminId) {
  const existing = await prisma.appUser.findFirst({ where: { email: user.email }, select: { id: true } });
  if (existing) throw domainError("EMAIL_TAKEN");

  const passwordHash = user.password ? await bcrypt.hash(user.password, 12) : null;

  let created;
  try {
    created = await prisma.appUser.create({
      data: {
        fullName:          user.fullName,
        email:             user.email,
        passwordHash,
        role:              "INSTRUCTOR",
        status:            user.status,
        verificationState: user.status === "ACTIVE" ? "VERIFIED" : "PENDING",
        phone:             user.phone,
        skills:            user.skills,
        ...(Object.keys(profile).length > 0 ? { instructorProfile: { create: profile } } : {}),
      },
      select: INSTRUCTOR_SELECT,
    });
  } catch (err) {
    if (err.code === "P2002") throw domainError("EMAIL_TAKEN");
    throw err;
  }

  await auditLog(adminId, "INSTRUCTOR_CREATED", {
    userId: created.id,
    email: created.email,
    fullName: created.fullName,
    specialization: profile.specialization ?? null,
  });

  return mapInstructor(created);
}

// Profile fields (+ the two shared AppUser fields the Instructors screen owns:
// fullName and phone). Everything the Users module owns is rejected by the
// validator with a message naming the endpoint to use instead.
async function updateInstructor(id, { profile, user }, adminId) {
  await assertIsInstructor(id);

  const updated = await prisma.appUser.update({
    where: { id },
    data: {
      ...user,
      // upsert, not update: instructors created before this module have no
      // profile row yet, and editing one must create it rather than 404.
      ...(Object.keys(profile).length > 0
        ? { instructorProfile: { upsert: { create: profile, update: profile } } }
        : {}),
    },
    select: INSTRUCTOR_SELECT,
  });

  await auditLog(adminId, "INSTRUCTOR_PROFILE_UPDATED", {
    userId: id,
    fields: [...Object.keys(profile), ...Object.keys(user)],
  });

  return mapInstructor(updated);
}

// Delegated state transitions. users.service owns AppUser.status and
// verificationState and already writes the audit entry for each — this layer
// only adds the instructor guard and the profile-side provenance stamp.
async function verifyInstructor(id, adminId) {
  const current = await assertIsInstructor(id);
  // users.service.approveVerification also flips status to ACTIVE. On a
  // suspended instructor that would silently lift the suspension from a button
  // labelled "Verify" — refuse instead and make the admin reactivate on purpose.
  if (current.status === "SUSPENDED") throw domainError("INSTRUCTOR_SUSPENDED");
  await usersService.approveVerification(id, { id: adminId });
  await prisma.instructorProfile.upsert({
    where:  { userId: id },
    create: { userId: id, verifiedAt: new Date(), verifiedById: adminId ?? null },
    update: { verifiedAt: new Date(), verifiedById: adminId ?? null },
  });
  return getInstructor(id);
}

async function suspendInstructor(id, body, adminId) {
  await assertIsInstructor(id);
  await usersService.suspendUser(id, body, { id: adminId });
  return getInstructor(id);
}

async function reactivateInstructor(id, adminId) {
  await assertIsInstructor(id);
  await usersService.reactivateUser(id, { id: adminId });
  return getInstructor(id);
}

// Soft delete: archive the user (users.service owns that transition) and KEEP
// the profile, so reactivating restores the instructor intact. Blocked while
// courses or live sessions still point here — Course.instructorId and
// LiveSession.instructorId are non-cascading FKs, so a hard delete would raise
// a raw Prisma P2003 and surface as a 500.
async function deleteInstructor(id, adminId) {
  await assertIsInstructor(id);

  const [courses, liveSessions] = await Promise.all([
    prisma.course.count({ where: { instructorId: id, status: { not: "ARCHIVED" } } }),
    prisma.liveSession.count({ where: { instructorId: id } }),
  ]);
  if (courses > 0 || liveSessions > 0) {
    throw Object.assign(domainError("INSTRUCTOR_HAS_CONTENT"), { blockers: { courses, liveSessions } });
  }

  await usersService.deleteUser(id, { id: adminId });
  await auditLog(adminId, "INSTRUCTOR_DELETED", { userId: id });

  return { id };
}

module.exports = {
  listInstructors,
  getInstructor,
  getStats,
  getAnalytics,
  getTabCounts,
  countPendingApplications,
  // Shared with the analytics endpoint (task 111) so "top instructor" has one
  // definition across the badge, the chart and the ?tab=top ordering.
  getTopInstructorIds,
  TOP_INSTRUCTOR_LIMIT,
  createInstructor,
  updateInstructor,
  verifyInstructor,
  suspendInstructor,
  reactivateInstructor,
  deleteInstructor,
};
