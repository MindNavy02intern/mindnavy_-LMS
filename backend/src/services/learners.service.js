const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const usersService = require("./users.service");
// Reused, not forked (Step 0 audit + ENROLLMENTS_CONTRACT.md addendum) — the
// SAME service backing the Learning Management EnrollmentsTab.
const enrollmentsService = require("./enrollments.service");
// Reused, not forked (Part 5) — the SAME service backing the Certificates
// module (CERTIFICATES_CONTRACT.md).
const certificatesService = require("./certificates.service");
const { DERIVED_TABS, TAB_STATUS_SCOPE } = require("../validators/learners.validator");

// ── Learners service ─────────────────────────────────────────────────────────────
//
// Mirrors instructors.service exactly (same module, same day): reads are driven
// by AppUser (role = LEARNER) with LearnerProfile LEFT-JOINED, never the profile
// table alone — every learner that existed before this module, or was created
// through POST /api/admin/users, has no profile row and must still appear here.
//
// OWNERSHIP (one field, one owner):
//   • status / verificationState / password are written ONLY by users.service.
//     suspend, reactivate and reset-password delegate to it (USER_* audit
//     actions, not LEARNER_* — one action, one audit row).
//   • learnerProfile.verificationStatus is a DIFFERENT concept (enrollment/
//     identity verification) fully owned by this module — plain admin-editable
//     field, no server-stamped workflow like instructor verifiedAt.
//   • Course/Certificate counts are computed live from those tables (B1) —
//     never stored here.
//
// TERMINOLOGY: "Learner" only in this file and everywhere it touches. The dead
// `student.*` scaffolding in invalidation.ts predates this module and is left
// alone (see learners.prisma header note).

const { STATUS_MAP, VERIFICATION_MAP } = usersService;

// A learner with a stored riskScore at or above this is "at-risk" (tab +
// stats card). Documented business rule, not a magic number sprinkled around —
// same pattern as instructors.service's TOP_INSTRUCTOR_LIMIT. Revisit with
// Hassan once real usage data exists to tune it.
const AT_RISK_THRESHOLD = 70;

// Bounded candidate set for the in-memory "progress" ranking (see listLearners),
// same tradeoff as instructors.service's RANKING_CEILING.
const RANKING_CEILING = 1000;

const CHART_MONTHS = 12;
const TOP_PERFORMERS_LIMIT = 10;
const AT_RISK_LIST_LIMIT = 10;
const RECENT_CERTS_LIMIT = 10;

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[learners.service] query failed:", err.message);
    return fallback;
  }
}

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

function domainError(code) { return Object.assign(new Error(code), { code }); }

// Best-effort audit — never breaks the primary write (mirrors instructors.service).
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

const LEARNER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  avatar: true,
  phone: true,
  status: true,
  verificationState: true,
  department: true,
  branch: true,
  lastActivityAt: true,
  suspendedAt: true,
  createdAt: true,
  updatedAt: true,
  learnerProfile: {
    select: {
      learnerCode: true,
      program: true,
      level: true,
      department: true,
      batch: true,
      advisorId: true,
      verificationStatus: true,
      riskScore: true,
      joinedDate: true,
      lastActiveAt: true,
    },
  },
};

// `id` IS the AppUser id. status/verificationState reuse the Users module's
// lowercase mapping (imported, not re-declared).
function mapLearner(u, agg = {}) {
  const p = u.learnerProfile ?? null;
  return {
    id:                u.id,
    userId:            u.id,
    fullName:          u.fullName,
    email:             u.email,
    avatar:            u.avatar ?? null,
    phone:             u.phone ?? null,
    status:            STATUS_MAP[u.status] ?? String(u.status).toLowerCase(),
    verificationState: VERIFICATION_MAP[u.verificationState] ?? String(u.verificationState).toLowerCase(),
    // AppUser.department is the org-hierarchy field (organization.prisma) —
    // profile.department is the LEARNER's academic department, a distinct
    // concept, same duality Course.category/categoryId has during migration.
    orgDepartment: u.department ?? null,
    branch:        u.branch ?? null,

    learnerCode:        p?.learnerCode ?? null,
    program:            p?.program ?? null,
    level:              p?.level ?? null,
    department:         p?.department ?? null,
    batch:              p?.batch ?? null,
    advisorId:          p?.advisorId ?? null,
    verificationStatus: p?.verificationStatus ?? null,
    riskScore:          p?.riskScore ?? null,
    joinedDate:         iso(p?.joinedDate) ?? iso(u.createdAt),
    hasProfile:         Boolean(p),

    coursesCount:          agg.coursesCount ?? 0,
    completedCoursesCount: agg.completedCoursesCount ?? 0,
    avgProgress:           agg.avgProgress ?? null,
    certificatesCount:     agg.certificatesCount ?? 0,

    lastActiveAt:   iso(p?.lastActiveAt) ?? iso(u.lastActivityAt),
    suspendedAt:    iso(u.suspendedAt),
    createdAt:      iso(u.createdAt),
    updatedAt:      iso(u.updatedAt),
  };
}

// ── Aggregates (computed live — never stored) ────────────────────────────────────

// Course totals + avg progress per learner for one page of rows: two grouped
// queries instead of N per-row lookups (courseCountsFor's pattern in
// instructors.service, split in two here because Prisma groupBy can't mix a
// by-status count with an overall avg in one call).
async function courseStatsFor(learnerIds) {
  if (learnerIds.length === 0) return new Map();
  const [byStatus, overall] = await Promise.all([
    safe(() => prisma.courseEnrollment.groupBy({
      by: ["userId", "status"],
      where: { userId: { in: learnerIds } },
      _count: { _all: true },
    }), []),
    safe(() => prisma.courseEnrollment.groupBy({
      by: ["userId"],
      where: { userId: { in: learnerIds } },
      _avg: { progress: true },
    }), []),
  ]);

  const map = new Map();
  for (const g of byStatus) {
    const entry = map.get(g.userId) ?? { coursesCount: 0, completedCoursesCount: 0, avgProgress: null };
    entry.coursesCount += g._count._all;
    if (g.status === "COMPLETED") entry.completedCoursesCount += g._count._all;
    map.set(g.userId, entry);
  }
  for (const g of overall) {
    const entry = map.get(g.userId) ?? { coursesCount: 0, completedCoursesCount: 0, avgProgress: null };
    entry.avgProgress = g._avg.progress == null ? null : Math.round(g._avg.progress);
    map.set(g.userId, entry);
  }
  return map;
}

