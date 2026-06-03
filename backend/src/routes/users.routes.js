const express = require("express");
const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { getUsersList, getUserDetails } = require("../controllers/users.controller");

const router = express.Router();

router.get("/", requireAdminAuth, getUsersList);
router.get("/:id", requireAdminAuth, getUserDetails);

module.exports = router;
