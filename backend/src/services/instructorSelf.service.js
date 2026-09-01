const prisma = require("../config/prisma");
const instructorsService = require("./instructors.service");
const liveSessionsService = require("./liveSessions.service");

// ── Instructor self-service dashboard ────────────────────────────────────────
//
// RULE (blueprint B.2 / IMPACT_MAP R4): reuse the SAME functions the admin
// side already computes with, scoped by instructorId, rather than
// reimplementing aggregation logic. Concretely:
//   • instructorsService.getInstructor(id) already returns, self-scoped by
//     construction (it takes one instructor's id): coursesCount,
//     publishedCoursesCount, studentsCount (real distinct-student raw SQL —
//     NOT reimplemented here), status, verificationState, badges, courses[],
//     pendingApprovals[], recentActivities[], performanceChart (the exact
//     12-month zero-filled enrollment series this dashboard's chart needs).
//   • instructorsService.withPercentages() is reused verbatim for the
//     courses-by-status donut so its rounding matches every other donut in
//     the app (same largest-remainder algorithm, one definition).
// What's genuinely new below is a handful of trivial single-predicate counts
// (this-month/last-month course counts, draft/pending counts, certificates
// issued) — mirroring the WHERE-shape instructors.service.getStats() already
// uses (same "published = status:PUBLISHED", same "this month = reviewedAt
// in range" rules), just with instructorId added — and one new avgRating
// aggregate, because getStats()'s version is GLOBAL across every instructor,
// not scoped to one.

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[instructorSelf.service] query failed:", err.message);
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
  return Math.round(((current - previous) / previous) * 100);
}

// ── Stats ─────────────────────────────────────────────────────────────────────