async function certificatesCountFor(learnerIds) {
  if (learnerIds.length === 0) return new Map();
  const rows = await safe(
    () => prisma.certificate.groupBy({
      by: ["userId"],
      where: { userId: { in: learnerIds } },
      _count: { _all: true },
    }),
    [],
  );
  return new Map(rows.map((r) => [r.userId, r._count._all]));
}

// ── Where-clause builders ───────────────────────────────────────────────────────

// Derived tabs are relational shapes TAB_STATUS_SCOPE can't express as a flat
// status value — built directly here, one definition each, reused by both
// listLearners (via buildWhere) and getTabCounts (duplicated as single-purpose
// count queries, same tradeoff instructors.service accepts for getTabCounts).
function derivedTabWhere(tab) {
  switch (tab) {
    case "at-risk":
      return { learnerProfile: { riskScore: { gte: AT_RISK_THRESHOLD } } };
    case "pending-verification":
      return { learnerProfile: { verificationStatus: "PENDING" } };
    // "Completed" = finished AT LEAST ONE course. Documented decision, not the
    // only reasonable one — see "graduated" below for the ALL-courses variant.
    case "completed":
      return { courseEnrollments: { some: { status: "COMPLETED" } } };
    // "Graduated" has no concept anywhere else in this system (no program-
    // completion model). Defined here as: has enrolled in at least one course,
    // AND every enrollment they have is COMPLETED — computed from real data,
    // not fabricated, but a business call that should be confirmed, same
    // caveat as instructors' violationType-optional note.
    case "graduated":
      return {
        AND: [
          { courseEnrollments: { some: {} } },
          { courseEnrollments: { every: { status: "COMPLETED" } } },
        ],
      };
    default:
      return {};
  }
}

function buildWhere({ tab = "all", search, department, program }) {
  const where = { role: "LEARNER" };

  if (DERIVED_TABS.has(tab)) {
    Object.assign(where, derivedTabWhere(tab));
  } else {
    where.status = TAB_STATUS_SCOPE[tab] ?? TAB_STATUS_SCOPE.all;
  }

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email:    { contains: search, mode: "insensitive" } },
    ];
  }
  if (department) {
    where.learnerProfile = { ...(where.learnerProfile ?? {}), department: { equals: department, mode: "insensitive" } };
  }
  if (program) {
    where.learnerProfile = { ...(where.learnerProfile ?? {}), program: { equals: program, mode: "insensitive" } };
  }
  return where;
}

const ORDER_BY = {
  recent:  { createdAt: "desc" },
  name:    { fullName: "asc" },
  courses: { courseEnrollments: { _count: "desc" } },
};

// ── Reads ───────────────────────────────────────────────────────────────────────

async function listLearners(query) {
  const { page, limit, tab, sort, search, department, program } = query;
  const where = buildWhere({ tab, search, department, program });
  const skip = (page - 1) * limit;

  let total;
  let rows;

  if (sort === "progress") {
    // Avg progress cannot be expressed as a Prisma orderBy — rank the filtered
    // candidate set in memory (bounded by RANKING_CEILING), then page over the
    // ranked ids. Same shape as instructors.service's sort==='students' branch.
    const candidates = await safe(
      () => prisma.appUser.findMany({ where, select: { id: true }, take: RANKING_CEILING }),
      [],
    );
    const ids = candidates.map((c) => c.id);
    const stats = await courseStatsFor(ids);
    const ranked = ids.sort((a, b) => (stats.get(b)?.avgProgress ?? -1) - (stats.get(a)?.avgProgress ?? -1));

    total = ranked.length;
    const pageIds = ranked.slice(skip, skip + limit);
    const unordered = await safe(
      () => prisma.appUser.findMany({ where: { id: { in: pageIds } }, select: LEARNER_SELECT }),
      [],
    );
    const byId = new Map(unordered.map((u) => [u.id, u]));
    rows = pageIds.map((id) => byId.get(id)).filter(Boolean);
  } else {
    [total, rows] = await Promise.all([
      safe(() => prisma.appUser.count({ where }), 0),
      safe(() => prisma.appUser.findMany({
        where, skip, take: limit,
        orderBy: ORDER_BY[sort] ?? ORDER_BY.recent,
        select: LEARNER_SELECT,
      }), []),
    ]);
  }

  const ids = rows.map((r) => r.id);
  const [courseStats, certCounts, tabCounts] = await Promise.all([
    courseStatsFor(ids),
    certificatesCountFor(ids),
    getTabCounts(),
  ]);

  const learners = rows.map((r) => mapLearner(r, {
    ...(courseStats.get(r.id) ?? {}),
    certificatesCount: certCounts.get(r.id) ?? 0,
  }));

  return {
    learners,
    tabCounts,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
  };
}

