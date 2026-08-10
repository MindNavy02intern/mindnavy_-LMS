// Validation for the Notifications module API (templates, announcements,
// automations, in-app sends, delivery logs, preferences, emergency alerts).
// Mirrors certificates.validator: each function returns { isValid, errors, data }.

const MAX = {
  name:        120,
  title:       200,
  subject:     200,
  body:        5000,
  description: 500,
  variable:    60,
  reason:      500,
  limit:       500,
  offset:      1000000,
  variables:   30,
  targetIds:   200,
  channels:    4,
  userIds:     1000,
};

const CHANNEL_TYPES          = ["EMAIL", "PUSH", "SMS", "IN_APP"];
const CATEGORIES             = ["SYSTEM", "MARKETING", "LEARNING", "SECURITY", "PAYMENT"];
const TEMPLATE_STATUSES      = ["ACTIVE", "INACTIVE"];
const ANNOUNCEMENT_TYPES     = ["PLATFORM", "MAINTENANCE", "PROMOTION", "COMPANY", "EMERGENCY"];
const ANNOUNCEMENT_AUDIENCES = ["ALL", "LEARNERS", "INSTRUCTORS", "DEPARTMENTS", "GROUPS", "CUSTOM"];
const PRIORITIES             = ["LOW", "NORMAL", "HIGH", "URGENT"];
const ANNOUNCEMENT_STATUSES  = ["DRAFT", "SCHEDULED", "SENT", "CANCELLED"];
const AUTOMATION_TRIGGERS = [
  "USER_REGISTRATION", "COURSE_ENROLLMENT", "COURSE_COMPLETION", "QUIZ_FAILURE",
  "ASSIGNMENT_DEADLINE", "PAYMENT_SUCCESS", "SUBSCRIPTION_EXPIRY",
  "LIVE_SESSION_START", "SECURITY_EVENT",
];
const AUTOMATION_STATUSES = ["ACTIVE", "PAUSED"];
const LOG_STATUSES        = ["SENT", "FAILED", "PENDING", "BOUNCED", "OPENED", "CLICKED"];

function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0) return `${label} is required.`;
  return null;
}

// ── Shared field readers (same shape as certificates.validator) ─────────────────

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

function readStringArray(value, key, maxItems, maxLen, errors, { required = false } = {}) {
  if (value === undefined) {
    if (required) errors.push(`${key} is required.`);
    return undefined;
  }
  if (!Array.isArray(value)) { errors.push(`${key} must be an array.`); return undefined; }
  if (value.length > maxItems) { errors.push(`${key} must have at most ${maxItems} items.`); return undefined; }
  const out = [];
  for (const v of value) {
    if (typeof v !== "string" || !v.trim() || v.trim().length > maxLen) {
      errors.push(`${key} items must be non-empty strings up to ${maxLen} characters.`);
      return undefined;
    }
    out.push(v.trim());
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
  if (value === undefined || value === null) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) { errors.push(`${key} must be a valid date.`); return undefined; }
  return d;
}

function readBool(value, key, errors) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") { errors.push(`${key} must be a boolean.`); return undefined; }
  return value;
}

const QUIET_HOUR = /^([01]\d|2[0-3]):[0-5]\d$/;
function readQuietHour(value, key, errors) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string" || !QUIET_HOUR.test(value)) {
    errors.push(`${key} must be "HH:MM" (24h) or null.`);
    return undefined;
  }
  return value;
}

// ── Templates ────────────────────────────────────────────────────────────────

