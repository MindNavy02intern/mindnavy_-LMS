const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { getDashboardCore } = require("../controllers/dashboard.controller");

const router = express.Router();

router.get("/core", requireAdminAuth, getDashboardCore);

module.exports = router;
