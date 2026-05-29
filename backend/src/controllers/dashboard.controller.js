const dashboardService = require("../services/dashboard.service");

async function getOverview(req, res) {
  try {
    const overview = await dashboardService.getOverview(req.admin);
    return res.status(200).json({ success: true, overview });
  } catch (error) {
    console.error("Dashboard overview error:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

async function getAnalytics(req, res) {
  try {
    const analytics = await dashboardService.getAnalytics();
    return res.status(200).json({ success: true, analytics });
  } catch (error) {
    console.error("Dashboard analytics error:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

async function getAdminWidgets(req, res) {
  try {
    const widgets = await dashboardService.getAdminWidgets();
    return res.status(200).json({ success: true, widgets });
  } catch (error) {
    console.error("Dashboard admin-widgets error:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

module.exports = { getOverview, getAnalytics, getAdminWidgets };
