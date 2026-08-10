const prisma = require("../config/prisma");
const lmService = require("./lm.service");
const instructorsService = require("./instructors.service");
const learnersService = require("./learners.service");

// ── Reports & Analytics service — Part 1 (Core Analytics API) ──────────────
//
// R4 discipline (IMPACT_MAP): every metric that already has an owning module
// is READ from that module's exported getStats()/getAnalytics()/shared
// constant, never recomputed here — see the per-function comments below for
// which owner each reused field comes from. Metrics with no existing owner
// (learner activity/dropout-risk trends, instructor course-completion rollup,
// course drop-off, assessment/attendance/audit aggregates, engagement) are
// fresh Prisma aggregation, since nothing else in the codebase defines them
// yet — building them here does not fork an existing definition.
//
// Trend convention: unlike other modules' fixed "this month vs last month",
// every Reports endpoint takes a user-selectable `dateRange` (week/month/
// quarter/custom — see reports.validator's resolveDateRange), so `changePercent`
// here always means "current window vs the immediately preceding window of
// the SAME length" (see priorWindow()) — a deliberately different, but
// equally real, comparison basis from the rest of the app. Documented, not
// silently inconsistent.

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[reports.service] query failed:", err.message);
    return fallback;
  }
}

function metric(value, changePercent = null) {
  return { value, changePercent, available: true };
}
function unavailable(reason) {
  return { value: null, changePercent: null, available: false, reason };
}
function calcChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  if (previous == null || current == null) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// Current window's immediately-preceding window of the same length.
function priorWindow({ gte, lte }) {
  const span = lte.getTime() - gte.getTime();
  return { gte: new Date(gte.getTime() - span), lte: new Date(gte.getTime()) };
}

// Day buckets for spans <= 62 days, otherwise week buckets — keeps trend
// arrays a sane length for a quarter/custom range instead of ~90 daily points.
function buildTrendBuckets(gte, lte) {
  const spanMs = lte.getTime() - gte.getTime();
  const spanDays = spanMs / (24 * 60 * 60 * 1000);
  const stepMs = spanDays > 62 ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const buckets = [];
  let cursor = new Date(gte.getTime());
  while (cursor.getTime() < lte.getTime()) {
    const next = new Date(Math.min(cursor.getTime() + stepMs, lte.getTime()));
    buckets.push({ label: cursor.toISOString().slice(0, 10), from: new Date(cursor), to: next });
    cursor = next;
  }
  if (buckets.length === 0) buckets.push({ label: gte.toISOString().slice(0, 10), from: gte, to: lte });
  return buckets;
}

// Count rows per bucket for a model+dateField, one query per bucket (bounded
// by buildTrendBuckets' cap — at most ~13 buckets for a quarter). Optional
// extra `where` merged into every bucket query.
async function countByBuckets(model, dateField, buckets, where = {}) {
  const counts = await Promise.all(
    buckets.map((b) => safe(() => model.count({ where: { ...where, [dateField]: { gte: b.from, lt: b.to } } }), 0)),
  );
  return counts;
}

// ── 1. Overview ──────────────────────────────────────────────────────────

async function getOverview(query) {
  const { dateRange } = query;
  const prev = priorWindow(dateRange);

  const [
    totalUsersNow, totalUsersPrev,
    liveSessionsToday,
    systemActivityNow, systemActivityPrev,
    learnerStats, instructorStats, lmStats,
  ] = await Promise.all([
    safe(() => prisma.appUser.count({ where: { status: { not: "ARCHIVED" } } }), 0),
    safe(() => prisma.appUser.count({ where: { status: { not: "ARCHIVED" }, createdAt: { lt: dateRange.gte } } }), 0),

    // "Today" is a fixed calendar concept, independent of the dateRange picker.
    safe(() => {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      return prisma.liveSession.count({ where: { startTime: { gte: start, lt: end } } });
    }, 0),

    safe(() => prisma.auditLog.count({ where: { createdAt: { gte: dateRange.gte, lte: dateRange.lte } } }), 0),
    safe(() => prisma.auditLog.count({ where: { createdAt: { gte: prev.gte, lt: prev.lte } } }), 0),

    // Owned by learners.service.getStats() — activeLearners / avgProgress.
    learnersService.getStats(),
    // Owned by instructors.service.getStats() — activeInstructors.
    instructorsService.getStats(),
    // Owned by lm.service.getStats() — coursesCompleted / certificatesIssued.
    lmService.getStats(),
  ]);

  return {
    totalUsers: metric(totalUsersNow, calcChange(totalUsersNow, totalUsersPrev)),
    activeLearners: learnerStats.activeLearners,
    activeInstructors: instructorStats.activeInstructors,
    coursesCompleted: metric(lmStats.coursesCompleted.value, lmStats.coursesCompleted.growth),
    avgLearningProgress: learnerStats.avgProgress,
    liveSessionsToday: metric(liveSessionsToday, null),
    totalRevenue: unavailable("No Payment/Transaction model exists yet — ships with the Finance module."),
    certificatesIssued: metric(lmStats.certificatesIssued.value, lmStats.certificatesIssued.growth),
    engagementScore: unavailable("No engagement-scoring model exists yet — same gap Dashboard's studentEngagement metrics already have."),
    systemActivity: metric(systemActivityNow, calcChange(systemActivityNow, systemActivityPrev)),
  };
}

