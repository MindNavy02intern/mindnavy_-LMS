import type {
  User,
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
  Invitation,
  InvitationsResponse,
  SendInvitationRequest,
  UserCourseEnrollment,
  UserSession,
  UserNote,
  UserDataExport,
} from '../types/users';
import { getStoredToken } from './adminAuth';
import { fetchWithRetry } from '../lib/fetchWithRetry';

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

export interface ExportParams {
  search?:            string;
  role?:              string;
  department?:        string;
  branch?:            string;
  status?:            string;
  verificationState?: string;
  createdAfter?:      string;
  createdBefore?:     string;
}

// Response shape for mutations that don't touch a `user` record (session
// revoke, note delete, unenroll, deletion request) — distinct from
// ActionResponse, which promises the caller a `user: Partial<User>`.
export interface SimpleActionResponse {
  success: boolean;
  message: string;
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
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetchWithRetry(url, { headers });
    if (res.ok) return await res.json() as UsersResponse;
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, (body as { message?: string })?.message ?? `HTTP ${res.status}`);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'Network error. Please check your connection.');
  }
}

// ── Shared action fetch helper ────────────────────────────────────────────────

// Generic over the response shape — most callers get the ActionResponse
// default (mutations that return the updated `user`), but a few return only
// { success, message } (no user record involved) and pass SimpleActionResponse.
async function actionFetch<T = ActionResponse>(
  url:     string,
  method:  string,
  body?:   unknown,
): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  try {
    const res = await fetchWithRetry(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (res.ok) return await res.json() as T;
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
  const token   = getStoredToken();
  const cleanId = userId.split(':')[0].trim();
  const url     = `${BASE_URL}/users/${encodeURIComponent(cleanId)}?_t=${Date.now()}`;

  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetchWithRetry(url, { headers });
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
    const importHeaders: Record<string, string> = {};
    if (token) importHeaders['Authorization'] = `Bearer ${token}`;
    const res = await fetchWithRetry(`${BASE_URL}/users/import`, {
      method: 'POST',
      headers: importHeaders,
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
    const bulkHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) bulkHeaders['Authorization'] = `Bearer ${token}`;
    const res = await fetchWithRetry(`${BASE_URL}/users/bulk-action`, {
      method:  'POST',
      headers: bulkHeaders,
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

// ── exportAllUsers ─────────────────────────────────────────────────────────────

export async function exportAllUsers(params: ExportParams = {}): Promise<{ users: User[]; total: number }> {
  const token = getStoredToken();
  const qs = new URLSearchParams();
  if (params.search)            qs.set('search',            params.search);
  if (params.role)              qs.set('role',              params.role);
  if (params.department)        qs.set('department',        params.department);
  if (params.branch)            qs.set('branch',            params.branch);
  if (params.status)            qs.set('status',            params.status);
  if (params.verificationState) qs.set('verificationState', params.verificationState);
  if (params.createdAfter)      qs.set('createdAfter',      params.createdAfter);
  if (params.createdBefore)     qs.set('createdBefore',     params.createdBefore);
  const url = `${BASE_URL}/users/export?${qs.toString()}`;
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetchWithRetry(url, { headers });
    if (res.ok) return await res.json() as { users: User[]; total: number };
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, (body as { message?: string })?.message ?? `HTTP ${res.status}`);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'Network error during export.');
  }
}

// ── Invitations ────────────────────────────────────────────────────────────────

export interface InvitationParams {
  page?:   number;
  limit?:  number;
  search?: string;
  status?: string;
}

export async function getInvitations(params: InvitationParams = {}): Promise<InvitationsResponse> {
  const token = getStoredToken();
  const qs = new URLSearchParams();
  if (params.page   !== undefined) qs.set('page',   String(params.page));
  if (params.limit  !== undefined) qs.set('limit',  String(params.limit));
  if (params.search)               qs.set('search', params.search);
  if (params.status)               qs.set('status', params.status);

  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetchWithRetry(`${BASE_URL}/invitations?${qs.toString()}`, { headers });
    if (res.ok) return await res.json() as InvitationsResponse;
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, (body as { message?: string })?.message ?? `HTTP ${res.status}`);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'Network error fetching invitations.');
  }
}

export function sendInvitation(body: SendInvitationRequest): Promise<ActionResponse & { invitation?: Invitation }> {
  return actionFetch(`${BASE_URL}/invitations`, 'POST', body) as Promise<ActionResponse & { invitation?: Invitation }>;
}

