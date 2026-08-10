const svc = require("../services/integrations.service");
const v = require("../validators/integrations.validator");

// ── Helpers (same shape as notifications.controller) ─────────────────────────

function badRequest(res, msg) { return res.status(400).json({ success: false, message: msg }); }
function notFound(res, msg = "Not found.") { return res.status(404).json({ success: false, message: msg }); }

function handleDomainError(res, err) {
  switch (err.code) {
    case "INTEGRATION_NOT_FOUND": return notFound(res, "Integration not found.");
    case "API_KEY_NOT_FOUND":     return notFound(res, "API key not found.");
    case "WEBHOOK_NOT_FOUND":     return notFound(res, "Webhook not found.");
    case "SYNC_NOT_FOUND":        return notFound(res, "Sync job not found.");
    default:                      return null;
  }
}

function serverError(res, err) {
  console.error("[IntegrationsController]", err);
  if (err.code === "P2025") return notFound(res, "Record not found.");
  if (err.code === "P2003") return badRequest(res, "Invalid reference: one or more IDs do not exist.");
  if (err.code === "P2021") return res.status(503).json({ success: false, message: "Database not migrated yet. Run `npx prisma db push`." });
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

// ── Stats / analytics ─────────────────────────────────────────────────────────

const getStats     = run(async (req, res) => res.json({ success: true, data: await svc.getStats() }));
const getAnalytics = run(async (req, res) => res.json({ success: true, data: await svc.getAnalytics() }));

// ── Registry ───────────────────────────────────────────────────────────────────

const listIntegrations = run(async (req, res) => res.json({ success: true, data: await svc.listIntegrations() }));

const getIntegration = run(async (req, res) => {
  const idErr = v.validateId(req.params.slug, "slug");
  if (idErr) return badRequest(res, idErr);
  res.json({ success: true, data: await svc.getIntegration(req.params.slug) });
});

const connectIntegration = run(async (req, res) => {
  const parsed = v.validateConnect(req.body);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  const result = await svc.connectIntegration(req.params.slug, parsed.data.config, req.admin?.id);
  res.json(result);
});

const disconnectIntegration = run(async (req, res) => {
  const result = await svc.disconnectIntegration(req.params.slug, req.admin?.id);
  res.json(result);
});

const testIntegration = run(async (req, res) => {
  const result = await svc.testIntegration(req.params.slug);
  res.json(result);
});

const toggleIntegration = run(async (req, res) => {
  const parsed = v.validateToggle(req.body);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  const data = await svc.toggleIntegration(req.params.slug, parsed.data.isEnabled, req.admin?.id);
  res.json({ success: true, data });
});

// ── API Keys ───────────────────────────────────────────────────────────────────

const listApiKeys = run(async (req, res) => {
  const parsed = v.validateApiKeysQuery(req.query);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  res.json({ success: true, data: await svc.listApiKeys(parsed.data) });
});

const generateApiKey = run(async (req, res) => {
  const parsed = v.validateApiKeyCreate(req.body);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  const data = await svc.generateApiKey(parsed.data, req.admin?.id);
  res.status(201).json({ success: true, message: "API key generated. Copy it now — it won't be shown again.", data });
});

const revokeApiKey = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "id");
  if (idErr) return badRequest(res, idErr);
  const data = await svc.revokeApiKey(req.params.id, req.admin?.id);
  res.json({ success: true, message: "API key revoked.", data });
});

const deleteApiKey = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "id");
  if (idErr) return badRequest(res, idErr);
  const data = await svc.deleteApiKey(req.params.id, req.admin?.id);
  res.json({ success: true, message: "API key deleted.", data });
});

// ── Webhooks ───────────────────────────────────────────────────────────────────

const listWebhooks = run(async (req, res) => {
  const parsed = v.validatePageQuery(req.query);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  res.json({ success: true, data: await svc.listWebhooks(parsed.data) });
});

const createWebhook = run(async (req, res) => {
  const parsed = v.validateWebhookCreate(req.body);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  const data = await svc.createWebhook(parsed.data, req.admin?.id);
  res.status(201).json({ success: true, message: "Webhook created.", data });
});

const updateWebhook = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "id");
  if (idErr) return badRequest(res, idErr);
  const parsed = v.validateWebhookUpdate(req.body);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  const data = await svc.updateWebhook(req.params.id, parsed.data, req.admin?.id);
  res.json({ success: true, message: "Webhook updated.", data });
});

const pauseWebhook = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "id");
  if (idErr) return badRequest(res, idErr);
  const data = await svc.setWebhookStatus(req.params.id, "PAUSED", req.admin?.id);
  res.json({ success: true, message: "Webhook paused.", data });
});

const resumeWebhook = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "id");
  if (idErr) return badRequest(res, idErr);
  const data = await svc.setWebhookStatus(req.params.id, "ACTIVE", req.admin?.id);
  res.json({ success: true, message: "Webhook resumed.", data });
});

const testWebhook = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "id");
  if (idErr) return badRequest(res, idErr);
  const data = await svc.testWebhook(req.params.id, req.admin?.id);
  res.json({ success: data.success, message: data.message, data });
});

const deleteWebhook = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "id");
  if (idErr) return badRequest(res, idErr);
  const data = await svc.deleteWebhook(req.params.id, req.admin?.id);
  res.json({ success: true, message: "Webhook deleted.", data });
});

// ── Logs ───────────────────────────────────────────────────────────────────────

const listLogs = run(async (req, res) => {
  const parsed = v.validateLogsQuery(req.query);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  res.json({ success: true, data: await svc.listLogs(parsed.data) });
});

// ── Data Sync ──────────────────────────────────────────────────────────────────

const listSyncs = run(async (req, res) => {
  const parsed = v.validatePageQuery(req.query);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  const { integrationId, status } = req.query;
  res.json({ success: true, data: await svc.listSyncs({ ...parsed.data, integrationId, status }) });
});

const getSyncById = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "id");
  if (idErr) return badRequest(res, idErr);
  res.json({ success: true, data: await svc.getSync(req.params.id) });
});

const triggerSync = run(async (req, res) => {
  const parsed = v.validateSyncTrigger(req.body);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  const result = await svc.triggerSync(req.params.integrationSlug, parsed.data.syncType, req.admin?.id);
  res.json(result);
});

module.exports = {
  getStats,
  getAnalytics,
  listIntegrations,
  getIntegration,
  connectIntegration,
  disconnectIntegration,
  testIntegration,
  toggleIntegration,
  listApiKeys,
  generateApiKey,
  revokeApiKey,
  deleteApiKey,
  listWebhooks,
  createWebhook,
  updateWebhook,
  pauseWebhook,
  resumeWebhook,
  testWebhook,
  deleteWebhook,
  listLogs,
  listSyncs,
  getSyncById,
  triggerSync,
};