// ── 2. Learner Analytics ─────────────────────────────────────────────────

function buildLearnerUserWhere({ department }) {
  const where = { role: "LEARNER" };
  if (department) where.department = { equals: department, mode: "insensitive" };
  return where;
}

async function getLearnerAnalytics(query) {
  const { dateRange, department, cohort } = query;
  const userWhere = buildLearnerUserWhere({ department });
  const buckets = buildTrendBuckets(dateRange.gte, dateRange.lte);

  const enrollmentWhere = { user: userWhere };
  if (cohort) enrollmentWhere.cohortId = cohort;

  const [
    activeCounts,
    progressRows,
    completedByBucket, totalByBucket,
    highRisk, medRisk, lowRisk,
    topPerformers,
    inactiveUsers,
    activeNowIds, activePrevIds,
  ] = await Promise.all([
    countByBuckets(prisma.appUser, "lastActivityAt", buckets, userWhere),

    safe(() => prisma.courseEnrollment.groupBy({
      by: ["progress"],
      where: enrollmentWhere,
      _count: { _all: true },
    }), []),

    countByBuckets(prisma.courseEnrollment, "completedAt", buckets, { ...enrollmentWhere, status: "COMPLETED" }),
    countByBuckets(prisma.courseEnrollment, "createdAt", buckets, enrollmentWhere),

    safe(() => prisma.appUser.findMany({ where: { ...userWhere, learnerProfile: { riskScore: { gte: learnersService.AT_RISK_THRESHOLD } } }, orderBy: { learnerProfile: { riskScore: "desc" } }, take: 20, select: { id: true, fullName: true, learnerProfile: { select: { riskScore: true } } } }), []),
    safe(() => prisma.appUser.findMany({ where: { ...userWhere, learnerProfile: { riskScore: { gte: 40, lt: learnersService.AT_RISK_THRESHOLD } } }, orderBy: { learnerProfile: { riskScore: "desc" } }, take: 20, select: { id: true, fullName: true, learnerProfile: { select: { riskScore: true } } } }), []),
    safe(() => prisma.appUser.findMany({ where: { ...userWhere, learnerProfile: { riskScore: { lt: 40 } } }, orderBy: { learnerProfile: { riskScore: "desc" } }, take: 20, select: { id: true, fullName: true, learnerProfile: { select: { riskScore: true } } } }), []),

    safe(() => prisma.courseEnrollment.groupBy({
      by: ["userId"],
      where: enrollmentWhere,
      _avg: { progress: true },
      _count: { _all: true },
      orderBy: { _avg: { progress: "desc" } },
      take: 10,
    }), []),

    safe(() => prisma.appUser.findMany({
      where: { ...userWhere, OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: dateRange.gte } }] },
      orderBy: { lastActivityAt: "asc" },
      take: 20,
      select: { id: true, fullName: true, lastActivityAt: true },
    }), []),

    safe(() => prisma.appUser.findMany({ where: { ...userWhere, lastActivityAt: { gte: dateRange.gte, lte: dateRange.lte } }, select: { id: true } }), []),
    safe(() => prisma.appUser.findMany({ where: { ...userWhere, lastActivityAt: { gte: priorWindow(dateRange).gte, lt: priorWindow(dateRange).lte } }, select: { id: true } }), []),
  ]);

  const bucketOf = (p) => (p >= 90 ? "excellent" : p >= 70 ? "good" : p >= 40 ? "average" : "poor");
  const progressDistribution = { excellent: 0, good: 0, average: 0, poor: 0 };
  for (const row of progressRows) progressDistribution[bucketOf(row.progress)] += row._count._all;

  // Per-bucket rate = enrollments that both started AND completed within that
  // bucket, divided by enrollments that started in it — a cohort-style read,
  // not "% of all-time enrollments completed by this date".
  const completionTrend = buckets.map((_, i) => (totalByBucket[i] > 0 ? Math.round((completedByBucket[i] / totalByBucket[i]) * 100) : 0));
  const totalCompleted = completedByBucket.reduce((s, v) => s + v, 0);
  const totalStarted = totalByBucket.reduce((s, v) => s + v, 0);
  const completionRateValue = totalStarted > 0 ? Math.round((totalCompleted / totalStarted) * 100) : 0;

  const topPerformerIds = topPerformers.map((r) => r.userId);
  const topPerformerUsers = topPerformerIds.length
    ? await safe(() => prisma.appUser.findMany({ where: { id: { in: topPerformerIds } }, select: { id: true, fullName: true } }), [])
    : [];
  const topPerformerNameById = new Map(topPerformerUsers.map((u) => [u.id, u.fullName]));

  const activePrevSet = new Set(activePrevIds.map((u) => u.id));
  const retained = activeNowIds.filter((u) => activePrevSet.has(u.id)).length;
  const retentionRateValue = activePrevSet.size > 0 ? Math.round((retained / activePrevSet.size) * 100) : 0;

  const mapRiskUser = (u) => ({ id: u.id, name: u.fullName, riskScore: u.learnerProfile?.riskScore ?? null });

  return {
    activityTrend: { labels: buckets.map((b) => b.label), activeUsers: activeCounts },
    progressDistribution,
    completionRate: { value: completionRateValue, trend: completionTrend },
    dropoutRisk: { high: highRisk.map(mapRiskUser), medium: medRisk.map(mapRiskUser), low: lowRisk.map(mapRiskUser) },
    retentionRate: metric(retentionRateValue, calcChange(retentionRateValue, null)),
    topPerformers: topPerformers.map((r) => ({
      userId: r.userId,
      name: topPerformerNameById.get(r.userId) ?? null,
      avgProgress: Math.round(r._avg.progress ?? 0),
      enrollments: r._count._all,
    })),
    inactiveUsers: inactiveUsers.map((u) => ({ id: u.id, name: u.fullName, lastActivityAt: u.lastActivityAt ? u.lastActivityAt.toISOString() : null })),
  };
}

