const crypto = require("crypto");
const prisma = require("../config/prisma");
const zoomProvider = require("./meetings/zoomProvider");
const supabaseProvider = require("./storage/supabaseProvider");
const { isMailerConfigured, verifyTransport } = require("../utils/mailer");

// ── Integrations service ─────────────────────────────────────────────────────
//
// This module is a REGISTRY, not a reimplementation. Zoom (meetings/zoomProvider)
// and Supabase Storage (storage/supabaseProvider) already have real working
// adapters elsewhere in this codebase — this file reads their isConfigured()/
// testConnection() and never duplicates their auth/API logic. SMTP is the same,
// via utils/mailer's isMailerConfigured()/verifyTransport().
//
// Every other catalog entry (Stripe, Twilio, SendGrid, SSO, HR/ERP, CRM…) has
// no backing provider at all and stays COMING_SOON forever — connect/test/sync
// on those return { success:false, message } WITHOUT ever touching a fake API,
// per the task's explicit rule.
//
// "status" is never trusted as stored — it's derived live in mapIntegration()
// from isConfigured()+isEnabled+lastError so the row always reflects reality
// (CONNECTED integrations show real status, IMPACT_MAP §5.15 rule), even if a
// COMING_SOON row row.status is a static catalog default with no live equivalent.
//
// integrationId on IntegrationLog is a plain string (no relation() — same
// convention as NotificationLog.sourceId, see notifications.prisma header):
// for API_CALL/AUTH/ERROR logs it's the Integration catalog row id; for SYNC
// logs it's the DataSync's integration's row id; for WEBHOOK logs there is no
// catalog row (webhooks are user-defined, not tied to a catalog provider) so
// it stores the Webhook's own id instead — same "different entity types share
// one loosely-typed reference column" pattern NotificationLog already uses.

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[integrations.service] query failed:", err.message);
    return fallback;
  }
}

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }
function domainError(code) { return Object.assign(new Error(code), { code }); }

async function auditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: adminId ?? null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

function metric(value, changePercent = null) { return { value, changePercent, available: true }; }
function unavailable(reason) { return { value: null, changePercent: null, available: false, reason }; }

function paginate({ page, limit }) {
  return { skip: (page - 1) * limit, take: limit };
}

// ── Catalog seed (task spec, verbatim slugs/categories/status) ──────────────────

// zoom/supabase/smtp-email seed isEnabled:true — computeLiveStatus() still
// requires provider.isConfigured() on top of this, so isEnabled alone can't
// fake a CONNECTED status; it only means "don't require a manual Connect
// click for a provider that's already wired via .env", matching the task's
// "Zoom is ALREADY integrated" framing.
const CATALOG = [
  { slug: "zoom",             name: "Zoom",                 category: "VIDEO",   status: "CONNECTED", isEnabled: true },
  { slug: "supabase",         name: "Supabase Storage",     category: "STORAGE", status: "CONNECTED", isEnabled: true },
  { slug: "smtp-email",       name: "Email (SMTP)",         category: "EMAIL",   status: "CONNECTED", isEnabled: true },
  { slug: "stripe",           name: "Stripe",                category: "PAYMENT", status: "COMING_SOON" },
  { slug: "paypal",           name: "PayPal",                category: "PAYMENT", status: "COMING_SOON" },
  { slug: "twilio",           name: "Twilio SMS",            category: "SMS",     status: "COMING_SOON" },
  { slug: "sendgrid",         name: "SendGrid",              category: "EMAIL",   status: "COMING_SOON" },
  { slug: "google-oauth",     name: "Google OAuth",          category: "AUTH",    status: "COMING_SOON" },
  { slug: "microsoft-azure",  name: "Microsoft Azure AD",    category: "AUTH",    status: "COMING_SOON" },
  { slug: "okta",             name: "Okta SSO",               category: "AUTH",    status: "COMING_SOON" },
  { slug: "salesforce",       name: "Salesforce CRM",         category: "CRM",     status: "COMING_SOON" },
  { slug: "hubspot",          name: "HubSpot",                category: "CRM",     status: "COMING_SOON" },
  { slug: "sap",              name: "SAP HR",                 category: "HR_ERP",  status: "COMING_SOON" },
  { slug: "bamboohr",         name: "BambooHR",               category: "HR_ERP",  status: "COMING_SOON" },
  { slug: "aws-s3",           name: "AWS S3",                  category: "STORAGE", status: "COMING_SOON" },
  { slug: "google-drive",     name: "Google Drive",            category: "STORAGE", status: "COMING_SOON" },
];

