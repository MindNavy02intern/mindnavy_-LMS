const prisma = require("../config/prisma");
const { Prisma } = require("@prisma/client");
const { listSessions: listLiveSessions } = require("./liveSessions.service");
// Total Revenue / Active Subscriptions are OWNED here (IMPACT_MAP §4a) but
// COMPUTED by finance.service — the same aggregate finance.service's own
// getStats() calls, so the two endpoints can never drift (R4, blueprint 09 §1
// ownership note).
const { getTotalRevenueValue, getActiveSubscriptionsCountValue } = require("./finance.service");

// Maps the real, schedule-derived LiveSession.status (UPCOMING/LIVE/ENDED,
// LIVE_SESSIONS_CONTRACT.md) onto this dashboard's own widget-status vocabulary
// (active/upcoming/completed/cancelled — types/dashboard.ts LiveSessionStatus).
// 'cancelled' has no source: a cancelled session is DELETEd, so it simply
// never appears as a row here.
const LIVE_SESSION_STATUS_MAP = { LIVE: "active", UPCOMING: "upcoming", ENDED: "completed" };

// ── Shared filter helpers ─────────────────────────────────────────────────────

// A user is "pending approval" when their verification is PENDING and they are
// not archived. Kept in one place so every widget reports the same number.
const PENDING_APPROVAL_WHERE = { verificationState: "PENDING", status: { not: "ARCHIVED" } };

function parseDateInput(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function endOfUtcDay(d) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

// Build a reusable Prisma `where` scope from the dashboard filters:
//   departmentId      → narrows to a single department
//   dateFrom/dateTo   → narrows by account-creation date (inclusive)
// Returns {} when no filters are supplied, so it is safe to spread anywhere.
function buildUserScope({ departmentId, dateFrom, dateTo } = {}) {
  const from  = parseDateInput(dateFrom);
  const to    = parseDateInput(dateTo);
  const scope = {};
  if (departmentId) scope.department = String(departmentId);
  if (from || to) {
    scope.createdAt = {
      ...(from && { gte: from }),
      ...(to   && { lte: endOfUtcDay(to) }),
    };
  }
  return scope;
}

// Inclusive list of UTC day strings (YYYY-MM-DD) between two dates, capped so a
// huge custom range can never blow up memory.
function enumerateUtcDays(start, end, cap = 366) {
  const days = [];
  const cur  = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(),   end.getUTCMonth(),   end.getUTCDate()));
  while (cur <= last && days.length < cap) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return days;
}

// ── Audit log → ActivityItem mapper ───────────────────────────────────────────

const ACTION_TYPE = {
  USER_CREATED:          "user",
  USER_UPDATED:          "user",
  USER_STATUS_CHANGED:   "user",
  USER_PASSWORD_RESET:   "user",
  USER_ROLE_ASSIGNED:    "user",
  USER_DELETED:          "user",
  USER_SUSPENDED:        "user",
  USER_REACTIVATED:      "user",
  USERS_IMPORTED:        "user",
  USER_ANALYTICS_VIEWED: "user",
  USERS_LIST_VIEWED:     "user",
  USER_DETAILS_VIEWED:   "user",
};

const ACTION_TITLE = {
  ADMIN_LOGIN:                   "logged in",
  ADMIN_LOGOUT:                  "logged out",
  USER_CREATED:                  "created a new user",
  USER_UPDATED:                  "updated a user",
  USER_STATUS_CHANGED:           "changed user status",
  USER_PASSWORD_RESET:           "reset a user password",
  USER_ROLE_ASSIGNED:            "assigned a role",
  USER_DELETED:                  "deleted a user",
  USER_SUSPENDED:                "suspended a user",
  USER_REACTIVATED:              "reactivated a user",
  USERS_IMPORTED:                "imported users from CSV",
  USER_ANALYTICS_VIEWED:         "viewed analytics",
  USERS_LIST_VIEWED:             "viewed user list",
  USER_DETAILS_VIEWED:           "viewed user details",
  FAILED_LOGIN:                  "had a failed login attempt",
  OTP_SENT:                      "requested OTP",
  OTP_VERIFIED:                  "verified OTP",
  SESSION_CREATED:               "started a session",
  SESSION_REVOKED:               "revoked a session",
  USER_VERIFICATION_APPROVED:    "approved user verification",
  USER_MESSAGE_SENT:             "sent a message",
  USER_FORCE_LOGOUT:             "forced user logout",
  ROLE_CREATED:                  "created a role",
  ROLE_UPDATED:                  "updated a role",
  ROLE_DELETED:                  "deleted a role",
  ROLE_PERMISSIONS_UPDATED:      "updated role permissions",
  ROLE_DUPLICATED:               "duplicated a role",
  USERS_EXPORTED:                "exported users",
};

