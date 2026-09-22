const svc = require("../services/instructorEarnings.service");

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function serverError(res, err) {
  console.error("[InstructorEarningsController]", err);
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

const getSummary = run(async (req, res) => {
  const result = await svc.getMySummary(req.instructor.id);
  return res.json({ success: true, data: result });
});

const listPayouts = run(async (req, res) => {
  const { status, page, limit } = req.query;
  if (status !== undefined && !svc.PAYOUT_STATUSES.has(String(status).toUpperCase())) {
    return badRequest(res, `status must be one of: ${[...svc.PAYOUT_STATUSES].join(", ")}.`);
  }
  const result = await svc.listMyPayouts(req.instructor.id, {
    status: status ? String(status).toUpperCase() : undefined,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
  });
  return res.json({ success: true, data: result });
});

module.exports = {
  getSummary,
  listPayouts,
};