// Real adapters, keyed by catalog slug. Anything not in this map is a pure UI
// catalog entry with no backing system — connect/disconnect/test/sync all
// short-circuit to the "Configure API keys to activate" response for those.
const REAL_PROVIDERS = {
  zoom:         zoomProvider,
  supabase:     supabaseProvider,
  "smtp-email": { isConfigured: isMailerConfigured, testConnection: verifyTransport },
};

const ENV_HINTS = {
  zoom:         "ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET",
  supabase:     "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
  "smtp-email": "SMTP_HOST / SMTP_USER / SMTP_PASS",
};

let seeded = false;
async function ensureCatalogSeeded() {
  if (seeded) return;
  await safe(() => prisma.integration.createMany({ data: CATALOG, skipDuplicates: true }), null);
  seeded = true;
}

async function mustFindIntegration(slug) {
  await ensureCatalogSeeded();
  const row = await prisma.integration.findUnique({ where: { slug } });
  if (!row) throw domainError("INTEGRATION_NOT_FOUND");
  return row;
}

function computeLiveStatus(row) {
  const provider = REAL_PROVIDERS[row.slug];
  if (!provider) return row.status; // pure catalog entry — no live signal to derive from
  if (!provider.isConfigured()) return "DISCONNECTED";
  if (!row.isEnabled) return "DISCONNECTED";
  if (row.lastError) return "ERROR";
  return "CONNECTED";
}

function mapIntegration(row) {
  return {
    id:            row.id,
    name:          row.name,
    slug:          row.slug,
    category:      row.category,
    status:        computeLiveStatus(row),
    hasProvider:   Boolean(REAL_PROVIDERS[row.slug]),
    config:        row.config ?? null,
    lastSyncAt:    iso(row.lastSyncAt),
    lastError:     row.lastError ?? null,
    isEnabled:     row.isEnabled,
    connectedById: row.connectedById ?? null,
    connectedAt:   iso(row.connectedAt),
    createdAt:     iso(row.createdAt),
    updatedAt:     iso(row.updatedAt),
  };
}

function sanitizeConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) return null;
  const keys = Object.keys(config);
  if (keys.length === 0) return null;
  // Values are NEVER persisted, regardless of what the caller sent — only
  // field names, forced to a masked placeholder server-side (defense in
  // depth beyond trusting the client to have already masked them).
  return Object.fromEntries(keys.map((k) => [k, "***masked***"]));
}

async function logEvent(integrationId, type, status, extra = {}) {
  await safe(() => prisma.integrationLog.create({
    data: {
      integrationId,
      type,
      status,
      method:       extra.method ?? null,
      endpoint:     extra.endpoint ?? null,
      responseCode: extra.responseCode ?? null,
      durationMs:   extra.durationMs ?? null,
      metadata:     extra.metadata ?? null,
    },
  }), null);
}

// ── Registry ───────────────────────────────────────────────────────────────────

async function listIntegrations() {
  await ensureCatalogSeeded();
  const rows = await safe(() => prisma.integration.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }), []);
  return rows.map(mapIntegration);
}

async function getIntegration(slug) {
  const row = await mustFindIntegration(slug);
  return mapIntegration(row);
}

async function connectIntegration(slug, config, adminId) {
  const row = await mustFindIntegration(slug);
  const provider = REAL_PROVIDERS[slug];
  if (!provider) return { success: false, message: "Configure API keys to activate." };

  if (!provider.isConfigured()) {
    return { success: false, message: `${row.name} requires ${ENV_HINTS[slug]} in backend/.env before it can connect.` };
  }

  const updated = await prisma.integration.update({
    where: { slug },
    data: {
      isEnabled:     true,
      connectedAt:   new Date(),
      connectedById: adminId ?? null,
      lastError:     null,
      config:        sanitizeConfig(config),
    },
  });
  await logEvent(updated.id, "AUTH", "SUCCESS", { method: "PATCH", endpoint: `/integrations/${slug}/connect` });
  await auditLog(adminId, "INTEGRATION_CONNECTED", { slug });
  return { success: true, message: `${row.name} connected.`, data: mapIntegration(updated) };
}

