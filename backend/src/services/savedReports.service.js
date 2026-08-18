const prisma = require("../config/prisma");
const { getExportData } = require("./reports.service");
const { resolveDateRange } = require("../validators/reports.validator");

// ── Custom Reports builder (savedReports.service.js) ─────────────────────────
//
// reportTemplate.save was a dead mutation ID (CustomReportsTab.tsx's own
// header comment: "no saved-report-definition model, no query-builder
// endpoint"). This is that model's service — deliberately its own file
// (reports.service.js is already 800+ lines), reusing that file's
// getExportData(type, dateRange) as the actual query ENGINE rather than
// forking 7 more parallel per-data-source queries (R4, one datum one owner).
// A consequence: the real, returned column set per data source is whatever
// getExportData already returns for that type — not a fresh column spec —
// so COLUMNS_BY_SOURCE below is a mirror of that function's actual `columns`
// arrays (kept in one place for validating `selectedColumns` without a live
// query), not an independent design.

function domainError(code, message) {
  return Object.assign(new Error(message || code), { code });
}

async function auditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: adminId ?? null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

// Mirrors reports.service.js's getExportData column keys exactly, per
// dataSource (lowercase, matching reports.validator's EXPORT_TYPES).
const COLUMNS_BY_SOURCE = {
  learners:     ["id", "fullName", "email", "department", "status", "riskScore", "createdAt"],
  instructors:  ["id", "fullName", "email", "status", "createdAt"],
  courses:      ["id", "title", "category", "status", "enrollments", "createdAt"],
  certificates: ["id", "courseTitle", "userName", "issuedAt", "revoked", "verificationCode"],
  assessments:  ["id", "userName", "quizTitle", "score", "status", "submittedAt"],
  attendance:   ["id", "sessionTitle", "userName", "status", "joinedAt", "leftAt"],
  audit:        ["id", "action", "adminName", "targetUserId", "createdAt"],
};

function mapReport(r) {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    dataSource: r.dataSource,
    selectedColumns: r.selectedColumns ?? [],
    filters: r.filters ?? null,
    visualization: r.visualization,
    schedule: r.schedule ?? null,
    lastRunAt: iso(r.lastRunAt),
    createdById: r.createdById,
    isPublic: r.isPublic,
    createdAt: iso(r.createdAt),
    updatedAt: iso(r.updatedAt),
  };
}

async function getReportOrThrow(id) {
  const row = await prisma.savedReport.findUnique({ where: { id } });
  if (!row) throw domainError("REPORT_NOT_FOUND");
  return row;
}

// selectedColumns' SHAPE is checked in the validator; whether each name is
// actually a real column for this dataSource can only be checked here,
// against the same map executeReport() uses to project rows.
function assertColumnsValid(dataSource, selectedColumns) {
  if (!selectedColumns || selectedColumns.length === 0) return;
  const valid = COLUMNS_BY_SOURCE[dataSource.toLowerCase()] ?? [];
  const unknown = selectedColumns.filter((c) => !valid.includes(c));
  if (unknown.length > 0) {
    throw Object.assign(domainError("UNKNOWN_COLUMNS", `Unknown column(s) for ${dataSource}: ${unknown.join(", ")}.`), { unknown });
  }
}

async function listSavedReports() {
  const rows = await prisma.savedReport.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(mapReport);
}

async function getSavedReport(id) {
  const row = await getReportOrThrow(id);
  return mapReport(row);
}

async function createSavedReport(data, adminId) {
  assertColumnsValid(data.dataSource, data.selectedColumns);
  const row = await prisma.savedReport.create({
    data: { ...data, createdById: adminId ?? null },
  });
  await auditLog(adminId, "SAVED_REPORT_CREATED", { reportId: row.id, name: row.name, dataSource: row.dataSource });
  return mapReport(row);
}

async function updateSavedReport(id, data, adminId) {
  const current = await getReportOrThrow(id);
  assertColumnsValid(data.dataSource ?? current.dataSource, data.selectedColumns);
  const row = await prisma.savedReport.update({ where: { id }, data });
  await auditLog(adminId, "SAVED_REPORT_UPDATED", { reportId: id, fields: Object.keys(data) });
  return mapReport(row);
}

async function deleteSavedReport(id, adminId) {
  await getReportOrThrow(id);
  await prisma.savedReport.delete({ where: { id } });
  await auditLog(adminId, "SAVED_REPORT_DELETED", { reportId: id });
  return { id };
}

// Filters were already validated at create/update time (validateSavedReportFilters
// below) — resolveDateRange is called again here purely to turn the stored
// {dateRange, dateFrom, dateTo} back into {gte, lte}, errors discarded (a
// bad stored value just falls back to "month", same default resolveDateRange
// always uses for a missing/invalid dateRange).
function dateRangeFromFilters(filters) {
  return resolveDateRange(filters || {}, []);
}

async function executeReport(report) {
  const type = report.dataSource.toLowerCase();
  const dateRange = dateRangeFromFilters(report.filters);
  const { columns, rows } = await getExportData(type, dateRange);

  const selected = report.selectedColumns.length > 0 ? new Set(report.selectedColumns) : null;
  const outColumns = selected ? columns.filter((c) => selected.has(c.key)) : columns;
  const outRows = rows.map((r) => Object.fromEntries(outColumns.map((c) => [c.key, r[c.key]])));

  return { columns: outColumns, rows: outRows };
}

async function runSavedReport(id, adminId) {
  const report = await getReportOrThrow(id);
  const { columns, rows } = await executeReport(report);

  await prisma.savedReport.update({ where: { id }, data: { lastRunAt: new Date() } });
  await auditLog(adminId, "SAVED_REPORT_RUN", { reportId: id, dataSource: report.dataSource, rowCount: rows.length });

  return { columns, rows, generatedAt: new Date().toISOString() };
}

async function exportSavedReportCsv(id) {
  const report = await getReportOrThrow(id);
  const { columns, rows } = await executeReport(report);
  return { columns, rows, dataSource: report.dataSource.toLowerCase() };
}

module.exports = {
  COLUMNS_BY_SOURCE,
  listSavedReports,
  getSavedReport,
  createSavedReport,
  updateSavedReport,
  deleteSavedReport,
  runSavedReport,
  exportSavedReportCsv,
};
