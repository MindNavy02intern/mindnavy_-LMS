import { getStoredToken } from './adminAuth';
import type {
  RolePageStats,
  RolePage,
  RolePageDetails,
  RolesPageResponse,
  CreateRolePagePayload,
} from '../types/rolesPage';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

class RolesPageError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'RolesPageError';
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
    throw new RolesPageError(
      res.status,
      (json as { message?: string }).message ?? `HTTP ${res.status}`,
    );
  }
  return json as T;
}

export async function getRolesPageStats(): Promise<RolePageStats> {
  const json = await apiFetch<{ stats: RolePageStats }>('/roles-page/stats');
  return json.stats;
}

export async function getRolesPageList(params: {
  page:   number;
  limit:  number;
  search: string;
  status: string;
  level:  string;
}): Promise<RolesPageResponse> {
  const qs = new URLSearchParams();
  qs.set('page',  String(params.page));
  qs.set('limit', String(params.limit));
  if (params.search) qs.set('search', params.search);
  if (params.status) qs.set('status', params.status);
  if (params.level)  qs.set('level',  params.level);
  return apiFetch<RolesPageResponse>(`/roles-page/roles?${qs.toString()}`);
}

export async function getRolePageDetails(id: string): Promise<RolePageDetails> {
  const json = await apiFetch<{ role: RolePageDetails }>(
    `/roles-page/roles/${encodeURIComponent(id)}`,
  );
  return json.role;
}

export async function createRolePage(data: CreateRolePagePayload): Promise<RolePage> {
  const json = await apiFetch<{ role: RolePage }>('/roles-page/roles', 'POST', data);
  return json.role;
}

export async function updateRolePage(
  id: string,
  data: Partial<CreateRolePagePayload>,
): Promise<RolePage> {
  const json = await apiFetch<{ role: RolePage }>(
    `/roles-page/roles/${encodeURIComponent(id)}`,
    'PATCH',
    data,
  );
  return json.role;
}

export async function deleteRolePage(id: string): Promise<void> {
  await apiFetch<{ message: string }>(
    `/roles-page/roles/${encodeURIComponent(id)}`,
    'DELETE',
  );
}

export async function duplicateRolePage(id: string): Promise<RolePage> {
  const json = await apiFetch<{ role: RolePage }>(
    `/roles-page/roles/${encodeURIComponent(id)}/duplicate`,
    'POST',
  );
  return json.role;
}
