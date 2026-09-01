const svc = require("../services/instructorSelf.service");

// Same run()/serverError() shape as instructors.controller.js — no
// req.params.id validation needed here (unlike the admin controller), since
// every handler is scoped to req.instructor.id, set by requireInstructorAuth.
// There is no id for a caller to spoof.

function serverError(res, err) {
  console.error("[InstructorDashboardController]", err);
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
      return serverError(res, err);
    }
  };
}

const getStats = run(async (req, res) => {
  const stats = await svc.getMyStats(req.instructor.id);
  return res.json({ success: true, data: stats });
});

const getEnrollmentTrend = run(async (req, res) => {
  const trend = await svc.getMyEnrollmentTrend(req.instructor.id);
  return res.json({ success: true, data: trend });
});

const getActivity = run(async (req, res) => {
  const activity = await svc.getMyActivity(req.instructor.id);
  return res.json({ success: true, data: activity });
});

module.exports = {
  getStats,
  getEnrollmentTrend,
  getActivity,
};
