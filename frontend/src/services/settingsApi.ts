// System Settings API — per SYSTEM_SETTINGS_CONTRACT.md. Real backend only
// (no mock flag — same convention as financeApi.ts / competenciesApi.ts).

import { getStoredToken } from '../api/adminAuth';
import {
  SettingsApiError,
  type BackupPayload,
  type BrandingSignResult,
  type ConfigLogsParams,
  type ConfigLogsResult,
  type StorageUsage,
  type SystemSettings,
  type TestEmailResult,
  type UpdateSystemSettingsRequest,
} from '../types/settings';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

async function settingsFetch<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new SettingsApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 429 ? 'Rate limited — slow down and retry.' :
      res.status === 503 ? (json.message ?? 'Not configured yet.') :
      res.status === 500 ? 'Something went wrong on the server.' :
      json.message ?? (res.status === 404 ? 'Not found.' : `HTTP ${res.status}`);
    throw new SettingsApiError(res.status, msg, json.data as unknown as Record<string, unknown> | undefined);
  }

  return json.data as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ── Settings ──────────────────────────────────────────────────────────────

export function getSystemSettings(): Promise<SystemSettings> {
  return settingsFetch<SystemSettings>('/system-settings');
}

export function updateSystemSettings(body: UpdateSystemSettingsRequest): Promise<SystemSettings> {
  return settingsFetch<SystemSettings>('/system-settings', 'PATCH', body);
}

// ── Feature flags (gating) ───────────────────────────────────────────────

export interface FeatureFlags {
  liveSessionsEnabled: boolean;
  certificatesModuleEnabled: boolean;
  marketplaceEnabled: boolean;
  aiEnabled: boolean;
  gamificationEnabled: boolean;
  scormModuleEnabled: boolean;
  mobileAppEnabled: boolean;
}

export function getFeatureFlags(): Promise<FeatureFlags> {
  return settingsFetch<FeatureFlags>('/system-settings/features');
}

// ── Config Logs ───────────────────────────────────────────────────────────

export function getConfigLogs(params: ConfigLogsParams = {}): Promise<ConfigLogsResult> {
  return settingsFetch<ConfigLogsResult>(`/system-settings/logs${qs(params)}`);
}

// ── Maintenance ───────────────────────────────────────────────────────────

export function enableMaintenance(body: { message?: string | null; scheduledAt?: string | null }): Promise<SystemSettings> {
  return settingsFetch<SystemSettings>('/system-settings/maintenance/enable', 'POST', body);
}

export function disableMaintenance(): Promise<SystemSettings> {
  return settingsFetch<SystemSettings>('/system-settings/maintenance/disable', 'POST');
}

// ── Email ─────────────────────────────────────────────────────────────────

// The backend always returns 200 with { success, message } here (a failed
// test send is an expected outcome, not an HTTP error) — settingsFetch's
// json.success===false→throw path is bypassed by calling it directly against
// the full envelope rather than unwrapping `.data`.
export async function sendTestEmail(to?: string): Promise<TestEmailResult> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}/system-settings/test-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ to: to || undefined }),
  });
  if (res.status === 401) throw new SettingsApiError(401, 'Unauthorized — please log in again.');
  const json = await res.json().catch(() => ({ success: false, message: 'Unexpected response.' }));
  if (!res.ok) throw new SettingsApiError(res.status, json.message ?? `HTTP ${res.status}`);
  return json as TestEmailResult;
}

// ── Backup / restore ──────────────────────────────────────────────────────

export function createBackup(): Promise<BackupPayload> {
  return settingsFetch<BackupPayload>('/system-settings/backup', 'POST');
}

export function restoreBackup(settings: Record<string, unknown>): Promise<SystemSettings> {
  return settingsFetch<SystemSettings>('/system-settings/restore', 'POST', { settings });
}

// ── Storage ───────────────────────────────────────────────────────────────

export function getStorageUsage(): Promise<StorageUsage> {
  return settingsFetch<StorageUsage>('/system-settings/storage-usage');
}

// ── Branding upload (logo / favicon) ─────────────────────────────────────

export function signBrandingUpload(kind: 'logo' | 'favicon', fileName: string): Promise<BrandingSignResult> {
  return settingsFetch<BrandingSignResult>('/system-settings/branding/sign', 'POST', { kind, fileName });
}

export function confirmBrandingUpload(kind: 'logo' | 'favicon', path: string): Promise<{ url: string }> {
  return settingsFetch<{ url: string }>('/system-settings/branding/confirm', 'POST', { kind, path });
}

export async function uploadBrandingAsset(kind: 'logo' | 'favicon', file: File): Promise<string> {
  const { uploadUrl, path, maxBytes } = await signBrandingUpload(kind, file.name);
  if (file.size > maxBytes) throw new SettingsApiError(400, `File exceeds the ${Math.round(maxBytes / 1024 / 1024)}MB limit.`);
  const putRes = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
  if (!putRes.ok) throw new SettingsApiError(putRes.status, 'Upload to storage failed.');
  const { url } = await confirmBrandingUpload(kind, path);
  return url;
}
