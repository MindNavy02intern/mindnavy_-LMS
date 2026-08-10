const svc = require("../services/learners.service");
const {
  validateId,
  validateLearnerCreate,
  validateLearnerUpdate,
  validateSuspend,
  validateReactivate,
  validateResetPassword,
  validateHistoryQuery,
  validateListQuery,
  validateEnrollBody,
  validateBulkEnroll,
  validateActivityQuery,
  validateGrade,
  validateSimplePageQuery,
} = require("../validators/learners.validator");
// Reused, not re-declared — certificates reissue/revoke share the exact
// validation the Certificates module already has.
const { validateReissue, validateRevoke } = require("../validators/certificates.validator");

// ── Helpers (same pattern as instructors.controller) ────────────────────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function conflict(res, msg, data) {
  return res.status(409).json({ success: false, message: msg, ...(data ? { data } : {}) });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "LEARNER_NOT_FOUND":
      return notFound(res, "Learner not found.");
    case "EMAIL_TAKEN":
      return conflict(res, "A user with this email already exists.");
    case "LEARNER_HAS_ACTIVE_ENROLLMENTS":
      return conflict(
        res,
        "This learner still has active (non-completed) course enrollments. Unenroll or complete them before archiving.",
        err.blockers,
      );
    // Enrollment errors (Part 3) — most come from the REUSED enrollments.service.
    case "ENROLLMENT_NOT_FOUND":
      return notFound(res, "Enrollment not found.");
    case "COURSE_NOT_FOUND":
      return badRequest(res, "Referenced course does not exist.");
    case "COURSE_ARCHIVED":
      return badRequest(res, "Cannot enroll into an archived course.");
    case "USER_NOT_FOUND":
      return badRequest(res, "Referenced user does not exist (or is archived).");
    case "ALREADY_ENROLLED":
      return badRequest(res, "This learner is already enrolled in this course.");
    case "COURSE_FULL":
      return badRequest(res, "Course is full: its enrollment limit has been reached.");
    case "COHORT_NOT_FOUND":
      return badRequest(res, "Referenced cohort (group) does not exist.");
    case "LEARNING_PATH_NOT_FOUND":
      return badRequest(res, "Referenced learning path does not exist.");
    case "LEARNING_PATH_EMPTY":
      return badRequest(res, "This learning path has no course items to enroll into.");
    // Assessments (Part 5)
    case "ATTEMPT_NOT_FOUND":
      return notFound(res, "Assessment attempt not found.");
    // Certificates (Part 5) — same codes certificates.service already throws;
    // learners.controller maps them too since the calls bubble up unchanged.
    case "CERT_NOT_FOUND":
      return notFound(res, "Certificate not found.");
    case "ALREADY_REVOKED":
      return badRequest(res, "Certificate is already revoked.");
    case "TEMPLATE_REF_NOT_FOUND":
      return badRequest(res, "Referenced template does not exist.");
    default:
      return null;
  }
}

// users.service throws makeError(message, statusCode) — pass those straight
// through instead of masking them as 500s (same as instructors.controller).
function handleDelegatedError(res, err) {
  if (typeof err.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 500) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }
  return null;
}

function serverError(res, err) {
  console.error("[LearnersController]", err);
  if (err.code === "P2025") return notFound(res, "Record not found.");
  if (err.code === "P2002") {
    const target = err.meta?.target;
    if (Array.isArray(target) && target.includes("learnerCode")) {
      return conflict(res, "Learner code generation collided — please retry.");
    }
    return conflict(res, "A user with this email already exists.");
  }
  if (err.code === "P2003") return badRequest(res, "Invalid reference: one or more IDs do not exist.");
  if (err.code === "P2021" || err.code === "P2022") {
    return res.status(503).json({ success: false, message: "Database not migrated yet. Run `npx prisma db push`." });
  }
  return res.status(500).json({ success: false, message: "Internal server error." });
}

function run(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      return handleDomainError(res, err) ?? handleDelegatedError(res, err) ?? serverError(res, err);
    }
  };
}

// ── Handlers ────────────────────────────────────────────────────────────────────

const listLearners = run(async (req, res) => {
  const v = validateListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.listLearners(v.data);
  return res.json({ success: true, data: result });
});

// Registered BEFORE /:id in the router — "stats"/"analytics" must never be
// matched as a learner id.
const getStats = run(async (req, res) => {
  const stats = await svc.getStats();
  return res.json({ success: true, data: stats });
});

const getAnalytics = run(async (req, res) => {
  const analytics = await svc.getAnalytics();
  return res.json({ success: true, data: analytics });
});

const getLearner = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  const learner = await svc.getLearner(req.params.id);
  return res.json({ success: true, data: learner });
});

const createLearner = run(async (req, res) => {
  const v = validateLearnerCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const learner = await svc.createLearner(v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Learner created.", data: learner });
});

const updateLearner = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  const v = validateLearnerUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const learner = await svc.updateLearner(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Learner updated.", data: learner });
});

const suspendLearner = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  const v = validateSuspend(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const learner = await svc.suspendLearner(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Learner suspended.", data: learner });
});

