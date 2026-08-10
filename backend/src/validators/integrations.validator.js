// Validation for the Integrations module API (registry, API keys, webhooks,
// logs, data syncs). Mirrors notifications.validator: each function returns
// { isValid, errors, data }.

const MAX = {
  name:        120,
  description: 500,
  url:         500,
  secret:      200,
  permissions: 20,
  events:      20,
  limit:       500,
};

const API_KEY_PERMISSIONS = [
  "read:users", "write:users",
  "read:courses", "write:courses",
  "read:enrollments", "write:enrollments",
  "read:certificates", "write:certificates",
  "read:finance", "write:finance",
  "read:reports",
  "read:notifications", "write:notifications",
  "admin:all",
];

const WEBHOOK_EVENTS = [
  "user.registered", "user.suspended",
  "course.created", "course.published", "course.completed",
  "enrollment.created", "enrollment.cancelled",
  "certificate.issued", "certificate.revoked",
  "payment.succeeded", "payment.failed",
  "live_session.created", "live_session.completed",
];

const SYNC_TYPES = ["users", "courses", "departments"];

const API_KEY_STATUSES = ["ACTIVE", "REVOKED", "EXPIRED"];
const WEBHOOK_STATUSES = ["ACTIVE", "PAUSED", "FAILED"];
const LOG_TYPES        = ["API_CALL", "WEBHOOK", "SYNC", "AUTH", "ERROR"];
const LOG_STATUSES     = ["SUCCESS", "FAILED", "PENDING"];

function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0) return `${label} is required.`;
  return null;
}

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

function readEnum(value, key, allowed, errors, { required = false } = {}) {
  if (value === undefined) {
    if (required) errors.push(`${key} is required.`);
    return undefined;
  }
  if (typeof value !== "string" || !allowed.includes(value)) {
    errors.push(`${key} must be one of: ${allowed.join(", ")}.`);
    return undefined;
  }
  return value;
}

function readStringArray(value, key, maxItems, allowed, errors, { required = false } = {}) {
  if (value === undefined) {
    if (required) errors.push(`${key} is required.`);
    return undefined;
  }
  if (!Array.isArray(value) || value.length === 0) { errors.push(`${key} must be a non-empty array.`); return undefined; }
  if (value.length > maxItems) { errors.push(`${key} must have at most ${maxItems} items.`); return undefined; }
  const out = [];
  for (const v of value) {
    if (typeof v !== "string" || !allowed.includes(v)) {
      errors.push(`${key} items must be one of: ${allowed.join(", ")}.`);
      return undefined;
    }
    out.push(v);
  }
  return out;
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

function readDate(value, key, errors) {
  if (value === undefined || value === null || value === "") return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) { errors.push(`${key} must be a valid date.`); return undefined; }
  return d;
}

function readBool(value, key, errors, { required = false } = {}) {
  if (value === undefined) {
    if (required) errors.push(`${key} is required.`);
    return undefined;
  }
  if (typeof value !== "boolean") { errors.push(`${key} must be a boolean.`); return undefined; }
  return value;
}

function readHttpsUrl(value, key, errors, { required = false } = {}) {
  if (value === undefined) {
    if (required) errors.push(`${key} is required.`);
    return undefined;
  }
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) { errors.push(`${key} is required.`); return undefined; }
  if (s.length > MAX.url) { errors.push(`${key} must be at most ${MAX.url} characters.`); return undefined; }
  let parsed;
  try { parsed = new URL(s); } catch { errors.push(`${key} must be a valid URL.`); return undefined; }
  if (parsed.protocol !== "https:") { errors.push(`${key} must use https.`); return undefined; }
  return s;
}

// ── Registry ───────────────────────────────────────────────────────────────────

function validateConnect(body = {}) {
  const errors = [];
  if (body.config !== undefined && (typeof body.config !== "object" || body.config === null || Array.isArray(body.config))) {
    errors.push("config must be an object.");
  }
  return { isValid: errors.length === 0, errors, data: { config: body.config ?? {} } };
}

function validateToggle(body = {}) {
  const errors = [];
  const isEnabled = readBool(body.isEnabled, "isEnabled", errors, { required: true });
  return { isValid: errors.length === 0, errors, data: { isEnabled } };
}

