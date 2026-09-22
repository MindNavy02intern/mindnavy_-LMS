const express = require("express");

const {
  instructorLoginController,
  instructorLogoutController,
  instructorMeController,
  instructorChangePasswordController,
} = require("../controllers/instructorAuth.controller");

const { requireInstructorAuth } = require("../middlewares/instructorAuth.middleware");
const { instructorLoginRateLimiter, adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");

const router = express.Router();

router.post("/login", instructorLoginRateLimiter, instructorLoginController);
router.get("/me", requireInstructorAuth, instructorMeController);
router.post("/logout", requireInstructorAuth, instructorLogoutController);
router.patch("/password", requireInstructorAuth, adminUserActionRateLimiter, instructorChangePasswordController);

module.exports = router;
