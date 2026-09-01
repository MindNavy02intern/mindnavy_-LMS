const express = require("express");

const {
  getProfile,
  updateProfile,
  listDocuments,
  signDocumentUpload,
  confirmDocumentUpload,
  withdrawDocument,
  listCertifications,
  signCertificationUpload,
  createCertification,
} = require("../controllers/instructorProfile.controller");

const { requireInstructorAuth } = require("../middlewares/instructorAuth.middleware");
const {
  coursesReadRateLimiter,
  adminUserActionRateLimiter,
} = require("../middlewares/rateLimit.middleware");

// Mounted at /api/instructor/profile (see server.js). No :id anywhere —
// every route is scoped to req.instructor.id from requireInstructorAuth.
// Verify/reject on documents and certifications are deliberately NOT here —
// those stay admin-only (see INSTRUCTOR_DASHBOARD_BLUEPRINT.docx Section 2.2
// "Known Gaps" — self-verification is not a thing this app should have).
const router = express.Router();

router.get("/", requireInstructorAuth, coursesReadRateLimiter, getProfile);
router.patch("/", requireInstructorAuth, adminUserActionRateLimiter, updateProfile);

router.get("/documents", requireInstructorAuth, coursesReadRateLimiter, listDocuments);
router.post("/documents/sign", requireInstructorAuth, adminUserActionRateLimiter, signDocumentUpload);
router.post("/documents/confirm", requireInstructorAuth, adminUserActionRateLimiter, confirmDocumentUpload);
router.delete("/documents/:docId", requireInstructorAuth, adminUserActionRateLimiter, withdrawDocument);

router.get("/certifications", requireInstructorAuth, coursesReadRateLimiter, listCertifications);
router.post("/certifications/sign", requireInstructorAuth, adminUserActionRateLimiter, signCertificationUpload);
router.post("/certifications", requireInstructorAuth, adminUserActionRateLimiter, createCertification);

module.exports = router;
