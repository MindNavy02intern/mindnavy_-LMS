// Notifications API — per NOTIFICATIONS_CONTRACT.md. Real backend only, same
// fetch-wrapper convention as competenciesApi.ts.

import { getStoredToken } from '../api/adminAuth';
import { fetchWithRetry } from '../lib/fetchWithRetry';
import {
  NotificationsApiError,
  type Announcement,
  type AnnouncementAudience,
  type AnnouncementStatus,
  type AnnouncementType,
  type AutomationTrigger,
  type CreateAnnouncementRequest,
  type CreateAutomationRequest,
  type CreateTemplateRequest,
  type ListResponse,
  type NotificationAutomation,
  type NotificationAutomationStatus,
  type NotificationChannelType,
  type NotificationLogEntry,
  type NotificationLogStatus,
  type NotificationTemplate,
  type NotificationTemplateStatus,
  type NotificationsAnalytics,
  type NotificationsStats,
  type SendEmergencyRequest,
  type SendNotificationRequest,
  type TemplatePreviewResponse,
  type UpdateAnnouncementRequest,
  type UpdateAutomationRequest,
  type UpdatePreferencesRequest,
  type UpdateTemplateRequest,
  type UserNotificationPreferences,
} from '../types/notifications';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

async function notificationsFetch<T>(
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

  if (res.status === 401) throw new NotificationsApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 429 ? 'Rate limited — slow down and retry.' :
      res.status === 503 ? 'Database not migrated yet. Run `npx prisma db push`.' :
      res.status === 500 ? 'Something went wrong on the server.' :
      json.message ?? (res.status === 404 ? 'Not found.' : `HTTP ${res.status}`);
    throw new NotificationsApiError(res.status, msg, json.data as unknown as Record<string, unknown> | undefined);
  }

  return json.data as T;
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

export function getNotificationsStats(): Promise<NotificationsStats> {
  return notificationsFetch<NotificationsStats>('/notifications/stats');
}

export function getNotificationsAnalytics(): Promise<NotificationsAnalytics> {
  return notificationsFetch<NotificationsAnalytics>('/notifications/analytics');
}

// ── In-app notifications ─────────────────────────────────────────────────────

export interface NotificationsListParams { userId?: string; read?: boolean; page?: number; limit?: number }

export function listNotifications(params: NotificationsListParams = {}): Promise<ListResponse<NotificationLogEntry>> {
  return notificationsFetch(`/notifications${qs(params as Record<string, string | number | boolean | undefined>)}`);
}

export function sendNotification(body: SendNotificationRequest): Promise<{ sentCount: number }> {
  return notificationsFetch('/notifications/send', 'POST', body);
}

export function markNotificationRead(id: string): Promise<NotificationLogEntry> {
  return notificationsFetch(`/notifications/${encodeURIComponent(id)}/read`, 'PATCH');
}

export function markAllNotificationsRead(userId?: string): Promise<{ updated: number }> {
  return notificationsFetch('/notifications/read-all', 'PATCH', userId ? { userId } : {});
}

export function deleteNotification(id: string): Promise<{ id: string }> {
  return notificationsFetch(`/notifications/${encodeURIComponent(id)}`, 'DELETE');
}

// ── Announcements ────────────────────────────────────────────────────────────

export interface AnnouncementsListParams {
  status?: AnnouncementStatus; type?: AnnouncementType; audience?: AnnouncementAudience;
  search?: string; page?: number; limit?: number;
}

export function listAnnouncements(params: AnnouncementsListParams = {}): Promise<ListResponse<Announcement>> {
  return notificationsFetch(`/notifications/announcements${qs(params as Record<string, string | number | boolean | undefined>)}`);
}

export function getAnnouncement(id: string): Promise<Announcement> {
  return notificationsFetch(`/notifications/announcements/${encodeURIComponent(id)}`);
}

export function createAnnouncement(body: CreateAnnouncementRequest): Promise<Announcement> {
  return notificationsFetch('/notifications/announcements', 'POST', body);
}

export function updateAnnouncement(id: string, body: UpdateAnnouncementRequest): Promise<Announcement> {
  return notificationsFetch(`/notifications/announcements/${encodeURIComponent(id)}`, 'PATCH', body);
}

export function sendAnnouncementNow(id: string): Promise<Announcement> {
  return notificationsFetch(`/notifications/announcements/${encodeURIComponent(id)}/send`, 'POST');
}

export function cancelAnnouncement(id: string): Promise<Announcement> {
  return notificationsFetch(`/notifications/announcements/${encodeURIComponent(id)}/cancel`, 'PATCH');
}

export function deleteAnnouncement(id: string): Promise<{ id: string }> {
  return notificationsFetch(`/notifications/announcements/${encodeURIComponent(id)}`, 'DELETE');
}

// ── Templates ──────────────────────────────────────────────────────────────────