function mapAuditToActivity(entries) {
  return entries.map(entry => ({
    id:        entry.id,
    actorName: entry.admin?.fullName ?? "System",
    type:      ACTION_TYPE[entry.action] ?? "system",
    title:     ACTION_TITLE[entry.action] ?? entry.action.replace(/_/g, " ").toLowerCase(),
    createdAt: entry.createdAt instanceof Date
      ? entry.createdAt.toISOString()
      : String(entry.createdAt),
  }));
}

async function getDashboardCore(admin) {
  // Each query falls back independently so a single failed count cannot 500 the
  // whole dashboard.
  const [
    totalUsers,
    activeStudents,
    activeInstructors,
    pendingApprovals,
    publishedCourses,
    totalRevenue,
    activeSubscriptions,
    certificatesIssued,
    recentActivitiesRaw,
    liveSessionRows,
    notificationsRaw,
    unreadNotificationsCount,
    pendingInstructorApps,
  ] = await Promise.all([
    prisma.appUser.count({ where: { status: { not: "ARCHIVED" } } }).catch(() => 0),
    prisma.appUser.count({ where: { role: "LEARNER",    status: "ACTIVE" } }).catch(() => 0),
    prisma.appUser.count({ where: { role: "INSTRUCTOR", status: "ACTIVE" } }).catch(() => 0),
    prisma.appUser.count({ where: PENDING_APPROVAL_WHERE }).catch(() => 0),
    prisma.course.count({ where: { status: "PUBLISHED" } }).catch(() => 0),
    getTotalRevenueValue().catch(() => 0),
    getActiveSubscriptionsCountValue().catch(() => 0),
    // Revoked certificates don't count as issued — same rule lm.service's
    // getStats() certificatesIssued uses (reports.service Overview mirrors it).
    prisma.certificate.count({ where: { revokedAt: null } }).catch(() => 0),
    prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id:        true,
        action:    true,
        createdAt: true,
        admin: { select: { fullName: true } },
      },
    }).catch(() => []),
    // Real live sessions — same status-synced query GET /live-sessions uses
    // (LIVE_SESSIONS_CONTRACT.md). Was previously counting app-user LOGIN
    // sessions, unrelated to actual live classes (fixed 2026-07-27).
    listLiveSessions({}).catch(() => []),
    // Notifications preview — was reading AuditLog (fake: isRead hardcoded
    // false, title derived from admin *actions*, not actual notifications).
    // Real source is NotificationLog{channel:IN_APP} — the same table the
    // sidebar bell badge (AdminLayout.tsx) and the Notifications module's
    // In-App tab already read (one sink, one owner).
    prisma.notificationLog.findMany({
      where: { channel: "IN_APP" },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, subject: true, body: true, priority: true, status: true, createdAt: true },
    }).catch(() => []),
    prisma.notificationLog.count({
      where: { channel: "IN_APP", status: { notIn: ["OPENED", "CLICKED"] } },
    }).catch(() => 0),
    // Same OPEN_STATES instructorApplications.service uses for its own queue —
    // reused here, not redefined, so this count can't drift from that module's.
    prisma.instructorApplication.count({ where: { status: { in: ["PENDING", "CHANGES_REQUESTED"] } } }).catch(() => 0),
  ]);

  const liveSessionsRunning = liveSessionRows.filter((s) => s.status === "LIVE").length;

  return {
    welcome: {
     adminName: admin.fullName || admin.name || "Admin",
      adminRole: admin.role || "admin",
      organizationName: "MindNavy LMS",
      currentDateTime:  new Date().toISOString(),
      lastLoginAt:      admin.lastLoginAt  || null,
      systemStatus:     "operational",
    },

    kpis: {
      totalUsers,
      activeStudents,
      activeInstructors,
      publishedCourses,
      // Combined queue — was user-verification-only, silently ignoring the
      // instructor-application queue (DEFERRED_ITEMS.md). Same combined
      // definition getDashboardAdminWidgets' pendingApprovals widget uses
      // below, so the KPI card and the widget total can never disagree.
      pendingApprovals: pendingApprovals + pendingInstructorApps,
      totalRevenue,
      activeSubscriptions,
      certificatesIssued,
      // Real LiveSession count (status LIVE). NOTE: this is a SEPARATE query
      // from getDashboardAdminWidgets' activeCount below — both filter the
      // same table via the same status-derivation logic, but core and
      // admin-widgets are independent HTTP endpoints with no shared
      // request-scoped cache, so the two numbers could theoretically differ
      // by whatever a session's status changes in the gap between the two
      // requests (a few ms). Same category of looseness the whole dashboard
      // already has across its 3 independent endpoints — not something this
      // fix introduced, and not worth a shared-cache layer to close.
      liveSessionsRunning,
    },

    recentActivities:      mapAuditToActivity(recentActivitiesRaw),
    notificationsPreview:  notificationsRaw.map(log => ({
      id:        log.id,
      title:     log.subject ?? log.body.slice(0, 80),
      message:   log.subject ? log.body : "",
      // No category field exists on NotificationLog to map to the 5-way
      // NotificationType union honestly — URGENT is the one real signal
      // this table has, everything else is a plain "system" notification.
      type:      log.priority === "URGENT" ? "security" : "system",
      isRead:    log.status === "OPENED" || log.status === "CLICKED",
      createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : String(log.createdAt),
    })),
    unreadNotificationsCount: unreadNotificationsCount,
    securityAlertsPreview: [],

    quickActions: [
      { key: "add_user",            label: "Add User",            enabled: true, path: "/users"              },
      { key: "create_course",       label: "Create Course",       enabled: true, path: "/learning/courses"   },
      { key: "approve_instructor",  label: "Approve Instructor",  enabled: true, path: "/learning/approvals" },
      { key: "generate_report",     label: "Generate Report",     enabled: true, path: "/reports"            },
      { key: "create_live_session", label: "Create Live Session", enabled: true, path: "/learning/sessions"  },
      { key: "system_settings",     label: "System Settings",     enabled: true, path: "/settings"           },
    ],

    systemHealth: {
      status:  "operational",
      message: "All systems are running normally.",
      version: "1.0.0",
    },
  };
}