// Global (search/filter independent) — badge counts for all 8 tabs.
async function getTabCounts() {
  const base = { role: "LEARNER" };
  const [all, active, inactive, suspended, atRisk, completed, pendingVerification, graduated] = await Promise.all([
    safe(() => prisma.appUser.count({ where: { ...base, status: TAB_STATUS_SCOPE.all } }), 0),
    safe(() => prisma.appUser.count({ where: { ...base, status: TAB_STATUS_SCOPE.active } }), 0),
    safe(() => prisma.appUser.count({ where: { ...base, status: TAB_STATUS_SCOPE.inactive } }), 0),
    safe(() => prisma.appUser.count({ where: { ...base, status: TAB_STATUS_SCOPE.suspended } }), 0),
    safe(() => prisma.appUser.count({ where: { ...base, ...derivedTabWhere("at-risk") } }), 0),
    safe(() => prisma.appUser.count({ where: { ...base, ...derivedTabWhere("completed") } }), 0),
    safe(() => prisma.appUser.count({ where: { ...base, ...derivedTabWhere("pending-verification") } }), 0),
    safe(() => prisma.appUser.count({ where: { ...base, ...derivedTabWhere("graduated") } }), 0),
  ]);
  return {
    all, active, inactive, suspended,
    "at-risk": atRisk, completed,
    "pending-verification": pendingVerification, graduated,
  };
}

async function getLearnerRow(id) {
  const user = await prisma.appUser.findFirst({ where: { id, role: "LEARNER" }, select: LEARNER_SELECT });
  if (!user) throw domainError("LEARNER_NOT_FOUND");
  return user;
}

async function assertIsLearner(id) {
  const user = await prisma.appUser.findUnique({ where: { id }, select: { id: true, role: true, status: true } });
  if (!user || user.role !== "LEARNER") throw domainError("LEARNER_NOT_FOUND");
  return user;
}

// Detail read — base profile + summary counts only (the panel's Overview /
// Stats row). Courses/progress/activity/certificates/assessments/attendance/
// documents/tickets are their own dedicated endpoints (Parts 3/5/7), each its
// own request from its own panel tab — same shape as InstructorSidePanel's
// Documents/Reviews/Certifications tabs, which never preload into the base
// GET /instructors/:id call either.
async function getLearner(id) {
  const user = await getLearnerRow(id);
  const advisorId = user.learnerProfile?.advisorId ?? null;

  const [courseStats, certCount, advisor] = await Promise.all([
    courseStatsFor([id]),
    certificatesCountFor([id]),
    // Detail-only enrichment (Part 4 side panel needs a name, not just an id)
    // — the list/table response deliberately stays lean and skips this.
    advisorId
      ? safe(() => prisma.appUser.findUnique({ where: { id: advisorId }, select: { fullName: true } }), null)
      : null,
  ]);

  return {
    ...mapLearner(user, {
      ...(courseStats.get(id) ?? {}),
      certificatesCount: certCount.get(id) ?? 0,
    }),
    advisorName: advisor?.fullName ?? null,
    badges: {
      active:   user.status === "ACTIVE",
      atRisk:   (user.learnerProfile?.riskScore ?? -1) >= AT_RISK_THRESHOLD,
      verified: user.learnerProfile?.verificationStatus === "VERIFIED",
    },
  };
}

// ── Stats (6 cards) ──────────────────────────────────────────────────────────────

function calcChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

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

  const learner = { role: "LEARNER" };
  const live = { status: { not: "ARCHIVED" } };

  const [
    total, totalThisMonth, totalLastMonth,
    active, activeThisMonth, activeLastMonth,
    newThisMonth, newLastMonth,
    completedCourses, completedThisMonth, completedLastMonth,
    avgProgressRow,
    atRisk,
  ] = await Promise.all([
    safe(() => prisma.appUser.count({ where: { ...learner, ...live } }), 0),
    safe(() => prisma.appUser.count({ where: { ...learner, ...live, createdAt: thisMonth } }), 0),
    safe(() => prisma.appUser.count({ where: { ...learner, ...live, createdAt: lastMonth } }), 0),

    safe(() => prisma.appUser.count({ where: { ...learner, status: "ACTIVE" } }), 0),
    safe(() => prisma.appUser.count({ where: { ...learner, status: "ACTIVE", createdAt: thisMonth } }), 0),
    safe(() => prisma.appUser.count({ where: { ...learner, status: "ACTIVE", createdAt: lastMonth } }), 0),

    safe(() => prisma.appUser.count({ where: { ...learner, ...live, createdAt: thisMonth } }), 0),
    safe(() => prisma.appUser.count({ where: { ...learner, ...live, createdAt: lastMonth } }), 0),

    safe(() => prisma.courseEnrollment.count({ where: { status: "COMPLETED", user: learner } }), 0),
    safe(() => prisma.courseEnrollment.count({ where: { status: "COMPLETED", completedAt: thisMonth, user: learner } }), 0),
    safe(() => prisma.courseEnrollment.count({ where: { status: "COMPLETED", completedAt: lastMonth, user: learner } }), 0),

    safe(() => prisma.courseEnrollment.aggregate({ where: { user: learner }, _avg: { progress: true } }), { _avg: { progress: null } }),

    safe(() => prisma.appUser.count({ where: { ...learner, ...derivedTabWhere("at-risk") } }), 0),
  ]);

  return {
    totalLearners:    metric(total, calcChange(totalThisMonth, totalLastMonth)),
    activeLearners:   metric(active, calcChange(activeThisMonth, activeLastMonth)),
    newLearners:      metric(newThisMonth, calcChange(newThisMonth, newLastMonth)),
    completedCourses: metric(completedCourses, calcChange(completedThisMonth, completedLastMonth)),
    // No historical snapshot of avg progress exists — a "vs last month" figure
    // would be fabricated, so changePercent stays null (never a guessed arrow).
    avgProgress: metric(
      avgProgressRow._avg.progress == null ? null : Math.round(avgProgressRow._avg.progress),
      null,
    ),
    // Same reasoning — riskScore has no history table to diff against.
    atRiskLearners: metric(atRisk, null),
  };
}

// ── Analytics (7 sections) ────────────────────────────────────────────────────────

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

const UNSPECIFIED = "Unspecified";

async function programDistribution() {
  const rows = await safe(
    () => prisma.$queryRaw`
      SELECT COALESCE(NULLIF(TRIM(lp."program"), ''), ${UNSPECIFIED}) AS name,
             COUNT(*)::int AS count
      FROM "app_users" u
      LEFT JOIN "learner_profiles" lp ON lp."userId" = u."id"
      WHERE u."role" = 'LEARNER' AND u."status" <> 'ARCHIVED'
      GROUP BY 1
      ORDER BY count DESC, name ASC`,
    [],
  );
  return withPercentages(rows.map((r) => ({ name: r.name, count: Number(r.count) || 0 })));
}