async function disconnectIntegration(slug, adminId) {
  const row = await mustFindIntegration(slug);
  const provider = REAL_PROVIDERS[slug];
  if (!provider) return { success: false, message: "Configure API keys to activate." };

  const updated = await prisma.integration.update({
    where: { slug },
    data: { isEnabled: false, connectedAt: null, connectedById: null },
  });
  await logEvent(updated.id, "AUTH", "SUCCESS", { method: "PATCH", endpoint: `/integrations/${slug}/disconnect` });
  await auditLog(adminId, "INTEGRATION_DISCONNECTED", { slug });
  return { success: true, message: `${row.name} disconnected.`, data: mapIntegration(updated) };
}

async function testIntegration(slug) {
  const row = await mustFindIntegration(slug);
  const provider = REAL_PROVIDERS[slug];
  if (!provider) return { success: false, message: "Configure API keys to activate." };
  if (!provider.isConfigured()) {
    return { success: false, message: `${row.name} requires ${ENV_HINTS[slug]} in backend/.env.` };
  }

  const start = Date.now();
  try {
    const result = await provider.testConnection();
    const durationMs = Date.now() - start;
    await logEvent(row.id, "API_CALL", "SUCCESS", { method: "GET", endpoint: `/integrations/${slug}/test`, durationMs });
    await safe(() => prisma.integration.update({ where: { slug }, data: { lastError: null, lastSyncAt: new Date() } }), null);
    return { success: true, message: "Connection successful.", data: result ?? {} };
  } catch (err) {
    const durationMs = Date.now() - start;
    await logEvent(row.id, "API_CALL", "FAILED", { method: "GET", endpoint: `/integrations/${slug}/test`, durationMs, metadata: { error: err.message } });
    await safe(() => prisma.integration.update({ where: { slug }, data: { lastError: err.message } }), null);
    return { success: false, message: err.message };
  }
}

async function toggleIntegration(slug, isEnabled, adminId) {
  const row = await mustFindIntegration(slug);
  const updated = await prisma.integration.update({ where: { slug }, data: { isEnabled } });
  await logEvent(updated.id, "AUTH", "SUCCESS", { method: "PATCH", endpoint: `/integrations/${slug}/toggle`, metadata: { isEnabled } });
  await auditLog(adminId, "INTEGRATION_TOGGLED", { slug, isEnabled });
  void row;
  return mapIntegration(updated);
}

// ── Stats / analytics ──────────────────────────────────────────────────────────

async function getStats() {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const integrations = await listIntegrations();
  const activeCount = integrations.filter((i) => i.status === "CONNECTED").length;
  const errorCount  = integrations.filter((i) => i.status === "ERROR").length;

  const realSlugs = Object.keys(REAL_PROVIDERS);
  const connectedRealCount = integrations.filter((i) => REAL_PROVIDERS[i.slug] && i.status === "CONNECTED").length;
  const healthScore = realSlugs.length ? Math.round((connectedRealCount / realSlugs.length) * 100) : null;

  const [apiUsageToday, webhookActivityToday, syncsToday] = await Promise.all([
    safe(() => prisma.integrationLog.count({ where: { type: "API_CALL", createdAt: { gte: startToday } } }), 0),
    safe(() => prisma.integrationLog.count({ where: { type: "WEBHOOK", createdAt: { gte: startToday } } }), 0),
    safe(() => prisma.dataSync.count({ where: { startedAt: { gte: startToday } } }), 0),
  ]);

  return {
    activeIntegrations: metric(activeCount),
    failedConnections:  metric(errorCount),
    apiUsageToday:       metric(apiUsageToday),
    webhookActivity:     metric(webhookActivityToday),
    syncStatus:          metric(syncsToday),
    healthScore:         healthScore === null ? unavailable("No real providers configured yet.") : metric(healthScore),
  };
}

