import type {
  DepartmentsResponse,
  DepartmentDetail,
  CreateDepartmentBody,
  Department,
  BranchesResponse,
  BranchDetail,
  CreateBranchBody,
  Branch,
  TeamsResponse,
  TeamDetail,
  CreateTeamBody,
  Team,
  OrgChart,
  HierarchySettings,
} from '../types/organization';
import { getStoredToken } from './adminAuth';
import { ApiError } from './users';
import { fetchWithRetry } from '../lib/fetchWithRetry';

const ORG_URL = `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin'}/organization`;

async function orgFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    Authorization: token ? `Bearer ${token}` : '',
  };
  if (init?.body) headers['Content-Type'] = 'application/json';

  try {
    const res = await fetchWithRetry(url, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string> ?? {}) } });
    if (res.ok) return await res.json() as T;
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, (body as { message?: string })?.message ?? `HTTP ${res.status}`);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'Network error. Please check your connection.');
  }
}

// ── Departments ────────────────────────────────────────────────────────────────

export interface DeptListParams {
  search?:   string;
  status?:   string;
  branchId?: string;
  page?:     number;
  limit?:    number;
}

export function getDepartments(params: DeptListParams = {}): Promise<DepartmentsResponse> {
  const qs = new URLSearchParams();
  if (params.search)   qs.set('search',   params.search);
  if (params.status)   qs.set('status',   params.status);
  if (params.branchId) qs.set('branchId', params.branchId);
  if (params.page)     qs.set('page',     String(params.page));
  if (params.limit)    qs.set('limit',    String(params.limit));
  return orgFetch<DepartmentsResponse>(`${ORG_URL}/departments?${qs}`);
}

export function getDepartment(id: string): Promise<DepartmentDetail> {
  return orgFetch<DepartmentDetail>(`${ORG_URL}/departments/${encodeURIComponent(id)}`);
}

export function createDepartment(body: CreateDepartmentBody): Promise<{ message: string; data: Department }> {
  return orgFetch(`${ORG_URL}/departments`, { method: 'POST', body: JSON.stringify(body) });
}

export function updateDepartment(id: string, body: Partial<CreateDepartmentBody>): Promise<{ message: string; data: Department }> {
  return orgFetch(`${ORG_URL}/departments/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteDepartment(id: string): Promise<{ message: string }> {
  return orgFetch(`${ORG_URL}/departments/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function assignUsersToDepartment(id: string, userIds: string[]): Promise<{ message: string; assignedCount: number; failedCount: number }> {
  return orgFetch(`${ORG_URL}/departments/${encodeURIComponent(id)}/assign-users`, { method: 'POST', body: JSON.stringify({ userIds }) });
}

export function getDepartmentKpis(id: string): Promise<{ totalUsers: number; activeUsers: number; completionRate: number; averageProgress: number; averageLearningTime: number; certificatesEarned: number }> {
  return orgFetch(`${ORG_URL}/departments/${encodeURIComponent(id)}/kpis`);
}

// ── Branches ───────────────────────────────────────────────────────────────────

export interface BranchListParams {
  search?: string;
  page?:   number;
  limit?:  number;
}

export function getBranches(params: BranchListParams = {}): Promise<BranchesResponse> {
  const qs = new URLSearchParams();
  if (params.search) qs.set('search', params.search);
  if (params.page)   qs.set('page',   String(params.page));
  if (params.limit)  qs.set('limit',  String(params.limit));
  return orgFetch<BranchesResponse>(`${ORG_URL}/branches?${qs}`);
}

export function getBranch(id: string): Promise<BranchDetail> {
  return orgFetch<BranchDetail>(`${ORG_URL}/branches/${encodeURIComponent(id)}`);
}

export function createBranch(body: CreateBranchBody): Promise<{ message: string; data: Branch }> {
  return orgFetch(`${ORG_URL}/branches`, { method: 'POST', body: JSON.stringify(body) });
}

export function updateBranch(id: string, body: Partial<CreateBranchBody>): Promise<{ message: string; data: Branch }> {
  return orgFetch(`${ORG_URL}/branches/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteBranch(id: string): Promise<{ message: string }> {
  return orgFetch(`${ORG_URL}/branches/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function assignDepartmentsToBranch(id: string, departmentIds: string[]): Promise<{ message: string; assignedCount: number }> {
  return orgFetch(`${ORG_URL}/branches/${encodeURIComponent(id)}/assign-departments`, { method: 'POST', body: JSON.stringify({ departmentIds }) });
}

// ── Teams ──────────────────────────────────────────────────────────────────────

export interface TeamListParams {
  search?:       string;
  departmentId?: string;
  status?:       string;
  page?:         number;
  limit?:        number;
}

export function getTeams(params: TeamListParams = {}): Promise<TeamsResponse> {
  const qs = new URLSearchParams();
  if (params.search)       qs.set('search',       params.search);
  if (params.departmentId) qs.set('departmentId', params.departmentId);
  if (params.status)       qs.set('status',       params.status);
  if (params.page)         qs.set('page',         String(params.page));
  if (params.limit)        qs.set('limit',        String(params.limit));
  return orgFetch<TeamsResponse>(`${ORG_URL}/teams?${qs}`);
}

export function getTeam(id: string): Promise<TeamDetail> {
  return orgFetch<TeamDetail>(`${ORG_URL}/teams/${encodeURIComponent(id)}`);
}

export function createTeam(body: CreateTeamBody): Promise<{ message: string; data: Team }> {
  return orgFetch(`${ORG_URL}/teams`, { method: 'POST', body: JSON.stringify(body) });
}

export function updateTeam(id: string, body: Partial<CreateTeamBody>): Promise<{ message: string; data: Team }> {
  return orgFetch(`${ORG_URL}/teams/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteTeam(id: string): Promise<{ message: string }> {
  return orgFetch(`${ORG_URL}/teams/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function assignTeamMembers(id: string, userIds: string[]): Promise<{ message: string; assignedCount: number }> {
  return orgFetch(`${ORG_URL}/teams/${encodeURIComponent(id)}/assign-members`, { method: 'POST', body: JSON.stringify({ userIds }) });
}

// ── Org Chart ──────────────────────────────────────────────────────────────────

export function getOrgChart(): Promise<OrgChart> {
  return orgFetch<OrgChart>(`${ORG_URL}/chart`);
}

export function moveOrgNode(nodeId: string, newParentId: string, action: string): Promise<{ message: string }> {
  return orgFetch(`${ORG_URL}/chart/move`, { method: 'PATCH', body: JSON.stringify({ nodeId, newParentId, action }) });
}

// ── Hierarchy Settings ─────────────────────────────────────────────────────────

export function getHierarchySettings(): Promise<HierarchySettings> {
  return orgFetch<HierarchySettings>(`${ORG_URL}/hierarchy/settings`);
}

export function updateHierarchySettings(data: Partial<HierarchySettings>): Promise<{ message: string; data: HierarchySettings }> {
  return orgFetch(`${ORG_URL}/hierarchy/settings`, { method: 'PATCH', body: JSON.stringify(data) });
}

export function resetHierarchySettings(): Promise<{ message: string; data: HierarchySettings }> {
  return orgFetch(`${ORG_URL}/hierarchy/settings/reset`, { method: 'POST', body: JSON.stringify({}) });
}