async function getMyStats(instructorId) {
  const now = new Date();
  const startOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const thisMonth = { gte: startOfThisMonth };
  const lastMonth = { gte: startOfLastMonth, lt: startOfThisMonth };

  // The one heavy call — reused wholesale, not reimplemented (see file header).
  const detail = await instructorsService.getInstructor(instructorId);

  const [
    coursesThisMonth, coursesLastMonth,
    draftCourses, pendingCourses,
    upcomingSessions,
    certificatesIssued,
    ratingAgg,
    statusGroups,
  ] = await Promise.all([
    // Same "published = status:PUBLISHED, dated by reviewedAt" rule
    // instructors.service.getStats() uses, with instructorId added.
    safe(() => prisma.course.count({ where: { instructorId, status: "PUBLISHED", reviewedAt: thisMonth } }), 0),
    safe(() => prisma.course.count({ where: { instructorId, status: "PUBLISHED", reviewedAt: lastMonth } }), 0),
    safe(() => prisma.course.count({ where: { instructorId, status: "DRAFT" } }), 0),
    safe(() => prisma.course.count({ where: { instructorId, status: "PENDING" } }), 0),
    // Reuses liveSessions.service.listSessions() wholesale — including its
    // lazy status-sync — rather than trusting a possibly-stale status column
    // directly via a raw count.
    liveSessionsService.listSessions({ instructorId, status: "UPCOMING" }),
    // "Certificates Issued" counts non-revoked only, same rule as the admin
    // Dashboard's Certificates Issued KPI (IMPACT_MAP §4c).
    safe(() => prisma.certificate.count({ where: { course: { instructorId }, revokedAt: null } }), 0),
    // Same aggregate SHAPE as instructors.service.getStats()'s ratingAgg,
    // scoped to this one instructor instead of every APPROVED review
    // platform-wide — that global version cannot answer "my rating".
    safe(
      () => prisma.instructorReview.aggregate({
        where: { instructorId, status: "APPROVED" },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      { _avg: { rating: null }, _count: { _all: 0 } },
    ),
    // Same groupBy shape as instructors.service.getAnalytics()'s
    // coursesByStatus, scoped to instructorId instead of "every instructor".
    safe(
      () => prisma.course.groupBy({
        by: ["status"],
        where: { instructorId },
        _count: { _all: true },
      }),
      [],
    ),
  ]);

  // Student-growth changePercent has no direct admin-side sibling to reuse
  // (instructors.service has no "total students" trend at all — that
  // concept lives on the Learners side, which has no instructor scoping
  // either, see the blueprint's Appendix A gap list). Using this month's vs
  // last month's NEW-enrollment bucket from the already-computed
  // performanceChart as an honest proxy for "is my student base growing" —
  // not a reimplementation, the two numbers come straight out of data
  // getInstructor() already fetched.
  const series = detail.performanceChart.enrollments;
  const thisMonthEnrollments = series[series.length - 1] ?? 0;
  const lastMonthEnrollments = series[series.length - 2] ?? 0;

  return {
    myPublishedCourses: metric(detail.publishedCoursesCount, calcChange(coursesThisMonth, coursesLastMonth)),
    myDraftCourses: metric(draftCourses),
    myPendingApprovalCourses: metric(pendingCourses),
    myTotalStudents: metric(detail.studentsCount, calcChange(thisMonthEnrollments, lastMonthEnrollments)),
    myUpcomingSessions: metric(upcomingSessions.length),
    myAvgRating: ratingAgg._count._all > 0
      ? metric(Math.round(ratingAgg._avg.rating * 10) / 10)
      : unavailable("No approved reviews on your courses yet."),
    // Genuinely blocked — no instructor-scoped payouts endpoint exists yet
    // (blueprint Section 2.9 / Appendix A #8). Not a stale copy of the admin
    // reason: this one names the actual missing piece for the self-service
    // side specifically.
    myTotalEarnings: unavailable("Earnings aren't available in the Instructor Dashboard yet — this ships in a later phase."),
    myCertificatesIssued: metric(certificatesIssued),

    // Extra, beyond the task's literal KPI list, because the Dashboard page
    // (Part 3) needs a courses-by-status donut and the blueprint's own
    // "My Courses by Status" chart spec (Section 2.1) — reuses withPercentages
    // verbatim, same rounding as every other donut in the app.
    coursesByStatus: {
      available: true,
      items: instructorsService.withPercentages(
        statusGroups
          .map((g) => ({ status: g.status, count: g._count._all }))
          .sort((a, b) => b.count - a.count),
      ),
    },

    // Read-only account facts the Dashboard header/badges need — same
    // fields the admin side panel already reads via GET /instructors/:id,
    // just surfaced here so the instructor doesn't need a second request.
    verificationStatus: {
      status: detail.status,
      verificationState: detail.verificationState,
      verifiedAt: detail.verifiedAt,
      badges: detail.badges,
    },
  };
}

// ── Enrollment trend (12-month chart) ───────────────────────────────────────

// Thin passthrough — getInstructor() already computes this exact series
// (buildPerformanceChart in instructors.service.js), so there is nothing to
// add beyond picking the one field the chart needs out of the full detail
// payload the stats endpoint already fetched a copy of.
async function getMyEnrollmentTrend(instructorId) {
  const detail = await instructorsService.getInstructor(instructorId);
  return {
    labels: detail.performanceChart.labels,
    enrollments: detail.performanceChart.enrollments,
  };
}

// ── Recent activity ─────────────────────────────────────────────────────────

const ACTIVITY_LIMIT = 10;

// getInstructor()'s recentActivities already merges course_created /
// session_scheduled / certificate_issued / admin_action for this instructor
// (buildActivityFeed in instructors.service.js) — reused as the base here.
// Two sources the blueprint's Part 1 spec explicitly asks for are NOT in
// that admin function at all (it has no reason to include them for the
// admin side panel): reviews received, and documents verified. Those are
// fetched fresh below and merged with the SAME sort-by-createdAt-desc /
// slice(ACTIVITY_LIMIT) rule the admin function already uses, not a new
// ordering convention.
async function getMyActivity(instructorId) {
  const [detail, recentReviews, recentVerifiedDocs] = await Promise.all([
    instructorsService.getInstructor(instructorId),
    safe(
      () => prisma.instructorReview.findMany({
        where: { instructorId },
        orderBy: { createdAt: "desc" },
        take: ACTIVITY_LIMIT,
        select: { id: true, rating: true, createdAt: true, course: { select: { title: true } } },
      }),
      [],
    ),
    safe(
      () => prisma.instructorDocument.findMany({
        where: { instructorId, status: "VERIFIED" },
        orderBy: { verifiedAt: "desc" },
        take: ACTIVITY_LIMIT,
        select: { id: true, type: true, verifiedAt: true },
      }),
      [],
    ),
  ]);

  const extra = [
    ...recentReviews.map((r) => ({
      id: `review_${r.id}`,
      type: "review_received",
      title: `Received a ${r.rating}-star review on "${r.course?.title ?? "a course"}"`,
      createdAt: iso(r.createdAt),
    })),
    ...recentVerifiedDocs.map((d) => ({
      id: `docverified_${d.id}`,
      type: "document_verified",
      title: `Your ${d.type.toLowerCase()} document was verified`,
      createdAt: iso(d.verifiedAt),
    })),
  ];

  return [...detail.recentActivities, ...extra]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, ACTIVITY_LIMIT);
}

module.exports = {
  getMyStats,
  getMyEnrollmentTrend,
  getMyActivity,
};