async function getAnalytics() {
  const now = new Date();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push(d);
  }
  const labels = days.map((d) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
  const values = await Promise.all(days.map((d) => {
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return safe(() => prisma.integrationLog.count({ where: { type: "API_CALL", createdAt: { gte: d, lt: next } } }), 0);
  }));
  // Same 7-day shape as apiUsageTrend, WEBHOOK type — backs the Dashboard
  // tab's "Webhook Activity" bar chart (daily call volume, not just a rate).
  const webhookValues = await Promise.all(days.map((d) => {
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    return safe(() => prisma.integrationLog.count({ where: { type: "WEBHOOK", createdAt: { gte: d, lt: next } } }), 0);
  }));

  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [webhookTotal, webhookSuccess] = await Promise.all([
    safe(() => prisma.integrationLog.count({ where: { type: "WEBHOOK", createdAt: { gte: since30d } } }), 0),
    safe(() => prisma.integrationLog.count({ where: { type: "WEBHOOK", status: "SUCCESS", createdAt: { gte: since30d } } }), 0),
  ]);
  const webhookSuccessRate = webhookTotal > 0
    ? metric(Math.round((webhookSuccess / webhookTotal) * 100))
    : unavailable("No webhook activity in the last 30 days.");

  // orderBy must reference the SAME field named in _count (Prisma requires
  // the aggregate shape to match) — _count.integrationId here, not _all.
  const topGroups = await safe(() => prisma.integrationLog.groupBy({
    by: ["integrationId"],
    where: { createdAt: { gte: since30d } },
    _count: { integrationId: true },
    orderBy: { _count: { integrationId: "desc" } },
    take: 5,
  }), []);
  let topIntegrations;
  if (topGroups.length === 0) {
    topIntegrations = { available: false, reason: "No usage recorded in the last 30 days.", items: [] };
  } else {
    const integrations = await safe(() => prisma.integration.findMany({ where: { id: { in: topGroups.map((g) => g.integrationId) } } }), []);
    const byId = new Map(integrations.map((i) => [i.id, i]));
    topIntegrations = {
      available: true,
      items: topGroups.map((g) => ({
        id: g.integrationId,
        name: byId.get(g.integrationId)?.name ?? "Unknown",
        slug: byId.get(g.integrationId)?.slug ?? null,
        count: g._count.integrationId,
      })),
    };
  }

  const errorGroups = await safe(() => prisma.integrationLog.groupBy({
    by: ["type"],
    where: { status: "FAILED", createdAt: { gte: since30d } },
    _count: { _all: true },
  }), []);
  const errorBreakdown = errorGroups.length === 0
    ? { available: false, reason: "No errors in the last 30 days.", items: [] }
    : { available: true, items: errorGroups.map((g) => ({ type: g.type, count: g._count._all })) };

  return {
    apiUsageTrend: { labels, values },
    webhookActivityTrend: { labels, values: webhookValues },
    webhookSuccessRate,
    topIntegrations,
    errorBreakdown,
  };
}

// ── API Keys ───────────────────────────────────────────────────────────────────

const KEY_PREFIX_LEN = 12; // "mk_live_" (8) + 4 chars of the random suffix — enough to visually tell keys apart

function mapApiKey(row) {
  return {
    id:          row.id,
    name:        row.name,
    description: row.description ?? null,
    keyPrefix:   `${row.keyPrefix}…`,
    permissions: row.permissions,
    status:      row.status,
    lastUsedAt:  iso(row.lastUsedAt),
    expiresAt:   iso(row.expiresAt),
    createdById: row.createdById ?? null,
    createdAt:   iso(row.createdAt),
    revokedAt:   iso(row.revokedAt),
  };
}

async function listApiKeys({ status, page, limit }) {
  const where = status ? { status } : {};
  const [items, total] = await Promise.all([
    safe(() => prisma.apiKey.findMany({ where, orderBy: { createdAt: "desc" }, ...paginate({ page, limit }) }), []),
    safe(() => prisma.apiKey.count({ where }), 0),
  ]);
  return { items: items.map(mapApiKey), total, page, limit };
}