// Avg progress of enrollments STARTED in each of the last 12 months (not a
// historical snapshot — progress is read at its CURRENT value for enrollments
// created that month). Zero-filled for months with no enrollments, same
// documented tradeoff as instructors.service's buildPerformanceChart.
async function progressOverview() {
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (CHART_MONTHS - 1), 1));
  const rows = await safe(
    () => prisma.$queryRaw`
      SELECT to_char(date_trunc('month', e."createdAt"), 'YYYY-MM') AS month,
             AVG(e."progress")::float AS avg_progress
      FROM "course_enrollments" e
      JOIN "app_users" u ON u."id" = e."userId"
      WHERE u."role" = 'LEARNER' AND e."createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1`,
    [],
  );
  const byMonth = new Map(rows.map((r) => [r.month, Math.round(Number(r.avg_progress) || 0)]));

  const now = new Date();
  const labels = [];
  const avgProgress = [];
  for (let i = CHART_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    labels.push(key);
    avgProgress.push(byMonth.get(key) ?? 0);
  }
  return { labels, avgProgress };
}

async function atRiskList() {
  const rows = await safe(
    () => prisma.appUser.findMany({
      where: { role: "LEARNER", ...derivedTabWhere("at-risk") },
      orderBy: { learnerProfile: { riskScore: "desc" } },
      take: AT_RISK_LIST_LIMIT,
      select: {
        id: true, fullName: true, avatar: true,
        learnerProfile: { select: { riskScore: true, program: true } },
      },
    }),
    [],
  );
  return rows.map((r) => ({
    id: r.id, name: r.fullName, photo: r.avatar ?? null,
    riskScore: r.learnerProfile?.riskScore ?? null,
    program: r.learnerProfile?.program ?? null,
  }));
}

async function enrollmentTrend() {
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (CHART_MONTHS - 1), 1));
  const rows = await safe(
    () => prisma.$queryRaw`
      SELECT to_char(date_trunc('month', e."createdAt"), 'YYYY-MM') AS month,
             COUNT(*)::int AS enrollments
      FROM "course_enrollments" e
      JOIN "app_users" u ON u."id" = e."userId"
      WHERE u."role" = 'LEARNER' AND e."createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1`,
    [],
  );
  const byMonth = new Map(rows.map((r) => [r.month, Number(r.enrollments) || 0]));

  const now = new Date();
  const labels = [];
  const enrollments = [];
  for (let i = CHART_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    labels.push(key);
    enrollments.push(byMonth.get(key) ?? 0);
  }
  return { labels, enrollments };
}

// Ranked by completed-course count (documented decision — the one number a
// "top performer" ranking least ambiguously means); avg progress is the
// tiebreaker, both real, both from courseStatsFor.
async function topPerformers() {
  const candidates = await safe(
    () => prisma.appUser.findMany({ where: { role: "LEARNER", status: { not: "ARCHIVED" } }, select: { id: true, fullName: true, avatar: true }, take: RANKING_CEILING }),
    [],
  );
  const stats = await courseStatsFor(candidates.map((c) => c.id));
  const ranked = candidates
    .map((c) => ({ ...c, stat: stats.get(c.id) ?? { coursesCount: 0, completedCoursesCount: 0, avgProgress: null } }))
    .sort((a, b) => (b.stat.completedCoursesCount - a.stat.completedCoursesCount) || ((b.stat.avgProgress ?? 0) - (a.stat.avgProgress ?? 0)))
    .slice(0, TOP_PERFORMERS_LIMIT);

  return ranked.map((r) => ({
    id: r.id, name: r.fullName, photo: r.avatar ?? null,
    completedCoursesCount: r.stat.completedCoursesCount,
    avgProgress: r.stat.avgProgress,
  }));
}

async function recentCertificates() {
  const rows = await safe(
    () => prisma.certificate.findMany({
      where: { user: { role: "LEARNER" } },
      orderBy: { issuedAt: "desc" },
      take: RECENT_CERTS_LIMIT,
      select: {
        id: true, issuedAt: true, revokedAt: true,
        user: { select: { id: true, fullName: true } },
        course: { select: { title: true } },
      },
    }),
    [],
  );
  return rows.map((c) => ({
    id: c.id, learnerId: c.user?.id ?? null, learnerName: c.user?.fullName ?? null,
    courseTitle: c.course?.title ?? null, issuedAt: iso(c.issuedAt), revoked: c.revokedAt != null,
  }));
}

// % of learners active in the last 30 days — the ONE definition of "engagement"
// this system can compute without a session/event-log table. The "score" the
// donut's center number shows is this same percentage, not a second metric.
async function engagement() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [totalCount, activeCount] = await Promise.all([
    safe(() => prisma.appUser.count({ where: { role: "LEARNER", status: { not: "ARCHIVED" } } }), 0),
    safe(() => prisma.appUser.count({ where: { role: "LEARNER", status: { not: "ARCHIVED" }, lastActivityAt: { gte: since } } }), 0),
  ]);
  const score = totalCount === 0 ? 0 : Math.round((activeCount / totalCount) * 100);
  return {
    available: true,
    score,
    items: [
      { name: "Active (last 30 days)", count: activeCount },
      { name: "Inactive", count: Math.max(0, totalCount - activeCount) },
    ].map((i) => ({ ...i, percentage: totalCount === 0 ? 0 : Math.round((i.count / totalCount) * 1000) / 10 })),
  };
}

