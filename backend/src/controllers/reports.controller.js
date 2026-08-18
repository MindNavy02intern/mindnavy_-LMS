const svc = require("../services/reports.service");
const savedReportsSvc = require("../services/savedReports.service");
const {
  validateOverviewQuery,
  validateLearnerAnalyticsQuery,
  validateInstructorAnalyticsQuery,
  validateCourseAnalyticsQuery,
  validateAssessmentQuery,
  validateCertificateQuery,
  validateAttendanceQuery,
  validateAuditQuery,
  validateEngagementQuery,
  validateExportQuery,
  validateComplianceQuery,
  validateSavedReportCreate,
  validateSavedReportUpdate,
} = require("../validators/reports.validator");

// Best-effort audit — never breaks the export itself (mirrors every other
// service's auditLog() in this codebase).
const prisma = require("../config/prisma");
async function auditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: adminId ?? null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

// Shared with the Scheduled Reports background job — see utils/csv.js.
const { toCsv } = require("../utils/csv");

// ── Helpers (same pattern as competencies.controller / instructors.controller) ──

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "REPORT_NOT_FOUND": return notFound(res, "Saved report not found.");
    case "UNKNOWN_COLUMNS":  return badRequest(res, err.message);
    default: return null;
  }
}

function serverError(res, err) {
  console.error("[ReportsController]", err);
  if (err.statusCode) return res.status(err.statusCode).json({ success: false, message: err.message });
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
      return handleDomainError(res, err) ?? serverError(res, err);
    }
  };
}

// ── Handlers — Part 1 ────────────────────────────────────────────────────

const getOverview = run(async (req, res) => {
  const v = validateOverviewQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const data = await svc.getOverview(v.data);
  return res.json({ success: true, data });
});

const getLearnerAnalytics = run(async (req, res) => {
  const v = validateLearnerAnalyticsQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const data = await svc.getLearnerAnalytics(v.data);
  return res.json({ success: true, data });
});

const getInstructorAnalytics = run(async (req, res) => {
  const v = validateInstructorAnalyticsQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const data = await svc.getInstructorAnalytics(v.data);
  return res.json({ success: true, data });
});

const getCourseAnalytics = run(async (req, res) => {
  const v = validateCourseAnalyticsQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const data = await svc.getCourseAnalytics(v.data);
  return res.json({ success: true, data });
});

const getAssessmentReports = run(async (req, res) => {
  const v = validateAssessmentQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const data = await svc.getAssessmentReports(v.data);
  return res.json({ success: true, data });
});

const getCertificateReports = run(async (req, res) => {
  const v = validateCertificateQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const data = await svc.getCertificateReports(v.data);
  return res.json({ success: true, data });
});

const getAttendanceReports = run(async (req, res) => {
  const v = validateAttendanceQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const data = await svc.getAttendanceReports(v.data);
  return res.json({ success: true, data });
});

const getAuditReports = run(async (req, res) => {
  const v = validateAuditQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const data = await svc.getAuditReports(v.data);
  return res.json({ success: true, data });
});

const getEngagementAnalytics = run(async (req, res) => {
  const v = validateEngagementQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const data = await svc.getEngagementAnalytics(v.data);
  return res.json({ success: true, data });
});

// ── Handlers — Part 2 ────────────────────────────────────────────────────

const exportReport = run(async (req, res) => {
  const v = validateExportQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const { type, format, dateRange } = v.data;

  const { columns, rows } = await svc.getExportData(type, dateRange);
  await auditLog(req.admin?.id, "REPORT_EXPORTED", { type, format, count: rows.length });

  const date = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    res.setHeader("Content-Disposition", `attachment; filename="reports-${type}-${date}.json"`);
    return res.status(200).json({ type, generatedAt: new Date().toISOString(), columns, rows });
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="reports-${type}-${date}.csv"`);
  return res.status(200).send(toCsv(columns, rows));
});

const getComplianceReports = run(async (req, res) => {
  const v = validateComplianceQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const data = await svc.getComplianceReports(v.data);
  return res.json({ success: true, data });
});

// ── Saved Reports (Custom Reports builder) ──────────────────────────────────

const listSavedReports = run(async (req, res) => {
  const reports = await savedReportsSvc.listSavedReports();
  return res.json({ success: true, data: reports });
});

const getSavedReport = run(async (req, res) => {
  if (!req.params.id) return badRequest(res, "id is required.");
  const report = await savedReportsSvc.getSavedReport(req.params.id);
  return res.json({ success: true, data: report });
});

const createSavedReport = run(async (req, res) => {
  const v = validateSavedReportCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const report = await savedReportsSvc.createSavedReport(v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Report saved.", data: report });
});

const updateSavedReport = run(async (req, res) => {
  if (!req.params.id) return badRequest(res, "id is required.");
  const v = validateSavedReportUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const report = await savedReportsSvc.updateSavedReport(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Report updated.", data: report });
});

const deleteSavedReport = run(async (req, res) => {
  if (!req.params.id) return badRequest(res, "id is required.");
  const result = await savedReportsSvc.deleteSavedReport(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Report deleted.", data: result });
});

const runSavedReport = run(async (req, res) => {
  if (!req.params.id) return badRequest(res, "id is required.");
  const result = await savedReportsSvc.runSavedReport(req.params.id, req.admin?.id);
  return res.json({ success: true, data: result });
});

const exportSavedReport = run(async (req, res) => {
  if (!req.params.id) return badRequest(res, "id is required.");
  const { columns, rows, dataSource } = await savedReportsSvc.exportSavedReportCsv(req.params.id);
  await auditLog(req.admin?.id, "SAVED_REPORT_RUN", { reportId: req.params.id, exported: true });

  const date = new Date().toISOString().slice(0, 10);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="saved-report-${dataSource}-${date}.csv"`);
  return res.status(200).send(toCsv(columns, rows));
});

module.exports = {
  getOverview,
  getLearnerAnalytics,
  getInstructorAnalytics,
  getCourseAnalytics,
  getAssessmentReports,
  getCertificateReports,
  getAttendanceReports,
  getAuditReports,
  getEngagementAnalytics,
  exportReport,
  getComplianceReports,
  listSavedReports,
  getSavedReport,
  createSavedReport,
  updateSavedReport,
  deleteSavedReport,
  runSavedReport,
  exportSavedReport,
};