async function generateApiKey({ name, description, permissions, expiresAt }, adminId) {
  const raw = crypto.randomBytes(24).toString("hex");
  const fullKey = `mk_live_${raw}`;
  const keyHash = crypto.createHash("sha256").update(fullKey).digest("hex");
  const keyPrefix = fullKey.slice(0, KEY_PREFIX_LEN);

  const created = await prisma.apiKey.create({
    data: { name, description, keyHash, keyPrefix, permissions, expiresAt, createdById: adminId ?? null },
  });
  await auditLog(adminId, "API_KEY_GENERATED", { apiKeyId: created.id, name });
  // Full key is returned ONCE — never persisted or logged anywhere else.
  return { ...mapApiKey(created), key: fullKey };
}

async function revokeApiKey(id, adminId) {
  const row = await prisma.apiKey.findUnique({ where: { id } });
  if (!row) throw domainError("API_KEY_NOT_FOUND");
  const updated = await prisma.apiKey.update({ where: { id }, data: { status: "REVOKED", revokedAt: new Date() } });
  await auditLog(adminId, "API_KEY_REVOKED", { apiKeyId: id });
  return mapApiKey(updated);
}

async function deleteApiKey(id, adminId) {
  const row = await prisma.apiKey.findUnique({ where: { id } });
  if (!row) throw domainError("API_KEY_NOT_FOUND");
  await prisma.apiKey.delete({ where: { id } });
  await auditLog(adminId, "API_KEY_DELETED", { apiKeyId: id, name: row.name });
  return { id };
}

// ── Webhooks ───────────────────────────────────────────────────────────────────

function mapWebhook(row, { revealSecret = false } = {}) {
  return {
    id:               row.id,
    name:             row.name,
    url:              row.url,
    secret:           revealSecret ? row.secret : `${row.secret.slice(0, 6)}••••••••`,
    events:           row.events,
    status:           row.status,
    lastTriggeredAt:  iso(row.lastTriggeredAt),
    lastResponseCode: row.lastResponseCode ?? null,
    failureCount:     row.failureCount,
    createdById:      row.createdById ?? null,
    createdAt:        iso(row.createdAt),
    updatedAt:        iso(row.updatedAt),
  };
}

async function listWebhooks({ page, limit }) {
  const [items, total] = await Promise.all([
    safe(() => prisma.webhook.findMany({ orderBy: { createdAt: "desc" }, ...paginate({ page, limit }) }), []),
    safe(() => prisma.webhook.count(), 0),
  ]);
  return { items: items.map((r) => mapWebhook(r)), total, page, limit };
}

async function createWebhook({ name, url, events, secret }, adminId) {
  const finalSecret = secret ?? crypto.randomBytes(24).toString("hex");
  const created = await prisma.webhook.create({ data: { name, url, events, secret: finalSecret, createdById: adminId ?? null } });
  await auditLog(adminId, "WEBHOOK_CREATED", { webhookId: created.id, name });
  return mapWebhook(created, { revealSecret: true });
}

async function updateWebhook(id, data, adminId) {
  const row = await prisma.webhook.findUnique({ where: { id } });
  if (!row) throw domainError("WEBHOOK_NOT_FOUND");
  const updated = await prisma.webhook.update({ where: { id }, data });
  await auditLog(adminId, "WEBHOOK_UPDATED", { webhookId: id, fields: Object.keys(data) });
  return mapWebhook(updated);
}

async function setWebhookStatus(id, status, adminId) {
  const row = await prisma.webhook.findUnique({ where: { id } });
  if (!row) throw domainError("WEBHOOK_NOT_FOUND");
  const updated = await prisma.webhook.update({ where: { id }, data: { status } });
  await auditLog(adminId, status === "PAUSED" ? "WEBHOOK_PAUSED" : "WEBHOOK_RESUMED", { webhookId: id });
  return mapWebhook(updated);
}

async function deleteWebhook(id, adminId) {
  const row = await prisma.webhook.findUnique({ where: { id } });
  if (!row) throw domainError("WEBHOOK_NOT_FOUND");
  await prisma.webhook.delete({ where: { id } });
  await auditLog(adminId, "WEBHOOK_DELETED", { webhookId: id, name: row.name });
  return { id };
}

