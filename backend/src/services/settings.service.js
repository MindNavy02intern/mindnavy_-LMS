const crypto = require("crypto");
const prisma = require("../config/prisma");
const { getProvider } = require("./storage");
const { isMailerConfigured, sendMail } = require("../utils/mailer");

// ── System Settings — single row, mirrors CompetencySettings/FinanceSettings/
// HierarchySettings (lazy-create-on-read, flat config fields). Unlike those,
// every update also writes one SystemConfigLog row PER changed field (the
// Config Logs tab needs a Setting/Old/New/Changed By/Date table) on top of
// the usual single AuditLog "which fields changed" entry.

function domainError(code, message) {
  return Object.assign(new Error(message || code), { code });
}

async function auditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: adminId ?? null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

// Never store real values for secret-shaped fields in the diff trail.
const REDACTED_FIELDS = new Set(["allowedIPs"]);

function serializeValue(key, value) {
  if (value === null || value === undefined) return null;
  if (REDACTED_FIELDS.has(key)) return "[redacted]";
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return JSON.stringify(value);
  return String(value);
}

function valuesEqual(a, b) {
  if (a instanceof Date || b instanceof Date) return new Date(a).getTime() === new Date(b).getTime();
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  return a === b;
}

async function writeConfigLogs(before, update, changedById) {
  const rows = Object.keys(update)
    .filter((field) => !valuesEqual(before[field], update[field]))
    .map((field) => ({
      setting: field,
      oldValue: serializeValue(field, before[field]),
      newValue: serializeValue(field, update[field]),
      changedById,
    }));
  if (rows.length > 0) await prisma.systemConfigLog.createMany({ data: rows });
  return rows.map((r) => r.setting);
}

async function getOrCreateSettings() {
  let settings = await prisma.systemSettings.findFirst({ orderBy: { createdAt: "asc" } });
  if (!settings) settings = await prisma.systemSettings.create({ data: {} });
  return settings;
}

async function getSystemSettings() {
  return getOrCreateSettings();
}

async function updateSystemSettings(data, adminId) {
  const before = await getOrCreateSettings();
  const update = { ...data, updatedById: adminId ?? null };

  const result = await prisma.systemSettings.update({ where: { id: before.id }, data: update });
  const changedFields = await writeConfigLogs(before, data, adminId);
  if (changedFields.length > 0) {
    await auditLog(adminId, "SYSTEM_SETTINGS_UPDATED", { fields: changedFields });
  }
  return result;
}

