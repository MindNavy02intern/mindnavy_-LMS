const prisma = require("../config/prisma");
const { getUsersAnalytics } = require("./users.service");

async function getDashboardCore(admin) {
  const [
    totalUsers,
    activeStudents,
    activeInstructors,
    pendingApprovals,
  ] = await Promise.all([
    prisma.appUser.count(),
    prisma.appUser.count({ where: { role: "LEARNER",    status: "ACTIVE" } }),
    prisma.appUser.count({ where: { role: "INSTRUCTOR", status: "ACTIVE" } }),
    prisma.appUser.count({ where: { status: "PENDING" } }),
  ]);

  return {
    welcome: {
      adminName:        admin.fullName     || null,
      adminRole:        admin.role         || null,
      organizationName: "MindNavy LMS",
      currentDateTime:  new Date().toISOString(),
      lastLoginAt:      admin.lastLoginAt  || null,
      systemStatus:     "operational",
    },

    kpis: {
      totalUsers,
      activeStudents,
      activeInstructors,
      publishedCourses:    0,
      pendingApprovals,
      totalRevenue:        0,
      activeSubscriptions: 0,
      certificatesIssued:  0,
      liveSessionsRunning: 0,
    },

    // TODO: replace with real DB queries when tables are ready
    recentActivities:      [],
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
  // Pull real data from the users analytics service AND direct status counts in parallel
  const [ua, activeUsers, suspendedUsers] = await Promise.allSettled([
    getUsersAnalytics(),
    prisma.appUser.count({ where: { status: "ACTIVE" } }),
    prisma.appUser.count({ where: { status: "SUSPENDED" } }),
  ]).then(([uaRes, activeRes, suspendedRes]) => [
    uaRes.status     === "fulfilled" ? uaRes.value     : null,
    activeRes.status === "fulfilled" ? activeRes.value : 0,
    suspendedRes.status === "fulfilled" ? suspendedRes.value : 0,
  ]);

  if (!ua) console.error("[dashboard] getUsersAnalytics failed — charts will be empty");

  // Map users-service role keys (LEARNER) → dashboard role keys (learners)
  const ROLE_MAP = {
    LEARNER:         "learners",
    INSTRUCTOR:      "instructors",
    MANAGER:         "managers",
    ADMIN_ASSISTANT: "admins",
  };

  const usersByRole = (ua?.usersByRole ?? []).map(r => ({
    role:       ROLE_MAP[r.role] ?? "others",
    count:      r.count,
    percentage: r.percentage,
  }));

  // Raw department list (users-service format: { department, count })
  const usersByDepartment = ua?.usersByDepartment ?? [];

  // Raw activity data (users-service format: { activeToday, activeThisWeek, dailyTrend })
  const userActivity = ua?.userActivity ?? { activeToday: 0, activeThisWeek: 0, dailyTrend: [] };

  // Raw verification data (users-service format: { status, count, percentage })
  const verificationStatus = ua?.verificationStatus ?? [];

  // topDepartments keeps existing frontend shape: { id, name, usersCount }
  const topDepartments = usersByDepartment.slice(0, 8).map(d => ({
    id:         d.department,
    name:       d.department,
    usersCount: d.count,
  }));

  const verifiedCount = verificationStatus.find(v => v.status === "verified")?.count ?? 0;

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
      newRegistrations: ua?.newUsersThisMonth?.count ?? 0,
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
    courseCompletion: {
      averageCompletion: 0,
      categories:        [],
    },
    instructorPerformance: {
      averageRating:         0,
      averageCompletionRate: 0,
      averageAttendanceRate: 0,
      averageReviewScore:    0,
    },
    studentEngagement: {
      dailyActiveStudents:        userActivity.activeToday,
      quizParticipationRate:      0,
      assignmentCompletionRate:   0,
      averageLearningTimeMinutes: 0,
    },
    performanceOverview: {
      averageScore: 0,
      passRate:     0,
      engagement:   0,
      satisfaction: 0,
    },
  };
}

async function getDashboardAdminWidgets(query = {}) {
  // TODO: replace with real DB queries when tables are ready
  return {
    filters: {
      dateFrom:     query.dateFrom     || null,
      dateTo:       query.dateTo       || null,
      departmentId: query.departmentId || null,
      courseId:     query.courseId     || null,
    },

    pendingApprovals: {
      total: 0,
      items: [],
    },

    liveSessions: {
      activeCount:          0,
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