const WEBHOOK_TEST_TIMEOUT_MS = 10000;

async function testWebhook(id, adminId) {
  const row = await prisma.webhook.findUnique({ where: { id } });
  if (!row) throw domainError("WEBHOOK_NOT_FOUND");

  const payload = {
    event: "webhook.test",
    timestamp: new Date().toISOString(),
    data: { message: "This is a test event from MindNavy LMS." },
  };
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", row.secret).update(body).digest("hex");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TEST_TIMEOUT_MS);
  const start = Date.now();
  let responseCode = null;
  let ok = false;
  let message = "";
  try {
    const res = await fetch(row.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-MindNavy-Signature": signature, "X-MindNavy-Event": payload.event },
      body,
      signal: controller.signal,
    });
    responseCode = res.status;
    ok = res.ok;
    message = ok ? `Received HTTP ${res.status}.` : `Endpoint responded with HTTP ${res.status}.`;
  } catch (err) {
    message = err.name === "AbortError" ? "Webhook endpoint timed out." : `Webhook endpoint unreachable: ${err.message}`;
  } finally {
    clearTimeout(timer);
  }
  const durationMs = Date.now() - start;

  // A PAUSED webhook stays paused regardless of test outcome — Test and
  // Resume are separate actions (separate buttons), so a successful test
  // must never silently un-pause it. Outside PAUSED, success clears the
  // failure streak and heals FAILED back to ACTIVE; failure escalates to
  // FAILED after 5 consecutive misses.
  const nextStatus = row.status === "PAUSED"
    ? "PAUSED"
    : ok ? "ACTIVE" : (row.failureCount + 1 >= 5 ? "FAILED" : row.status);
  const updated = await prisma.webhook.update({
    where: { id },
    data: {
      lastTriggeredAt: new Date(),
      lastResponseCode: responseCode,
      failureCount: ok ? 0 : { increment: 1 },
      status: nextStatus,
    },
  });
  await logEvent(row.id, "WEBHOOK", ok ? "SUCCESS" : "FAILED", { method: "POST", endpoint: row.url, responseCode, durationMs });
  await auditLog(adminId, "WEBHOOK_TESTED", { webhookId: id, ok, responseCode });

  return { success: ok, message, responseCode, durationMs, payload, webhook: mapWebhook(updated) };
}

// ── Logs ───────────────────────────────────────────────────────────────────────

