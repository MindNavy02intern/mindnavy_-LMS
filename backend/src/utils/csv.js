// Shared CSV builder — extracted from reports.controller.js (was private to
// GET /reports/export) so the Scheduled Reports background job can build the
// exact same CSV shape without forking the escaping logic.

function csvEscape(val) {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(columns, rows) {
  const header = columns.map((c) => csvEscape(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => csvEscape(r[c.key])).join(",")).join("\r\n");
  return [header, body].filter(Boolean).join("\r\n");
}

module.exports = { csvEscape, toCsv };
