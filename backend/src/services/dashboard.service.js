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

async function getDashboardAnalytics() {
  return {
    success: true,
    data: {
      learningActivity: [],
      usersByRole: [],
      revenueOverview: {
        totalRevenue: 0,
        monthlyRevenue: 0,
        currency: "USD",
      },
      userAnalytics: {
        totalUsers: 0,
        activeUsers: 0,
        newUsers: 0,
      },
      courseAnalytics: {
        totalCourses: 0,
        activeCourses: 0,
        completedCourses: 0,
      },
      courseCompletionRate: {
        rate: 0,
        completed: 0,
        total: 0,
      },
    },
  };
}

async function getDashboardAdminWidgets(query = {}) {
  const dateFrom = query.dateFrom || null;
  const dateTo   = query.dateTo   || null;
  const status   = query.status   || "all";

  const rawLimit = parseInt(query.limit, 10);
  const limit    = Number.isFinite(rawLimit) && rawLimit >= 1 && rawLimit <= 20 ? rawLimit : 5;

  return {
    // TODO: replace with real DB queries when tables are ready
    filters: { dateFrom, dateTo, status, limit },

    pendingApprovals: {
      summary: { total: 0, pending: 0, approved: 0, rejected: 0 },
      list: [],
    },

    liveSessions: {
      summary: { activeNow: 0, scheduledToday: 0, completedToday: 0 },
      list: [],
    },

    tasksAndReminders: {
      summary: { total: 0, dueToday: 0, overdue: 0, completed: 0 },
      list: [],
    },
  };
}

module.exports = { getDashboardCore, getDashboardAnalytics, getDashboardAdminWidgets };