async function listLogs({ integrationId, type, status, dateFrom, dateTo, page, limit }) {
  const where = {
    ...(integrationId ? { integrationId } : {}),
    ...(type ? { type } : {}),
    ...(status ? { status } : {}),
    ...((dateFrom || dateTo) ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
  };
  const [items, total] = await Promise.all([
    safe(() => prisma.integrationLog.findMany({ where, orderBy: { createdAt: "desc" }, ...paginate({ page, limit }) }), []),
    safe(() => prisma.integrationLog.count({ where }), 0),
  ]);

  // integrationId is a loose reference (see header) — resolve a display label
  // by checking both the Integration catalog and the Webhook table.
  const ids = [...new Set(items.map((i) => i.integrationId))];
  const [integrations, webhooks] = await Promise.all([
    safe(() => prisma.integration.findMany({ where: { id: { in: ids } } }), []),
    safe(() => prisma.webhook.findMany({ where: { id: { in: ids } } }), []),
  ]);
  const intByI = new Map(integrations.map((i) => [i.id, i.name]));
  const webhookById = new Map(webhooks.map((w) => [w.id, w.name]));

  return {
    items: items.map((row) => ({
      id:              row.id,
      integrationId:   row.integrationId,
      integrationName: intByI.get(row.integrationId) ?? webhookById.get(row.integrationId) ?? "Unknown",
      type:            row.type,
      status:          row.status,
      method:          row.method ?? null,
      endpoint:        row.endpoint ?? null,
      responseCode:    row.responseCode ?? null,
      durationMs:      row.durationMs ?? null,
      metadata:        row.metadata ?? null,
      createdAt:       iso(row.createdAt),
    })),
    total,
    page,
    limit,
  };
}

// ── Data Sync ──────────────────────────────────────────────────────────────────

function mapSync(row) {
  return {
    id:               row.id,
    integrationId:    row.integrationId,
    syncType:         row.syncType,
    status:           row.status,
    totalRecords:     row.totalRecords,
    processedRecords: row.processedRecords,
    failedRecords:    row.failedRecords,
    startedAt:        iso(row.startedAt),
    completedAt:      iso(row.completedAt),
    errorLog:         row.errorLog ?? null,
    createdAt:        iso(row.createdAt),
  };
}

async function listSyncs({ integrationId, status, page, limit }) {
  const where = { ...(integrationId ? { integrationId } : {}), ...(status ? { status } : {}) };
  const [items, total] = await Promise.all([
    safe(() => prisma.dataSync.findMany({ where, orderBy: { startedAt: "desc" }, ...paginate({ page, limit }) }), []),
    safe(() => prisma.dataSync.count({ where }), 0),
  ]);
  const ids = [...new Set(items.map((i) => i.integrationId))];
  const integrations = await safe(() => prisma.integration.findMany({ where: { id: { in: ids } } }), []);
  const nameById = new Map(integrations.map((i) => [i.id, i.name]));
  return { items: items.map((r) => ({ ...mapSync(r), integrationName: nameById.get(r.integrationId) ?? "Unknown" })), total, page, limit };
}

async function getSync(id) {
  const row = await prisma.dataSync.findUnique({ where: { id } });
  if (!row) throw domainError("SYNC_NOT_FOUND");
  return mapSync(row);
}

const SYNC_COUNTERS = {
  users:       () => prisma.appUser.count(),
  courses:     () => prisma.course.count(),
  departments: () => prisma.department.count(),
};

// No job queue in this codebase (see server.js's setInterval sweeps) — a
// triggered sync completes itself shortly after via a one-shot timer instead
// of a real worker, same "best-effort background work, never blocks the
// request" shape as those sweeps.
async function triggerSync(slug, syncType, adminId) {
  const row = await mustFindIntegration(slug);
  const liveStatus = computeLiveStatus(row);
  if (!REAL_PROVIDERS[slug]) return { success: false, message: "Configure API keys to activate." };
  if (liveStatus !== "CONNECTED") return { success: false, message: `${row.name} must be connected before syncing.` };

  const totalRecords = await safe(SYNC_COUNTERS[syncType] ?? (() => Promise.resolve(0)), 0);
  const sync = await prisma.dataSync.create({
    data: { integrationId: row.id, syncType, status: "RUNNING", totalRecords, startedAt: new Date() },
  });
  await logEvent(row.id, "SYNC", "PENDING", { endpoint: `/integrations/${slug}/syncs/trigger`, metadata: { syncType } });
  await safe(() => prisma.integration.update({ where: { slug }, data: { lastSyncAt: new Date() } }), null);
  await auditLog(adminId, "DATA_SYNC_TRIGGERED", { slug, syncType, syncId: sync.id });

  const timer = setTimeout(() => {
    prisma.dataSync.update({
      where: { id: sync.id },
      data: { status: "COMPLETED", processedRecords: totalRecords, completedAt: new Date() },
    }).then(() => logEvent(row.id, "SYNC", "SUCCESS", { endpoint: `/integrations/${slug}/syncs/${sync.id}`, metadata: { syncType, totalRecords } }))
      .catch((err) => console.error("[integrations.service] sync completion failed:", err.message));
  }, 1500);
  timer.unref();

  return { success: true, message: "Sync started.", data: mapSync(sync) };
}

module.exports = {
  listIntegrations,
  getIntegration,
  connectIntegration,
  disconnectIntegration,
  testIntegration,
  toggleIntegration,
  getStats,
  getAnalytics,
  listApiKeys,
  generateApiKey,
  revokeApiKey,
  deleteApiKey,
  listWebhooks,
  createWebhook,
  updateWebhook,
  setWebhookStatus,
  deleteWebhook,
  testWebhook,
  listLogs,
  listSyncs,
  getSync,
  triggerSync,
};
