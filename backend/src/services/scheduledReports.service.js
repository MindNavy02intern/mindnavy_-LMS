const prisma = require("../config/prisma");
const reportsService = require("./reports.service");
const { toCsv } = require("../utils/csv");
const { sendMail } = require("../utils/mailer");
const { resolveDateRange } = require("../validators/reports.validator");

// ── nextRunAt arithmetic ─────────────────────────────────────────────────
// DAILY/WEEKLY are fixed-length offsets; MONTHLY walks the UTC calendar
// month forward (mirrors reports.validator's own "month" = same day, one
// month back" convention, just forward instead of back). Same month-end
// overflow characteristics as that existing convention — e.g. scheduled from
// Jan 31, Date.UTC's Feb-31 overflows to Mar 3 — not fixed here since the
// codebase already tolerates this elsewhere; every run after the first
// stays consistent on whatever day it lands on.

function computeNextRun(frequency, from = new Date()) {
  if (frequency === "DAILY") return new Date(from.getTime() + 24 * 60 * 60 * 1000);
  if (frequency === "WEEKLY") return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
  return new Date(Date.UTC(
    from.getUTCFullYear(), from.getUTCMonth() + 1, from.getUTCDate(),
    from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds(),
  ));
}

function notFound() {
  const err = new Error("Scheduled report not found.");
  err.code = "NOT_FOUND";
  return err;
}

// ── CRUD ──────────────────────────────────────────────────────────────────

async function list({ page, limit, status }) {
  const where = status ? { status } : {};
  const skip = (page - 1) * limit;
  const [total, rows] = await Promise.all([
    prisma.scheduledReport.count({ where }),
    prisma.scheduledReport.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
  ]);
  return { rows, pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) } };
}

function create(data, createdById) {
  return prisma.scheduledReport.create({
    data: { ...data, createdById: createdById ?? null, nextRunAt: computeNextRun(data.frequency) },
  });
}

async function update(id, data) {
  const existing = await prisma.scheduledReport.findUnique({ where: { id } });
  if (!existing) throw notFound();

  const patch = { ...data };
  // Changing frequency mid-cycle recomputes nextRunAt from now — the old
  // cadence's countdown has no meaning once the interval itself changes.
  if (data.frequency && data.frequency !== existing.frequency) {
    patch.nextRunAt = computeNextRun(data.frequency);
  }
  return prisma.scheduledReport.update({ where: { id }, data: patch });
}

async function remove(id) {
  try {
    return await prisma.scheduledReport.delete({ where: { id } });
  } catch (err) {
    if (err.code === "P2025") throw notFound();
    throw err;
  }
}

async function setStatus(id, status) {
  const existing = await prisma.scheduledReport.findUnique({ where: { id } });
  if (!existing) throw notFound();

  const patch = { status };
  // Resuming recomputes nextRunAt from now — a report paused for three weeks
  // must not fire 21 backlogged runs the instant it's resumed.
  if (status === "ACTIVE") patch.nextRunAt = computeNextRun(existing.frequency);
  return prisma.scheduledReport.update({ where: { id }, data: patch });
}

// ── Background sweep ──────────────────────────────────────────────────────
// Unattended job — never throws on a bad/missing filters.dateRange, falls
// back to the same "month" default every /reports/* endpoint uses.
function safeDateRange(filters) {
  const errors = [];
  const resolved = resolveDateRange(filters || {}, errors);
  if (errors.length > 0 || !resolved) return resolveDateRange({}, []);
  return resolved;
}

async function buildReportFile(scheduledReport) {
  const dateRange = safeDateRange(scheduledReport.filters);
  const { columns, rows } = await reportsService.getExportData(scheduledReport.reportType, dateRange);
  const date = new Date().toISOString().slice(0, 10);

  if (scheduledReport.format === "JSON") {
    const content = JSON.stringify(
      { type: scheduledReport.reportType, generatedAt: new Date().toISOString(), columns, rows },
      null, 2,
    );
    return { filename: `reports-${scheduledReport.reportType}-${date}.json`, content, rowCount: rows.length };
  }

  return { filename: `reports-${scheduledReport.reportType}-${date}.csv`, content: toCsv(columns, rows), rowCount: rows.length };
}

// Best-effort audit — mirrors every other service's auditLog(), never
// blocks the run. adminId is null (system-authored row — the acting party
// is the hourly sweep, not a logged-in admin).
async function auditRun(details) {
  try {
    await prisma.auditLog.create({ data: { adminId: null, action: "SCHEDULED_REPORT_RUN", details } });
  } catch (err) {
    console.error("Audit log error (SCHEDULED_REPORT_RUN):", err.message);
  }
}

async function runOne(scheduledReport) {
  const file = await buildReportFile(scheduledReport);
  const mailResult = await sendMail({
    to: scheduledReport.recipients.join(","),
    subject: `Scheduled Report: ${scheduledReport.name}`,
    text: `Your scheduled "${scheduledReport.name}" report (${scheduledReport.reportType}) is attached — ${file.rowCount} row(s).`,
    attachments: [{ filename: file.filename, content: file.content }],
  });

  const now = new Date();
  await prisma.scheduledReport.update({
    where: { id: scheduledReport.id },
    data: { lastRunAt: now, nextRunAt: computeNextRun(scheduledReport.frequency, now) },
  });

  await auditRun({
    id: scheduledReport.id, name: scheduledReport.name, reportType: scheduledReport.reportType,
    recipients: scheduledReport.recipients.length, rowCount: file.rowCount, mailSent: mailResult.sent,
  });
}

// Hourly sweep (wired via setInterval in server.js, same convention as the
// role-assignment-expiry sweep — no node-cron in this codebase). Each report
// is isolated in its own try/catch: one bad send must never block the rest
// of the batch or crash the interval. A failed run leaves nextRunAt
// untouched, so it's retried on the next tick instead of silently skipped
// for a full cycle.
async function runDueReports() {
  const due = await prisma.scheduledReport.findMany({
    where: { status: "ACTIVE", nextRunAt: { lte: new Date() } },
  });
  for (const report of due) {
    try {
      await runOne(report);
    } catch (err) {
      console.error(`[scheduledReports] run failed for ${report.id} (${report.name}):`, err.message);
    }
  }
}

module.exports = { list, create, update, remove, setStatus, computeNextRun, runDueReports };
