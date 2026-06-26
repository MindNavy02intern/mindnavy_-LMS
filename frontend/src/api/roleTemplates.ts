import { getStoredToken } from './adminAuth';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

export interface RoleTemplateListItem {
  id: string;
  name: string;
  description: string | null;
  permissionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface RoleTemplatePermission {
  id: string;
  name: string;
  description: string | null;
  category: string;
}

export interface RoleTemplateDetails extends RoleTemplateListItem {
  permissions: RoleTemplatePermission[];
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ApplyRoleTemplateResult {
  templateId: string;
  roleId: string;
  applied: number;
}

export class RoleTemplateError extends Error {
  status: number;
  missing?: string[];
  constructor(status: number, message: string, missing?: string[]) {
    super(message);
    this.name = 'RoleTemplateError';
    this.status = status;
    this.missing = missing;
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
    const j = json as { message?: string; missing?: string[] };
    throw new RoleTemplateError(res.status, j.message ?? `HTTP ${res.status}`, j.missing);
  }
  return json as T;
}

export async function getRoleTemplates(params: {
  page: number;
  limit: number;
  search?: string;
}): Promise<{ data: RoleTemplateListItem[]; pagination: Pagination }> {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page));
  qs.set('limit', String(params.limit));
  if (params.search) qs.set('search', params.search);
  const json = await apiFetch<{ success: boolean; data: RoleTemplateListItem[]; pagination: Pagination }>(
    `/role-templates?${qs.toString()}`,
  );
  return { data: json.data, pagination: json.pagination };
}

export async function getRoleTemplateDetails(id: string): Promise<RoleTemplateDetails> {
  const json = await apiFetch<{ success: boolean; data: RoleTemplateDetails }>(
    `/role-templates/${encodeURIComponent(id)}`,
  );
  return json.data;
}

export async function createRoleTemplate(payload: {
  name: string;
  description?: string | null;
  permissions: string[];
}): Promise<RoleTemplateListItem> {
  const json = await apiFetch<{ success: boolean; data: RoleTemplateListItem }>(
    '/role-templates',
    'POST',
    payload,
  );
  return json.data;
}

export async function applyRoleTemplate(id: string, roleId: string): Promise<ApplyRoleTemplateResult> {
  const json = await apiFetch<{ success: boolean; data: ApplyRoleTemplateResult }>(
    `/role-templates/${encodeURIComponent(id)}/apply`,
    'POST',
    { roleId },
  );
  return json.data;
}

export async function deleteRoleTemplate(id: string): Promise<void> {
  await apiFetch<{ success: boolean; message: string }>(
    `/role-templates/${encodeURIComponent(id)}`,
    'DELETE',
  );
}
