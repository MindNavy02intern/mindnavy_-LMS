// Integrations API — per INTEGRATIONS_CONTRACT.md. Real backend only, same
// fetch-wrapper convention as notificationsApi.ts.

import { getStoredToken } from '../api/adminAuth';
import { fetchWithRetry } from '../lib/fetchWithRetry';
import {
  IntegrationsApiError,
  type ActionResult,
  type ApiKey,
  type ApiKeyStatus,
  type CreateApiKeyRequest,
  type CreatedApiKey,
  type CreateWebhookRequest,
  type DataSync,
  type Integration,
  type IntegrationLogEntry,
  type IntegrationLogStatus,
  type IntegrationLogType,
  type IntegrationsAnalytics,
  type IntegrationsStats,
  type ListResponse,
  type SyncType,
  type Webhook,
  type WebhookTestResult,
} from '../types/integrations';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

async function integrationsFetch<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const token = getStoredToken();
  const res = await fetchWithRetry(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new IntegrationsApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok) {
    const msg =
      res.status === 429 ? 'Rate limited — slow down and retry.' :
      res.status === 503 ? 'Database not migrated yet. Run `npx prisma db push`.' :
      res.status === 500 ? 'Something went wrong on the server.' :
      json.message ?? (res.status === 404 ? 'Not found.' : `HTTP ${res.status}`);
    throw new IntegrationsApiError(res.status, msg, json.data as unknown as Record<string, unknown> | undefined);
  }

  return json.data as T;
}

// Some registry actions (connect/disconnect/test/sync trigger on COMING_SOON
// or unconfigured providers) return { success:false, message } with a 200 —
// not an error, a normal "not available yet" outcome. This variant returns
// the full envelope instead of throwing on success:false.
async function integrationsAction<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  body?: unknown,
): Promise<ActionResult<T>> {
  const token = getStoredToken();
  const res = await fetchWithRetry(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 401) throw new IntegrationsApiError(401, 'Unauthorized — please log in again.');
  let json: { success?: boolean; message?: string; data?: T } = {};
  try { json = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    const msg =
      res.status === 429 ? 'Rate limited — slow down and retry.' :
      res.status === 503 ? 'Database not migrated yet. Run `npx prisma db push`.' :
      json.message ?? `HTTP ${res.status}`;
    throw new IntegrationsApiError(res.status, msg);
  }
  return { success: json.success ?? true, message: json.message ?? '', data: json.data };
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, val] of Object.entries(params)) {
    if (val !== undefined && val !== '') q.set(k, String(val));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ── Stats / analytics ─────────────────────────────────────────────────────────

export function getIntegrationsStats(): Promise<IntegrationsStats> {
  return integrationsFetch<IntegrationsStats>('/integrations/stats');
}

export function getIntegrationsAnalytics(): Promise<IntegrationsAnalytics> {
  return integrationsFetch<IntegrationsAnalytics>('/integrations/analytics');
}

// ── Registry ───────────────────────────────────────────────────────────────────

export function listIntegrations(): Promise<Integration[]> {
  return integrationsFetch('/integrations');
}

export function getIntegration(slug: string): Promise<Integration> {
  return integrationsFetch(`/integrations/${encodeURIComponent(slug)}`);
}

export function connectIntegration(slug: string, config: Record<string, string> = {}): Promise<ActionResult<Integration>> {
  return integrationsAction(`/integrations/${encodeURIComponent(slug)}/connect`, 'PATCH', { config });
}

export function disconnectIntegration(slug: string): Promise<ActionResult<Integration>> {
  return integrationsAction(`/integrations/${encodeURIComponent(slug)}/disconnect`, 'PATCH');
}

export function testIntegration(slug: string): Promise<ActionResult<Record<string, unknown>>> {
  return integrationsAction(`/integrations/${encodeURIComponent(slug)}/test`, 'PATCH');
}

export function toggleIntegration(slug: string, isEnabled: boolean): Promise<Integration> {
  return integrationsFetch(`/integrations/${encodeURIComponent(slug)}/toggle`, 'PATCH', { isEnabled });
}

// ── API Keys ───────────────────────────────────────────────────────────────────

export interface ApiKeysListParams { status?: ApiKeyStatus; page?: number; limit?: number }

export function listApiKeys(params: ApiKeysListParams = {}): Promise<ListResponse<ApiKey>> {
  return integrationsFetch(`/integrations/api-keys${qs(params as Record<string, string | number | boolean | undefined>)}`);
}

export function generateApiKey(body: CreateApiKeyRequest): Promise<CreatedApiKey> {
  return integrationsFetch('/integrations/api-keys', 'POST', body);
}

export function revokeApiKey(id: string): Promise<ApiKey> {
  return integrationsFetch(`/integrations/api-keys/${encodeURIComponent(id)}/revoke`, 'PATCH');
}

export function deleteApiKey(id: string): Promise<{ id: string }> {
  return integrationsFetch(`/integrations/api-keys/${encodeURIComponent(id)}`, 'DELETE');
}

// ── Webhooks ───────────────────────────────────────────────────────────────────

export function listWebhooks(params: { page?: number; limit?: number } = {}): Promise<ListResponse<Webhook>> {
  return integrationsFetch(`/integrations/webhooks${qs(params as Record<string, string | number | boolean | undefined>)}`);
}

export function createWebhook(body: CreateWebhookRequest): Promise<Webhook> {
  return integrationsFetch('/integrations/webhooks', 'POST', body);
}

export function updateWebhook(id: string, body: Partial<CreateWebhookRequest>): Promise<Webhook> {
  return integrationsFetch(`/integrations/webhooks/${encodeURIComponent(id)}`, 'PATCH', body);
}

export function pauseWebhook(id: string): Promise<Webhook> {
  return integrationsFetch(`/integrations/webhooks/${encodeURIComponent(id)}/pause`, 'PATCH');
}

export function resumeWebhook(id: string): Promise<Webhook> {
  return integrationsFetch(`/integrations/webhooks/${encodeURIComponent(id)}/resume`, 'PATCH');
}

export function testWebhook(id: string): Promise<WebhookTestResult> {
  return integrationsFetch(`/integrations/webhooks/${encodeURIComponent(id)}/test`, 'PATCH');
}

export function deleteWebhook(id: string): Promise<{ id: string }> {
  return integrationsFetch(`/integrations/webhooks/${encodeURIComponent(id)}`, 'DELETE');
}

// ── Logs ───────────────────────────────────────────────────────────────────────

export interface LogsListParams {
  integrationId?: string; type?: IntegrationLogType; status?: IntegrationLogStatus;
  dateFrom?: string; dateTo?: string; page?: number; limit?: number;
}

export function listLogs(params: LogsListParams = {}): Promise<ListResponse<IntegrationLogEntry>> {
  return integrationsFetch(`/integrations/logs${qs(params as Record<string, string | number | boolean | undefined>)}`);
}

// ── Data Sync ──────────────────────────────────────────────────────────────────

export function listSyncs(params: { integrationId?: string; status?: string; page?: number; limit?: number } = {}): Promise<ListResponse<DataSync>> {
  return integrationsFetch(`/integrations/syncs${qs(params as Record<string, string | number | boolean | undefined>)}`);
}

export function getSync(id: string): Promise<DataSync> {
  return integrationsFetch(`/integrations/syncs/${encodeURIComponent(id)}`);
}

export function triggerSync(slug: string, syncType: SyncType): Promise<ActionResult<DataSync>> {
  return integrationsAction(`/integrations/syncs/${encodeURIComponent(slug)}/trigger`, 'POST', { syncType });
}
