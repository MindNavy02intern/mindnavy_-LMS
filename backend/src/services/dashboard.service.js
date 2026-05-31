async function getDashboardCore(admin) {
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
      totalUsers:         0,
      activeStudents:     0,
      activeInstructors:  0,
      publishedCourses:   0,
      pendingApprovals:   0,
      totalRevenue:       0,
      activeSubscriptions: 0,
      certificatesIssued: 0,
      liveSessionsRunning: 0,
    },

    // TODO: replace with real DB queries when tables are ready
    recentActivities:      [],
    notificationsPreview:  [],
    securityAlertsPreview: [],

    quickActions: [
      { key: "add_user",            label: "Add User",            enabled: true, path: null },
      { key: "create_course",       label: "Create Course",       enabled: true, path: null },
      { key: "approve_instructor",  label: "Approve Instructor",  enabled: true, path: null },
      { key: "generate_report",     label: "Generate Report",     enabled: true, path: null },
      { key: "create_live_session", label: "Create Live Session", enabled: true, path: null },
      { key: "system_settings",     label: "System Settings",     enabled: true, path: null },
    ],

    systemHealth: {
      status:  "operational",
      message: "All systems are running normally.",
      version: "1.0.0",
    },
  };
}

async function getDashboardAnalytics(filters = {}) {
  // TODO: replace with real DB queries when tables are ready
  return {
    filters: {
      dateFrom:     filters.dateFrom     || null,
      dateTo:       filters.dateTo       || null,
      departmentId: filters.departmentId || null,
    },
    learningActivity: [],
    usersByRole:      [],
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
      newRegistrations: 0,
      activeUsers:      0,
      retentionRate:    0,
      verifiedUsers:    0,
      suspendedUsers:   0,
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
      dailyActiveStudents:        0,
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
    topDepartments: [],
  };
}

module.exports = { getDashboardCore, getDashboardAnalytics };
