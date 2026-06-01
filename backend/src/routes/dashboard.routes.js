const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  getDashboardCore,
  getDashboardAnalytics,
  getDashboardAdminWidgets,
} = require("../controllers/dashboard.controller");

const router = express.Router();

router.get("/core", requireAdminAuth, getDashboardCore);
router.get("/analytics", requireAdminAuth, getDashboardAnalytics);
router.get("/admin-widgets", requireAdminAuth, getDashboardAdminWidgets);

module.exports = router;