async function listConfigLogs({ page = 1, limit = 20, search, dateFrom, dateTo } = {}) {
  const where = {};
  if (search) where.setting = { contains: search, mode: "insensitive" };
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = dateFrom;
    if (dateTo) where.createdAt.lte = dateTo;
  }

  const [total, logs] = await Promise.all([
    prisma.systemConfigLog.count({ where }),
    prisma.systemConfigLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  const adminIds = [...new Set(logs.map((l) => l.changedById).filter(Boolean))];
  const admins = adminIds.length
    ? await prisma.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, fullName: true, email: true } })
    : [];
  const adminById = new Map(admins.map((a) => [a.id, a]));

  return {
    logs: logs.map((l) => ({ ...l, changedBy: adminById.get(l.changedById) ?? null })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

// ── Maintenance mode ─────────────────────────────────────────────────────────
// Enabling/disabling is a dedicated action (not folded into the generic PATCH)
// because it needs its own audit action + a distinct message than "fields
// changed", matching HIERARCHY_SETTINGS_RESET being separate from
// HIERARCHY_SETTINGS_UPDATED.

async function enableMaintenance({ message, scheduledAt }, adminId) {
  const before = await getOrCreateSettings();
  const update = { maintenanceMode: true, maintenanceMessage: message ?? null, scheduledMaintenanceAt: scheduledAt ?? null, updatedById: adminId ?? null };
  const result = await prisma.systemSettings.update({ where: { id: before.id }, data: update });
  await writeConfigLogs(before, { maintenanceMode: true, maintenanceMessage: message ?? null, scheduledMaintenanceAt: scheduledAt ?? null }, adminId);
  await auditLog(adminId, "MAINTENANCE_MODE_ENABLED", { message: message ?? null, scheduledAt: scheduledAt ?? null });
  return result;
}

async function disableMaintenance(adminId) {
  const before = await getOrCreateSettings();
  const result = await prisma.systemSettings.update({
    where: { id: before.id },
    data: { maintenanceMode: false, updatedById: adminId ?? null },
  });
  await writeConfigLogs(before, { maintenanceMode: false }, adminId);
  await auditLog(adminId, "MAINTENANCE_MODE_DISABLED", null);
  return result;
}

// ── Test email ───────────────────────────────────────────────────────────────

async function sendTestEmail(adminId, to) {
  const settings = await getOrCreateSettings();
  const target = to || settings.contactEmail;
  if (!target) throw domainError("NO_RECIPIENT", "No recipient email provided and no contact email configured.");
  if (!isMailerConfigured()) {
    return { success: false, message: "SMTP is not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing on the server)." };
  }
  const result = await sendMail({
    to: target,
    subject: `${settings.platformName} — Test Email`,
    text: `This is a test email from ${settings.platformName}'s System Settings > Email Configuration tab. If you received this, SMTP delivery is working.`,
    html: `<p>This is a test email from <strong>${settings.platformName}</strong>'s System Settings &gt; Email Configuration tab.</p><p>If you received this, SMTP delivery is working.</p>`,
  });
  await auditLog(adminId, "SYSTEM_SETTINGS_TEST_EMAIL_SENT", { to: target, sent: result.sent });
  return result.sent
    ? { success: true, message: `Test email sent to ${target}.` }
    : { success: false, message: "Failed to send test email. Check SMTP configuration." };
}

// ── Backup / restore ─────────────────────────────────────────────────────────

async function createBackup(adminId) {
  const settings = await getOrCreateSettings();
  // Strip row bookkeeping — a backup is a config snapshot, not a row clone.
  const { id, createdAt, updatedAt, updatedById, lastBackupAt, ...config } = settings;
  const backup = { exportedAt: new Date().toISOString(), platformName: settings.platformName, settings: config };
  await prisma.systemSettings.update({ where: { id: settings.id }, data: { lastBackupAt: new Date() } });
  await auditLog(adminId, "SYSTEM_BACKUP_CREATED", null);
  return backup;
}

async function restoreFromBackup(config, adminId) {
  const before = await getOrCreateSettings();
  const result = await prisma.systemSettings.update({ where: { id: before.id }, data: { ...config, updatedById: adminId ?? null } });
  const changedFields = await writeConfigLogs(before, config, adminId);
  await auditLog(adminId, "SYSTEM_SETTINGS_RESTORED", { fields: changedFields });
  return result;
}

// ── Storage usage ────────────────────────────────────────────────────────────

async function getStorageUsage() {
  const provider = getProvider();
  if (!provider.isConfigured()) throw domainError("STORAGE_NOT_CONFIGURED", "Storage is not configured.");
  if (typeof provider.getBucketUsage !== "function") throw domainError("STORAGE_USAGE_UNSUPPORTED", "The active storage provider does not report usage.");
  const buckets = await provider.getBucketUsage();
  return {
    provider: provider.name,
    buckets,
    totalFiles: buckets.reduce((sum, b) => sum + b.fileCount, 0),
    totalSizeBytes: buckets.reduce((sum, b) => sum + b.totalSizeBytes, 0),
  };
}

// ── Branding asset upload (logo / favicon) — platform-level, not course-
// scoped, so it can't reuse uploads.service (which requires a courseId).
// Same sign → direct PUT → confirm flow, own bucket. ──────────────────────────

const BRANDING_BUCKET = process.env.SUPABASE_BRANDING_BUCKET || "system-branding";
const BRANDING_MAX_BYTES = 2 * 1024 * 1024; // 2MB — logos/favicons only
const BRANDING_KINDS = ["logo", "favicon"];

function safeFileName(name) {
  const base = String(name).split(/[/\\]/).pop() || "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_").slice(0, 120) || "file";
}

async function signBrandingUpload({ kind, fileName }) {
  if (!BRANDING_KINDS.includes(kind)) throw domainError("BAD_KIND", "kind must be 'logo' or 'favicon'.");
  const provider = getProvider();
  if (!provider.isConfigured()) throw domainError("STORAGE_NOT_CONFIGURED");
  const path = `${kind}/${crypto.randomUUID()}-${safeFileName(fileName)}`;
  const { uploadUrl } = await provider.createSignedUpload(BRANDING_BUCKET, path);
  return { uploadUrl, path, kind, maxBytes: BRANDING_MAX_BYTES };
}

async function confirmBrandingUpload({ kind, path }, adminId) {
  if (!BRANDING_KINDS.includes(kind)) throw domainError("BAD_KIND", "kind must be 'logo' or 'favicon'.");
  if (path.includes("..") || path.includes("\\") || path.startsWith("/") || !path.startsWith(`${kind}/`)) {
    throw domainError("BAD_PATH");
  }
  const provider = getProvider();
  if (!provider.isConfigured()) throw domainError("STORAGE_NOT_CONFIGURED");
  const info = await provider.statObject(BRANDING_BUCKET, path);
  if (!info.exists) throw domainError("OBJECT_NOT_FOUND");
  if (info.size != null && info.size > BRANDING_MAX_BYTES) throw domainError("FILE_TOO_LARGE");

  const url = provider.getPublicUrl(BRANDING_BUCKET, path);
  const before = await getOrCreateSettings();
  const field = kind === "logo" ? "logoUrl" : "faviconUrl";
  const result = await prisma.systemSettings.update({ where: { id: before.id }, data: { [field]: url, updatedById: adminId ?? null } });
  await writeConfigLogs(before, { [field]: url }, adminId);
  await auditLog(adminId, "SYSTEM_SETTINGS_UPDATED", { fields: [field] });
  return { url };
}

module.exports = {
  getSystemSettings,
  updateSystemSettings,
  listConfigLogs,
  enableMaintenance,
  disableMaintenance,
  sendTestEmail,
  createBackup,
  restoreFromBackup,
  getStorageUsage,
  signBrandingUpload,
  confirmBrandingUpload,
};