async function getDashboardAnalytics(filters = {}) {
  const now = new Date();
  const last30d      = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const last7d       = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  // ── Apply dashboard filters (department + creation-date range) ──────────────
  const scope        = buildUserScope(filters);
  const deptScope    = scope.department ? { department: scope.department } : {};
  const hasDateRange = Boolean(scope.createdAt);

  // New registrations honor an explicit date range, else default to this month.
  const registrationWhere = hasDateRange
    ? { createdAt: scope.createdAt, ...deptScope }
    : { createdAt: { gte: startOfMonth }, ...deptScope };

  // The daily-activity trend spans the requested range, else the last 30 days.
  const trendStart = scope.createdAt?.gte ?? last30d;
  const trendEnd   = scope.createdAt?.lte ?? now;
  const deptCond   = scope.department
    ? Prisma.sql`AND "department" = ${scope.department}`
    : Prisma.empty;
  // Same department filter, joined-table form — course_enrollments has no
  // department column of its own (that lives on the enrolled user).
  const enrollDeptCond = scope.department
    ? Prisma.sql`AND u."department" = ${scope.department}`
    : Prisma.empty;

  // Retention cohort: users old enough (30+ days) to meaningfully measure
  // retention on. eligibleForRetention/retained share this exact where-clause
  // shape (dept-scoped) so the ratio can't drift between two differently-
  // filtered queries.
  const retentionEligibleWhere = { createdAt: { lte: last30d }, status: { not: "ARCHIVED" }, ...deptScope };

  const [
    roleGroups,
    departmentGroups,
    verificationGroups,
    statusGroups,
    thisMonthCount,
    activeToday,
    activeLast7d,
    courseStatusGroups,
    rawDailyTrend,
    rawEnrolledTrend,
    rawCompletedTrend,
    retentionEligibleCount,
    retentionRetainedCount,
    enrollmentsWithCourse,
  ] = await Promise.all([
    prisma.appUser.groupBy({ by: ["role"],              _count: { _all: true }, where: { status: { not: "ARCHIVED" }, ...scope } }),
    prisma.appUser.groupBy({ by: ["department"],        _count: { _all: true }, where: { department: { not: null }, ...scope } }),
    prisma.appUser.groupBy({ by: ["verificationState"], _count: { _all: true }, where: scope }),
    prisma.appUser.groupBy({ by: ["status"],            _count: { _all: true }, where: scope }),
    prisma.appUser.count({ where: registrationWhere }),
    prisma.appUser.count({ where: { lastActivityAt: { gte: startOfToday }, ...deptScope } }),
    prisma.appUser.count({ where: { lastActivityAt: { gte: last7d }, ...deptScope } }),
    prisma.course.groupBy({ by: ["status"], _count: { _all: true } }).catch(() => []),
    prisma.$queryRaw`
      SELECT DATE("lastActivityAt") AS date, COUNT(*)::int AS count
      FROM "app_users"
      WHERE "lastActivityAt" >= ${trendStart} AND "lastActivityAt" <= ${trendEnd}
        AND "lastActivityAt" IS NOT NULL ${deptCond}
      GROUP BY DATE("lastActivityAt")
      ORDER BY date ASC
    `,
    // Learning Activity Overview — real enrolled-vs-completed trend from the
    // EXISTING course_enrollments table (was a hardcoded [] "Phase 2" stub;
    // Course + Enrollment are both real now, fixed 2026-07-27).
    prisma.$queryRaw`
      SELECT DATE(ce."createdAt") AS date, COUNT(*)::int AS count
      FROM "course_enrollments" ce
      JOIN "app_users" u ON u.id = ce."userId"
      WHERE ce."createdAt" >= ${trendStart} AND ce."createdAt" <= ${trendEnd} ${enrollDeptCond}
      GROUP BY DATE(ce."createdAt")
      ORDER BY date ASC
    `.catch(() => []),
    prisma.$queryRaw`
      SELECT DATE(ce."completedAt") AS date, COUNT(*)::int AS count
      FROM "course_enrollments" ce
      JOIN "app_users" u ON u.id = ce."userId"
      WHERE ce."completedAt" IS NOT NULL
        AND ce."completedAt" >= ${trendStart} AND ce."completedAt" <= ${trendEnd} ${enrollDeptCond}
      GROUP BY DATE(ce."completedAt")
      ORDER BY date ASC
    `.catch(() => []),
    // Retention rate = % of the 30+ day-old cohort still active in the last
    // 30 days. Defined here explicitly since "retention" has no single
    // industry-standard definition — this is the one this dashboard uses.
    prisma.appUser.count({ where: retentionEligibleWhere }).catch(() => 0),
    prisma.appUser.count({ where: { ...retentionEligibleWhere, lastActivityAt: { gte: last30d } } }).catch(() => 0),
    // Drives Course Analytics' averageCompletionRate/mostPopularCourse AND
    // Course Completion's averageCompletion/categories from ONE real query —
    // same "one datum, one owner" principle as elsewhere on this dashboard,
    // so the two widgets can never show two different numbers for the same thing.
    prisma.courseEnrollment.findMany({
      select: { status: true, courseId: true, course: { select: { title: true, category: true } } },
    }).catch(() => []),
  ]);

  const totalUsers     = statusGroups.filter((g) => g.status !== "ARCHIVED").reduce((s, g) => s + g._count._all, 0);
  const activeUsers    = statusGroups.find((g) => g.status === "ACTIVE")?._count._all    ?? 0;
  const suspendedUsers = statusGroups.find((g) => g.status === "SUSPENDED")?._count._all ?? 0;

  const courseCountByStatus = { DRAFT: 0, PENDING: 0, PUBLISHED: 0, ARCHIVED: 0 };
  for (const g of courseStatusGroups) courseCountByStatus[g.status] = g._count._all;

  const ROLE_MAP  = { LEARNER: "learners", INSTRUCTOR: "instructors", MANAGER: "managers", ADMIN_ASSISTANT: "adminAssistants" };
  const ALL_ROLES = ["LEARNER", "INSTRUCTOR", "MANAGER", "ADMIN_ASSISTANT"];
  const roleCountMap = Object.fromEntries(roleGroups.map((g) => [g.role, g._count._all]));
  const usersByRole = ALL_ROLES.map((r) => {
    const count = roleCountMap[r] ?? 0;
    return { role: ROLE_MAP[r] ?? "others", count, percentage: totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0 };
  });

  const usersByDepartment = departmentGroups
    .filter((g) => g.department)
    .map((g) => ({ department: g.department, count: g._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const topDepartments = usersByDepartment.slice(0, 8).map((d) => ({
    id: d.department, name: d.department, usersCount: d.count,
  }));

  const VERIFICATION_MAP = { VERIFIED: "verified", PENDING: "pending", REJECTED: "rejected", EXPIRED: "expired" };
  const ALL_VERIFICATION = ["VERIFIED", "PENDING", "REJECTED", "EXPIRED"];
  const verificationCountMap = Object.fromEntries(verificationGroups.map((g) => [g.verificationState, g._count._all]));
  const verificationStatus = ALL_VERIFICATION.map((v) => {
    const count = verificationCountMap[v] ?? 0;
    return { status: VERIFICATION_MAP[v] ?? v.toLowerCase(), count, percentage: totalUsers > 0 ? Math.round((count / totalUsers) * 100) : 0 };
  });
  const verifiedCount = verificationCountMap["VERIFIED"] ?? 0;

  // Build a dense daily trend across the active range (fill missing days with 0)
  const activityMap = {};
  for (const day of enumerateUtcDays(trendStart, trendEnd)) {
    activityMap[day] = 0;
  }
  for (const row of rawDailyTrend) {
    const key = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10);
    if (key in activityMap) activityMap[key] = Number(row.count);
  }
  const dailyTrend = Object.entries(activityMap).map(([date, count]) => ({ date, count }));
  const userActivity = { activeToday, activeThisWeek: activeLast7d, dailyTrend };

  // Learning Activity Overview — same dense-day-fill approach as dailyTrend
  // above, merging two real counts (enrolled / completed per day) from
  // course_enrollments.createdAt / .completedAt.
  const enrolledMap = {};
  const completedMap = {};
  for (const day of enumerateUtcDays(trendStart, trendEnd)) { enrolledMap[day] = 0; completedMap[day] = 0; }
  for (const row of rawEnrolledTrend) {
    const key = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10);
    if (key in enrolledMap) enrolledMap[key] = Number(row.count);
  }
  for (const row of rawCompletedTrend) {
    const key = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date).slice(0, 10);
    if (key in completedMap) completedMap[key] = Number(row.count);
  }
  const learningActivity = Object.keys(enrolledMap).map((date) => ({
    date, enrolled: enrolledMap[date], completed: completedMap[date],
  }));

  // Retention rate — null (not 0) when the cohort doesn't exist yet to measure.
  const retentionRate = retentionEligibleCount > 0
    ? Math.round((retentionRetainedCount / retentionEligibleCount) * 1000) / 10
    : null;

  // Course Analytics + Course Completion — both derived from the SAME
  // enrollmentsWithCourse rows fetched above (single source, can't drift).
  const totalEnrollments     = enrollmentsWithCourse.length;
  const completedEnrollments = enrollmentsWithCourse.filter((e) => e.status === "COMPLETED").length;
  const averageCompletionRate = totalEnrollments > 0
    ? Math.round((completedEnrollments / totalEnrollments) * 1000) / 10
    : null;

  const courseEnrollCounts = {}; // courseId -> { count, title }
  const categoryStats = {};      // category -> { total, completed }
  for (const e of enrollmentsWithCourse) {
    if (e.courseId) {
      const c = courseEnrollCounts[e.courseId] ??= { count: 0, title: e.course?.title ?? null };
      c.count += 1;
    }
    const cat = e.course?.category ?? "Uncategorized";
    const s = categoryStats[cat] ??= { total: 0, completed: 0 };
    s.total += 1;
    if (e.status === "COMPLETED") s.completed += 1;
  }
  const mostPopularCourse = Object.values(courseEnrollCounts)
    .sort((a, b) => b.count - a.count)[0]?.title ?? null;
  const completionCategories = Object.entries(categoryStats)
    .map(([name, s]) => ({ name, completionRate: Math.round((s.completed / s.total) * 100) }))
    .sort((a, b) => b.completionRate - a.completionRate)
    .slice(0, 6);

  // Revenue Overview — same source tables (Payment/Subscription/Refund/
  // InstructorPayout) finance.service reads; computed here directly rather
  // than imported since this needs day/month/year buckets finance.service's
  // exported helpers don't expose (R4 still holds — one table, one query
  // shape per number, no separate aggregates stored anywhere).
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const [
    dailyRevenueAgg, monthlyRevenueAgg, lastMonthRevenueAgg, annualRevenueAgg,
    subscriptionRevenueAgg, refundTotalAgg, instructorPayoutsAgg,
  ] = await Promise.all([
    prisma.payment.aggregate({ where: { status: "SUCCESSFUL", createdAt: { gte: startOfToday } }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
    prisma.payment.aggregate({ where: { status: "SUCCESSFUL", createdAt: { gte: startOfMonth } }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
    prisma.payment.aggregate({ where: { status: "SUCCESSFUL", createdAt: { gte: lastMonthStart, lt: startOfMonth } }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
    prisma.payment.aggregate({ where: { status: "SUCCESSFUL", createdAt: { gte: startOfYear } }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
    prisma.subscription.aggregate({ where: { status: "ACTIVE" }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
    prisma.refund.aggregate({ where: { status: "PROCESSED" }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
    prisma.instructorPayout.aggregate({ where: { status: "COMPLETED" }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })),
  ]);
  const monthlyRevenueValue = monthlyRevenueAgg._sum.amount ?? 0;
  const lastMonthRevenueValue = lastMonthRevenueAgg._sum.amount ?? 0;
  const growthPercentage = lastMonthRevenueValue === 0
    ? (monthlyRevenueValue > 0 ? 100 : 0)
    : Math.round(((monthlyRevenueValue - lastMonthRevenueValue) / lastMonthRevenueValue) * 1000) / 10;

  return {
    filters: {
      dateFrom:     filters.dateFrom     || null,
      dateTo:       filters.dateTo       || null,
      departmentId: filters.departmentId || null,
    },
    learningActivity,
    usersByRole,
    usersByDepartment,
    userActivity,
    verificationStatus,
    topDepartments,
    revenueOverview: {
      dailyRevenue:        dailyRevenueAgg._sum.amount ?? 0,
      monthlyRevenue:      monthlyRevenueValue,
      annualRevenue:       annualRevenueAgg._sum.amount ?? 0,
      subscriptionRevenue: subscriptionRevenueAgg._sum.amount ?? 0,
      refundTotal:         refundTotalAgg._sum.amount ?? 0,
      instructorPayouts:   instructorPayoutsAgg._sum.amount ?? 0,
      growthPercentage,
    },
    userAnalytics: {
      newRegistrations: thisMonthCount,
      activeUsers,
      retentionRate,
      verifiedUsers:    verifiedCount,
      suspendedUsers,
    },
    // Course counts + completion + most-popular are all live now (Enrollment
    // is real — fixed 2026-07-27). averageQuizScore stays null: no
    // quiz-attempt/submission system exists anywhere in this schema, so
    // there is genuinely nothing to compute it from (not a "coming soon"
    // stub on THIS data — a wholly separate, unbuilt system).
    courseAnalytics: {
      totalCourses:           courseCountByStatus.DRAFT + courseCountByStatus.PENDING + courseCountByStatus.PUBLISHED,
      activeCourses:          courseCountByStatus.PUBLISHED,
      pendingApprovalCourses: courseCountByStatus.PENDING,
      averageCompletionRate,
      mostPopularCourse,
      averageQuizScore:       null,
    },
    courseCompletion: { averageCompletion: averageCompletionRate, categories: completionCategories },
    instructorPerformance: {
      averageRating: 0, averageCompletionRate: 0, averageAttendanceRate: 0, averageReviewScore: 0,
    },
    studentEngagement: {
      dailyActiveStudents:        activeToday,
      quizParticipationRate:      0,
      assignmentCompletionRate:   0,
      averageLearningTimeMinutes: 0,
    },
    performanceOverview: { averageScore: 0, passRate: 0, engagement: 0, satisfaction: 0 },
  };
}

async function getDashboardAdminWidgets(query = {}) {
  const scope     = buildUserScope(query);
  const deptScope = scope.department ? { department: scope.department } : {};
  // Single where-clause shared by BOTH the badge count and the item list below
  // — the same object, not a re-typed copy, so the two can never drift apart
  // again the way total/items did before this fix.
  const pendingApprovalWhere = { ...PENDING_APPROVAL_WHERE, ...deptScope };

  const [
    pendingApprovalCount, pendingApprovalRows, liveSessionRows,
    pendingCourseCount, pendingInstructorAppCount, pendingRefundCount,
    recentPayments, recentRefunds, recentPayouts,
    lastScheduledReport, pendingInstructorAppRows,
  ] = await Promise.all([
    prisma.appUser.count({ where: pendingApprovalWhere }).catch(() => 0),
    prisma.appUser.findMany({
      where: pendingApprovalWhere,
      orderBy: { createdAt: "asc" }, // longest-waiting first
      take: 10,
      select: { id: true, fullName: true, createdAt: true },
    }).catch(() => []),
    // Real live sessions (LIVE_SESSIONS_CONTRACT.md) — was previously counting
    // app-user LOGIN sessions, unrelated to actual live classes (fixed 2026-07-27).
    listLiveSessions({}).catch(() => []),

    // Pending Tasks — each count is owned elsewhere (Learning Management's
    // Course.status, Instructors' InstructorApplication queue, Finance's
    // Refund queue, this widget's own pendingApprovalCount above) and just
    // read here, never recomputed with a different definition (R4).
    prisma.course.count({ where: { status: "PENDING" } }).catch(() => 0),
    prisma.instructorApplication.count({ where: { status: { in: ["PENDING", "CHANGES_REQUESTED"] } } }).catch(() => 0),
    prisma.refund.count({ where: { status: "PENDING" } }).catch(() => 0),

    // Recent Transactions — merged from Finance's three money-moving tables
    // (Payment/Refund/InstructorPayout), same tables finance.service reads.
    prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, amount: true, currency: true, status: true, createdAt: true } }).catch(() => []),
    prisma.refund.findMany({ orderBy: { requestedAt: "desc" }, take: 3, select: { id: true, amount: true, status: true, requestedAt: true } }).catch(() => []),
    prisma.instructorPayout.findMany({ orderBy: { createdAt: "desc" }, take: 3, select: { id: true, amount: true, currency: true, status: true, createdAt: true } }).catch(() => []),

    // Reports Snapshot's lastGeneratedAt — the one real "a report ran" event
    // this schema has (ScheduledReport.lastRunAt, reports.prisma).
    prisma.scheduledReport.findFirst({ where: { lastRunAt: { not: null } }, orderBy: { lastRunAt: "desc" }, select: { lastRunAt: true } }).catch(() => null),

    // Pending Approvals widget rows (DEFERRED_ITEMS.md — the KPI/widget
    // ignored the instructor-application queue). Same OPEN_STATES filter as
    // pendingInstructorAppCount above, just the actual rows for the list.
    prisma.instructorApplication.findMany({
      where: { status: { in: ["PENDING", "CHANGES_REQUESTED"] } },
      orderBy: { createdAt: "asc" },
      take: 10,
      select: { id: true, fullName: true, createdAt: true },
    }).catch(() => []),
  ]);

  // Priority is fixed per task type (money/identity queues rank above
  // content queues) — there's no per-item "waiting since" to derive it from
  // the way pendingApprovalPriority() below does for individual users.
  const PENDING_TASK_DEFS = [
    { type: "user_verification",      count: pendingApprovalCount,      title: "User accounts pending verification", priority: "high",   link: "/users?tab=pending-verification" },
    { type: "refund",                 count: pendingRefundCount,        title: "Refund requests pending",            priority: "high",   link: "/finance?tab=refunds" },
    { type: "instructor_application", count: pendingInstructorAppCount, title: "Instructor applications to review",  priority: "medium", link: "/instructors?tab=pending" },
    { type: "course_approval",        count: pendingCourseCount,        title: "Courses awaiting approval",          priority: "medium", link: "/learning-management?tab=courses" },
  ];
  const tasksAndReminders = PENDING_TASK_DEFS
    .filter((t) => t.count > 0)
    .map((t) => ({ id: t.type, type: t.type, title: t.title, count: t.count, priority: t.priority, link: t.link }));

  const PAYMENT_TX_STATUS = { PENDING: "pending", SUCCESSFUL: "success", FAILED: "failed", REFUNDED: "refunded", CANCELLED: "failed" };
  const REFUND_TX_STATUS  = { PENDING: "pending", APPROVED: "pending", REJECTED: "failed", PROCESSED: "success" };
  const PAYOUT_TX_STATUS  = { PENDING: "pending", APPROVED: "pending", PROCESSING: "pending", HELD: "pending", COMPLETED: "success", FAILED: "failed" };
  const recentTransactions = [
    ...recentPayments.map((p) => ({
      id: p.id, type: p.status === "FAILED" ? "failed_payment" : "payment",
      amount: p.amount, currency: p.currency, status: PAYMENT_TX_STATUS[p.status] ?? "pending",
      createdAt: p.createdAt.toISOString(),
    })),
    ...recentRefunds.map((r) => ({
      id: r.id, type: "refund", amount: r.amount, currency: "USD",
      status: REFUND_TX_STATUS[r.status] ?? "pending", createdAt: r.requestedAt.toISOString(),
    })),
    ...recentPayouts.map((p) => ({
      id: p.id, type: "payout", amount: p.amount, currency: p.currency,
      status: PAYOUT_TX_STATUS[p.status] ?? "pending", createdAt: p.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);

  // Static link catalog into Reports & Analytics' real tabs (ReportsPage.tsx
  // TABS) — this widget doesn't own or recompute report data, it's a
  // navigation shortcut, same nature as the Quick Actions grid above.
  const availableReports = [
    { key: "overview",     label: "Reports Overview", path: "/reports-analytics?tab=overview" },
    { key: "learners",     label: "Learner Analytics", path: "/reports-analytics?tab=learners" },
    { key: "courses",      label: "Course Analytics",  path: "/reports-analytics?tab=courses" },
    { key: "certificates", label: "Certificates",      path: "/reports-analytics?tab=certificates" },
    { key: "audit",        label: "Audit Logs",        path: "/reports-analytics?tab=audit" },
  ];

  // Priority is a real, derived signal (how long the request has been
  // waiting), not an invented field — there is no separate priority system.
  function pendingApprovalPriority(createdAt) {
    const days = (Date.now() - new Date(createdAt).getTime()) / 86_400_000;
    if (days >= 14) return "urgent";
    if (days >= 7)  return "high";
    if (days >= 2)  return "medium";
    return "low";
  }

  // Combined queue — user verifications + instructor applications, same
  // definition the KPI card (getDashboardCore) uses so the two never
  // disagree. Longest-waiting first across BOTH types, capped at 10 total
  // (matches each individual query's own cap).
  const pendingApprovalItems = [
    ...pendingApprovalRows.map((u) => ({
      id:          u.id,
      type:        "user_verification",
      title:       `${u.fullName} — account verification`,
      submittedBy: u.fullName,
      submittedAt: u.createdAt.toISOString(),
      priority:    pendingApprovalPriority(u.createdAt),
    })),
    ...pendingInstructorAppRows.map((a) => ({
      id:          a.id,
      type:        "instructor",
      title:       `${a.fullName} — instructor application`,
      submittedBy: a.fullName,
      submittedAt: a.createdAt.toISOString(),
      priority:    pendingApprovalPriority(a.createdAt),
    })),
  ].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt)).slice(0, 10);

  // activeCount/upcomingCount/items all derive from the SAME synced rows —
  // no separate counts that could drift from what's actually listed.
  const activeCount   = liveSessionRows.filter((s) => s.status === "LIVE").length;
  const upcomingCount = liveSessionRows.filter((s) => s.status === "UPCOMING").length;
  const liveSessionItems = liveSessionRows
    .filter((s) => s.status === "LIVE" || s.status === "UPCOMING")
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    .slice(0, 5)
    .map((s) => ({
      id:              s.id,
      title:           s.title,
      instructorName:  s.instructorName ?? "Unassigned",
      status:          LIVE_SESSION_STATUS_MAP[s.status] ?? "upcoming",
      startsAt:        s.startTime,
      // No attendance-tracking system exists yet (classroom features are
      // [phase-later] per the blueprint) — null, not a fake 0. The frontend
      // must render this as "not tracked", never as "0 attendees".
      attendanceCount: null,
    }));

  // Calendar & Events — real upcoming/live sessions at minimum (course
  // deadlines and other event types have no backend source yet, so they
  // simply don't appear — partial real data, never a fabricated entry).
  // Reuses the SAME liveSessionRows as the widget above (no extra query,
  // and the two can't show inconsistent session lists).
  const calendarEvents = liveSessionRows
    .filter((s) => s.status === "LIVE" || s.status === "UPCOMING")
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    .slice(0, 10)
    .map((s) => ({
      id:       s.id,
      title:    s.title,
      type:     "live_session",
      startsAt: s.startTime,
      endsAt:   new Date(new Date(s.startTime).getTime() + s.durationMin * 60_000).toISOString(),
    }));

  return {
    filters: {
      dateFrom:     query.dateFrom     || null,
      dateTo:       query.dateTo       || null,
      departmentId: query.departmentId || null,
      courseId:     query.courseId     || null,
    },

    pendingApprovals: {
      total: pendingApprovalCount + pendingInstructorAppCount,
      items: pendingApprovalItems,
    },

    liveSessions: {
      activeCount,
      upcomingCount,
      // No technical-issue monitoring system exists — null (not tracked),
      // never a fake 0 that would imply "confirmed zero issues".
      technicalIssuesCount: null,
      items: liveSessionItems,
    },

    tasksAndReminders,
    recentTransactions,
    calendarEvents,

    reportsSnapshot: {
      availableReports,
      lastGeneratedAt: lastScheduledReport?.lastRunAt ? lastScheduledReport.lastRunAt.toISOString() : null,
    },

    aiInsights: [],
  };
}

module.exports = { getDashboardCore, getDashboardAnalytics, getDashboardAdminWidgets };
