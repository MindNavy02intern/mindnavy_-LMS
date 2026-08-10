const svc = require("../services/settings.service");
const { isMailerConfigured } = require("../utils/mailer");
const { getProvider } = require("../services/storage");
const {
  validateSettingsUpdate,
  validateMaintenanceEnable,
  validateLogsQuery,
  validateTestEmail,
} = require("../validators/settings.validator");

// Derived, env-only status flags — never the underlying secret values. Merged
// onto every settings response so tabs (Email Config, Storage, API &
// Developer) can show "configured / not configured" honestly without a
// separate round trip.
function withEnvStatus(settings) {
  return {
    ...settings,
    smtpConfigured: isMailerConfigured(),
    storageConfigured: getProvider().isConfigured(),
  };
}

// ── Helpers (same pattern as uploads/competencies controllers) ──────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "NO_RECIPIENT":
      return badRequest(res, err.message);
    case "BAD_KIND":
    case "BAD_PATH":
      return badRequest(res, err.message || "Invalid request.");
    case "OBJECT_NOT_FOUND":
      return badRequest(res, "The file was not found in storage — the upload did not complete.");
    case "FILE_TOO_LARGE":
      return badRequest(res, "The uploaded file exceeds the maximum allowed size (2MB).");
    case "STORAGE_NOT_CONFIGURED":
      return res.status(503).json({ success: false, message: "File storage is not configured yet." });
    case "STORAGE_USAGE_UNSUPPORTED":
      return res.status(503).json({ success: false, message: err.message });
    case "STORAGE_SIGN_FAILED":
    case "STORAGE_LIST_FAILED":
      return res.status(502).json({ success: false, message: "Storage service error. Please try again." });
    default:
      return null;
  }
}

function serverError(res, err) {
  console.error("[SettingsController]", err);
  return res.status(500).json({ success: false, message: "Internal server error." });
}

function run(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      return handleDomainError(res, err) ?? serverError(res, err);
    }
  };
}

// ── Settings CRUD ─────────────────────────────────────────────────────────────

const getSettings = run(async (req, res) => {
  const settings = await svc.getSystemSettings();
  return res.json({ success: true, data: withEnvStatus(settings) });
});

const updateSettings = run(async (req, res) => {
  const v = validateSettingsUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const settings = await svc.updateSystemSettings(v.data, req.admin?.id);
  return res.json({ success: true, message: "Settings updated.", data: withEnvStatus(settings) });
});

const getLogs = run(async (req, res) => {
  const v = validateLogsQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.listConfigLogs(v.data);
  return res.json({ success: true, data: result });
});

// ── Maintenance ────────────────────────────────────────────────────────────

const enableMaintenance = run(async (req, res) => {
  const v = validateMaintenanceEnable(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const settings = await svc.enableMaintenance(v.data, req.admin?.id);
  return res.json({ success: true, message: "Maintenance mode enabled.", data: withEnvStatus(settings) });
});

const disableMaintenance = run(async (req, res) => {
  const settings = await svc.disableMaintenance(req.admin?.id);
  return res.json({ success: true, message: "Maintenance mode disabled.", data: withEnvStatus(settings) });
});

// ── Test email ─────────────────────────────────────────────────────────────

const testEmail = run(async (req, res) => {
  const v = validateTestEmail(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.sendTestEmail(req.admin?.id, v.data.to);
  return res.json(result);
});

// ── Backup / restore ─────────────────────────────────────────────────────────

const backup = run(async (req, res) => {
  const data = await svc.createBackup(req.admin?.id);
  return res.json({ success: true, message: "Backup created.", data });
});

const restore = run(async (req, res) => {
  const payload = req.body?.settings;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return badRequest(res, "Request body must include a settings object (as produced by /backup).");
  }
  const v = validateSettingsUpdate(payload);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const settings = await svc.restoreFromBackup(v.data, req.admin?.id);
  return res.json({ success: true, message: "Settings restored from backup.", data: withEnvStatus(settings) });
});

// ── Storage usage ────────────────────────────────────────────────────────────

const storageUsage = run(async (req, res) => {
  const data = await svc.getStorageUsage();
  return res.json({ success: true, data });
});

// ── Branding upload (logo / favicon) ─────────────────────────────────────────

const signBranding = run(async (req, res) => {
  const { kind, fileName } = req.body || {};
  if (!kind || !fileName) return badRequest(res, "kind and fileName are required.");
  const data = await svc.signBrandingUpload({ kind, fileName });
  return res.json({ success: true, message: "Signed upload URL issued.", data });
});

const confirmBranding = run(async (req, res) => {
  const { kind, path } = req.body || {};
  if (!kind || !path) return badRequest(res, "kind and path are required.");
  const data = await svc.confirmBrandingUpload({ kind, path }, req.admin?.id);
  return res.json({ success: true, message: "Branding asset updated.", data });
});

module.exports = {
  getSettings, updateSettings, getLogs,
  enableMaintenance, disableMaintenance,
  testEmail,
  backup, restore,
  storageUsage,
  signBranding, confirmBranding,
};
