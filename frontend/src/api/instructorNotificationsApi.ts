// Instructor self-service Notifications + Preferences API — scoped to
// /api/instructor/notifications.

import { getStoredInstructorToken } from './instructorAuth';
import { fetchWithRetry } from '../lib/fetchWithRetry';
import type {
  InstructorNotification, ListMyNotificationsResult,
  NotificationPreferences, NotificationPreferencesUpdate,
} from '../types/instructorNotifications';

const BASE = import.meta.env.VITE_INSTRUCTOR_API_BASE_URL2 ?? 'http://localhost:5001/api/instructor';

export class InstructorNotificationsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'InstructorNotificationsApiError';
  }
}

async function notificationsFetch<T>(path: string, method: 'GET' | 'PATCH' = 'GET', body?: unknown): Promise<T> {
  const token = getStoredInstructorToken();
  const res = await fetchWithRetry(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new InstructorNotificationsApiError(401, 'Your session has expired — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg = res.status === 429 ? 'Too many requests — slow down.' : json.message ?? `HTTP ${res.status}`;
    throw new InstructorNotificationsApiError(res.status, msg);
  }

  return json.data as T;
}

export interface ListMyNotificationsParams {
  dateFrom?: string; // YYYY-MM-DD
  dateTo?:   string; // YYYY-MM-DD
  read?:     boolean;
  page?:     number;
  limit?:    number;
}

export function listMyNotifications(params: ListMyNotificationsParams = {}): Promise<ListMyNotificationsResult> {
  const qs = new URLSearchParams();
  if (params.dateFrom) qs.set('dateFrom', params.dateFrom);
  if (params.dateTo) qs.set('dateTo', params.dateTo);
  if (params.read !== undefined) qs.set('read', String(params.read));
  if (params.page !== undefined) qs.set('page', String(params.page));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return notificationsFetch<ListMyNotificationsResult>(`/notifications${suffix}`);
}

export function markMyNotificationRead(id: string): Promise<InstructorNotification> {
  return notificationsFetch<InstructorNotification>(`/notifications/${encodeURIComponent(id)}/read`, 'PATCH');
}

export function markAllMyNotificationsRead(): Promise<{ updated: number }> {
  return notificationsFetch<{ updated: number }>('/notifications/read-all', 'PATCH');
}

export function getMyNotificationPreferences(): Promise<NotificationPreferences> {
  return notificationsFetch<NotificationPreferences>('/notifications/preferences');
}

export function updateMyNotificationPreferences(data: NotificationPreferencesUpdate): Promise<NotificationPreferences> {
  return notificationsFetch<NotificationPreferences>('/notifications/preferences', 'PATCH', data);
}
