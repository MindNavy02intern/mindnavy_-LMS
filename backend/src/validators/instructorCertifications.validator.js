// Validation for the Instructor Certifications API
// (/api/admin/instructors/:id/certifications).
//
// NOTE: INSTRUCTORS_CONTRACT.md v1 "Known gaps" flags this as a SEPARATE entity
// deliberately not shipped with Documents ("folding them in would make both
// half-features"). This module ships it at the user's explicit direction — see
// instructors.prisma InstructorCertification for the full note.
//
// Same shape as the other validators here: { isValid, errors, data }, every
// field parsed/trimmed/bounded/allow-listed so the service only ever receives
// safe values. File handling mirrors instructorDocuments.validator (private
// bucket, sign -> client PUT -> confirm; no bytes through this API).

const CERTIFICATION_TYPES = new Set(["TEACHING", "PROFESSIONAL", "ACADEMIC", "TECHNICAL", "TRAINING"]);

// Certificates/licences: PDFs and image scans. No SVG (can carry script), no
// office formats — same allow-list reasoning as instructorDocuments.validator.
const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

const MAX = { name: 200, issuer: 200, fileName: 300, path: 500, limit: 100 };

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function readType(value, errors) {
  if (!isNonEmptyString(value)) { errors.push("type is required."); return null; }
  const t = value.trim().toUpperCase();
  if (!CERTIFICATION_TYPES.has(t)) {
    errors.push(`type must be one of: ${[...CERTIFICATION_TYPES].join(", ")}.`);
    return null;
  }
  return t;
}

// ── Sign: ask for an upload URL (file is optional — a cert row may exist
// with no attachment yet, same as a document row cannot). ──────────────────────

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

  return { isValid: errors.length === 0, errors, data: { fileName, fileType } };
}

// ── Create: name + type + issuer, optionally attaching an already-signed file ──

function validateCreate(body = {}) {
  const errors = [];

  const name = isNonEmptyString(body.name) ? body.name.trim() : "";
  if (!name) errors.push("name is required.");
  else if (name.length > MAX.name) errors.push(`name must be at most ${MAX.name} characters.`);

  const issuer = isNonEmptyString(body.issuer) ? body.issuer.trim() : "";
  if (!issuer) errors.push("issuer is required.");
  else if (issuer.length > MAX.issuer) errors.push(`issuer must be at most ${MAX.issuer} characters.`);

  const type = readType(body.type, errors);

  // Attaching a file is optional at create time, but path/fileName travel
  // together — sending one without the other is a mistake worth rejecting
  // rather than silently dropping the file.
  let path = null;
  if (body.path !== undefined && body.path !== null && String(body.path).trim() !== "") {
    path = String(body.path).trim();
    if (path.length > MAX.path) errors.push(`path must be at most ${MAX.path} characters.`);
    if (!isNonEmptyString(body.fileName)) errors.push("fileName is required when path is provided.");
  }

  return { isValid: errors.length === 0, errors, data: { name, issuer, type, path } };
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
    if (!["PENDING", "VERIFIED", "REJECTED"].includes(s)) errors.push("status must be one of: PENDING, VERIFIED, REJECTED.");
    else data.status = s;
  }

  return { isValid: errors.length === 0, errors, data };
}

module.exports = {
  CERTIFICATION_TYPES,
  ALLOWED_MIME,
  validateSign,
  validateCreate,
  validateListQuery,
};
