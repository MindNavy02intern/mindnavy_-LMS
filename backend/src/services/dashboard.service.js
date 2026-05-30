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

module.exports = { getDashboardCore };
