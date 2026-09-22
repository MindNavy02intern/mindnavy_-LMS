const prisma = require("../config/prisma");
const { getOwnedCourses } = require("../utils/ownershipGuard");

// ── Instructor Reports & Analytics (Phase 5, blueprint 2.11) ────────────────────
//
// Self-scoped mirror of admin Reports' Instructor Analytics tab
// (reports.service.getInstructorAnalytics), which is confirmed 100% global —
// no instructorId parameter exists in its route, validator, or service
// signature (it always queries every AppUser with role=INSTRUCTOR and
// returns a flat top-N array). Reuses the exact same FORMULAS (completion
// rate = completed/total enrollments; live session attendance = present+late
// / total attendance; avgRating = same InstructorReview aggregate shape
// instructorSelf.service.js already uses for the Dashboard), scoped to one
// instructor's own courses/sessions instead of forking that global function.
//
// Trend window is a fixed trailing 12 months, not admin Reports' selectable
// week/month/quarter dateRange — matches every other trend chart already
// built in this instructor portal (Dashboard, My Students), not a new
// date-picker system. Simplification noted, not a silent gap.

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[instructorReports.service] query failed:", err.message);
    return fallback;
  }
}

function metric(value, changePercent = null) { return { value, changePercent, available: true }; }
function unavailable(reason) { return { value: null, changePercent: null, available: false, reason }; }

const TREND_MONTHS = 12;

// ── Overview (KPI cards + trend chart) ──────────────────────────────────────────

async function getPerformanceTrend(ownIds) {
  if (ownIds.length === 0) return { labels: [], completionRate: [] };

  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - (TREND_MONTHS - 1), 1));
  const rows = await safe(
    () => prisma.$queryRaw`
      SELECT to_char(date_trunc('month', e."createdAt"), 'YYYY-MM') AS month,
             COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE e."status" = 'COMPLETED')::int AS completed
      FROM "course_enrollments" e
      WHERE e."courseId" = ANY(${ownIds}::text[]) AND e."createdAt" >= ${since}
      GROUP BY 1
      ORDER BY 1`,
    [],
  );
  const byMonth = new Map(rows.map((r) => [r.month, { total: Number(r.total) || 0, completed: Number(r.completed) || 0 }]));

  const now = new Date();
  const labels = [];
  const completionRate = [];
  for (let i = TREND_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    labels.push(key);
    const b = byMonth.get(key);
    completionRate.push(b && b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0);
  }
  return { labels, completionRate };
}

async function getMyOverview(instructorId) {
  const ownCourses = await getOwnedCourses(instructorId);
  const ownIds = ownCourses.map((c) => c.id);

  const [enrollmentGroups, ratingAgg, ownSessions] = await Promise.all([
    ownIds.length
      ? safe(() => prisma.courseEnrollment.groupBy({ by: ["status"], where: { courseId: { in: ownIds } }, _count: { _all: true } }), [])
      : [],
    safe(
      () => prisma.instructorReview.aggregate({
        where: { instructorId, status: "APPROVED" },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      { _avg: { rating: null }, _count: { _all: 0 } },
    ),
    safe(() => prisma.liveSession.findMany({ where: { instructorId }, select: { id: true } }), []),
  ]);

  const totalEnrollments = enrollmentGroups.reduce((s, g) => s + g._count._all, 0);
  const completedEnrollments = enrollmentGroups.filter((g) => g.status === "COMPLETED").reduce((s, g) => s + g._count._all, 0);
  const courseCompletionRate = totalEnrollments > 0
    ? metric(Math.round((completedEnrollments / totalEnrollments) * 100))
    : unavailable("No enrollments in your courses yet.");

  const avgRating = ratingAgg._count._all > 0
    ? metric(Math.round(ratingAgg._avg.rating * 10) / 10)
    : unavailable("No approved reviews on your courses yet.");

  const sessionIds = ownSessions.map((s) => s.id);
  const attendanceAgg = sessionIds.length
    ? await safe(() => prisma.sessionAttendance.groupBy({ by: ["status"], where: { sessionId: { in: sessionIds } }, _count: { _all: true } }), [])
    : [];
  const attendanceTotal = attendanceAgg.reduce((s, g) => s + g._count._all, 0);
  const attendancePresent = attendanceAgg.filter((g) => g.status === "PRESENT" || g.status === "LATE").reduce((s, g) => s + g._count._all, 0);
  const liveSessionAttendance = attendanceTotal > 0
    ? metric(Math.round((attendancePresent / attendanceTotal) * 100))
    : unavailable("No live sessions with recorded attendance yet.");

  const performanceTrend = await getPerformanceTrend(ownIds);

  return { courseCompletionRate, avgRating, liveSessionAttendance, performanceTrend };
}

// ── Per-course breakdown ──────────────────────────────────────────────────────

async function getMyCourseBreakdown(instructorId) {
  const ownCourses = await getOwnedCourses(instructorId);
  const ownIds = ownCourses.map((c) => c.id);
  if (ownIds.length === 0) return [];

  const [enrollGroups, quizzes] = await Promise.all([
    safe(() => prisma.courseEnrollment.groupBy({ by: ["courseId", "status"], where: { courseId: { in: ownIds } }, _count: { _all: true } }), []),
    safe(() => prisma.quiz.findMany({ where: { courseId: { in: ownIds } }, select: { id: true, courseId: true } }), []),
  ]);

  const quizIds = quizzes.map((q) => q.id);
  const courseIdByQuizId = new Map(quizzes.map((q) => [q.id, q.courseId]));

  const scoreRows = quizIds.length
    ? await safe(() => prisma.quizAttempt.findMany({ where: { quizId: { in: quizIds }, score: { not: null } }, select: { quizId: true, score: true } }), [])
    : [];

  const scoresByCourseId = new Map();
  for (const r of scoreRows) {
    const courseId = courseIdByQuizId.get(r.quizId);
    if (!courseId) continue;
    const arr = scoresByCourseId.get(courseId) ?? [];
    arr.push(r.score);
    scoresByCourseId.set(courseId, arr);
  }

  const enrolledByCourse = new Map();
  const completedByCourse = new Map();
  for (const g of enrollGroups) {
    enrolledByCourse.set(g.courseId, (enrolledByCourse.get(g.courseId) ?? 0) + g._count._all);
    if (g.status === "COMPLETED") completedByCourse.set(g.courseId, (completedByCourse.get(g.courseId) ?? 0) + g._count._all);
  }

  return ownCourses.map((c) => {
    const enrolled = enrolledByCourse.get(c.id) ?? 0;
    const completed = completedByCourse.get(c.id) ?? 0;
    const scores = scoresByCourseId.get(c.id) ?? [];
    return {
      courseId:       c.id,
      courseTitle:    c.title,
      enrolled,
      completed,
      completionRate: enrolled > 0 ? Math.round((completed / enrolled) * 100) : null,
      avgQuizScore:   scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null,
    };
  });
}

module.exports = {
  getMyOverview,
  getMyCourseBreakdown,
};
