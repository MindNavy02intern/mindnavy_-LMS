import { getStoredToken } from './adminAuth';
import { fetchWithRetry } from '../lib/fetchWithRetry';
import type {
  AdminWidgetsResponse,
  DashboardAnalyticsResponse,
  DashboardCoreResponse,
} from '../types/dashboard';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

// ── Core API (TASK 5A) ────────────────────────────────────────────────────────

export interface DashboardCoreParams {
  dateFrom?: string | null;
  dateTo?:   string | null;
}

export async function getDashboardCore(params: DashboardCoreParams = {}): Promise<DashboardCoreResponse> {
  const token = getStoredToken();
  const qs = new URLSearchParams();
  if (params.dateFrom) qs.set('dateFrom', params.dateFrom);
  if (params.dateTo)   qs.set('dateTo',   params.dateTo);
  qs.set('_t', String(Date.now()));
  const res = await fetchWithRetry(`${BASE_URL}/dashboard/core?${qs.toString()}`, {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<DashboardCoreResponse>;
}

// ── Analytics API (TASK 5B.1) ─────────────────────────────────────────────────

export interface AnalyticsParams {
  dateFrom:     string | null;
  dateTo:       string | null;
  departmentId: string | null;
}

export async function getDashboardAnalytics(
  params: AnalyticsParams = { dateFrom: null, dateTo: null, departmentId: null },
): Promise<DashboardAnalyticsResponse> {
  const token = getStoredToken();
  const qs = new URLSearchParams();
  if (params.dateFrom)     qs.set('dateFrom',     params.dateFrom);
  if (params.dateTo)       qs.set('dateTo',       params.dateTo);
  if (params.departmentId) qs.set('departmentId', params.departmentId);
  const query = qs.toString();
  const res = await fetchWithRetry(
    `${BASE_URL}/dashboard/analytics${query ? `?${query}` : ''}`,
    { headers: { Authorization: token ? `Bearer ${token}` : '' } },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<DashboardAnalyticsResponse>;
}

// ── Admin Widgets API (TASK 5C) ───────────────────────────────────────────────

export interface AdminWidgetsParams {
  dateFrom:     string | null;
  dateTo:       string | null;
  departmentId: string | null;
  courseId:     string | null;
}

export async function getAdminWidgets(
  params: AdminWidgetsParams = { dateFrom: null, dateTo: null, departmentId: null, courseId: null },
): Promise<AdminWidgetsResponse> {
  const token = getStoredToken();
  const qs = new URLSearchParams();
  if (params.dateFrom)     qs.set('dateFrom',     params.dateFrom);
  if (params.dateTo)       qs.set('dateTo',       params.dateTo);
  if (params.departmentId) qs.set('departmentId', params.departmentId);
  if (params.courseId)     qs.set('courseId',     params.courseId);
  const query = qs.toString();
  const res = await fetchWithRetry(
    `${BASE_URL}/dashboard/admin-widgets${query ? `?${query}` : ''}`,
    { headers: { Authorization: token ? `Bearer ${token}` : '' } },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<AdminWidgetsResponse>;
}