// ── 3. Instructor Analytics ──────────────────────────────────────────────

async function getInstructorAnalytics(query) {
  const { dateRange } = query;

  const [instructorStats, topIds, instructors] = await Promise.all([
    // avgRating unavailable is owned by instructors.service.getStats() — reused verbatim.
    instructorsService.getStats(),
    // "Top instructor" has exactly one definition — instructors.service.getTopInstructorIds().
    instructorsService.getTopInstructorIds(),
    safe(() => prisma.appUser.findMany({ where: { role: "INSTRUCTOR", status: { not: "ARCHIVED" } }, select: { id: true, fullName: true } }), []),
  ]);

  const instructorIds = instructors.map((i) => i.id);

  const [courseGroups, enrollmentGroups, perInstructorEnrollmentRows, sessionRows, attendanceAgg] = await Promise.all([
    safe(() => prisma.course.groupBy({ by: ["instructorId", "status"], where: { instructorId: { in: instructorIds } }, _count: { _all: true } }), []),
    // Completion rate = % of enrollments in THIS instructor's courses that
    // are COMPLETED — an enrollment/student-outcome metric, deliberately NOT
    // "% of their courses that are published" (that's a separate, real
    // concept already exposed below as publishedCourses).
    safe(() => prisma.courseEnrollment.groupBy({ by: ["status"], where: { course: { instructorId: { in: instructorIds } } }, _count: { _all: true } }), []),
    // Per-instructor breakdown of the same metric (for the Instructor
    // Analytics tab's completion-rate bar chart) — Prisma's groupBy can't
    // group by a nested relation field (course.instructorId), hence raw SQL.
    instructorIds.length > 0 ? safe(() => prisma.$queryRaw`
      SELECT c."instructorId" AS "instructorId", e."status" AS status, COUNT(*)::int AS count
      FROM "course_enrollments" e
      JOIN "courses" c ON c."id" = e."courseId"
      WHERE c."instructorId" = ANY(${instructorIds}::text[])
      GROUP BY c."instructorId", e."status"`,
    []) : [],
    safe(() => prisma.liveSession.findMany({ where: { instructorId: { in: instructorIds }, startTime: { gte: dateRange.gte, lte: dateRange.lte } }, select: { id: true, instructorId: true } }), []),
    safe(() => prisma.sessionAttendance.groupBy({ by: ["status"], where: { session: { instructorId: { in: instructorIds }, startTime: { gte: dateRange.gte, lte: dateRange.lte } } }, _count: { _all: true } }), []),
  ]);

  const publishedByInstructor = new Map();
  const totalByInstructor = new Map();
  for (const g of courseGroups) {
    totalByInstructor.set(g.instructorId, (totalByInstructor.get(g.instructorId) ?? 0) + g._count._all);
    if (g.status === "PUBLISHED") publishedByInstructor.set(g.instructorId, (publishedByInstructor.get(g.instructorId) ?? 0) + g._count._all);
  }
  const totalEnrollments = enrollmentGroups.reduce((s, g) => s + g._count._all, 0);
  const completedEnrollments = enrollmentGroups.filter((g) => g.status === "COMPLETED").reduce((s, g) => s + g._count._all, 0);
  const courseCompletionRateValue = totalEnrollments > 0 ? Math.round((completedEnrollments / totalEnrollments) * 100) : 0;

  const enrollmentTotalsByInstructor = new Map();
  const enrollmentCompletedByInstructor = new Map();
  for (const row of perInstructorEnrollmentRows) {
    const count = Number(row.count) || 0;
    enrollmentTotalsByInstructor.set(row.instructorId, (enrollmentTotalsByInstructor.get(row.instructorId) ?? 0) + count);
    if (row.status === "COMPLETED") enrollmentCompletedByInstructor.set(row.instructorId, (enrollmentCompletedByInstructor.get(row.instructorId) ?? 0) + count);
  }
  function completionRateFor(id) {
    const total = enrollmentTotalsByInstructor.get(id) ?? 0;
    if (total === 0) return null;
    return Math.round(((enrollmentCompletedByInstructor.get(id) ?? 0) / total) * 100);
  }

  const sessionsByInstructor = new Map();
  for (const s of sessionRows) sessionsByInstructor.set(s.instructorId, (sessionsByInstructor.get(s.instructorId) ?? 0) + 1);

  const attendanceTotal = attendanceAgg.reduce((s, g) => s + g._count._all, 0);
  const attendancePresent = attendanceAgg.filter((g) => g.status === "PRESENT" || g.status === "LATE").reduce((s, g) => s + g._count._all, 0);
  const liveSessionAttendanceValue = attendanceTotal > 0 ? Math.round((attendancePresent / attendanceTotal) * 100) : 0;

  const nameById = new Map(instructors.map((i) => [i.id, i.fullName]));
  const topInstructors = topIds.map((id) => ({
    id,
    name: nameById.get(id) ?? null,
    publishedCourses: publishedByInstructor.get(id) ?? 0,
    liveSessions: sessionsByInstructor.get(id) ?? 0,
  }));

  const performanceComparison = instructors.map((i) => ({
    id: i.id,
    name: i.fullName,
    publishedCourses: publishedByInstructor.get(i.id) ?? 0,
    totalCourses: totalByInstructor.get(i.id) ?? 0,
    liveSessions: sessionsByInstructor.get(i.id) ?? 0,
    completionRate: completionRateFor(i.id),
  })).sort((a, b) => b.publishedCourses - a.publishedCourses).slice(0, query.limit ?? 20);

  return {
    avgRating: instructorStats.avgRating,
    courseCompletionRate: totalEnrollments > 0 ? metric(courseCompletionRateValue, null) : unavailable("No enrollments in any instructor's courses."),
    liveSessionAttendance: attendanceTotal > 0 ? metric(liveSessionAttendanceValue, null) : unavailable("No live sessions with recorded attendance in this window."),
    topInstructors,
    performanceComparison,
  };
}

