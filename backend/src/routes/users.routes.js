const express = require("express");
const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { getUsersList } = require("../controllers/users.controller");

const router = express.Router();

router.get("/", requireAdminAuth, getUsersList);

module.exports = router;
