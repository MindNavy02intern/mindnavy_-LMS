import { getStoredToken } from './adminAuth';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

export class RolesApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'RolesApiError';
  }
}

async function apiCall(endpoint: string, method = 'GET', body?: unknown): Promise<unknown> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options: RequestInit = { method, headers };
  if (body !== undefined) options.body = JSON.stringify(body);

  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, options);
    const json = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    if (!res.ok) {
      throw new RolesApiError(res.status, (json as { message?: string }).message ?? `HTTP ${res.status}`);
    }
    return json;
  } catch (err) {
    if (err instanceof RolesApiError) throw err;
    throw new RolesApiError(0, 'Network error. Please check your connection.');
  }
}

export const rolesPermissionsAPI = {
  // ── Roles ──────────────────────────────────────────────────────────────────
  getRoles(params?: { search?: string; status?: string; page?: number; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.status && params.status !== 'ALL') qs.set('status', params.status);
    if (params?.page  !== undefined) qs.set('page',  String(params.page));
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return apiCall(`/roles${q ? `?${q}` : ''}`) as Promise<{ success: boolean; data: import('../types/rolesPermissions').Role[] }>;
  },

  getRoleById(id: string) {
    return apiCall(`/roles/${encodeURIComponent(id)}`) as Promise<{ success: boolean; data: import('../types/rolesPermissions').Role }>;
  },

  createRole(data: { name: string; description?: string; status: string }) {
    return apiCall('/roles', 'POST', data) as Promise<{ success: boolean; message: string; data: import('../types/rolesPermissions').Role }>;
  },

  updateRole(id: string, data: { name?: string; description?: string; status?: string }) {
    return apiCall(`/roles/${encodeURIComponent(id)}`, 'PATCH', data) as Promise<{ success: boolean; message: string; data: import('../types/rolesPermissions').Role }>;
  },

  deleteRole(id: string) {
    return apiCall(`/roles/${encodeURIComponent(id)}`, 'DELETE') as Promise<{ success: boolean; message: string }>;
  },

  getRolePermissions(roleId: string) {
    return apiCall(`/roles/${encodeURIComponent(roleId)}/permissions`) as Promise<{ success: boolean; data: import('../types/rolesPermissions').Permission[] }>;
  },

  assignPermissionsToRole(roleId: string, permissionIds: string[]) {
    return apiCall(`/roles/${encodeURIComponent(roleId)}/permissions`, 'POST', { permissionIds }) as Promise<{ success: boolean; message: string; data: import('../types/rolesPermissions').Permission[] }>;
  },

  // ── Permissions ────────────────────────────────────────────────────────────
  getPermissions(params?: { search?: string; category?: string; page?: number; limit?: number }) {
    const qs = new URLSearchParams();
    if (params?.search)   qs.set('search',   params.search);
    if (params?.category && params.category !== 'ALL') qs.set('category', params.category);
    if (params?.page  !== undefined) qs.set('page',  String(params.page));
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    const q = qs.toString();
    return apiCall(`/permissions${q ? `?${q}` : ''}`) as Promise<{ success: boolean; data: import('../types/rolesPermissions').Permission[] }>;
  },

  getPermissionById(id: string) {
    return apiCall(`/permissions/${encodeURIComponent(id)}`) as Promise<{ success: boolean; data: import('../types/rolesPermissions').Permission }>;
  },

  createPermission(data: { name: string; description?: string; category: string }) {
    return apiCall('/permissions', 'POST', data) as Promise<{ success: boolean; message: string; data: import('../types/rolesPermissions').Permission }>;
  },

  updatePermission(id: string, data: { name?: string; description?: string; category?: string }) {
    return apiCall(`/permissions/${encodeURIComponent(id)}`, 'PATCH', data) as Promise<{ success: boolean; message: string; data: import('../types/rolesPermissions').Permission }>;
  },

  deletePermission(id: string) {
    return apiCall(`/permissions/${encodeURIComponent(id)}`, 'DELETE') as Promise<{ success: boolean; message: string }>;
  },
};
