// Validation for the System Settings API. Same conventions as
// finance.validator.js: each function returns { isValid, errors, data };
// every field is read individually so nothing arbitrary reaches Prisma.

const MAX = {
  short:  120,
  medium: 500,
  long:   2000,
  page:   100000,
  limit:  200,
  domains: 50,
  ips:     100,
  types:   30,
};

const REGISTRATION_MODES  = ["OPEN", "INVITE_ONLY", "APPROVAL_REQUIRED"];
const DEFAULT_USER_ROLES  = ["LEARNER", "INSTRUCTOR"];
const COURSE_VISIBILITIES = ["PUBLIC", "PRIVATE", "ENROLLED_ONLY"];

// ── Shared field readers (mirrors finance.validator) ─────────────────────────

function readBoundedString(value, key, max, errors, { required = false, allowEmpty = false } = {}) {
  if (value === undefined || value === null) {
    if (required) errors.push(`${key} is required.`);
    return value === null ? null : undefined;
  }
  const s = typeof value === "string" ? value.trim() : "";
  if (!s && !allowEmpty) { errors.push(required ? `${key} is required.` : `${key} cannot be empty.`); return undefined; }
  if (s.length > max) { errors.push(`${key} must be at most ${max} characters.`); return undefined; }
  return s;
}

function readEnum(value, key, allowed, errors, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) errors.push(`${key} is required.`);
    return undefined;
  }
  const s = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!allowed.includes(s)) { errors.push(`${key} must be one of: ${allowed.join(", ")}.`); return undefined; }
  return s;
}

function readBool(value, key, errors) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") { errors.push(`${key} must be a boolean.`); return undefined; }
  return value;
}

function readInt(value, key, min, max, errors) {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) { errors.push(`${key} must be an integer between ${min} and ${max}.`); return undefined; }
  return n;
}

function readStringArray(value, key, maxLen, errors) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) { errors.push(`${key} must be an array of strings.`); return undefined; }
  if (value.length > maxLen) { errors.push(`${key} must have at most ${maxLen} items.`); return undefined; }
  const out = [];
  for (const v of value) {
    if (typeof v !== "string" || !v.trim()) { errors.push(`${key} must contain only non-empty strings.`); return undefined; }
    out.push(v.trim());
  }
  return out;
}

function readEmail(value, key, errors, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) errors.push(`${key} is required.`);
    return value === null ? null : undefined;
  }
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) { errors.push(`${key} must be a valid email.`); return undefined; }
  return s;
}

function readDate(value, key, errors, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) errors.push(`${key} is required.`);
    return value === null ? null : undefined;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) { errors.push(`${key} must be a valid date.`); return undefined; }
  return d;
}

// ── Settings update — every field optional (PATCH semantics) ────────────────