// ── 4. Course Analytics ──────────────────────────────────────────────────

async function getCourseAnalytics(query) {
  const { dateRange, categoryId } = query;
  const buckets = buildTrendBuckets(dateRange.gte, dateRange.lte);
  const courseWhere = categoryId ? { categoryId } : {};

  const [
    enrollmentCounts,
    courseRows,
    categoryGroups,
  ] = await Promise.all([
    countByBuckets(prisma.courseEnrollment, "createdAt", buckets, { course: courseWhere }),

    safe(() => prisma.course.findMany({
      where: { ...courseWhere, status: { not: "ARCHIVED" } },
      select: {
        id: true, title: true, category: true,
        _count: { select: { enrollments: true } },
      },
    }), []),

    safe(() => prisma.$queryRaw`
      SELECT c."category" AS category, AVG(e."progress")::float AS "avgProgress", COUNT(DISTINCT e."id")::int AS enrollments
      FROM "courses" c
      JOIN "course_enrollments" e ON e."courseId" = c."id"
      WHERE c."status" <> 'ARCHIVED'
      GROUP BY c."category"
      ORDER BY "avgProgress" DESC NULLS LAST`,
    []),
  ]);

  const courseIds = courseRows.map((c) => c.id);
  const completionByCourse = courseIds.length
    ? await safe(() => prisma.courseEnrollment.groupBy({ by: ["courseId"], where: { courseId: { in: courseIds }, status: "COMPLETED" }, _count: { _all: true } }), [])
    : [];
  const completedById = new Map(completionByCourse.map((r) => [r.courseId, r._count._all]));

  const completionRates = courseRows
    .map((c) => ({
      id: c.id,
      title: c.title,
      enrollments: c._count.enrollments,
      completed: completedById.get(c.id) ?? 0,
      completionRate: c._count.enrollments > 0 ? Math.round(((completedById.get(c.id) ?? 0) / c._count.enrollments) * 100) : 0,
    }))
    .sort((a, b) => b.completionRate - a.completionRate);

  const mostPopular = [...courseRows]
    .sort((a, b) => b._count.enrollments - a._count.enrollments)
    .slice(0, 10)
    .map((c) => ({ id: c.id, title: c.title, enrollments: c._count.enrollments }));

  const bestCategories = categoryGroups.slice(0, 8).map((r) => ({
    name: r.category ?? "Uncategorized",
    avgProgress: Math.round(Number(r.avgProgress) || 0),
    enrollments: Number(r.enrollments) || 0,
  }));

  return {
    enrollmentTrend: { labels: buckets.map((b) => b.label), values: enrollmentCounts },
    completionRates: completionRates.slice(0, 20),
    mostPopular,
    // Would require a per-lesson/per-video progress-checkpoint model (which
    // lesson a learner dropped off at) — CourseEnrollment only stores an
    // overall 0-100 progress percent, not a position within the course.
    dropOffPoints: unavailable("No per-lesson progress checkpoint model exists — CourseEnrollment only stores an overall progress percent."),
    bestCategories,
    // Same "no watch-time model" gap confirmed everywhere else in the app.
    watchTime: unavailable("No watch-time/video-progress tracking model exists yet."),
  };
}

// ── 5. Assessment Reports ────────────────────────────────────────────────