export function resendInvitation(invitationId: string): Promise<ActionResponse> {
  return actionFetch(`${BASE_URL}/invitations/${encodeURIComponent(invitationId)}/resend`, 'POST', {});
}

export function cancelInvitation(invitationId: string): Promise<ActionResponse> {
  return actionFetch(`${BASE_URL}/invitations/${encodeURIComponent(invitationId)}`, 'DELETE');
}

export function updateInvitationExpiry(invitationId: string, expiresAt: string): Promise<ActionResponse> {
  return actionFetch(`${BASE_URL}/invitations/${encodeURIComponent(invitationId)}/expiration`, 'PATCH', { expiresAt });
}

// ── getAnalytics ───────────────────────────────────────────────────────────────

export async function getAnalytics(): Promise<AnalyticsResponse> {
  const token = getStoredToken();
  try {
    const analyticsHeaders: Record<string, string> = {};
    if (token) analyticsHeaders['Authorization'] = `Bearer ${token}`;
    const res = await fetchWithRetry(`${BASE_URL}/users/analytics?_t=${Date.now()}`, {
      headers: analyticsHeaders,
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

// ── Shared GET fetch helper ───────────────────────────────────────────────────

async function getFetch<T>(url: string): Promise<T> {
  const token = getStoredToken();
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetchWithRetry(url, { headers });
    if (res.ok) return await res.json() as T;
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, (body as { message?: string })?.message ?? `HTTP ${res.status}`);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'Network error. Please check your connection.');
  }
}

// ── User Details Drawer: Courses tab ──────────────────────────────────────────

export async function getUserCourses(userId: string): Promise<UserCourseEnrollment[]> {
  const res = await getFetch<{ success: boolean; courses: UserCourseEnrollment[] }>(
    `${BASE_URL}/users/${encodeURIComponent(userId)}/courses`,
  );
  return res.courses;
}

export function unenrollUserCourse(userId: string, enrollmentId: string): Promise<SimpleActionResponse> {
  return actionFetch<SimpleActionResponse>(`${BASE_URL}/users/${encodeURIComponent(userId)}/courses/${encodeURIComponent(enrollmentId)}`, 'DELETE');
}

// ── User Details Drawer: More tab — Devices & Sessions ────────────────────────

export async function getUserSessions(userId: string): Promise<UserSession[]> {
  const res = await getFetch<{ success: boolean; sessions: UserSession[] }>(
    `${BASE_URL}/users/${encodeURIComponent(userId)}/sessions`,
  );
  return res.sessions;
}

export function revokeUserSession(userId: string, sessionId: string): Promise<SimpleActionResponse> {
  return actionFetch<SimpleActionResponse>(`${BASE_URL}/users/${encodeURIComponent(userId)}/sessions/${encodeURIComponent(sessionId)}`, 'DELETE');
}

// ── User Details Drawer: More tab — Notes ─────────────────────────────────────

export async function getUserNotes(userId: string): Promise<UserNote[]> {
  const res = await getFetch<{ success: boolean; notes: UserNote[] }>(
    `${BASE_URL}/users/${encodeURIComponent(userId)}/notes`,
  );
  return res.notes;
}

export async function addUserNote(userId: string, content: string): Promise<UserNote> {
  const res = await actionFetch<{ success: boolean; message: string; note: UserNote }>(
    `${BASE_URL}/users/${encodeURIComponent(userId)}/notes`, 'POST', { content },
  );
  return res.note;
}

export function deleteUserNote(userId: string, noteId: string): Promise<SimpleActionResponse> {
  return actionFetch<SimpleActionResponse>(`${BASE_URL}/users/${encodeURIComponent(userId)}/notes/${encodeURIComponent(noteId)}`, 'DELETE');
}

// ── User Details Drawer: More tab — Consent & Privacy ─────────────────────────

export function getUserDataExport(userId: string): Promise<UserDataExport> {
  return getFetch<UserDataExport>(`${BASE_URL}/users/${encodeURIComponent(userId)}/export`);
}

export function requestAccountDeletion(userId: string): Promise<SimpleActionResponse> {
  return actionFetch<SimpleActionResponse>(`${BASE_URL}/users/${encodeURIComponent(userId)}/request-deletion`, 'POST', {});
}