async function getAnalytics() {
  const [distribution, progress, riskList, trend, performers, certs, eng] = await Promise.all([
    programDistribution(),
    progressOverview(),
    atRiskList(),
    enrollmentTrend(),
    topPerformers(),
    recentCertificates(),
    engagement(),
  ]);

  return {
    learnersByProgram:     { available: true, items: distribution },
    progressOverview:      { available: true, ...progress },
    atRiskLearners:        { available: true, items: riskList },
    enrollmentTrend:       { available: true, ...trend },
    topPerformingLearners: { available: true, items: performers },
    recentCertificates:    { available: true, items: certs },
    learnerEngagement:     eng,
  };
}

// ── learnerCode generation ────────────────────────────────────────────────────────

// LRN-0001 style — never "STD" (terminology rule). Sequential-looking but not
// strictly gapless: retries on the unique-constraint race rather than trusting
// a count-then-insert (two concurrent creates could both read the same count).
async function generateLearnerCode() {
  const count = await safe(() => prisma.learnerProfile.count(), 0);
  return `LRN-${String(count + 1).padStart(4, "0")}`;
}

// ── Writes ──────────────────────────────────────────────────────────────────────

async function createLearner({ user, profile }, adminId) {
  const existing = await prisma.appUser.findFirst({ where: { email: user.email }, select: { id: true } });
  if (existing) throw domainError("EMAIL_TAKEN");

  const passwordHash = user.password ? await bcrypt.hash(user.password, 12) : null;

  let created;
  for (let attempt = 0; attempt < 3; attempt++) {
    const learnerCode = await generateLearnerCode();
    try {
      created = await prisma.appUser.create({
        data: {
          fullName: user.fullName,
          email: user.email,
          passwordHash,
          role: "LEARNER",
          status: user.status,
          verificationState: user.status === "ACTIVE" ? "VERIFIED" : "PENDING",
          phone: user.phone,
          learnerProfile: { create: { ...profile, learnerCode } },
        },
        select: LEARNER_SELECT,
      });
      break;
    } catch (err) {
      if (err.code === "P2002" && err.meta?.target?.includes?.("email")) throw domainError("EMAIL_TAKEN");
      // learnerCode collision — retry with a freshly generated one.
      if (err.code === "P2002" && attempt < 2) continue;
      throw err;
    }
  }

  await auditLog(adminId, "LEARNER_CREATED", {
    userId: created.id, email: created.email, fullName: created.fullName,
    learnerCode: created.learnerProfile?.learnerCode ?? null,
  });

  return mapLearner(created);
}

async function updateLearner(id, { profile, user }, adminId) {
  await assertIsLearner(id);

  const hasProfileWrite = Object.keys(profile).length > 0;
  // Only the CREATE half of the upsert needs a learnerCode — checking existence
  // up front avoids generating (and possibly colliding on) a code on every
  // update of a learner who already has a profile, which is the common case.
  const existingProfile = hasProfileWrite
    ? await prisma.learnerProfile.findUnique({ where: { userId: id }, select: { id: true } })
    : null;

  let updated;
  for (let attempt = 0; ; attempt++) {
    try {
      updated = await prisma.appUser.update({
        where: { id },
        data: {
          ...user,
          ...(hasProfileWrite
            ? existingProfile
              ? { learnerProfile: { update: profile } }
              : { learnerProfile: { create: { ...profile, learnerCode: await generateLearnerCode() } } }
            : {}),
        },
        select: LEARNER_SELECT,
      });
      break;
    } catch (err) {
      // learnerCode race on first-ever profile creation — same retry as
      // createLearner. Anything else (including a genuine email/unique clash
      // on `user`) is rethrown untouched.
      if (!existingProfile && err.code === "P2002" && err.meta?.target?.includes?.("learnerCode") && attempt < 2) continue;
      throw err;
    }
  }

  await auditLog(adminId, "LEARNER_PROFILE_UPDATED", {
    userId: id, fields: [...Object.keys(profile), ...Object.keys(user)],
  });

  return mapLearner(updated);
}

async function suspendLearner(id, body, adminId) {
  await assertIsLearner(id);
  await usersService.suspendUser(id, body, { id: adminId });
  return getLearner(id);
}

async function reactivateLearner(id, body, adminId) {
  await assertIsLearner(id);
  await usersService.reactivateUser(id, body, { id: adminId });
  return getLearner(id);
}

async function resetLearnerPassword(id, { newPassword }, adminId) {
  await assertIsLearner(id);
  await usersService.resetUserPassword(id, { newPassword }, { id: adminId });
  return { id };
}

// ── Suspension history (same read as instructors — audit log, not a table) ──────

const SUSPENSION_ACTIONS = ["USER_SUSPENDED", "USER_REACTIVATED"];
const SUSPENSION_ACTION_LABEL = { USER_SUSPENDED: "suspended", USER_REACTIVATED: "reactivated" };

function detailString(details, key) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const value = details[key];
  return typeof value === "string" && value.trim() ? value : null;
}