async function getAssessmentReports(query) {
  const { dateRange, courseId, page, limit } = query;
  const where = { submittedAt: { gte: dateRange.gte, lte: dateRange.lte } };
  if (courseId) where.quiz = { courseId };

  const skip = (page - 1) * limit;

  const [total, gradedAgg, passCount, failCount, rows] = await Promise.all([
    safe(() => prisma.quizAttempt.count({ where }), 0),
    safe(() => prisma.quizAttempt.aggregate({ where: { ...where, score: { not: null } }, _avg: { score: true }, _count: { _all: true } }), { _avg: { score: null }, _count: { _all: 0 } }),
    // Passing convention: same 60% default used by Quiz.passingGrade / Competencies' assessment default.
    safe(() => prisma.quizAttempt.count({ where: { ...where, score: { gte: 60 } } }), 0),
    safe(() => prisma.quizAttempt.count({ where: { ...where, score: { not: null, lt: 60 } } }), 0),
    safe(() => prisma.quizAttempt.findMany({
      where, orderBy: { submittedAt: "desc" }, skip, take: limit,
      select: {
        id: true, score: true, status: true, submittedAt: true, attemptNo: true,
        user: { select: { id: true, fullName: true } },
        quiz: { select: { id: true, title: true, courseId: true } },
      },
    }), []),
  ]);

  const gradedTotal = gradedAgg._count._all;
  const passRateValue = gradedTotal > 0 ? Math.round((passCount / gradedTotal) * 100) : 0;
  const failRateValue = gradedTotal > 0 ? Math.round((failCount / gradedTotal) * 100) : 0;

  return {
    totalAttempts: metric(total, null),
    avgScore: gradedTotal > 0 ? metric(Math.round(gradedAgg._avg.score ?? 0), null) : unavailable("No graded quiz attempts in this window."),
    passRate: gradedTotal > 0 ? metric(passRateValue, null) : unavailable("No graded quiz attempts in this window."),
    failRate: gradedTotal > 0 ? metric(failRateValue, null) : unavailable("No graded quiz attempts in this window."),
    recentAttempts: rows.map((r) => ({
      id: r.id,
      userId: r.user?.id ?? null,
      userName: r.user?.fullName ?? null,
      quizId: r.quiz?.id ?? null,
      quizTitle: r.quiz?.title ?? null,
      score: r.score,
      status: r.status,
      attemptNo: r.attemptNo,
      submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
    })),
    // Would require a per-question response/answer-log model — QuizAttempt
    // only stores the final score, not which questions were missed.
    hardestQuestions: unavailable("No per-question response log exists — QuizAttempt stores only the final score."),
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

// ── 6. Certificate Reports ───────────────────────────────────────────────

async function getCertificateReports(query) {
  const { dateRange, page, limit } = query;
  const prev = priorWindow(dateRange);
  const buckets = buildTrendBuckets(dateRange.gte, dateRange.lte);
  const skip = (page - 1) * limit;

  const [issuedNow, issuedPrev, revoked, issuedTrend, rows, total] = await Promise.all([
    safe(() => prisma.certificate.count({ where: { revokedAt: null, issuedAt: { gte: dateRange.gte, lte: dateRange.lte } } }), 0),
    safe(() => prisma.certificate.count({ where: { revokedAt: null, issuedAt: { gte: prev.gte, lt: prev.lte } } }), 0),
    safe(() => prisma.certificate.count({ where: { revokedAt: { not: null } } }), 0),
    countByBuckets(prisma.certificate, "issuedAt", buckets, { revokedAt: null }),
    safe(() => prisma.certificate.findMany({
      where: { issuedAt: { gte: dateRange.gte, lte: dateRange.lte } },
      orderBy: { issuedAt: "desc" }, skip, take: limit,
      select: {
        id: true, issuedAt: true, revokedAt: true, verificationCode: true,
        course: { select: { id: true, title: true } },
        user: { select: { id: true, fullName: true } },
      },
    }), []),
    safe(() => prisma.certificate.count({ where: { issuedAt: { gte: dateRange.gte, lte: dateRange.lte } } }), 0),
  ]);

  return {
    totalIssued: metric(issuedNow, calcChange(issuedNow, issuedPrev)),
    // Certificate has no expiresAt field in this schema — every certificate
    // is issued without an expiration.
    expired: unavailable("Certificate model has no expiry field — certificates don't expire in this schema."),
    revoked: metric(revoked, null),
    verificationRequests: unavailable("No tracking of public certificate-verification page hits exists yet."),
    issuedTrend: { labels: buckets.map((b) => b.label), values: issuedTrend },
    recentCertificates: rows.map((c) => ({
      id: c.id,
      courseId: c.course?.id ?? null,
      courseTitle: c.course?.title ?? null,
      userId: c.user?.id ?? null,
      userName: c.user?.fullName ?? null,
      issuedAt: c.issuedAt.toISOString(),
      revoked: c.revokedAt !== null,
      verificationCode: c.verificationCode ?? null,
    })),
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

// ── 7. Attendance Reports ────────────────────────────────────────────────

async function getAttendanceReports(query) {
  const { dateRange, page, limit } = query;
  const buckets = buildTrendBuckets(dateRange.gte, dateRange.lte);
  const skip = (page - 1) * limit;

  const where = { session: { startTime: { gte: dateRange.gte, lte: dateRange.lte } } };

  const [statusGroups, total, rows, trendRows] = await Promise.all([
    safe(() => prisma.sessionAttendance.groupBy({ by: ["status"], where, _count: { _all: true } }), []),
    safe(() => prisma.sessionAttendance.count({ where }), 0),
    safe(() => prisma.sessionAttendance.findMany({
      where, orderBy: { session: { startTime: "desc" } }, skip, take: limit,
      select: {
        id: true, status: true, joinedAt: true, leftAt: true,
        session: { select: { id: true, title: true, startTime: true } },
        user: { select: { id: true, fullName: true } },
      },
    }), []),
    Promise.all(buckets.map((b) =>
      safe(() => prisma.sessionAttendance.groupBy({ by: ["status"], where: { session: { startTime: { gte: b.from, lt: b.to } } }, _count: { _all: true } }), []),
    )),
  ]);

  const countOf = (status) => statusGroups.find((g) => g.status === status)?._count._all ?? 0;
  const present = countOf("PRESENT");
  const late = countOf("LATE");
  const absent = countOf("ABSENT");
  const excused = countOf("EXCUSED");
  const overallRateValue = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

  const trendValues = trendRows.map((groups) => {
    const t = groups.reduce((s, g) => s + g._count._all, 0);
    const p = groups.filter((g) => g.status === "PRESENT" || g.status === "LATE").reduce((s, g) => s + g._count._all, 0);
    return t > 0 ? Math.round((p / t) * 100) : 0;
  });

  const wrap = (v) => (total > 0 ? metric(v, null) : unavailable("No recorded session attendance in this window."));

  return {
    overallRate: wrap(overallRateValue),
    present: wrap(present),
    late: wrap(late),
    absent: wrap(absent),
    excused: wrap(excused),
    sessionAttendance: rows.map((r) => ({
      id: r.id,
      sessionId: r.session?.id ?? null,
      sessionTitle: r.session?.title ?? null,
      sessionStartTime: r.session?.startTime ? r.session.startTime.toISOString() : null,
      userId: r.user?.id ?? null,
      userName: r.user?.fullName ?? null,
      status: r.status,
      joinedAt: r.joinedAt ? r.joinedAt.toISOString() : null,
      leftAt: r.leftAt ? r.leftAt.toISOString() : null,
    })),
    trend: { labels: buckets.map((b) => b.label), values: trendValues },
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

// ── 8. Audit Reports ──────────────────────────────────────────────────────
//
// Pattern copied from instructors.service.getSuspensionHistory /
// learners.service.getSuspensionHistory (count + findMany + pagination over
// AuditLog), generalized to accept action/userId/dateRange/search instead of
// their hard-coded targetUserId+SUSPENSION_ACTIONS — no generic audit-list
// endpoint existed anywhere before this.

async function getAuditReports(query) {
  const { dateRange, search, action, userId, page, limit } = query;
  const where = { createdAt: { gte: dateRange.gte, lte: dateRange.lte } };
  if (action) where.action = action;
  if (userId) where.OR = [{ adminId: userId }, { targetUserId: userId }];
  // `action` is a strictly-typed Prisma enum (~150 values) — `contains`
  // isn't even a valid operator for it, and `equals` with an unrecognized
  // string THROWS (caught by safe() below, silently returning 0 rows —
  // confirmed live: a free-text `action:{equals}` branch here made every
  // non-exact-enum search term return empty instead of erroring loudly).
  // Filtering by action is the dedicated `action` param above; `search`
  // only ever matches the admin's real name field.
  if (search) where.admin = { fullName: { contains: search, mode: "insensitive" } };

  const skip = (page - 1) * limit;

  const [total, rows] = await Promise.all([
    safe(() => prisma.auditLog.count({ where }), 0),
    safe(() => prisma.auditLog.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take: limit,
      select: {
        id: true, action: true, adminId: true, targetUserId: true, details: true, createdAt: true,
        admin: { select: { fullName: true } },
      },
    }), []),
  ]);

  return {
    logs: rows.map((r) => ({
      id: r.id,
      action: r.action,
      userId: r.adminId,
      userName: r.admin?.fullName ?? null,
      targetId: r.targetUserId,
      targetType: r.targetUserId ? "user" : null,
      metadata: r.details ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

// ── 9. Engagement Analytics ──────────────────────────────────────────────

async function getEngagementAnalytics(query) {
  const { dateRange } = query;
  const dayBuckets = buildTrendBuckets(dateRange.gte, dateRange.lte);

  // Weekly buckets always, independent of the day/week auto-switch above —
  // "Daily Active Users" and "Weekly Active Users" are two distinct charts
  // over the SAME window, not the same bucketing at two granularities.
  const weekBuckets = [];
  let cursor = new Date(dateRange.gte.getTime());
  while (cursor.getTime() < dateRange.lte.getTime()) {
    const next = new Date(Math.min(cursor.getTime() + 7 * 24 * 60 * 60 * 1000, dateRange.lte.getTime()));
    weekBuckets.push({ label: cursor.toISOString().slice(0, 10), from: new Date(cursor), to: next });
    cursor = next;
  }
  if (weekBuckets.length === 0) weekBuckets.push({ label: dateRange.gte.toISOString().slice(0, 10), from: dateRange.gte, to: dateRange.lte });

  const activeWhere = { status: { not: "ARCHIVED" } };

  const [dailyCounts, weeklyCounts, activeNow, activePrev, lowEngagement] = await Promise.all([
    countByBuckets(prisma.appUser, "lastActivityAt", dayBuckets, activeWhere),
    countByBuckets(prisma.appUser, "lastActivityAt", weekBuckets, activeWhere),
    safe(() => prisma.appUser.findMany({ where: { ...activeWhere, lastActivityAt: { gte: dateRange.gte, lte: dateRange.lte } }, select: { id: true } }), []),
    safe(() => prisma.appUser.findMany({ where: { ...activeWhere, lastActivityAt: { gte: priorWindow(dateRange).gte, lt: priorWindow(dateRange).lte } }, select: { id: true } }), []),
    safe(() => prisma.appUser.findMany({
      where: { ...activeWhere, OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: priorWindow(dateRange).gte } }] },
      orderBy: { lastActivityAt: "asc" }, take: 20,
      select: { id: true, fullName: true, role: true, lastActivityAt: true },
    }), []),
  ]);

  const activePrevSet = new Set(activePrev.map((u) => u.id));
  const retained = activeNow.filter((u) => activePrevSet.has(u.id)).length;
  const retentionRateValue = activePrevSet.size > 0 ? Math.round((retained / activePrevSet.size) * 100) : 0;

  return {
    dailyActiveUsers: { labels: dayBuckets.map((b) => b.label), values: dailyCounts },
    weeklyActiveUsers: { labels: weekBuckets.map((b) => b.label), values: weeklyCounts },
    // Same "no watch-time/session-duration model" gap as everywhere else.
    avgSessionDuration: unavailable("No session-duration tracking model exists yet."),
    videoWatchTime: unavailable("No watch-time tracking model exists yet."),
    retentionRate: activePrevSet.size > 0 ? metric(retentionRateValue, null) : unavailable("No users were active in the prior comparison window."),
    lowEngagementUsers: lowEngagement.map((u) => ({ id: u.id, name: u.fullName, role: u.role, lastActivityAt: u.lastActivityAt ? u.lastActivityAt.toISOString() : null })),
  };
}

// ── Part 2 — Export Center ────────────────────────────────────────────────
//
// Unlike Users/Competencies (backend returns JSON, frontend builds the CSV),
// Export Center is spec'd to return an actual file — a single central place
// that can emit any report type in either format, so the file itself is
// built here. Row cap matches the EXPORT_ROW_CAP convention used by
// users.service.exportUsers (5000) — a report export is a bounded snapshot,
// not a paginated stream.

const EXPORT_ROW_CAP = 5000;

// { columns: [{key,label}], rows: [{...}] } — one shape both CSV and JSON
// export share, so the controller never special-cases a report type.
async function getExportData(type, dateRange) {
  const inRange = { gte: dateRange.gte, lte: dateRange.lte };

  if (type === "learners") {
    const rows = await safe(() => prisma.appUser.findMany({
      where: { role: "LEARNER", createdAt: inRange },
      take: EXPORT_ROW_CAP, orderBy: { createdAt: "desc" },
      select: { id: true, fullName: true, email: true, department: true, status: true, createdAt: true, learnerProfile: { select: { riskScore: true } } },
    }), []);
    return {
      columns: [{ key: "id", label: "ID" }, { key: "fullName", label: "Name" }, { key: "email", label: "Email" }, { key: "department", label: "Department" }, { key: "status", label: "Status" }, { key: "riskScore", label: "Risk Score" }, { key: "createdAt", label: "Created At" }],
      rows: rows.map((r) => ({ id: r.id, fullName: r.fullName, email: r.email, department: r.department ?? "", status: r.status, riskScore: r.learnerProfile?.riskScore ?? "", createdAt: r.createdAt.toISOString() })),
    };
  }

  if (type === "instructors") {
    const rows = await safe(() => prisma.appUser.findMany({
      where: { role: "INSTRUCTOR", createdAt: inRange },
      take: EXPORT_ROW_CAP, orderBy: { createdAt: "desc" },
      select: { id: true, fullName: true, email: true, status: true, createdAt: true },
    }), []);
    return {
      columns: [{ key: "id", label: "ID" }, { key: "fullName", label: "Name" }, { key: "email", label: "Email" }, { key: "status", label: "Status" }, { key: "createdAt", label: "Created At" }],
      rows: rows.map((r) => ({ id: r.id, fullName: r.fullName, email: r.email, status: r.status, createdAt: r.createdAt.toISOString() })),
    };
  }

  if (type === "courses") {
    const rows = await safe(() => prisma.course.findMany({
      where: { createdAt: inRange },
      take: EXPORT_ROW_CAP, orderBy: { createdAt: "desc" },
      select: { id: true, title: true, category: true, status: true, createdAt: true, _count: { select: { enrollments: true } } },
    }), []);
    return {
      columns: [{ key: "id", label: "ID" }, { key: "title", label: "Title" }, { key: "category", label: "Category" }, { key: "status", label: "Status" }, { key: "enrollments", label: "Enrollments" }, { key: "createdAt", label: "Created At" }],
      rows: rows.map((r) => ({ id: r.id, title: r.title, category: r.category, status: r.status, enrollments: r._count.enrollments, createdAt: r.createdAt.toISOString() })),
    };
  }

  if (type === "certificates") {
    const rows = await safe(() => prisma.certificate.findMany({
      where: { issuedAt: inRange },
      take: EXPORT_ROW_CAP, orderBy: { issuedAt: "desc" },
      select: { id: true, issuedAt: true, revokedAt: true, verificationCode: true, course: { select: { title: true } }, user: { select: { fullName: true } } },
    }), []);
    return {
      columns: [{ key: "id", label: "ID" }, { key: "courseTitle", label: "Course" }, { key: "userName", label: "Learner" }, { key: "issuedAt", label: "Issued At" }, { key: "revoked", label: "Revoked" }, { key: "verificationCode", label: "Verification Code" }],
      rows: rows.map((c) => ({ id: c.id, courseTitle: c.course?.title ?? "", userName: c.user?.fullName ?? "", issuedAt: c.issuedAt.toISOString(), revoked: c.revokedAt !== null, verificationCode: c.verificationCode ?? "" })),
    };
  }

  if (type === "assessments") {
    const rows = await safe(() => prisma.quizAttempt.findMany({
      where: { submittedAt: inRange },
      take: EXPORT_ROW_CAP, orderBy: { submittedAt: "desc" },
      select: { id: true, score: true, status: true, submittedAt: true, user: { select: { fullName: true } }, quiz: { select: { title: true } } },
    }), []);
    return {
      columns: [{ key: "id", label: "ID" }, { key: "userName", label: "User" }, { key: "quizTitle", label: "Quiz" }, { key: "score", label: "Score" }, { key: "status", label: "Status" }, { key: "submittedAt", label: "Submitted At" }],
      rows: rows.map((r) => ({ id: r.id, userName: r.user?.fullName ?? "", quizTitle: r.quiz?.title ?? "", score: r.score ?? "", status: r.status, submittedAt: r.submittedAt ? r.submittedAt.toISOString() : "" })),
    };
  }

  if (type === "attendance") {
    const rows = await safe(() => prisma.sessionAttendance.findMany({
      where: { session: { startTime: inRange } },
      take: EXPORT_ROW_CAP, orderBy: { session: { startTime: "desc" } },
      select: { id: true, status: true, joinedAt: true, leftAt: true, session: { select: { title: true, startTime: true } }, user: { select: { fullName: true } } },
    }), []);
    return {
      columns: [{ key: "id", label: "ID" }, { key: "sessionTitle", label: "Session" }, { key: "userName", label: "User" }, { key: "status", label: "Status" }, { key: "joinedAt", label: "Joined At" }, { key: "leftAt", label: "Left At" }],
      rows: rows.map((r) => ({ id: r.id, sessionTitle: r.session?.title ?? "", userName: r.user?.fullName ?? "", status: r.status, joinedAt: r.joinedAt ? r.joinedAt.toISOString() : "", leftAt: r.leftAt ? r.leftAt.toISOString() : "" })),
    };
  }

  // type === "audit" (validator restricts to the 7 known types, this is the last).
  const rows = await safe(() => prisma.auditLog.findMany({
    where: { createdAt: inRange },
    take: EXPORT_ROW_CAP, orderBy: { createdAt: "desc" },
    select: { id: true, action: true, createdAt: true, admin: { select: { fullName: true } }, targetUserId: true },
  }), []);
  return {
    columns: [{ key: "id", label: "ID" }, { key: "action", label: "Action" }, { key: "adminName", label: "Admin" }, { key: "targetUserId", label: "Target User ID" }, { key: "createdAt", label: "Created At" }],
    rows: rows.map((r) => ({ id: r.id, action: r.action, adminName: r.admin?.fullName ?? "", targetUserId: r.targetUserId ?? "", createdAt: r.createdAt.toISOString() })),
  };
}

// ── Part 2 — Compliance Reports ──────────────────────────────────────────
//
// This schema has NO mandatory-training flag on Course/CompetencyFramework,
// NO certificate expiry field, and NO compliance-violation tracking model —
// confirmed by a full schema grep before writing this function. All three
// concepts are marked unavailable rather than fabricated. `atRiskUsers` is
// the one real, defensible field here: it reuses learners.service's own
// AT_RISK_THRESHOLD (the codebase's one existing "risk" definition), scoped
// to a department when given — not a bespoke "compliance risk" invented for
// this endpoint.

async function getComplianceReports(query) {
  const { departmentId } = query;
  const where = { role: "LEARNER", learnerProfile: { riskScore: { gte: learnersService.AT_RISK_THRESHOLD } } };
  if (departmentId) where.departmentId = departmentId;

  const atRiskUsers = await safe(() => prisma.appUser.findMany({
    where, orderBy: { learnerProfile: { riskScore: "desc" } }, take: 50,
    select: { id: true, fullName: true, department: true, learnerProfile: { select: { riskScore: true } } },
  }), []);

  const NO_COMPLIANCE_MODEL = "No mandatory-training flag or compliance-violation tracking exists in this schema yet.";

  return {
    mandatoryTrainingCompletion: unavailable(NO_COMPLIANCE_MODEL),
    expiredCertifications: unavailable("Certificate model has no expiry field — certificates don't expire in this schema."),
    complianceViolations: unavailable(NO_COMPLIANCE_MODEL),
    departmentCompliance: { available: false, reason: NO_COMPLIANCE_MODEL, items: [] },
    atRiskUsers: atRiskUsers.map((u) => ({ id: u.id, name: u.fullName, department: u.department ?? null, riskScore: u.learnerProfile?.riskScore ?? null })),
  };
}

module.exports = {
  safe,
  metric,
  unavailable,
  calcChange,
  priorWindow,
  buildTrendBuckets,
  getOverview,
  getLearnerAnalytics,
  getInstructorAnalytics,
  getCourseAnalytics,
  getAssessmentReports,
  getCertificateReports,
  getAttendanceReports,
  getAuditReports,
  getEngagementAnalytics,
  getExportData,
  getComplianceReports,
};