const reactivateLearner = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  const v = validateReactivate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const learner = await svc.reactivateLearner(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Learner reactivated.", data: learner });
});

const resetPassword = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  const v = validateResetPassword(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.resetLearnerPassword(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Learner password has been reset.", data: result });
});

const getSuspensionHistory = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  const v = validateHistoryQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.getSuspensionHistory(req.params.id, v.data);
  return res.json({ success: true, data: result });
});

const deleteLearner = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteLearner(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Learner archived.", data: result });
});

// ── Enrollments / progress / activity (Part 3) ──────────────────────────────────

const listEnrollments = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.listLearnerEnrollments(req.params.id, req.query);
  return res.json({ success: true, data: result });
});

const createEnrollment = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  const v = validateEnrollBody(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.createLearnerEnrollment(req.params.id, v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Learner enrolled.", data: result });
});

const deleteEnrollment = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  const enrollmentIdErr = validateId(req.params.enrollmentId, "enrollmentId");
  if (enrollmentIdErr) return badRequest(res, enrollmentIdErr);
  const result = await svc.deleteLearnerEnrollment(req.params.id, req.params.enrollmentId, req.admin?.id);
  return res.json({ success: true, message: "Learner unenrolled.", data: result });
});

const bulkEnroll = run(async (req, res) => {
  const v = validateBulkEnroll(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.bulkEnrollLearners(v.data, req.admin?.id);
  return res.json({ success: true, message: `${result.enrolledCount} learner(s) enrolled.`, data: result });
});

const getProgress = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.getLearnerProgress(req.params.id);
  return res.json({ success: true, data: result });
});

const resetProgress = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  const courseIdErr = validateId(req.params.courseId, "courseId");
  if (courseIdErr) return badRequest(res, courseIdErr);
  const result = await svc.resetLearnerProgress(req.params.id, req.params.courseId, req.admin?.id);
  return res.json({ success: true, message: "Progress reset.", data: result });
});

const getActivity = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  const v = validateActivityQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.getLearnerActivity(req.params.id, v.data);
  return res.json({ success: true, data: result });
});

// ── Assessments / Certificates / Attendance (Part 5) ────────────────────────────

function attemptIdErr(req, res) {
  const err = validateId(req.params.aid, "attemptId");
  if (err) { badRequest(res, err); return true; }
  return false;
}

function certIdErr(req, res) {
  const err = validateId(req.params.cid, "certificateId");
  if (err) { badRequest(res, err); return true; }
  return false;
}

const listAssessments = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  const v = validateSimplePageQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.listLearnerAssessments(req.params.id, v.data);
  return res.json({ success: true, data: result });
});

const reopenAssessment = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  if (attemptIdErr(req, res)) return;
  const result = await svc.reopenAssessment(req.params.id, req.params.aid, req.admin?.id);
  return res.json({ success: true, message: "Assessment reopened.", data: result });
});

const resetAssessment = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  if (attemptIdErr(req, res)) return;
  const result = await svc.resetAssessment(req.params.id, req.params.aid, req.admin?.id);
  return res.json({ success: true, message: "Assessment reset.", data: result });
});

const gradeAssessment = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  if (attemptIdErr(req, res)) return;
  const v = validateGrade(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.gradeAssessment(req.params.id, req.params.aid, v.data, req.admin?.id);
  return res.json({ success: true, message: "Assessment graded.", data: result });
});

const listCertificates = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  const v = validateSimplePageQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.listLearnerCertificates(req.params.id, v.data);
  return res.json({ success: true, data: result });
});

const reissueCertificate = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  if (certIdErr(req, res)) return;
  const v = validateReissue(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.reissueLearnerCertificate(req.params.id, req.params.cid, v.data, req.admin?.id);
  return res.json({ success: true, message: "Certificate reissued with a new verification code.", data: result });
});

const revokeCertificate = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  if (certIdErr(req, res)) return;
  const v = validateRevoke(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.revokeLearnerCertificate(req.params.id, req.params.cid, v.data.reason, req.admin?.id);
  return res.json({ success: true, message: "Certificate revoked.", data: result });
});

const getAttendance = run(async (req, res) => {
  const idErr = validateId(req.params.id, "learnerId");
  if (idErr) return badRequest(res, idErr);
  const v = validateSimplePageQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.getLearnerAttendance(req.params.id, v.data);
  return res.json({ success: true, data: result });
});

module.exports = {
  listLearners,
  getStats,
  getAnalytics,
  getLearner,
  createLearner,
  updateLearner,
  suspendLearner,
  reactivateLearner,
  resetPassword,
  getSuspensionHistory,
  deleteLearner,
  listEnrollments,
  createEnrollment,
  deleteEnrollment,
  bulkEnroll,
  getProgress,
  resetProgress,
  getActivity,
  listAssessments,
  reopenAssessment,
  resetAssessment,
  gradeAssessment,
  listCertificates,
  reissueCertificate,
  revokeCertificate,
  getAttendance,
};