async function getSuspensionHistory(id, { page = 1, limit = 20 } = {}) {
  await assertIsLearner(id);

  const where = { targetUserId: id, action: { in: SUSPENSION_ACTIONS } };
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    safe(() => prisma.auditLog.count({ where }), 0),
    safe(() => prisma.auditLog.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take: limit,
      select: {
        id: true, action: true, details: true, createdAt: true, adminId: true,
        admin: { select: { fullName: true } },
      },
    }), []),
  ]);

  return {
    history: rows.map((r) => ({
      id: r.id,
      action: SUSPENSION_ACTION_LABEL[r.action] ?? r.action,
      reason: detailString(r.details, "reason"),
      notes: detailString(r.details, "notes"),
      violationType: detailString(r.details, "violationType"),
      adminId: r.adminId ?? null,
      adminName: r.admin?.fullName ?? null,
      createdAt: iso(r.createdAt),
    })),
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

// Soft delete — mirrors instructors.deleteInstructor. Blocked while they still
// own non-terminal enrollments (an archived learner losing in-progress work
// silently would be worse than a 409 the admin has to acknowledge).
async function deleteLearner(id, adminId) {
  await assertIsLearner(id);

  const activeEnrollments = await prisma.courseEnrollment.count({
    where: { userId: id, status: { not: "COMPLETED" } },
  });
  if (activeEnrollments > 0) {
    throw Object.assign(domainError("LEARNER_HAS_ACTIVE_ENROLLMENTS"), { blockers: { activeEnrollments } });
  }

  await usersService.deleteUser(id, { id: adminId });
  await auditLog(adminId, "LEARNER_DELETED", { userId: id });

  return { id };
}

// ── Enrollments (Part 3 — thin wrappers over enrollments.service, NOT a
// second implementation; see ENROLLMENTS_CONTRACT.md addendum) ─────────────────

async function listLearnerEnrollments(id, query = {}) {
  await assertIsLearner(id);
  return enrollmentsService.listEnrollments({ ...query, userId: id });
}

// learningPathId has no FK on CourseEnrollment — expands into one enrollment
// per COURSE item in the path (blueprint 06 §3: "Assign learning path" is
// documented as the path variant of the same enrollment mutation, not a
// different write). LIVE_SESSION items in the path are skipped: there is no
// enrollment concept for live sessions in this system.
async function enrollLearnerInPath(learnerId, pathId, extra, adminId) {
  const path = await prisma.learningPath.findUnique({ where: { id: pathId }, select: { id: true } });
  if (!path) throw domainError("LEARNING_PATH_NOT_FOUND");

  const items = await prisma.learningPathItem.findMany({
    where: { pathId, itemType: "COURSE" },
    select: { itemId: true },
  });
  if (items.length === 0) throw domainError("LEARNING_PATH_EMPTY");

  const results = [];
  for (const item of items) {
    try {
      // enrollments.service.createEnrollment already writes ENROLLMENT_CREATED
      // for this exact write — a second LEARNER_ENROLLED row here would double
      // the activity feed for one event (same rule instructor.suspend follows
      // for USER_SUSPENDED). No audit call needed on this path.
      const enrollment = await enrollmentsService.createEnrollment(
        { courseId: item.itemId, userId: learnerId, ...extra }, adminId,
      );
      results.push({ courseId: item.itemId, success: true, enrollment });
    } catch (err) {
      // ALREADY_ENROLLED / COURSE_FULL / COURSE_ARCHIVED etc. on ONE course
      // must not abort the rest of the path — same partial-success shape as
      // bulkEnrollLearners below.
      results.push({ courseId: item.itemId, success: false, error: err.code ?? "UNKNOWN_ERROR" });
    }
  }
  return {
    pathId,
    enrolledCount: results.filter((r) => r.success).length,
    results,
  };
}

async function createLearnerEnrollment(id, { courseId, learningPathId, startDate, expiryDate, cohortId }, adminId) {
  await assertIsLearner(id);
  const extra = { startDate, expiryDate, cohortId };

  if (learningPathId) return enrollLearnerInPath(id, learningPathId, extra, adminId);

  // No LEARNER_ENROLLED audit call — enrollments.service already writes
  // ENROLLMENT_CREATED for this write (see enrollLearnerInPath's comment).
  return enrollmentsService.createEnrollment({ courseId, userId: id, ...extra }, adminId);
}

async function deleteLearnerEnrollment(id, enrollmentId, adminId) {
  await assertIsLearner(id);

  // Scope the lookup to THIS learner — same rule as instructorDocuments'
  // assertDocumentOf: an enrollment id belonging to someone else answers 404,
  // not a cross-learner unenroll.
  const enrollment = await prisma.courseEnrollment.findFirst({
    where: { id: enrollmentId, userId: id },
    select: { id: true },
  });
  if (!enrollment) throw domainError("ENROLLMENT_NOT_FOUND");

  // No LEARNER_UNENROLLED audit call — enrollments.service already writes
  // ENROLLMENT_DELETED for this write.
  return enrollmentsService.deleteEnrollment(enrollmentId, adminId);
}

// Partial-success by design — enrolling 50 learners in a course where 3 are
// already enrolled should enroll the other 47, not fail the whole batch.
async function bulkEnrollLearners({ learnerIds, courseId, learningPathId, startDate, expiryDate, cohortId }, adminId) {
  const extra = { startDate, expiryDate, cohortId };
  const results = [];

  for (const learnerId of learnerIds) {
    try {
      await assertIsLearner(learnerId);
      // No audit call here either — enrollments.service writes ENROLLMENT_CREATED
      // per row (see enrollLearnerInPath's comment on the same reasoning).
      const outcome = learningPathId
        ? await enrollLearnerInPath(learnerId, learningPathId, extra, adminId)
        : await enrollmentsService.createEnrollment({ courseId, userId: learnerId, ...extra }, adminId);
      results.push({ learnerId, success: true, result: outcome });
    } catch (err) {
      results.push({ learnerId, success: false, error: err.code ?? "UNKNOWN_ERROR" });
    }
  }

  return {
    enrolledCount: results.filter((r) => r.success).length,
    failedCount: results.filter((r) => !r.success).length,
    results,
  };
}

// ── Progress (Part 3) ────────────────────────────────────────────────────────────

async function getLearnerProgress(id) {
  await assertIsLearner(id);
  const rows = await safe(
    () => prisma.courseEnrollment.findMany({
      where: { userId: id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, courseId: true, progress: true, status: true, completedAt: true, updatedAt: true,
        course: { select: { title: true, thumbnail: true } },
      },
    }),
    [],
  );
  return {
    courses: rows.map((r) => ({
      enrollmentId: r.id,
      courseId: r.courseId,
      courseTitle: r.course?.title ?? null,
      courseThumbnail: r.course?.thumbnail ?? null,
      progress: r.progress,
      status: r.status,
      completedAt: iso(r.completedAt),
      updatedAt: iso(r.updatedAt),
    })),
  };
}

async function resetLearnerProgress(id, courseId, adminId) {
  await assertIsLearner(id);

  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { courseId_userId: { courseId, userId: id } },
    select: { id: true },
  });
  if (!enrollment) throw domainError("ENROLLMENT_NOT_FOUND");

  const updated = await prisma.courseEnrollment.update({
    where: { id: enrollment.id },
    data: { progress: 0, status: "NOT_STARTED", completedAt: null },
    select: { id: true, courseId: true, progress: true, status: true, completedAt: true, updatedAt: true },
  });

  await auditLog(adminId, "LEARNER_PROGRESS_RESET", { userId: id, courseId });

  return {
    enrollmentId: updated.id, courseId: updated.courseId,
    progress: updated.progress, status: updated.status,
    completedAt: iso(updated.completedAt), updatedAt: iso(updated.updatedAt),
  };
}

