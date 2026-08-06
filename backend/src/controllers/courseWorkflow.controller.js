const svc = require("../services/courseWorkflow.service");
const {
  validateId,
  validateSettings,
  validateRejectReason,
} = require("../validators/courses.validator");

// ── Helpers (mirror courses.controller) ─────────────────────────────────────────

function badRequest(res, msg, extra) {
  return res.status(400).json({ success: false, message: msg, ...extra });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function handleDomainError(res, err) {
  if (err.code === "COURSE_NOT_FOUND")   return notFound(res, "Course not found.");
  if (err.code === "PRICE_REQUIRED")     return badRequest(res, "price (integer cents, > 0) is required when isFree is false.");
  if (err.code === "ONLY_DRAFT_SUBMITTABLE")
    return badRequest(res, `Only Draft courses can be submitted (course is ${err.status}).`);
  if (err.code === "ONLY_PENDING_DECIDABLE")
    return badRequest(res, `Only Pending courses can be approved or rejected (course is ${err.status}).`);
  if (err.code === "ONLY_PUBLISHED_UNPUBLISHABLE")
    return badRequest(res, `Only Published courses can be unpublished (course is ${err.status}).`);
  if (err.code === "SUBMIT_CHECKS_FAILED")
    return badRequest(res, "Course is not ready to submit.", { errors: err.errors });
  if (err.code === "STATE_CHANGED")
    return badRequest(res, "Course status changed in the meantime — refresh and try again.");
  return null;
}

function serverError(res, err) {
  console.error("[CourseWorkflowController]", err);
  if (err.code === "P2025") return notFound(res, "Course not found.");
  return res.status(500).json({ success: false, message: "Internal server error." });
}

// One wrapper for every endpoint: id check → action → domain-error map → 500 guard.
function endpoint(handler) {
  return async (req, res) => {
    try {
      const idErr = validateId(req.params.id, "courseId");
      if (idErr) return badRequest(res, idErr);
      return await handler(req, res);
    } catch (err) {
      return handleDomainError(res, err) ?? serverError(res, err);
    }
  };
}

// ── Endpoints ────────────────────────────────────────────────────────────────────

const updateSettings = endpoint(async (req, res) => {
  const v = validateSettings(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const settings = await svc.updateSettings(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Course settings updated.", data: settings });
});

const getPreview = endpoint(async (req, res) => {
  return res.json({ success: true, data: await svc.getPreview(req.params.id) });
});

const submitCourse = endpoint(async (req, res) => {
  const result = await svc.submitCourse(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Course submitted for approval.", data: result });
});

const approveCourse = endpoint(async (req, res) => {
  const result = await svc.approveCourse(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Course approved and published.", data: result });
});

const rejectCourse = endpoint(async (req, res) => {
  const v = validateRejectReason(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.rejectCourse(req.params.id, v.data.reason, req.admin?.id);
  return res.json({ success: true, message: "Course rejected — returned to Draft.", data: result });
});

const unpublishCourse = endpoint(async (req, res) => {
  const result = await svc.unpublishCourse(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Course unpublished — returned to Draft.", data: result });
});

module.exports = { updateSettings, getPreview, submitCourse, approveCourse, rejectCourse, unpublishCourse };
