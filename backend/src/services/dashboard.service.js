const prisma = require("../config/prisma");

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
  ADMIN_LOGIN:           "logged in",
  ADMIN_LOGOUT:          "logged out",
  USER_CREATED:          "created a new user",
  USER_UPDATED:          "updated a user",
  USER_STATUS_CHANGED:   "changed user status",
  USER_PASSWORD_RESET:   "reset a user password",
  USER_ROLE_ASSIGNED:    "assigned a role",
  USER_DELETED:          "deleted a user",
  USER_SUSPENDED:        "suspended a user",
  USER_REACTIVATED:      "reactivated a user",
  USERS_IMPORTED:        "imported users from CSV",
  USER_ANALYTICS_VIEWED: "viewed analytics",
  USERS_LIST_VIEWED:     "viewed user list",
  USER_DETAILS_VIEWED:   "viewed user details",
  FAILED_LOGIN:          "had a failed login attempt",
  OTP_SENT:              "requested OTP",
  OTP_VERIFIED:          "verified OTP",
  SESSION_CREATED:       "started a session",
  SESSION_REVOKED:       "revoked a session",
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
  const now = new Date();

  const [
    totalUsers,
    activeStudents,
    activeInstructors,
    pendingApprovals,
    recentActivitiesRaw,
    liveSessionsRunning,
  ] = await Promise.all([
    prisma.appUser.count({ where: { status: { not: "ARCHIVED" } } }),
    prisma.appUser.count({ where: { role: "LEARNER",    status: "ACTIVE" } }),
    prisma.appUser.count({ where: { role: "INSTRUCTOR", status: "ACTIVE" } }),
    prisma.appUser.count({ where: { verificationState: "PENDING", status: { not: "ARCHIVED" } } }),
    prisma.auditLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id:      true,
        action:  true,
        createdAt: true,
        admin: { select: { fullName: true } },
      },
    }).catch(() => []),
    prisma.adminSession.count({
      where: { revokedAt: null, expiresAt: { gt: now } },
    }),
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
      publishedCourses:    0,  // TODO: courses table not yet built
      pendingApprovals,
      totalRevenue:        0,  // TODO: payments table not yet built
      activeSubscriptions: 0,
      certificatesIssued:  0,  // TODO: certificates table not yet built
      liveSessionsRunning,
    },

    recentActivities:      mapAuditToActivity(recentActivitiesRaw),
    notificationsPreview:  [],
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

  const [
    roleGroups,
    departmentGroups,
    verificationGroups,
    statusGroups,
    thisMonthCount,
    activeToday,
    activeLast7d,
    rawDailyTrend,
  ] = await Promise.all([
    prisma.appUser.groupBy({ by: ["role"],              _count: { _all: true }, where: { status: { not: "ARCHIVED" } } }),
    prisma.appUser.groupBy({ by: ["department"],        _count: { _all: true }, where: { department: { not: null } } }),
    prisma.appUser.groupBy({ by: ["verificationState"], _count: { _all: true } }),
    prisma.appUser.groupBy({ by: ["status"],            _count: { _all: true } }),
    prisma.appUser.count({ where: { createdAt: { gte: startOfMonth } } }),
    prisma.appUser.count({ where: { lastActivityAt: { gte: startOfToday } } }),
    prisma.appUser.count({ where: { lastActivityAt: { gte: last7d } } }),
    prisma.$queryRaw`
      SELECT DATE("lastActivityAt") AS date, COUNT(*)::int AS count
      FROM "app_users"
      WHERE "lastActivityAt" >= ${last30d} AND "lastActivityAt" IS NOT NULL
      GROUP BY DATE("lastActivityAt")
      ORDER BY date ASC
    `,
  ]);

  const totalUsers     = statusGroups.filter((g) => g.status !== "ARCHIVED").reduce((s, g) => s + g._count._all, 0);
  const activeUsers    = statusGroups.find((g) => g.status === "ACTIVE")?._count._all    ?? 0;
  const suspendedUsers = statusGroups.find((g) => g.status === "SUSPENDED")?._count._all ?? 0;

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

  // Build dense 30-day daily trend (fill missing days with 0)
  const activityMap = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    activityMap[d.toISOString().slice(0, 10)] = 0;
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
    courseAnalytics: {
      totalCourses:           0,
      activeCourses:          0,
      pendingApprovalCourses: 0,
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
  const now = new Date();

  const [liveSessionCount, pendingApprovalCount] = await Promise.all([
    prisma.adminSession.count({
      where: { revokedAt: null, expiresAt: { gt: now } },
    }),
    prisma.appUser.count({
      where: { status: "PENDING" },
    }),
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
      activeCount:          liveSessionCount,
      upcomingCount:        0,
      technicalIssuesCount: 0,
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