// ── Activity (Part 3) ────────────────────────────────────────────────────────────
//
// Real sources only, merged and sorted — never a fabricated feed:
//   • login            <- AppUserSession.createdAt (real: a session row IS a login)
//   • quiz_attempt     <- QuizAttempt (learners.prisma, shipped Part 1)
//   • session_attended <- SessionAttendance (learners.prisma, shipped Part 1)
//   • lesson_viewed / video_watched / assignment_upload — NO source table
//     exists anywhere in this system (Step 0 audit: no lesson-progress-event
//     model, no Assignment model at all). They stay listed in the `type`
//     filter's allowed values (so a caller asking for them gets a clean empty
//     result, not a 400) but never appear in the unfiltered feed.
const ACTIVITY_LIMIT_DEFAULT = 20;

async function getLearnerActivity(id, { page = 1, limit = ACTIVITY_LIMIT_DEFAULT, type } = {}) {
  await assertIsLearner(id);

  const NO_SOURCE_TYPES = new Set(["lesson_viewed", "video_watched", "assignment_upload"]);
  if (type && NO_SOURCE_TYPES.has(type)) {
    return { activities: [], pagination: { total: 0, page, limit, pages: 1 }, unavailableTypes: [...NO_SOURCE_TYPES] };
  }

  const wantsLogin = !type || type === "login";
  const wantsQuiz  = !type || type === "quiz_attempt";
  const wantsSession = !type || type === "session_attended";

  // Fetch a bounded window from each real source, merge, sort, then paginate
  // in memory — same tradeoff as instructors.service's buildActivityFeed
  // (four sources merged client-side there too), scaled up slightly since
  // this feed supports pagination rather than a fixed top-10.
  const FETCH_WINDOW = page * limit + limit;

  const [logins, quizAttempts, attendance] = await Promise.all([
    wantsLogin ? safe(() => prisma.appUserSession.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: FETCH_WINDOW,
      select: { id: true, createdAt: true, ipAddress: true },
    }), []) : [],
    wantsQuiz ? safe(() => prisma.quizAttempt.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: FETCH_WINDOW,
      select: { id: true, createdAt: true, status: true, score: true, quiz: { select: { title: true } } },
    }), []) : [],
    wantsSession ? safe(() => prisma.sessionAttendance.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: FETCH_WINDOW,
      select: { id: true, createdAt: true, status: true, session: { select: { title: true } } },
    }), []) : [],
  ]);

  const merged = [
    ...logins.map((l) => ({
      id: `login_${l.id}`, type: "login",
      title: l.ipAddress ? `Logged in from ${l.ipAddress}` : "Logged in",
      createdAt: iso(l.createdAt),
    })),
    ...quizAttempts.map((a) => ({
      id: `quiz_${a.id}`, type: "quiz_attempt",
      title: `Attempted quiz "${a.quiz?.title ?? "Untitled"}"${a.score != null ? ` — scored ${a.score}` : ""}`,
      createdAt: iso(a.createdAt),
    })),
    ...attendance.map((s) => ({
      id: `session_${s.id}`, type: "session_attended",
      title: `${s.status === "PRESENT" ? "Attended" : s.status === "LATE" ? "Joined late to" : "Marked absent for"} "${s.session?.title ?? "a live session"}"`,
      createdAt: iso(s.createdAt),
    })),
  ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const total = merged.length;
  const skip = (page - 1) * limit;
  const activities = merged.slice(skip, skip + limit);

  return {
    activities,
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    unavailableTypes: [...NO_SOURCE_TYPES],
  };
}

// ── Assessments (Part 5) — QuizAttempt, shipped Part 1 ──────────────────────────
//
// The admin-facing half of a runtime that has no learner-facing half yet (see
// QuizAttempt's schema comment) — reopen/reset/grade are admin actions on
// existing rows, not a retake flow a learner triggers themselves.

const ASSESSMENT_SELECT = {
  id: true, quizId: true, status: true, score: true, feedback: true, attemptNo: true,
  startedAt: true, submittedAt: true, gradedAt: true, gradedById: true,
  createdAt: true, updatedAt: true,
  quiz: { select: { title: true, passingGrade: true, course: { select: { id: true, title: true } } } },
};

function mapAssessment(a) {
  return {
    id: a.id,
    quizId: a.quizId,
    quizTitle: a.quiz?.title ?? null,
    passingGrade: a.quiz?.passingGrade ?? null,
    courseId: a.quiz?.course?.id ?? null,
    courseTitle: a.quiz?.course?.title ?? null,
    status: a.status,
    score: a.score,
    feedback: a.feedback ?? null,
    attemptNo: a.attemptNo,
    startedAt: iso(a.startedAt),
    submittedAt: iso(a.submittedAt),
    gradedAt: iso(a.gradedAt),
    gradedById: a.gradedById ?? null,
    createdAt: iso(a.createdAt),
    updatedAt: iso(a.updatedAt),
  };
}

async function assertAttemptOf(learnerId, attemptId) {
  const attempt = await prisma.quizAttempt.findFirst({ where: { id: attemptId, userId: learnerId }, select: { id: true } });
  if (!attempt) throw domainError("ATTEMPT_NOT_FOUND");
  return attempt;
}

