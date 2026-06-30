import { getStoredToken } from './adminAuth';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

export type AssignmentType   = 'PRIMARY' | 'SECONDARY' | 'TEMPORARY' | 'EMERGENCY';
export type AssignmentStatus = 'ACTIVE' | 'EXPIRED';

export interface AssignmentStats {
  totalUsersWithRoles:    number;
  usersWithMultipleRoles: number;
  temporaryAssignments:   number;
  expiredAssignments:     number;
}

export interface Assignment {
  id:             string;
  assignmentType: AssignmentType;
  status:         AssignmentStatus;
  expiresAt:      string | null;
  assignedBy:     string;
  createdAt:      string;
  updatedAt:      string;
  user: { id: string; fullName: string; email: string; avatar: string | null };
  role: { id: string; name: string };
}

export interface AssignmentsPagination {
  total: number;
  page:  number;
  limit: number;
  pages: number;
}

export interface CreateAssignmentPayload {
  userId:         string;
  roleId:         string;
  assignmentType: AssignmentType;
  expiresAt?:     string | null;
}

export interface UpdateAssignmentPayload {
  assignmentType?: AssignmentType;
  expiresAt?:      string | null;
}

export class UserRoleAssignmentError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'UserRoleAssignmentError';
  }
}

async function apiFetch<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
  if (!res.ok) {
    throw new UserRoleAssignmentError(res.status, (json as { message?: string }).message ?? `HTTP ${res.status}`);
  }
  return json as T;
}

export async function getAssignmentStats(): Promise<AssignmentStats> {
  const json = await apiFetch<{ success: boolean; data: AssignmentStats }>('/user-role-assignments/stats');
  return json.data;
}

export async function getAssignments(params: {
  page?:           number;
  limit?:          number;
  search?:         string;
  assignmentType?: AssignmentType | 'ALL';
  status?:         AssignmentStatus | 'ALL';
} = {}): Promise<{ data: Assignment[]; pagination: AssignmentsPagination }> {
  const qs = new URLSearchParams();
  if (params.page  !== undefined) qs.set('page',  String(params.page));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.search)                                qs.set('search', params.search);
  if (params.assignmentType && params.assignmentType !== 'ALL') qs.set('assignmentType', params.assignmentType);
  if (params.status         && params.status         !== 'ALL') qs.set('status', params.status);
  const q = qs.toString();
  return apiFetch<{ success: boolean; data: Assignment[]; pagination: AssignmentsPagination }>(
    `/user-role-assignments${q ? `?${q}` : ''}`,
  );
}

export async function createAssignment(payload: CreateAssignmentPayload): Promise<Assignment> {
  const json = await apiFetch<{ success: boolean; data: Assignment }>('/user-role-assignments', 'POST', payload);
  return json.data;
}

export async function updateAssignment(id: string, payload: UpdateAssignmentPayload): Promise<Assignment> {
  const json = await apiFetch<{ success: boolean; data: Assignment }>(
    `/user-role-assignments/${encodeURIComponent(id)}`, 'PATCH', payload,
  );
  return json.data;
}

export async function deleteAssignment(id: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/user-role-assignments/${encodeURIComponent(id)}`, 'DELETE');
}
