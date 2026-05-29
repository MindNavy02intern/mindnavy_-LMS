async function getOverview(admin) {
  return {
    welcome: {
      adminName: admin.fullName || null,
      organizationName: "MindNavy LMS",
      currentDate: new Date().toISOString(),
      lastLoginAt: admin.lastLoginAt || null,
      systemStatus: "healthy",
    },
    quickStats: {
      totalUsers: 0,
      activeUsers: 0,
      totalCourses: 0,
      activeCourses: 0,
      pendingApprovals: 0,
    },
  };
}

async function getAnalytics() {
  return {
    learningActivity: [],
    usersByRole: [],
    revenueOverview: {
      totalRevenue: 0,
      monthlyRevenue: 0,
      currency: "USD",
    },
    courseAnalytics: {
      totalCourses: 0,
      activeCourses: 0,
      draftCourses: 0,
      pendingCourses: 0,
    },
  };
}

async function getAdminWidgets() {
  return {
    pendingApprovals: [],
    liveSessions: {
      activeNow: 0,
      sessions: [],
    },
    tasksAndReminders: [],
    reportsSnapshot: [],
  };
}

module.exports = { getOverview, getAnalytics, getAdminWidgets };