async function listLearnerAssessments(id, { page = 1, limit = 20 } = {}) {
  await assertIsLearner(id);
  const where = { userId: id };
  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    safe(() => prisma.quizAttempt.count({ where }), 0),
    safe(() => prisma.quizAttempt.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take: limit, select: ASSESSMENT_SELECT,
    }), []),
  ]);

  return {
    assessments: rows.map(mapAssessment),
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

async function reopenAssessment(id, attemptId, adminId) {
  await assertAttemptOf(id, attemptId);
  const updated = await prisma.quizAttempt.update({
    where: { id: attemptId },
    data: { status: "REOPENED" },
    select: ASSESSMENT_SELECT,
  });
  await auditLog(adminId, "LEARNER_ASSESSMENT_REOPENED", { userId: id, attemptId });
  return mapAssessment(updated);
}

// Full reset — clears the graded result and starts a fresh attempt count, not
// just a status flip (that's reopenAssessment). Distinct verbs, distinct effects.
async function resetAssessment(id, attemptId, adminId) {
  await assertAttemptOf(id, attemptId);
  const updated = await prisma.quizAttempt.update({
    where: { id: attemptId },
    data: {
      status: "IN_PROGRESS", score: null, feedback: null,
      submittedAt: null, gradedAt: null, gradedById: null,
      attemptNo: { increment: 1 },
    },
    select: ASSESSMENT_SELECT,
  });
  await auditLog(adminId, "LEARNER_ASSESSMENT_RESET", { userId: id, attemptId });
  return mapAssessment(updated);
}

// Note: submittedAt is deliberately NOT touched here — grading an existing
// attempt doesn't imply a new submission just happened.
async function gradeAssessment(id, attemptId, { score, feedback }, adminId) {
  await assertAttemptOf(id, attemptId);
  const updated = await prisma.quizAttempt.update({
    where: { id: attemptId },
    data: { score, feedback, status: "GRADED", gradedAt: new Date(), gradedById: adminId ?? null },
    select: ASSESSMENT_SELECT,
  });
  await auditLog(adminId, "LEARNER_ASSESSMENT_GRADED", { userId: id, attemptId, score });
  return mapAssessment(updated);
}

// ── Certificates (Part 5) — thin wrappers over certificates.service, NOT a
// second implementation (Step 0 audit + CERTIFICATES_CONTRACT.md addendum) ──────

async function listLearnerCertificates(id, { page = 1, limit = 20 } = {}) {
  await assertIsLearner(id);
  const offset = (page - 1) * limit;
  const result = await certificatesService.listCertificates({ userId: id, limit, offset });
  return {
    certificates: result.items,
    pagination: { total: result.total, page, limit, pages: Math.max(1, Math.ceil(result.total / limit)) },
  };
}

async function assertCertificateOf(learnerId, certId) {
  const cert = await prisma.certificate.findFirst({ where: { id: certId, userId: learnerId }, select: { id: true } });
  if (!cert) throw domainError("CERT_NOT_FOUND");
  return cert;
}

async function reissueLearnerCertificate(id, certId, body, adminId) {
  await assertCertificateOf(id, certId);
  return certificatesService.reissueCertificate(certId, body, adminId);
}

async function revokeLearnerCertificate(id, certId, reason, adminId) {
  await assertCertificateOf(id, certId);
  return certificatesService.revokeCertificate(certId, adminId, reason);
}

// ── Attendance (Part 5) — SessionAttendance, shipped Part 1 ─────────────────────
// Read-only here (Part 5 asks for GET only; manual correction is [phase-later]
// per the model comment). Real rows only — a learner with zero session
// invitations simply has an empty list, never a fabricated one.

async function getLearnerAttendance(id, { page = 1, limit = 20 } = {}) {
  await assertIsLearner(id);
  const where = { userId: id };
  const skip = (page - 1) * limit;

  // Summary must cover ALL of this learner's attendance, not just the current
  // page's slice — a groupBy over the same `where`, not derived from `rows`
  // below (that would silently change the "summary" depending on which page
  // you're viewing).
  const [total, rows, statusGroups] = await Promise.all([
    safe(() => prisma.sessionAttendance.count({ where }), 0),
    safe(() => prisma.sessionAttendance.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take: limit,
      select: {
        id: true, status: true, joinedAt: true, leftAt: true, durationMin: true,
        participationScore: true, createdAt: true,
        session: { select: { id: true, title: true, startTime: true } },
      },
    }), []),
    safe(() => prisma.sessionAttendance.groupBy({ by: ["status"], where, _count: { _all: true } }), []),
  ]);

  const records = rows.map((r) => ({
    id: r.id,
    sessionId: r.session?.id ?? null,
    sessionTitle: r.session?.title ?? null,
    sessionStartTime: iso(r.session?.startTime ?? null),
    status: r.status,
    joinedAt: iso(r.joinedAt),
    leftAt: iso(r.leftAt),
    durationMin: r.durationMin,
    participationScore: r.participationScore,
    createdAt: iso(r.createdAt),
  }));

  const summary = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const g of statusGroups) {
    const key = g.status.toLowerCase();
    if (key in summary) summary[key] = g._count._all;
  }

  return {
    records,
    summary,
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

module.exports = {
  AT_RISK_THRESHOLD,
  listLearners,
  getLearner,
  getStats,
  getAnalytics,
  getTabCounts,
  createLearner,
  updateLearner,
  suspendLearner,
  reactivateLearner,
  resetLearnerPassword,
  getSuspensionHistory,
  deleteLearner,
  assertIsLearner,
  courseStatsFor,
  certificatesCountFor,
  listLearnerEnrollments,
  createLearnerEnrollment,
  deleteLearnerEnrollment,
  bulkEnrollLearners,
  getLearnerProgress,
  resetLearnerProgress,
  getLearnerActivity,
  listLearnerAssessments,
  reopenAssessment,
  resetAssessment,
  gradeAssessment,
  listLearnerCertificates,
  reissueLearnerCertificate,
  revokeLearnerCertificate,
  getLearnerAttendance,
};
