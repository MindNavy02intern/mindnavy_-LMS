const svc = require("../services/lm.service");
const {
  validateRange,
  validateLimit,
  validateSessionStatus,
  validateCoursesQuery,
} = require("../validators/lm.validator");

// ── Helpers ────────────────────────────────────────────────────────────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function serverError(res, err) {
  console.error("[LearningManagementController]", err);
  return res.status(500).json({ success: false, message: "Internal server error." });
}

// ── Endpoints (all return { success: true, data }) ───────────────────────────────

async function getStats(req, res) {
  try {
    return res.json({ success: true, data: await svc.getStats() });
  } catch (err) { return serverError(res, err); }
}

async function getDistribution(req, res) {
  try {
    return res.json({ success: true, data: await svc.getDistribution() });
  } catch (err) { return serverError(res, err); }
}

async function getProgress(req, res) {
  try {
    const v = validateRange(req.query);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    return res.json({ success: true, data: await svc.getProgress(v.data.range) });
  } catch (err) { return serverError(res, err); }
}

async function getTopCourses(req, res) {
  try {
    const { data } = validateLimit(req.query, 5);
    return res.json({ success: true, data: await svc.getTopCourses(data.limit) });
  } catch (err) { return serverError(res, err); }
}

async function getContentStats(req, res) {
  try {
    return res.json({ success: true, data: await svc.getContentStats() });
  } catch (err) { return serverError(res, err); }
}

async function getCourses(req, res) {
  try {
    const v = validateCoursesQuery(req.query);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    return res.json({ success: true, data: await svc.getCourses(v.data) });
  } catch (err) { return serverError(res, err); }
}

async function getActivities(req, res) {
  try {
    const { data } = validateLimit(req.query, 5);
    return res.json({ success: true, data: await svc.getActivities(data.limit) });
  } catch (err) { return serverError(res, err); }
}

async function getLiveSessions(req, res) {
  try {
    const v = validateSessionStatus(req.query);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    return res.json({ success: true, data: await svc.getLiveSessions(v.data.status) });
  } catch (err) { return serverError(res, err); }
}

async function getFilterOptions(req, res) {
  try {
    return res.json({ success: true, data: await svc.getFilterOptions() });
  } catch (err) { return serverError(res, err); }
}

module.exports = {
  getStats,
  getDistribution,
  getProgress,
  getTopCourses,
  getContentStats,
  getCourses,
  getActivities,
  getLiveSessions,
  getFilterOptions,
};
