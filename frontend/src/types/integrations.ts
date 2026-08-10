// Integrations — types per INTEGRATIONS_CONTRACT.md. Field names mirror the
// backend response shapes 1:1 (integrations.service.js / .controller.js),
// same convention as types/notifications.ts.

export class IntegrationsApiError extends Error {
  status: number;
  data?: Record<string, unknown>;
  constructor(status: number, message: string, data?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'IntegrationsApiError';
  }
}

export type Metric = {
  value: number | null;
  changePercent: number | null;
  available: boolean;
  reason?: string;
};

export type IntegrationCategory = 'PAYMENT' | 'VIDEO' | 'EMAIL' | 'SMS' | 'HR_ERP' | 'CRM' | 'STORAGE' | 'AUTH' | 'OTHER';
export type IntegrationStatus = 'CONNECTED' | 'DISCONNECTED' | 'ERROR' | 'PENDING' | 'COMING_SOON';
export type ApiKeyStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';
export type WebhookStatus = 'ACTIVE' | 'PAUSED' | 'FAILED';
export type IntegrationLogType = 'API_CALL' | 'WEBHOOK' | 'SYNC' | 'AUTH' | 'ERROR';
export type IntegrationLogStatus = 'SUCCESS' | 'FAILED' | 'PENDING';
export type DataSyncStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'PAUSED';

export const API_KEY_PERMISSIONS = [
  'read:users', 'write:users',
  'read:courses', 'write:courses',
  'read:enrollments', 'write:enrollments',
  'read:certificates', 'write:certificates',
  'read:finance', 'write:finance',
  'read:reports',
  'read:notifications', 'write:notifications',
  'admin:all',
] as const;

export const WEBHOOK_EVENTS = [
  'user.registered', 'user.suspended',
  'course.created', 'course.published', 'course.completed',
  'enrollment.created', 'enrollment.cancelled',
  'certificate.issued', 'certificate.revoked',
  'payment.succeeded', 'payment.failed',
  'live_session.created', 'live_session.completed',
] as const;

export const SYNC_TYPES = ['users', 'courses', 'departments'] as const;
export type SyncType = typeof SYNC_TYPES[number];

export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ── Stats (Dashboard tab, 6 cards) ────────────────────────────────────────────

export interface IntegrationsStats {
  activeIntegrations: Metric;
  failedConnections: Metric;
  apiUsageToday: Metric;
  webhookActivity: Metric;
  syncStatus: Metric;
  healthScore: Metric;
}

export interface IntegrationsAnalytics {
  apiUsageTrend: { labels: string[]; values: number[] };
  webhookActivityTrend: { labels: string[]; values: number[] };
  webhookSuccessRate: Metric;
  topIntegrations: { available: boolean; reason?: string; items: { id: string; name: string; slug: string | null; count: number }[] };
  errorBreakdown: { available: boolean; reason?: string; items: { type: IntegrationLogType; count: number }[] };
}

// ── Registry ───────────────────────────────────────────────────────────────────

export interface Integration {
  id: string;
  name: string;
  slug: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  hasProvider: boolean;
  config: Record<string, string> | null;
  lastSyncAt: string | null;
  lastError: string | null;
  isEnabled: boolean;
  connectedById: string | null;
  connectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActionResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

// ── API Keys ───────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  name: string;
  description: string | null;
  keyPrefix: string;
  permissions: string[];
  status: ApiKeyStatus;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdById: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface CreateApiKeyRequest {
  name: string;
  description?: string;
  permissions: string[];
  expiresAt?: string;
}

export interface CreatedApiKey extends ApiKey {
  key: string; // shown ONCE
}

// ── Webhooks ───────────────────────────────────────────────────────────────────

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string; // masked unless just-created
  events: string[];
  status: WebhookStatus;
  lastTriggeredAt: string | null;
  lastResponseCode: number | null;
  failureCount: number;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookRequest {
  name: string;
  url: string;
  events: string[];
  secret?: string;
}

export interface WebhookTestResult {
  success: boolean;
  message: string;
  responseCode: number | null;
  durationMs: number;
  payload: Record<string, unknown>;
  webhook: Webhook;
}

// ── Logs ───────────────────────────────────────────────────────────────────────

export interface IntegrationLogEntry {
  id: string;
  integrationId: string;
  integrationName: string;
  type: IntegrationLogType;
  status: IntegrationLogStatus;
  method: string | null;
  endpoint: string | null;
  responseCode: number | null;
  durationMs: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

// ── Data Sync ──────────────────────────────────────────────────────────────────

export interface DataSync {
  id: string;
  integrationId: string;
  integrationName?: string;
  syncType: string;
  status: DataSyncStatus;
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  startedAt: string;
  completedAt: string | null;
  errorLog: Record<string, unknown> | null;
  createdAt: string;
}
