const express = require("express");
const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");
const { sendMessage, getMessages } = require("../controllers/messages.controller");

const router = express.Router();

// POST /api/admin/messages — send a message to a user
router.post("/", requireAdminAuth, adminUserActionRateLimiter, sendMessage);

// GET /api/admin/messages?recipientId=<uuid>&page=1&limit=10 — list messages for a user
router.get("/", requireAdminAuth, getMessages);

module.exports = router;
