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

module.exports = { getDashboardCore };
