async function getDashboardCore(admin) {
  return {
    welcome: {
      adminName: admin.fullName || null,
      adminEmail: admin.email || null,
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

module.exports = { getDashboardCore };
