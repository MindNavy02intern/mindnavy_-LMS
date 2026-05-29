const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const {
  getOverview,
  getAnalytics,
  getAdminWidgets,
} = require("../controllers/dashboard.controller");

const router = express.Router();

router.get("/overview", requireAdminAuth, getOverview);
router.get("/analytics", requireAdminAuth, getAnalytics);
router.get("/admin-widgets", requireAdminAuth, getAdminWidgets);

module.exports = router;
