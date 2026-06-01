const dashboardService = require("../services/dashboard.service");

async function getDashboardCore(req, res) {
  try {
    const data = await dashboardService.getDashboardCore(req.admin);
    return res.status(200).json(data);
  } catch (error) {
    console.error("Dashboard core error:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

async function getDashboardAnalytics(req, res) {
  try {
    const { dateFrom, dateTo, departmentId } = req.query;
    const data = await dashboardService.getDashboardAnalytics({ dateFrom, dateTo, departmentId });
    return res.status(200).json(data);
  } catch (error) {
    console.error("Dashboard analytics error:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

async function getDashboardAdminWidgets(req, res) {
  try {
    const data = await dashboardService.getDashboardAdminWidgets(req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error("Dashboard admin widgets error:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

module.exports = { getDashboardCore, getDashboardAnalytics, getDashboardAdminWidgets };