function validateSettingsUpdate(body = {}) {
  const errors = [];
  const data = {};

  // General
  if (body.platformName        !== undefined) data.platformName        = readBoundedString(body.platformName, "platformName", MAX.short, errors, { required: true });
  if (body.platformDescription !== undefined) data.platformDescription = body.platformDescription === null ? null : readBoundedString(body.platformDescription, "platformDescription", MAX.long, errors, { allowEmpty: true });
  if (body.timezone            !== undefined) data.timezone            = readBoundedString(body.timezone, "timezone", MAX.short, errors, { required: true });
  if (body.defaultLanguage     !== undefined) data.defaultLanguage     = readBoundedString(body.defaultLanguage, "defaultLanguage", 10, errors, { required: true });
  if (body.dateFormat          !== undefined) data.dateFormat          = readBoundedString(body.dateFormat, "dateFormat", 20, errors, { required: true });
  if (body.currency            !== undefined) data.currency            = readBoundedString(body.currency, "currency", 10, errors, { required: true });
  if (body.contactEmail        !== undefined) data.contactEmail        = readEmail(body.contactEmail, "contactEmail", errors);
  if (body.contactPhone        !== undefined) data.contactPhone        = body.contactPhone === null ? null : readBoundedString(body.contactPhone, "contactPhone", 30, errors, { allowEmpty: true });

  // Registration
  if (body.registrationMode          !== undefined) data.registrationMode          = readEnum(body.registrationMode, "registrationMode", REGISTRATION_MODES, errors, { required: true });
  if (body.emailVerificationRequired !== undefined) data.emailVerificationRequired = readBool(body.emailVerificationRequired, "emailVerificationRequired", errors);
  if (body.phoneVerificationRequired !== undefined) data.phoneVerificationRequired = readBool(body.phoneVerificationRequired, "phoneVerificationRequired", errors);
  if (body.captchaEnabled            !== undefined) data.captchaEnabled            = readBool(body.captchaEnabled, "captchaEnabled", errors);
  if (body.allowedEmailDomains       !== undefined) data.allowedEmailDomains       = readStringArray(body.allowedEmailDomains, "allowedEmailDomains", MAX.domains, errors);
  if (body.defaultUserRole           !== undefined) data.defaultUserRole           = readEnum(body.defaultUserRole, "defaultUserRole", DEFAULT_USER_ROLES, errors, { required: true });

  // Learning
  if (body.defaultCourseVisibility !== undefined) data.defaultCourseVisibility = readEnum(body.defaultCourseVisibility, "defaultCourseVisibility", COURSE_VISIBILITIES, errors, { required: true });
  if (body.autoEnrollmentEnabled   !== undefined) data.autoEnrollmentEnabled   = readBool(body.autoEnrollmentEnabled, "autoEnrollmentEnabled", errors);
  if (body.certificatesEnabled     !== undefined) data.certificatesEnabled     = readBool(body.certificatesEnabled, "certificatesEnabled", errors);
  if (body.quizPassingScore        !== undefined) data.quizPassingScore        = readInt(body.quizPassingScore, "quizPassingScore", 0, 100, errors);
  if (body.maxQuizAttempts         !== undefined) data.maxQuizAttempts         = readInt(body.maxQuizAttempts, "maxQuizAttempts", 1, 20, errors);
  if (body.scormEnabled            !== undefined) data.scormEnabled            = readBool(body.scormEnabled, "scormEnabled", errors);
  if (body.progressTrackingEnabled !== undefined) data.progressTrackingEnabled = readBool(body.progressTrackingEnabled, "progressTrackingEnabled", errors);

  // Security
  if (body.passwordMinLength        !== undefined) data.passwordMinLength        = readInt(body.passwordMinLength, "passwordMinLength", 6, 64, errors);
  if (body.passwordRequireUppercase !== undefined) data.passwordRequireUppercase = readBool(body.passwordRequireUppercase, "passwordRequireUppercase", errors);
  if (body.passwordRequireNumbers   !== undefined) data.passwordRequireNumbers   = readBool(body.passwordRequireNumbers, "passwordRequireNumbers", errors);
  if (body.passwordRequireSymbols   !== undefined) data.passwordRequireSymbols   = readBool(body.passwordRequireSymbols, "passwordRequireSymbols", errors);
  if (body.sessionTimeoutMinutes    !== undefined) data.sessionTimeoutMinutes    = readInt(body.sessionTimeoutMinutes, "sessionTimeoutMinutes", 5, 1440, errors);
  if (body.maxLoginAttempts         !== undefined) data.maxLoginAttempts         = readInt(body.maxLoginAttempts, "maxLoginAttempts", 3, 20, errors);
  if (body.mfaEnabled               !== undefined) data.mfaEnabled               = readBool(body.mfaEnabled, "mfaEnabled", errors);
  if (body.ipRestrictionEnabled     !== undefined) data.ipRestrictionEnabled     = readBool(body.ipRestrictionEnabled, "ipRestrictionEnabled", errors);
  if (body.allowedIPs               !== undefined) data.allowedIPs               = readStringArray(body.allowedIPs, "allowedIPs", MAX.ips, errors);

  // Media
  if (body.maxUploadSizeMb         !== undefined) data.maxUploadSizeMb         = readInt(body.maxUploadSizeMb, "maxUploadSizeMb", 1, 500, errors);
  if (body.allowedFileTypes        !== undefined) data.allowedFileTypes        = readStringArray(body.allowedFileTypes, "allowedFileTypes", MAX.types, errors);
  if (body.videoProcessingEnabled  !== undefined) data.videoProcessingEnabled  = readBool(body.videoProcessingEnabled, "videoProcessingEnabled", errors);
  if (body.imageCompressionEnabled !== undefined) data.imageCompressionEnabled = readBool(body.imageCompressionEnabled, "imageCompressionEnabled", errors);

  // Branding
  if (body.logoUrl      !== undefined) data.logoUrl      = body.logoUrl === null ? null : readBoundedString(body.logoUrl, "logoUrl", 1000, errors);
  if (body.faviconUrl   !== undefined) data.faviconUrl   = body.faviconUrl === null ? null : readBoundedString(body.faviconUrl, "faviconUrl", 1000, errors);
  if (body.primaryColor !== undefined) {
    const c = typeof body.primaryColor === "string" ? body.primaryColor.trim() : "";
    if (!/^#[0-9a-fA-F]{6}$/.test(c)) errors.push("primaryColor must be a hex color like #2563eb.");
    else data.primaryColor = c;
  }

  // Email Config (SMTP host/port/user/pass stay .env-only — never in DB)
  if (body.emailFromName  !== undefined) data.emailFromName  = body.emailFromName === null ? null : readBoundedString(body.emailFromName, "emailFromName", MAX.short, errors, { allowEmpty: true });
  if (body.emailFromEmail !== undefined) data.emailFromEmail = readEmail(body.emailFromEmail, "emailFromEmail", errors);

  // Notifications (global toggles — per-template rules live in the
  // Notifications module, not here)
  if (body.emailNotificationsEnabled !== undefined) data.emailNotificationsEnabled = readBool(body.emailNotificationsEnabled, "emailNotificationsEnabled", errors);
  if (body.digestEmailsEnabled       !== undefined) data.digestEmailsEnabled       = readBool(body.digestEmailsEnabled, "digestEmailsEnabled", errors);

  // Automation
  if (body.autoCertificationEnabled     !== undefined) data.autoCertificationEnabled     = readBool(body.autoCertificationEnabled, "autoCertificationEnabled", errors);
  if (body.reminderNotificationsEnabled !== undefined) data.reminderNotificationsEnabled = readBool(body.reminderNotificationsEnabled, "reminderNotificationsEnabled", errors);

  // Domain & URL (SEO)
  if (body.metaTitle       !== undefined) data.metaTitle       = body.metaTitle === null ? null : readBoundedString(body.metaTitle, "metaTitle", MAX.short, errors, { allowEmpty: true });
  if (body.metaDescription !== undefined) data.metaDescription = body.metaDescription === null ? null : readBoundedString(body.metaDescription, "metaDescription", MAX.medium, errors, { allowEmpty: true });

  // Maintenance (message/schedule editable here; enable/disable have their
  // own endpoints below since they also flip maintenanceMode + audit-log)
  if (body.maintenanceMessage !== undefined) data.maintenanceMessage = body.maintenanceMessage === null ? null : readBoundedString(body.maintenanceMessage, "maintenanceMessage", MAX.long, errors, { allowEmpty: true });

  // Features
  if (body.liveSessionsEnabled       !== undefined) data.liveSessionsEnabled       = readBool(body.liveSessionsEnabled, "liveSessionsEnabled", errors);
  if (body.certificatesModuleEnabled !== undefined) data.certificatesModuleEnabled = readBool(body.certificatesModuleEnabled, "certificatesModuleEnabled", errors);
  if (body.marketplaceEnabled        !== undefined) data.marketplaceEnabled        = readBool(body.marketplaceEnabled, "marketplaceEnabled", errors);
  if (body.aiEnabled                 !== undefined) data.aiEnabled                 = readBool(body.aiEnabled, "aiEnabled", errors);
  if (body.gamificationEnabled       !== undefined) data.gamificationEnabled       = readBool(body.gamificationEnabled, "gamificationEnabled", errors);
  if (body.scormModuleEnabled        !== undefined) data.scormModuleEnabled        = readBool(body.scormModuleEnabled, "scormModuleEnabled", errors);
  if (body.mobileAppEnabled          !== undefined) data.mobileAppEnabled          = readBool(body.mobileAppEnabled, "mobileAppEnabled", errors);

  if (errors.length === 0 && Object.keys(data).length === 0) errors.push("No valid fields provided to update.");
  return { isValid: errors.length === 0, errors, data };
}

function validateMaintenanceEnable(body = {}) {
  const errors = [];
  const data = {};
  data.message     = body.message     !== undefined && body.message     !== null ? readBoundedString(body.message, "message", MAX.long, errors, { allowEmpty: true }) : null;
  data.scheduledAt = body.scheduledAt !== undefined && body.scheduledAt !== null ? readDate(body.scheduledAt, "scheduledAt", errors) : null;
  return { isValid: errors.length === 0, errors, data };
}

function validateLogsQuery(query = {}) {
  const errors = [];
  const page   = readInt(query.page,  "page",  1, MAX.page,  errors) ?? 1;
  const limit  = readInt(query.limit, "limit", 1, MAX.limit, errors) ?? 20;
  const search = query.search ? readBoundedString(query.search, "search", MAX.short, errors, { allowEmpty: true }) : undefined;
  const from   = query.dateFrom ? readDate(query.dateFrom, "dateFrom", errors) : undefined;
  const to     = query.dateTo   ? readDate(query.dateTo,   "dateTo",   errors) : undefined;
  return { isValid: errors.length === 0, errors, data: { page, limit, search, dateFrom: from, dateTo: to } };
}

function validateTestEmail(body = {}) {
  const errors = [];
  const to = readEmail(body.to, "to", errors, { required: false });
  return { isValid: errors.length === 0, errors, data: { to: to ?? null } };
}

module.exports = {
  validateSettingsUpdate,
  validateMaintenanceEnable,
  validateLogsQuery,
  validateTestEmail,
  REGISTRATION_MODES,
  DEFAULT_USER_ROLES,
  COURSE_VISIBILITIES,
};
