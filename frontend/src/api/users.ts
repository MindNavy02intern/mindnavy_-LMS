import type {
  UsersResponse,
  UserDetailsResponse,
  CreateUserRequest,
  UpdateUserRequest,
  SuspendUserRequest,
  AssignRoleRequest,
  ActionResponse,
  AnalyticsResponse,
  ImportResult,
  BulkActionType,
  BulkActionResponse,
} from '../types/users';
import { getStoredToken } from './adminAuth';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

export interface UsersParams {
  page?:              number;
  limit?:             number;
  search?:            string;
  role?:              string;
  department?:        string;
  branch?:            string;
  status?:            string;
  verificationState?: string;
  createdAfter?:      string;
  createdBefore?:     string;
}

// ── ApiError ───────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// ── getUsers ───────────────────────────────────────────────────────────────────

export async function getUsers(params: UsersParams = {}): Promise<UsersResponse> {
  const token = getStoredToken();
  const qs = new URLSearchParams();
  if (params.page              !== undefined) qs.set('page',              String(params.page));
  if (params.limit             !== undefined) qs.set('limit',             String(params.limit));
  if (params.search)                          qs.set('search',            params.search);
  if (params.role)                            qs.set('role',              params.role);
  if (params.department)                      qs.set('department',        params.department);
  if (params.branch)                          qs.set('branch',            params.branch);
  if (params.status)                          qs.set('status',            params.status);
  if (params.verificationState)               qs.set('verificationState', params.verificationState);
  if (params.createdAfter)                    qs.set('createdAfter',      params.createdAfter);
  if (params.createdBefore)                   qs.set('createdBefore',     params.createdBefore);

  const url = `${BASE_URL}/users?${qs.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });
    if (res.ok) return await res.json() as UsersResponse;
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, (body as { message?: string })?.message ?? `HTTP ${res.status}`);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'Network error. Please check your connection.');
  }
}

// ── Shared action fetch helper ────────────────────────────────────────────────

async function actionFetch(
  url:     string,
  method:  string,
  body?:   unknown,
): Promise<ActionResponse> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    Authorization: token ? `Bearer ${token}` : '',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  try {
    const res = await fetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (res.ok) return await res.json() as ActionResponse;
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new ApiError(res.status, (err as { message?: string }).message ?? `HTTP ${res.status}`);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'Network error. Please check your connection.');
  }
}

// ── User actions ──────────────────────────────────────────────────────────────

export function createUser(body: CreateUserRequest): Promise<ActionResponse> {
  return actionFetch(`${BASE_URL}/users`, 'POST', body);
}

export function updateUser(userId: string, body: UpdateUserRequest): Promise<ActionResponse> {
  return actionFetch(`${BASE_URL}/users/${encodeURIComponent(userId)}`, 'PATCH', body);
}

export function suspendUser(userId: string, body: SuspendUserRequest): Promise<ActionResponse> {
  return actionFetch(`${BASE_URL}/users/${encodeURIComponent(userId)}/suspend`, 'PATCH', body);
}

export function reactivateUser(userId: string): Promise<ActionResponse> {
  return actionFetch(`${BASE_URL}/users/${encodeURIComponent(userId)}/reactivate`, 'PATCH', {});
}

export function approveVerification(userId: string): Promise<ActionResponse> {
  return actionFetch(`${BASE_URL}/users/${encodeURIComponent(userId)}/approve-verification`, 'PATCH', {});
}

export function deleteUser(userId: string): Promise<ActionResponse> {
  return actionFetch(`${BASE_URL}/users/${encodeURIComponent(userId)}`, 'DELETE');
}

export function resetPassword(userId: string, newPassword: string): Promise<ActionResponse> {
  return actionFetch(`${BASE_URL}/users/${encodeURIComponent(userId)}/reset-password`, 'POST', { newPassword });
}

export function assignRole(userId: string, body: AssignRoleRequest): Promise<ActionResponse> {
  return actionFetch(`${BASE_URL}/users/${encodeURIComponent(userId)}/role`, 'PATCH', body);
}

// ── getUserDetails ─────────────────────────────────────────────────────────────

export async function getUserDetails(userId: string): Promise<UserDetailsResponse> {
  const token = getStoredToken();
  const url   = `${BASE_URL}/users/${encodeURIComponent(userId)}?_t=${Date.now()}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });
    if (res.ok) return await res.json() as UserDetailsResponse;
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, (body as { message?: string })?.message ?? `HTTP ${res.status}`);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'Network error. Please check your connection.');
  }
}

// ── importUsers ────────────────────────────────────────────────────────────────

export async function importUsers(file: File): Promise<ImportResult> {
  const token = getStoredToken();
  const formData = new FormData();
  formData.append('file', file);
  // No Content-Type header — browser sets multipart/form-data + boundary automatically
  try {
    const res = await fetch(`${BASE_URL}/users/import`, {
      method: 'POST',
      headers: { Authorization: token ? `Bearer ${token}` : '' },
      body: formData,
    });
    if (res.ok) return await res.json() as ImportResult;
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new ApiError(res.status, (err as { message?: string }).message ?? `HTTP ${res.status}`);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'Network error during import');
  }
}

// ── bulkAction ────────────────────────────────────────────────────────────────

export async function bulkAction(body: {
  userIds: string[];
  action:  BulkActionType;
  params:  Record<string, string>;
}): Promise<BulkActionResponse> {
  const token = getStoredToken();
  try {
    const res = await fetch(`${BASE_URL}/users/bulk-action`, {
      method:  'POST',
      headers: {
        Authorization:  token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (res.ok) return await res.json() as BulkActionResponse;
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new ApiError(res.status, (err as { message?: string }).message ?? `HTTP ${res.status}`);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'Network error. Please check your connection.');
  }
}

// ── getAnalytics ───────────────────────────────────────────────────────────────

export async function getAnalytics(): Promise<AnalyticsResponse> {
  const token = getStoredToken();
  try {
    const res = await fetch(`${BASE_URL}/users/analytics?_t=${Date.now()}`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });
    if (res.ok) {
      const json = await res.json();
      return json.analytics as AnalyticsResponse;
    }
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, (body as { message?: string })?.message ?? `HTTP ${res.status}`);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'Network error fetching analytics');
  }
}