function validateTemplateCreate(body = {}) {
  const errors = [];
  const name     = readBoundedString(body.name, "name", MAX.name, errors, { required: true });
  const type     = readEnum(body.type, "type", CHANNEL_TYPES, errors, { required: true });
  const subject  = readBoundedString(body.subject, "subject", MAX.subject, errors, { nullable: true });
  const bodyText = readBoundedString(body.body, "body", MAX.body, errors, { required: true });
  const variables = readStringArray(body.variables ?? [], "variables", MAX.variables, MAX.variable, errors);
  const category = readEnum(body.category ?? "SYSTEM", "category", CATEGORIES, errors);
  const status   = readEnum(body.status ?? "ACTIVE", "status", TEMPLATE_STATUSES, errors);

  return {
    isValid: errors.length === 0,
    errors,
    data: { name, type, subject: subject ?? null, body: bodyText, variables: variables ?? [], category, status },
  };
}

function validateTemplateUpdate(body = {}) {
  const errors = [];
  const data = {};

  const name = readBoundedString(body.name, "name", MAX.name, errors);
  if (name !== undefined) data.name = name;

  const type = readEnum(body.type, "type", CHANNEL_TYPES, errors);
  if (type !== undefined) data.type = type;

  if (body.subject !== undefined) {
    const subject = readBoundedString(body.subject, "subject", MAX.subject, errors, { nullable: true });
    if (subject !== undefined) data.subject = subject;
  }

  const bodyText = readBoundedString(body.body, "body", MAX.body, errors);
  if (bodyText !== undefined) data.body = bodyText;

  if (body.variables !== undefined) {
    const variables = readStringArray(body.variables, "variables", MAX.variables, MAX.variable, errors);
    if (variables !== undefined) data.variables = variables;
  }

  const category = readEnum(body.category, "category", CATEGORIES, errors);
  if (category !== undefined) data.category = category;

  const status = readEnum(body.status, "status", TEMPLATE_STATUSES, errors);
  if (status !== undefined) data.status = status;

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data };
}

// { variables: { key: value } } — values coerced to strings, unknown keys allowed
// (renderer only substitutes {{keys}} present in the template body).
function validateTemplatePreview(body = {}) {
  const errors = [];
  const raw = body.variables;
  if (raw !== undefined && (typeof raw !== "object" || raw === null || Array.isArray(raw))) {
    errors.push("variables must be an object of key/value pairs.");
    return { isValid: false, errors, data: {} };
  }
  const variables = {};
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (typeof k !== "string" || k.length > MAX.variable) { errors.push("variable keys must be short strings."); break; }
    variables[k] = v === null || v === undefined ? "" : String(v).slice(0, 500);
  }
  return { isValid: errors.length === 0, errors, data: { variables } };
}

// ── Announcements ────────────────────────────────────────────────────────────

function validateAnnouncementCreate(body = {}) {
  const errors = [];
  const title    = readBoundedString(body.title, "title", MAX.title, errors, { required: true });
  const bodyText = readBoundedString(body.body, "body", MAX.body, errors, { required: true });
  const type     = readEnum(body.type, "type", ANNOUNCEMENT_TYPES, errors, { required: true });
  const audience = readEnum(body.audience, "audience", ANNOUNCEMENT_AUDIENCES, errors, { required: true });
  const priority = readEnum(body.priority ?? "NORMAL", "priority", PRIORITIES, errors);
  const scheduledAt = readDate(body.scheduledAt, "scheduledAt", errors);

  let targetIds = [];
  if (audience === "CUSTOM" || audience === "DEPARTMENTS" || audience === "GROUPS") {
    targetIds = readStringArray(body.targetIds ?? [], "targetIds", MAX.targetIds, 100, errors, { required: true }) ?? [];
    if (targetIds.length === 0) errors.push("targetIds is required for this audience.");
  } else if (body.targetIds !== undefined) {
    targetIds = readStringArray(body.targetIds, "targetIds", MAX.targetIds, 100, errors) ?? [];
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      title, body: bodyText, type, audience, priority, targetIds,
      status: scheduledAt ? "SCHEDULED" : "DRAFT",
      scheduledAt: scheduledAt ?? null,
    },
  };
}

