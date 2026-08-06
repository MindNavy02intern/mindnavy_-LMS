// Validation for the Instructor Documents API
// (/api/admin/instructors/:id/documents).
//
// Same contract as the other validators here: every function returns
// { isValid, errors, data } with each field parsed, trimmed, bounded and
// allow-listed, so the service only ever receives safe values.
//
// SCOPE: administrative documents only. There is no CERTIFICATION type —
// teaching certificates are a separate entity with their own verification queue
// (blueprint 05 §11 vs §12).
//
// SECURITY:
//   • `status`, `verifiedAt`, `verifiedById`, `fileSize` and `mimeType` are
//     server-owned. They are never read from a request body: size and mime come
//     from the stored object itself on confirm, status only from the transition
//     endpoints.
//   • `filePath` is never accepted raw either — the client echoes back the exact
//     `path` the sign step issued, and the service re-derives and re-checks it.

const DOCUMENT_TYPES = new Set(["IDENTITY", "CONTRACT", "AGREEMENT", "TAX", "COMPLIANCE"]);

const DOCUMENT_STATUSES = new Set(["PENDING", "VERIFIED", "REJECTED", "ARCHIVED"]);

// Documents are paperwork: PDFs and scans. No office formats (macro-bearing), no
// archives, no SVG (scripts execute when rendered inline).
const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

const MAX = { fileName: 300, path: 500, reason: 1000, limit: 100 };

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function readType(value, errors, { required = true } = {}) {
  if (!isNonEmptyString(value)) {
    if (required) errors.push("type is required.");
    return null;
  }
  const t = value.trim().toUpperCase();
  if (!DOCUMENT_TYPES.has(t)) {
    errors.push(`type must be one of: ${[...DOCUMENT_TYPES].join(", ")}.`);
    return null;
  }
  return t;
}

// Expiry is optional and always in the future — a document that is already
// expired on upload is a data-entry mistake, not a record worth filing.
function readExpiresAt(value, errors) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") { errors.push("expiresAt must be an ISO date string."); return null; }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) { errors.push("expiresAt must be a valid ISO date."); return null; }
  if (d.getTime() <= Date.now()) { errors.push("expiresAt must be in the future."); return null; }
  return d;
}

// ── Sign: ask for an upload URL ─────────────────────────────────────────────────

function validateSign(body = {}) {
  const errors = [];

  const fileName = isNonEmptyString(body.fileName) ? body.fileName.trim() : "";
  if (!fileName) errors.push("fileName is required.");
  else if (fileName.length > MAX.fileName) errors.push(`fileName must be at most ${MAX.fileName} characters.`);

  const fileType = isNonEmptyString(body.fileType) ? body.fileType.trim().toLowerCase() : "";
  if (!fileType) errors.push("fileType is required.");
  else if (!ALLOWED_MIME.includes(fileType)) {
    errors.push(`fileType "${fileType}" is not allowed. Allowed: ${ALLOWED_MIME.join(", ")}.`);
  }

  const type = readType(body.type, errors);

  return { isValid: errors.length === 0, errors, data: { fileName, fileType, type } };
}

// ── Confirm: the upload finished, create the row ────────────────────────────────

function validateConfirm(body = {}) {
  const errors = [];

  const path = isNonEmptyString(body.path) ? body.path.trim() : "";
  if (!path) errors.push("path is required.");
  else if (path.length > MAX.path) errors.push(`path must be at most ${MAX.path} characters.`);

  const fileName = isNonEmptyString(body.fileName) ? body.fileName.trim() : "";
  if (!fileName) errors.push("fileName is required.");
  else if (fileName.length > MAX.fileName) errors.push(`fileName must be at most ${MAX.fileName} characters.`);

  const type = readType(body.type, errors);
  const expiresAt = readExpiresAt(body.expiresAt, errors);

  // fileSize / mimeType are NOT read from the body on purpose — the service
  // takes both from the object that actually landed in storage.
  return { isValid: errors.length === 0, errors, data: { path, fileName, type, expiresAt } };
}

// ── Reject ──────────────────────────────────────────────────────────────────────

function validateReject(body = {}) {
  const errors = [];
  const reason = isNonEmptyString(body.reason) ? body.reason.trim() : "";
  if (!reason) errors.push("reason is required.");
  else if (reason.length < 3) errors.push("reason must be at least 3 characters.");
  else if (reason.length > MAX.reason) errors.push(`reason must be at most ${MAX.reason} characters.`);
  return { isValid: errors.length === 0, errors, data: { reason } };
}

// ── List query ──────────────────────────────────────────────────────────────────

function validateListQuery(query = {}) {
  const errors = [];
  const data = {};

  if (query.type !== undefined && String(query.type).trim() !== "") {
    const t = readType(query.type, errors);
    if (t) data.type = t;
  }

  if (query.status !== undefined && String(query.status).trim() !== "") {
    const s = String(query.status).trim().toUpperCase();
    if (!DOCUMENT_STATUSES.has(s)) errors.push(`status must be one of: ${[...DOCUMENT_STATUSES].join(", ")}.`);
    else data.status = s;
  }

  // Archived documents are hidden by default — they are the soft-deleted ones.
  // ?includeArchived=true brings them back for a compliance review.
  data.includeArchived = String(query.includeArchived).toLowerCase() === "true";

  return { isValid: errors.length === 0, errors, data };
}

module.exports = {
  DOCUMENT_TYPES,
  DOCUMENT_STATUSES,
  ALLOWED_MIME,
  validateSign,
  validateConfirm,
  validateReject,
  validateListQuery,
};
