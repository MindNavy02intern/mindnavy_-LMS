const prisma = require("../config/prisma");
const { Prisma } = require("@prisma/client");

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

// Maps audit actions → NotificationType (security | approval | system | payment | course)
const ACTION_NOTIF_TYPE = {
  ADMIN_LOGIN:                "security",
  ADMIN_LOGOUT:               "security",
  FAILED_LOGIN:               "security",
  SESSION_REVOKED:            "security",
  USER_FORCE_LOGOUT:          "security",
  USER_VERIFICATION_APPROVED: "approval",
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
    recentActivitiesRaw,
    liveSessionsRunning,
    notificationsRaw,
  ] = await Promise.all([
    prisma.appUser.count({ where: { status: { not: "ARCHIVED" } } }).catch(() => 0),
    prisma.appUser.count({ where: { role: "LEARNER",    status: "ACTIVE" } }).catch(() => 0),
    prisma.appUser.count({ where: { role: "INSTRUCTOR", status: "ACTIVE" } }).catch(() => 0),
    prisma.appUser.count({ where: PENDING_APPROVAL_WHERE }).catch(() => 0),
    prisma.course.count({ where: { status: "PUBLISHED" } }).catch(() => 0),
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
    // Active app-user sessions (proxy for "users currently online")
    prisma.appUserSession.count({
      where: { revokedAt: null, expiresAt: { gt: new Date() } },
    }).catch(() => 0),
    // Last 5 audit log entries for the notifications preview panel
    prisma.auditLog.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, action: true, createdAt: true },
    }).catch(() => []),
  ]);

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
      pendingApprovals,
      totalRevenue:        0,  // Phase 2 — Finance table not yet built
      activeSubscriptions: 0,  // Phase 2 — Subscription table not yet built
      certificatesIssued:  0,  // Phase 2 — Certificate table not yet built
      liveSessionsRunning,     // active app-user sessions
    },

    recentActivities:      mapAuditToActivity(recentActivitiesRaw),
    notificationsPreview:  notificationsRaw.map(log => ({
      id:        log.id,
      title:     ACTION_TITLE[log.action] ?? log.action.replace(/_/g, " ").toLowerCase(),
      message:   "",
      type:      ACTION_NOTIF_TYPE[log.action] ?? "system",
      isRead:    false,
      createdAt: log.createdAt instanceof Date ? log.createdAt.toISOString() : String(log.createdAt),
    })),
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

  return {
    filters: {
      dateFrom:     filters.dateFrom     || null,
      dateTo:       filters.dateTo       || null,
      departmentId: filters.departmentId || null,
    },
    // learningActivity: [] — Requires Course + Enrollment schema (Phase 2 — Learning Mgmt module)
    learningActivity: [],
    usersByRole,
    usersByDepartment,
    userActivity,
    verificationStatus,
    topDepartments,
    revenueOverview: {
      dailyRevenue:        0,
      monthlyRevenue:      0,
      annualRevenue:       0,
      subscriptionRevenue: 0,
      refundTotal:         0,
      instructorPayouts:   0,
      growthPercentage:    0,
    },
    userAnalytics: {
      newRegistrations: thisMonthCount,
      activeUsers,
      retentionRate:    0,
      verifiedUsers:    verifiedCount,
      suspendedUsers,
    },
    // Course counts are live (R3/B1) so the submit/approve invalidations on
    // ['dashboard','course-analytics'] actually move these KPIs. The remaining
    // fields stay stubs until quiz/completion tracking exists.
    courseAnalytics: {
      totalCourses:           courseCountByStatus.DRAFT + courseCountByStatus.PENDING + courseCountByStatus.PUBLISHED,
      activeCourses:          courseCountByStatus.PUBLISHED,
      pendingApprovalCourses: courseCountByStatus.PENDING,
      averageCompletionRate:  0,
      mostPopularCourse:      null,
      averageQuizScore:       0,
    },
    courseCompletion: { averageCompletion: 0, categories: [] },
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

  const [pendingApprovalCount, activeUserSessions] = await Promise.all([
    prisma.appUser
      .count({ where: { ...PENDING_APPROVAL_WHERE, ...deptScope } })
      .catch(() => 0),
    // Count active app-user sessions as a proxy for "users currently online"
    prisma.appUserSession
      .count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } })
      .catch(() => 0),
  ]);

  return {
    filters: {
      dateFrom:     query.dateFrom     || null,
      dateTo:       query.dateTo       || null,
      departmentId: query.departmentId || null,
      courseId:     query.courseId     || null,
    },

    pendingApprovals: {
      total: pendingApprovalCount,
      items: [],
    },

    liveSessions: {
      activeCount:          activeUserSessions,  // active app-user sessions
      upcomingCount:        0,  // Phase 2 — Live session scheduling
      technicalIssuesCount: 0,  // Phase 2 — Live session monitoring
      items:                [],
    },

    tasksAndReminders:  [],
    recentTransactions: [],
    calendarEvents:     [],

    reportsSnapshot: {
      availableReports: [],
      lastGeneratedAt:  null,
    },

    aiInsights: [],
  };
}

module.exports = { getDashboardCore, getDashboardAnalytics, getDashboardAdminWidgets };
