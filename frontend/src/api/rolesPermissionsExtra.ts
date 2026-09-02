// Company Roles + Delegated Admins — the two Roles & Permissions tabs that
// had zero backend (DEFERRED_ITEMS.md). Same fetch/error shape as
// rolesPage.ts / accessPoliciesPage.ts.
import { getStoredToken } from './adminAuth';
import { fetchWithRetry } from '../lib/fetchWithRetry';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

export class RolesPermissionsExtraError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.name = 'RolesPermissionsExtraError';
    this.code = code;
  }
}

async function apiFetch<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = getStoredToken();
  const res = await fetchWithRetry(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
  if (!res.ok) {
    const j = json as { message?: string; error?: string };
    throw new RolesPermissionsExtraError(res.status, j.message ?? `HTTP ${res.status}`, j.error);
  }
  return json as T;
}

// ── Company Roles ────────────────────────────────────────────────────────

export type CompanyRoleStatus = 'ACTIVE' | 'INACTIVE';

export interface CompanyRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isSystem: boolean;
  status: CompanyRoleStatus;
  userCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyRolePayload {
  name: string;
  description?: string | null;
  permissions?: string[];
  status?: CompanyRoleStatus;
}

export async function listCompanyRoles(params: { search?: string; status?: string; page?: number; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.status) qs.set('status', params.status);
  qs.set('page', String(params.page ?? 1));
  qs.set('limit', String(params.limit ?? 20));
  return apiFetch<{ success: boolean; data: CompanyRole[]; pagination: { total: number; page: number; limit: number; pages: number } }>(
    `/company-roles?${qs.toString()}`,
  );
}

export async function getCompanyRolePermissionCatalog(): Promise<string[]> {
  const json = await apiFetch<{ success: boolean; data: string[] }>('/company-roles/permissions');
  return json.data;
}

export async function createCompanyRole(payload: CompanyRolePayload): Promise<CompanyRole> {
  const json = await apiFetch<{ success: boolean; data: CompanyRole }>('/company-roles', 'POST', payload);
  return json.data;
}

export async function updateCompanyRole(id: string, payload: Partial<CompanyRolePayload>): Promise<CompanyRole> {
  const json = await apiFetch<{ success: boolean; data: CompanyRole }>(`/company-roles/${encodeURIComponent(id)}`, 'PATCH', payload);
  return json.data;
}

export async function deleteCompanyRole(id: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/company-roles/${encodeURIComponent(id)}`, 'DELETE');
}

// ── Delegated Admins ─────────────────────────────────────────────────────

export type DelegatedAdminStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED';

export interface AdminDirectoryEntry {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
}

export interface DelegatedAdminGrant {
  id: string;
  adminId: string;
  grantedById: string;
  scopeRole: string;
  reason: string | null;
  status: 'ACTIVE' | 'REVOKED';
  effectiveStatus: DelegatedAdminStatus;
  expiresAt: string | null;
  grantedAt: string;
  revokedAt: string | null;
  revokedById: string | null;
  admin: { id: string; fullName: string; email: string } | null;
  grantedBy: { id: string; fullName: string; email: string } | null;
  revokedBy: { id: string; fullName: string; email: string } | null;
}

export async function listDelegatedAdmins(params: { status?: string; page?: number; limit?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  qs.set('page', String(params.page ?? 1));
  qs.set('limit', String(params.limit ?? 20));
  return apiFetch<{ success: boolean; data: DelegatedAdminGrant[]; pagination: { total: number; page: number; limit: number; pages: number } }>(
    `/delegated-admins?${qs.toString()}`,
  );
}

export async function getAdminDirectory(): Promise<AdminDirectoryEntry[]> {
  const json = await apiFetch<{ success: boolean; data: AdminDirectoryEntry[] }>('/delegated-admins/directory');
  return json.data;
}

export async function grantDelegatedAdmin(payload: { adminId: string; scopeRole: string; reason?: string | null; expiresAt?: string | null }): Promise<DelegatedAdminGrant> {
  const json = await apiFetch<{ success: boolean; data: DelegatedAdminGrant }>('/delegated-admins', 'POST', payload);
  return json.data;
}

export async function revokeDelegatedAdmin(id: string): Promise<DelegatedAdminGrant> {
  const json = await apiFetch<{ success: boolean; data: DelegatedAdminGrant }>(`/delegated-admins/${encodeURIComponent(id)}/revoke`, 'POST');
  return json.data;
}