export interface TemplatesListParams {
  type?: NotificationChannelType; category?: string; status?: NotificationTemplateStatus;
  search?: string; page?: number; limit?: number;
}

export function listTemplates(params: TemplatesListParams = {}): Promise<ListResponse<NotificationTemplate>> {
  return notificationsFetch(`/notifications/templates${qs(params as Record<string, string | number | boolean | undefined>)}`);
}

export function getTemplate(id: string): Promise<NotificationTemplate> {
  return notificationsFetch(`/notifications/templates/${encodeURIComponent(id)}`);
}

export function createTemplate(body: CreateTemplateRequest): Promise<NotificationTemplate> {
  return notificationsFetch('/notifications/templates', 'POST', body);
}

export function updateTemplate(id: string, body: UpdateTemplateRequest): Promise<NotificationTemplate> {
  return notificationsFetch(`/notifications/templates/${encodeURIComponent(id)}`, 'PATCH', body);
}

export function deleteTemplate(id: string): Promise<{ id: string }> {
  return notificationsFetch(`/notifications/templates/${encodeURIComponent(id)}`, 'DELETE');
}

export function duplicateTemplate(id: string): Promise<NotificationTemplate> {
  return notificationsFetch(`/notifications/templates/${encodeURIComponent(id)}/duplicate`, 'POST');
}

export function previewTemplate(id: string, variables: Record<string, string>): Promise<TemplatePreviewResponse> {
  return notificationsFetch(`/notifications/templates/${encodeURIComponent(id)}/preview`, 'POST', { variables });
}

// ── Automations ────────────────────────────────────────────────────────────────

export interface AutomationsListParams {
  status?: NotificationAutomationStatus; trigger?: AutomationTrigger; search?: string; page?: number; limit?: number;
}

export function listAutomations(params: AutomationsListParams = {}): Promise<ListResponse<NotificationAutomation>> {
  return notificationsFetch(`/notifications/automations${qs(params as Record<string, string | number | boolean | undefined>)}`);
}

export function createAutomation(body: CreateAutomationRequest): Promise<NotificationAutomation> {
  return notificationsFetch('/notifications/automations', 'POST', body);
}

export function updateAutomation(id: string, body: UpdateAutomationRequest): Promise<NotificationAutomation> {
  return notificationsFetch(`/notifications/automations/${encodeURIComponent(id)}`, 'PATCH', body);
}

export function pauseAutomation(id: string): Promise<NotificationAutomation> {
  return notificationsFetch(`/notifications/automations/${encodeURIComponent(id)}/pause`, 'PATCH');
}

export function resumeAutomation(id: string): Promise<NotificationAutomation> {
  return notificationsFetch(`/notifications/automations/${encodeURIComponent(id)}/resume`, 'PATCH');
}

export function deleteAutomation(id: string): Promise<{ id: string }> {
  return notificationsFetch(`/notifications/automations/${encodeURIComponent(id)}`, 'DELETE');
}

// ── Delivery logs ──────────────────────────────────────────────────────────────

export interface LogsListParams {
  channel?: NotificationChannelType; status?: NotificationLogStatus; userId?: string;
  dateFrom?: string; dateTo?: string; page?: number; limit?: number;
}

export function listLogs(params: LogsListParams = {}): Promise<ListResponse<NotificationLogEntry>> {
  return notificationsFetch(`/notifications/logs${qs(params as Record<string, string | number | boolean | undefined>)}`);
}

export function retryDelivery(id: string): Promise<NotificationLogEntry> {
  return notificationsFetch(`/notifications/logs/${encodeURIComponent(id)}/retry`, 'POST');
}

// ── Preferences ───────────────────────────────────────────────────────────────

export function getPreferences(userId: string): Promise<UserNotificationPreferences> {
  return notificationsFetch(`/notifications/preferences/${encodeURIComponent(userId)}`);
}

export function updatePreferences(userId: string, body: UpdatePreferencesRequest): Promise<UserNotificationPreferences> {
  return notificationsFetch(`/notifications/preferences/${encodeURIComponent(userId)}`, 'PATCH', body);
}

// ── Feature waitlist ("notify me when this ships") ──────────────────────────

export function joinFeatureWaitlist(feature: string): Promise<{ alreadyJoined: boolean }> {
  return notificationsFetch('/notifications/preferences/waitlist', 'POST', { feature });
}

// ── Emergency ─────────────────────────────────────────────────────────────────

export function sendEmergencyAlert(body: SendEmergencyRequest): Promise<Announcement & { recipientCount: number }> {
  return notificationsFetch('/notifications/emergency', 'POST', body);
}

export function listEmergencyAlerts(params: { page?: number; limit?: number } = {}): Promise<ListResponse<Announcement>> {
  return notificationsFetch(`/notifications/emergency${qs(params as Record<string, string | number | boolean | undefined>)}`);
}
