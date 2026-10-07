// Shared CSV builder — extracted from reports.controller.js (was private to
// GET /reports/export) so the Scheduled Reports background job can build the
// exact same CSV shape without forking the escaping logic.

// CSV / formula injection guard (OWASP). Spreadsheet apps execute a cell that
// starts with = + - @ (or tab / carriage return) as a formula — so a user who
// names themselves `=HYPERLINK("https://evil.example","Click")` (or submits it
// through the public instructor-application form) gets code running in the
// admin's Excel when the admin opens an export. Prefixing a single quote makes
// the cell plain text. Plain numbers (-1999, +9613123456, 12.5) are left
// untouched so amounts and phone numbers stay numbers.
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/;

function neutralizeFormula(s) {
  return FORMULA_START.test(s) && !PLAIN_NUMBER.test(s) ? `'${s}` : s;
}

function csvEscape(val) {
  if (val === null || val === undefined) return "";
  const s = neutralizeFormula(String(val));
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(columns, rows) {
  const header = columns.map((c) => csvEscape(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => csvEscape(r[c.key])).join(",")).join("\r\n");
  return [header, body].filter(Boolean).join("\r\n");
}

module.exports = { csvEscape, toCsv, neutralizeFormula };
