// CSV / formula injection guard (OWASP) — mirrors backend/src/utils/csv.js.
//
// Spreadsheet apps run a cell that starts with = + - @ (or tab / carriage
// return) as a formula, so a user-controlled value like
// `=HYPERLINK("https://evil.example","Click")` in a name, subject or log line
// executes in whoever opens the exported file. Prefixing a single quote makes
// it plain text. Plain numbers (-1999, +9613123456, 12.5) are left untouched.
// Apply to every cell value before the usual quote-escaping.
const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[+-]?\d+(\.\d+)?$/;

export function neutralizeFormula(value: string): string {
  return FORMULA_START.test(value) && !PLAIN_NUMBER.test(value) ? `'${value}` : value;
}
