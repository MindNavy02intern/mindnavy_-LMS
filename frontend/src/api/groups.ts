import { getStoredToken } from './adminAuth';
import { ApiError } from './users';
import type { Group, GroupMember } from '../types/groups';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

async function groupsFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (init.body) headers['Content-Type'] = 'application/json';
  try {
    const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
    if (res.ok) return await res.json() as T;
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, (body as { message?: string })?.message ?? `HTTP ${res.status}`);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'Network error. Please check your connection.');
  }
}

export interface GroupsListResponse {
  success: boolean;
  data: Group[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

export interface GroupResponse {
  success: boolean;
  data: Group;
  message?: string;
}

export interface GroupMembersResponse {
  success: boolean;
  data: GroupMember[];
  message?: string;
}

export const groupsAPI = {
  listGroups(params?: { search?: string; status?: string; departmentId?: string; page?: number; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.search)       qs.set('search',       params.search);
    if (params?.status && params.status !== 'ALL') qs.set('status', params.status);
    if (params?.departmentId) qs.set('departmentId', params.departmentId);
    if (params?.page  !== undefined) qs.set('page',  String(params.page));
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return groupsFetch<GroupsListResponse>(`/groups${q ? `?${q}` : ''}`);
  },

  getGroup(id: string) {
    return groupsFetch<GroupResponse>(`/groups/${encodeURIComponent(id)}`);
  },

  createGroup(data: { name: string; description?: string | null; departmentId?: string | null; leaderId?: string; status?: string }) {
    return groupsFetch<GroupResponse>('/groups', { method: 'POST', body: JSON.stringify(data) });
  },

  updateGroup(id: string, data: { name?: string; description?: string | null; departmentId?: string | null; leaderId?: string | null; status?: string }) {
    return groupsFetch<GroupResponse>(`/groups/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(data) });
  },

  deleteGroup(id: string) {
    return groupsFetch<{ success: boolean; message: string }>(`/groups/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  getGroupMembers(groupId: string) {
    return groupsFetch<GroupMembersResponse>(`/groups/${encodeURIComponent(groupId)}/members`);
  },

  addMembers(groupId: string, userIds: string[], role?: string) {
    return groupsFetch<GroupMembersResponse>(`/groups/${encodeURIComponent(groupId)}/members`, {
      method: 'POST',
      body: JSON.stringify({ userIds, role }),
    });
  },

  removeMember(groupId: string, userId: string) {
    return groupsFetch<{ success: boolean; message: string }>(
      `/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    );
  },
};
