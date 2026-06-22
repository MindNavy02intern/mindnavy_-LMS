import { getStoredToken } from './adminAuth';
import type {
  RolePageStats,
  RolePage,
  RolePageDetails,
  RolesPageResponse,
  RolesPagePagination,
  CreateRolePagePayload,
  Permission,
  PermissionMatrixData,
} from '../types/rolesPage';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

export class RolesPageError extends Error {
  status: number;
  code?: string;
  count?: number;
  roleName?: string;
  constructor(
    status: number,
    message: string,
    extra?: { code?: string; count?: number; roleName?: string },
  ) {
    super(message);
    this.status = status;
    this.name = 'RolesPageError';
    this.code = extra?.code;
    this.count = extra?.count;
    this.roleName = extra?.roleName;
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
    const j = json as { message?: string; error?: string; count?: number; roleName?: string };
    throw new RolesPageError(res.status, j.message ?? `HTTP ${res.status}`, {
      code: j.error,
      count: j.count,
      roleName: j.roleName,
    });
  }
  return json as T;
}

export async function getRolesPageStats(): Promise<RolePageStats> {
  const json = await apiFetch<{ success: boolean; data: RolePageStats }>('/roles/stats');
  return json.data;
}

export async function getRolesPageList(params: {
  page: number;
  limit: number;
  search: string;
  status: string;
}): Promise<RolesPageResponse> {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page));
  qs.set('limit', String(params.limit));
  if (params.search) qs.set('search', params.search);
  if (params.status && params.status !== 'ALL') qs.set('status', params.status);
  const json = await apiFetch<{ success: boolean; data: RolePage[]; pagination: RolesPagePagination }>(
    `/roles?${qs.toString()}`,
  );
  return { data: json.data, pagination: json.pagination };
}

export async function getRolePageDetails(id: string): Promise<RolePageDetails> {
  const json = await apiFetch<{ success: boolean; data: RolePageDetails }>(
    `/roles/${encodeURIComponent(id)}`,
  );
  return json.data;
}

export async function createRolePage(data: CreateRolePagePayload): Promise<RolePage> {
  const json = await apiFetch<{ success: boolean; data: RolePage }>('/roles', 'POST', data);
  return json.data;
}

export async function updateRolePage(
  id: string,
  data: Partial<CreateRolePagePayload>,
): Promise<RolePage> {
  const json = await apiFetch<{ success: boolean; data: RolePage }>(
    `/roles/${encodeURIComponent(id)}`,
    'PATCH',
    data,
  );
  return json.data;
}

export async function deleteRolePage(id: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/roles/${encodeURIComponent(id)}`, 'DELETE');
}

export async function duplicateRolePage(id: string): Promise<RolePage> {
  const json = await apiFetch<{ success: boolean; data: RolePage }>(
    `/roles/${encodeURIComponent(id)}/duplicate`,
    'POST',
  );
  return json.data;
}

export async function getRolePermissions(roleId: string): Promise<Permission[]> {
  const json = await apiFetch<{ success: boolean; data: Permission[] }>(
    `/roles/${encodeURIComponent(roleId)}/permissions`,
  );
  return json.data;
}

export async function assignRolePermissions(roleId: string, permissionIds: string[]): Promise<void> {
  await apiFetch<{ success: boolean; data: Permission[] }>(
    `/roles/${encodeURIComponent(roleId)}/permissions`,
    'POST',
    { permissionIds },
  );
}

export async function getAllPermissions(): Promise<Permission[]> {
  const json = await apiFetch<{ success: boolean; data: Permission[]; pagination: unknown }>(
    '/permissions?limit=500',
  );
  return json.data;
}

export async function getPermissionMatrix(params?: {
  roleStatus?: 'ACTIVE' | 'INACTIVE';
  category?: string;
  search?: string;
}): Promise<PermissionMatrixData> {
  const qs = new URLSearchParams();
  if (params?.roleStatus) qs.set('roleStatus', params.roleStatus);
  if (params?.category)   qs.set('category',   params.category);
  if (params?.search)     qs.set('search',      params.search);
  const query = qs.toString();
  const json = await apiFetch<{ success: boolean; data: PermissionMatrixData }>(
    `/permission-matrix${query ? `?${query}` : ''}`,
  );
  return json.data;
}

export async function togglePermission(payload: {
  roleId: string;
  permissionId: string;
  enabled: boolean;
}): Promise<{ roleId: string; permissionId: string; enabled: boolean }> {
  const json = await apiFetch<{
    success: boolean;
    data: { roleId: string; permissionId: string; enabled: boolean };
  }>('/permission-matrix/toggle', 'POST', payload);
  return json.data;
}