function validateAnnouncementUpdate(body = {}) {
  const errors = [];
  const data = {};

  const title = readBoundedString(body.title, "title", MAX.title, errors);
  if (title !== undefined) data.title = title;

  const bodyText = readBoundedString(body.body, "body", MAX.body, errors);
  if (bodyText !== undefined) data.body = bodyText;

  const type = readEnum(body.type, "type", ANNOUNCEMENT_TYPES, errors);
  if (type !== undefined) data.type = type;

  const audience = readEnum(body.audience, "audience", ANNOUNCEMENT_AUDIENCES, errors);
  if (audience !== undefined) data.audience = audience;

  const priority = readEnum(body.priority, "priority", PRIORITIES, errors);
  if (priority !== undefined) data.priority = priority;

  if (body.targetIds !== undefined) {
    const targetIds = readStringArray(body.targetIds, "targetIds", MAX.targetIds, 100, errors);
    if (targetIds !== undefined) data.targetIds = targetIds;
  }

  if (body.scheduledAt !== undefined) {
    const scheduledAt = readDate(body.scheduledAt, "scheduledAt", errors);
    if (body.scheduledAt === null) data.scheduledAt = null;
    else if (scheduledAt !== undefined) data.scheduledAt = scheduledAt;
  }

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data };
}

// ── Automations ──────────────────────────────────────────────────────────────

function validateAutomationCreate(body = {}) {
  const errors = [];
  const name        = readBoundedString(body.name, "name", MAX.name, errors, { required: true });
  const description = readBoundedString(body.description, "description", MAX.description, errors, { nullable: true });
  const trigger      = readEnum(body.trigger, "trigger", AUTOMATION_TRIGGERS, errors, { required: true });
  const templateIdErr = validateId(body.templateId, "templateId");
  if (templateIdErr) errors.push(templateIdErr);
  const channels = readStringArray(body.channels, "channels", MAX.channels, 10, errors, { required: true });
  if (channels && channels.some(c => !CHANNEL_TYPES.includes(c))) errors.push("channels must be a subset of EMAIL, PUSH, SMS, IN_APP.");
  const status = readEnum(body.status ?? "ACTIVE", "status", AUTOMATION_STATUSES, errors);

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      name,
      description: description ?? null,
      trigger,
      templateId: typeof body.templateId === "string" ? body.templateId.trim() : body.templateId,
      channels: channels ?? [],
      status,
    },
  };
}

function validateAutomationUpdate(body = {}) {
  const errors = [];
  const data = {};

  const name = readBoundedString(body.name, "name", MAX.name, errors);
  if (name !== undefined) data.name = name;

  if (body.description !== undefined) {
    const description = readBoundedString(body.description, "description", MAX.description, errors, { nullable: true });
    if (description !== undefined) data.description = description;
  }

  const trigger = readEnum(body.trigger, "trigger", AUTOMATION_TRIGGERS, errors);
  if (trigger !== undefined) data.trigger = trigger;

  if (body.templateId !== undefined) {
    const templateIdErr = validateId(body.templateId, "templateId");
    if (templateIdErr) errors.push(templateIdErr);
    else data.templateId = body.templateId.trim();
  }

  if (body.channels !== undefined) {
    const channels = readStringArray(body.channels, "channels", MAX.channels, 10, errors);
    if (channels && channels.some(c => !CHANNEL_TYPES.includes(c))) errors.push("channels must be a subset of EMAIL, PUSH, SMS, IN_APP.");
    else if (channels !== undefined) data.channels = channels;
  }

  const status = readEnum(body.status, "status", AUTOMATION_STATUSES, errors);
  if (status !== undefined) data.status = status;

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data };
}

// ── In-app send ───────────────────────────────────────────────────────────────