function validateSyncTrigger(body = {}) {
  const errors = [];
  const syncType = readEnum(body.syncType ?? "users", "syncType", SYNC_TYPES, errors);
  return { isValid: errors.length === 0, errors, data: { syncType } };
}

// ── API Keys ───────────────────────────────────────────────────────────────────

function validateApiKeyCreate(body = {}) {
  const errors = [];
  const name        = readBoundedString(body.name, "name", MAX.name, errors, { required: true });
  const description = readBoundedString(body.description, "description", MAX.description, errors, { nullable: true });
  const permissions  = readStringArray(body.permissions, "permissions", MAX.permissions, API_KEY_PERMISSIONS, errors, { required: true });
  const expiresAt    = readDate(body.expiresAt, "expiresAt", errors);
  return {
    isValid: errors.length === 0,
    errors,
    data: { name, description: description ?? null, permissions, expiresAt: expiresAt ?? null },
  };
}

function validateApiKeysQuery(query = {}) {
  const errors = [];
  const status = readEnum(query.status, "status", API_KEY_STATUSES, errors);
  const page  = readInt(query.page, "page", 1, 1000000, errors);
  const limit = readInt(query.limit, "limit", 1, MAX.limit, errors);
  return { isValid: errors.length === 0, errors, data: { status, page: page ?? 1, limit: limit ?? 20 } };
}

// ── Webhooks ───────────────────────────────────────────────────────────────────

function validateWebhookCreate(body = {}) {
  const errors = [];
  const name   = readBoundedString(body.name, "name", MAX.name, errors, { required: true });
  const url    = readHttpsUrl(body.url, "url", errors, { required: true });
  const events = readStringArray(body.events, "events", MAX.events, WEBHOOK_EVENTS, errors, { required: true });
  const secret = readBoundedString(body.secret, "secret", MAX.secret, errors, { nullable: true });
  return { isValid: errors.length === 0, errors, data: { name, url, events, secret: secret ?? null } };
}

function validateWebhookUpdate(body = {}) {
  const errors = [];
  const data = {};

  const name = readBoundedString(body.name, "name", MAX.name, errors);
  if (name !== undefined) data.name = name;

  if (body.url !== undefined) {
    const url = readHttpsUrl(body.url, "url", errors, { required: true });
    if (url !== undefined) data.url = url;
  }

  if (body.events !== undefined) {
    const events = readStringArray(body.events, "events", MAX.events, WEBHOOK_EVENTS, errors, { required: true });
    if (events !== undefined) data.events = events;
  }

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data };
}

// ── Logs ───────────────────────────────────────────────────────────────────────

function validateLogsQuery(query = {}) {
  const errors = [];
  const read = (key) => (typeof query[key] === "string" && query[key].trim() ? query[key].trim() : undefined);

  const integrationId = read("integrationId");
  const type   = readEnum(read("type"), "type", LOG_TYPES, errors);
  const status = readEnum(read("status"), "status", LOG_STATUSES, errors);
  const dateFrom = readDate(read("dateFrom"), "dateFrom", errors);
  const dateTo   = readDate(read("dateTo"), "dateTo", errors);
  const page  = readInt(query.page, "page", 1, 1000000, errors);
  const limit = readInt(query.limit, "limit", 1, MAX.limit, errors);

  return {
    isValid: errors.length === 0,
    errors,
    data: { integrationId, type, status, dateFrom, dateTo, page: page ?? 1, limit: limit ?? 20 },
  };
}

function validatePageQuery(query = {}) {
  const errors = [];
  const page  = readInt(query.page, "page", 1, 1000000, errors);
  const limit = readInt(query.limit, "limit", 1, MAX.limit, errors);
  return { isValid: errors.length === 0, errors, data: { page: page ?? 1, limit: limit ?? 20 } };
}

module.exports = {
  API_KEY_PERMISSIONS,
  WEBHOOK_EVENTS,
  SYNC_TYPES,
  validateId,
  validateConnect,
  validateToggle,
  validateSyncTrigger,
  validateApiKeyCreate,
  validateApiKeysQuery,
  validateWebhookCreate,
  validateWebhookUpdate,
  validateLogsQuery,
  validatePageQuery,
};
