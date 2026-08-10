const prisma = require("../config/prisma");
const svc = require("../services/scheduledReports.service");
const { validateCreate, validateUpdate, validateListQuery } = require("../validators/scheduledReports.validator");

// ── Helpers (same pattern as reports.controller / every other *.controller) ──

async function auditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: adminId ?? null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Scheduled report not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function serverError(res, err) {
  console.error("[ScheduledReportsController]", err);
  if (err.code === "NOT_FOUND") return notFound(res, err.message);
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

// ── Handlers ─────────────────────────────────────────────────────────────

const listScheduledReports = run(async (req, res) => {
  const v = validateListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const { rows, pagination } = await svc.list(v.data);
  return res.json({ success: true, data: { reports: rows, pagination } });
});

const createScheduledReport = run(async (req, res) => {
  const v = validateCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const created = await svc.create(v.data, req.admin?.id);
  await auditLog(req.admin?.id, "SCHEDULED_REPORT_CREATED", { id: created.id, name: created.name, reportType: created.reportType, frequency: created.frequency });
  return res.status(201).json({ success: true, data: created });
});

const updateScheduledReport = run(async (req, res) => {
  const v = validateUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const updated = await svc.update(req.params.id, v.data);
  await auditLog(req.admin?.id, "SCHEDULED_REPORT_UPDATED", { id: updated.id, fields: Object.keys(v.data) });
  return res.json({ success: true, data: updated });
});

const deleteScheduledReport = run(async (req, res) => {
  const deleted = await svc.remove(req.params.id);
  await auditLog(req.admin?.id, "SCHEDULED_REPORT_DELETED", { id: deleted.id, name: deleted.name });
  return res.json({ success: true, data: { id: deleted.id } });
});

const pauseScheduledReport = run(async (req, res) => {
  const updated = await svc.setStatus(req.params.id, "PAUSED");
  await auditLog(req.admin?.id, "SCHEDULED_REPORT_PAUSED", { id: updated.id, name: updated.name });
  return res.json({ success: true, data: updated });
});

const resumeScheduledReport = run(async (req, res) => {
  const updated = await svc.setStatus(req.params.id, "ACTIVE");
  await auditLog(req.admin?.id, "SCHEDULED_REPORT_RESUMED", { id: updated.id, name: updated.name });
  return res.json({ success: true, data: updated });
});

module.exports = {
  listScheduledReports,
  createScheduledReport,
  updateScheduledReport,
  deleteScheduledReport,
  pauseScheduledReport,
  resumeScheduledReport,
};