function validateSendNotification(body = {}) {
  const errors = [];
  const userIds = readStringArray(body.userIds, "userIds", MAX.userIds, 100, errors, { required: true });
  const title    = readBoundedString(body.title, "title", MAX.title, errors, { required: true });
  const bodyText = readBoundedString(body.body, "body", MAX.body, errors, { required: true });
  const type     = readBoundedString(body.type ?? "system", "type", 40, errors);
  const priority = readEnum(body.priority ?? "NORMAL", "priority", PRIORITIES, errors);

  if (userIds && userIds.length === 0) errors.push("userIds must have at least one id.");

  return {
    isValid: errors.length === 0,
    errors,
    data: { userIds: userIds ?? [], title, body: bodyText, type, priority },
  };
}

// ── Preferences ───────────────────────────────────────────────────────────────

function validatePreferencesUpdate(body = {}) {
  const errors = [];
  const data = {};

  for (const key of ["emailEnabled", "pushEnabled", "smsEnabled", "marketingEnabled", "learningAlertsEnabled", "securityEnabled"]) {
    const v = readBool(body[key], key, errors);
    if (v !== undefined) data[key] = v;
  }

  if (body.quietHoursStart !== undefined) {
    const v = readQuietHour(body.quietHoursStart, "quietHoursStart", errors);
    if (v !== undefined) data.quietHoursStart = v;
  }
  if (body.quietHoursEnd !== undefined) {
    const v = readQuietHour(body.quietHoursEnd, "quietHoursEnd", errors);
    if (v !== undefined) data.quietHoursEnd = v;
  }

  return { isValid: errors.length === 0, errors, data };
}

// ── Emergency alert ───────────────────────────────────────────────────────────

function validateEmergency(body = {}) {
  const errors = [];
  const title   = readBoundedString(body.title, "title", MAX.title, errors, { required: true });
  const message = readBoundedString(body.message, "message", MAX.body, errors, { required: true });
  const channels = readStringArray(body.channels, "channels", MAX.channels, 10, errors, { required: true });
  if (channels && channels.some(c => !CHANNEL_TYPES.includes(c))) errors.push("channels must be a subset of EMAIL, PUSH, SMS, IN_APP.");

  return { isValid: errors.length === 0, errors, data: { title, message, channels: channels ?? [] } };
}

// ── List filters (query string) ────────────────────────────────────────────────

function validatePageQuery(query = {}) {
  const errors = [];
  const page  = readInt(query.page, "page", 1, 1000000, errors);
  const limit = readInt(query.limit, "limit", 1, MAX.limit, errors);
  return { isValid: errors.length === 0, errors, data: { page: page ?? 1, limit: limit ?? 20 } };
}

function validateLogsQuery(query = {}) {
  const errors = [];
  const read = (key) => (typeof query[key] === "string" && query[key].trim() ? query[key].trim() : undefined);

  const channel = readEnum(read("channel"), "channel", CHANNEL_TYPES, errors);
  const status  = readEnum(read("status"), "status", LOG_STATUSES, errors);
  const userId  = read("userId");
  const dateFrom = readDate(read("dateFrom"), "dateFrom", errors);
  const dateTo   = readDate(read("dateTo"), "dateTo", errors);
  const page  = readInt(query.page, "page", 1, 1000000, errors);
  const limit = readInt(query.limit, "limit", 1, MAX.limit, errors);

  return {
    isValid: errors.length === 0,
    errors,
    data: { channel, status, userId, dateFrom, dateTo, page: page ?? 1, limit: limit ?? 20 },
  };
}

module.exports = {
  validateId,
  validateTemplateCreate,
  validateTemplateUpdate,
  validateTemplatePreview,
  validateAnnouncementCreate,
  validateAnnouncementUpdate,
  validateAutomationCreate,
  validateAutomationUpdate,
  validateSendNotification,
  validatePreferencesUpdate,
  validateEmergency,
  validatePageQuery,
  validateLogsQuery,
  CHANNEL_TYPES,
  CATEGORIES,
  ANNOUNCEMENT_TYPES,
  ANNOUNCEMENT_AUDIENCES,
  PRIORITIES,
  AUTOMATION_TRIGGERS,
};
