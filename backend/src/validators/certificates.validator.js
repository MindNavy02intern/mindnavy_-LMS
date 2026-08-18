// Validation for the Certificates API (templates + issued certificates + verify).
// Mirrors quizzes.validator: each function returns { isValid, errors, data }.
// Everything is parsed, length-capped and allow-listed here — the template
// `layout` Json is REBUILT field-by-field with defaults filled in, so only the
// six known keys ever reach the Json column (never arbitrary HTML/objects).
//
// v1 layout has NO logoUrl on purpose: embedding a remote image means the
// server fetching an arbitrary URL at PDF time (SSRF). Logos arrive in v2 via
// the existing uploads sign→confirm flow.

const MAX = {
  name:      120,
  title:     120,
  body:      600,
  signature: 100,
  limit:     500,     // list page size cap
  offset:    1000000,
};

// Logo upload (sign -> PUT -> confirm) — same allow-list style as
// uploads.validator.js's thumbnail kind (this reuses that bucket).
const LOGO_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const LOGO_MAX_BYTES    = 2 * 1024 * 1024;

const HEX_COLOR   = /^#[0-9a-fA-F]{6}$/;
// crypto.randomBytes(16).toString("hex") — anything else never hits the DB.
const CODE_FORMAT = /^[a-f0-9]{32}$/;

const LIST_STATUSES = ["active", "revoked", "expired", "expiring_soon"];

// Placeholders the PDF renderer substitutes; documented in the contract.
const DEFAULT_LAYOUT = {
  title:          "Certificate of Completion",
  body:           "This certifies that {{studentName}} has successfully completed {{courseTitle}} on {{date}}.",
  primaryColor:   "#1E3A8A",
  accentColor:    "#B8860B",
  signatureName:  null,
  signatureTitle: null,
};

function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0) return `${label} is required.`;
  return null;
}

function isValidCodeFormat(code) {
  return typeof code === "string" && CODE_FORMAT.test(code);
}

// ── Shared field readers ────────────────────────────────────────────────────────

function readBoundedString(value, key, max, errors, { required = false, nullable = false } = {}) {
  if (value === undefined) {
    if (required) errors.push(`${key} is required.`);
    return undefined;
  }
  if (value === null) {
    if (nullable) return null;
    errors.push(`${key} cannot be null.`);
    return undefined;
  }
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) { errors.push(required ? `${key} is required.` : `${key} cannot be empty.`); return undefined; }
  if (s.length > max) { errors.push(`${key} must be at most ${max} characters.`); return undefined; }
  return s;
}

function readColor(value, key, errors) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !HEX_COLOR.test(value.trim())) {
    errors.push(`${key} must be a hex color like #1E3A8A.`);
    return undefined;
  }
  return value.trim().toUpperCase();
}

function readInt(value, key, min, max, errors) {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    errors.push(`${key} must be an integer between ${min} and ${max}.`);
    return undefined;
  }
  return n;
}

// ── Template layout (rebuilt with defaults — always a complete object) ───────────

function readLayout(raw, errors) {
  if (raw === undefined) raw = {};
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    errors.push("layout must be an object.");
    return undefined;
  }

  const title = readBoundedString(raw.title, "layout.title", MAX.title, errors);
  const body  = readBoundedString(raw.body, "layout.body", MAX.body, errors);
  const primaryColor = readColor(raw.primaryColor, "layout.primaryColor", errors);
  const accentColor  = readColor(raw.accentColor, "layout.accentColor", errors);
  const signatureName  = readBoundedString(raw.signatureName, "layout.signatureName", MAX.signature, errors, { nullable: true });
  const signatureTitle = readBoundedString(raw.signatureTitle, "layout.signatureTitle", MAX.signature, errors, { nullable: true });

  if (errors.length > 0) return undefined;

  return {
    title:          title          ?? DEFAULT_LAYOUT.title,
    body:           body           ?? DEFAULT_LAYOUT.body,
    primaryColor:   primaryColor   ?? DEFAULT_LAYOUT.primaryColor,
    accentColor:    accentColor    ?? DEFAULT_LAYOUT.accentColor,
    signatureName:  signatureName  !== undefined ? signatureName  : DEFAULT_LAYOUT.signatureName,
    signatureTitle: signatureTitle !== undefined ? signatureTitle : DEFAULT_LAYOUT.signatureTitle,
  };
}

// ── Templates ────────────────────────────────────────────────────────────────────

function validateTemplateCreate(body = {}) {
  const errors = [];

  const name   = readBoundedString(body.name, "name", MAX.name, errors, { required: true });
  const layout = readLayout(body.layout, errors);

  return { isValid: errors.length === 0, errors, data: { name, layout } };
}

// PATCH semantics: `layout`, when present, REPLACES the whole layout object
// (missing keys fall back to defaults) — no deep merge, documented in contract.
function validateTemplateUpdate(body = {}) {
  const errors = [];
  const data = {};

  const name = readBoundedString(body.name, "name", MAX.name, errors);
  if (name !== undefined) data.name = name;

  if (body.layout !== undefined) {
    const layout = readLayout(body.layout, errors);
    if (layout !== undefined) data.layout = layout;
  }

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data };
}

