const svc = require("../services/instructorReports.service");

function serverError(res, err) {
  console.error("[InstructorReportsController]", err);
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

const getOverview = run(async (req, res) => {
  const result = await svc.getMyOverview(req.instructor.id);
  return res.json({ success: true, data: result });
});

const getCourseBreakdown = run(async (req, res) => {
  const result = await svc.getMyCourseBreakdown(req.instructor.id);
  return res.json({ success: true, data: result });
});

module.exports = {
  getOverview,
  getCourseBreakdown,
};