// ── Issue / reissue ──────────────────────────────────────────────────────────────

function validateIssue(body = {}) {
  const errors = [];

  const userIdErr = validateId(body.userId, "userId");
  if (userIdErr) errors.push(userIdErr);
  const courseIdErr = validateId(body.courseId, "courseId");
  if (courseIdErr) errors.push(courseIdErr);

  let templateId;
  if (body.templateId !== undefined && body.templateId !== null) {
    const tErr = validateId(body.templateId, "templateId");
    if (tErr) errors.push(tErr);
    else templateId = body.templateId.trim();
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      userId:   typeof body.userId === "string" ? body.userId.trim() : body.userId,
      courseId: typeof body.courseId === "string" ? body.courseId.trim() : body.courseId,
      ...(templateId !== undefined ? { templateId } : {}),
    },
  };
}

// Reissue takes an optional templateId: string sets it, null clears it (back to
// the default layout), absent keeps the current one. An empty body is valid.
function validateReissue(body = {}) {
  const errors = [];
  const data = {};

  if (body.templateId !== undefined) {
    if (body.templateId === null) data.templateId = null;
    else {
      const tErr = validateId(body.templateId, "templateId");
      if (tErr) errors.push(tErr);
      else data.templateId = body.templateId.trim();
    }
  }

  return { isValid: errors.length === 0, errors, data };
}

// Optional — see the CERTIFICATES_CONTRACT.md addendum (Learners module Part
// 5). No body at all is still valid; an empty/whitespace-only reason is
// treated as "not provided" rather than a validation error.
function validateRevoke(body = {}) {
  const errors = [];
  let reason;
  if (body.reason !== undefined && body.reason !== null) {
    if (typeof body.reason !== "string") errors.push("reason must be a string.");
    else if (body.reason.trim().length > 1000) errors.push("reason must be at most 1000 characters.");
    else reason = body.reason.trim() || undefined;
  }
  return { isValid: errors.length === 0, errors, data: { reason } };
}

function validateExpiry(body = {}) {
  const errors = [];
  let expiresAt;
  if (body.expiresAt === null) {
    expiresAt = null; // explicit clear
  } else if (body.expiresAt !== undefined) {
    const d = new Date(body.expiresAt);
    if (Number.isNaN(d.getTime())) errors.push("expiresAt must be a valid date.");
    else expiresAt = d;
  } else {
    errors.push("expiresAt is required (use null to clear it).");
  }
  return { isValid: errors.length === 0, errors, data: { expiresAt } };
}

// ── List filters (query string) ────────────────────────────────────────────────────

function validateListQuery(query = {}) {
  const errors = [];

  const read = (key) =>
    typeof query[key] === "string" && query[key].trim() ? query[key].trim() : undefined;

  const courseId = read("courseId");
  const userId   = read("userId");

  let status = read("status");
  if (status !== undefined) {
    status = status.toLowerCase();
    if (!LIST_STATUSES.includes(status)) {
      errors.push(`status must be one of: ${LIST_STATUSES.join(", ")}.`);
      status = undefined;
    }
  }

  const limit  = readInt(query.limit, "limit", 1, MAX.limit, errors);
  const offset = readInt(query.offset, "offset", 0, MAX.offset, errors);

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      courseId,
      userId,
      status,
      limit:  limit  ?? 100,
      offset: offset ?? 0,
    },
  };
}

// ── Logo upload ──────────────────────────────────────────────────────────────

function validateLogoSign(body = {}) {
  const errors = [];

  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  if (!fileName) errors.push("fileName is required.");
  else if (fileName.length > 300) errors.push("fileName must be at most 300 characters.");

  const fileType = typeof body.fileType === "string" ? body.fileType.trim().toLowerCase() : "";
  if (!fileType) errors.push("fileType is required.");
  else if (!LOGO_ALLOWED_MIME.includes(fileType)) {
    errors.push(`fileType "${fileType}" is not allowed. Allowed: ${LOGO_ALLOWED_MIME.join(", ")}.`);
  }

  return { isValid: errors.length === 0, errors, data: { fileName, fileType } };
}

function validateLogoConfirm(body = {}) {
  const errors = [];
  const path = typeof body.path === "string" ? body.path.trim() : "";
  if (!path) errors.push("path is required.");
  else if (path.length > 500) errors.push("path must be at most 500 characters.");
  return { isValid: errors.length === 0, errors, data: { path } };
}

module.exports = {
  validateId,
  isValidCodeFormat,
  validateTemplateCreate,
  validateTemplateUpdate,
  validateIssue,
  validateReissue,
  validateRevoke,
  validateExpiry,
  validateListQuery,
  validateLogoSign,
  validateLogoConfirm,
  DEFAULT_LAYOUT,
  LOGO_ALLOWED_MIME,
  LOGO_MAX_BYTES,
};
