// Instructors & Applications API — per INSTRUCTORS_CONTRACT.md v1 (root).
// Real backend only (no mock flag — backend shipped 2026-08-03, 89/89 smoke green).

import { getStoredToken } from '../api/adminAuth';
import {
  InstructorApiError,
  type ActionResponse,
  type CreateInstructorRequest,
  type Instructor,
  type InstructorApplication,
  type InstructorApplicationsListResponse,
  type InstructorDetail,
  type InstructorsAnalytics,
  type InstructorsListResponse,
  type InstructorsStats,
  type SuspendInstructorRequest,
  type UpdateInstructorRequest,
} from '../types/instructors';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

// ── Fetch wrapper — same envelope as coursesApi/categoriesApi ─────────────────

async function instructorsFetch<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new InstructorApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 429 ? 'Rate limited — slow down and retry.' :
      res.status === 404 ? 'Instructor not found.' :
      res.status === 500 ? 'Something went wrong on the server.' :
      json.message ?? `HTTP ${res.status}`;
    throw new InstructorApiError(res.status, msg);
  }

  return json.data as T;
}

// ── Instructors list / stats / analytics / detail ─────────────────────────────

export interface InstructorsListParams {
  page?:           number;
  limit?:          number;
  tab?:            'all' | 'active' | 'inactive' | 'suspended' | 'top';
  sort?:           'recent' | 'name' | 'courses' | 'students';
  search?:         string;
  specialization?: string;
  categoryId?:     string;
}

export function listInstructors(params: InstructorsListParams = {}): Promise<InstructorsListResponse> {
  const qs = new URLSearchParams();
  if (params.page           !== undefined) qs.set('page',           String(params.page));
  if (params.limit          !== undefined) qs.set('limit',          String(params.limit));
  if (params.tab)                          qs.set('tab',            params.tab);
  if (params.sort)                         qs.set('sort',           params.sort);
  if (params.search)                       qs.set('search',         params.search);
  if (params.specialization)               qs.set('specialization', params.specialization);
  if (params.categoryId)                   qs.set('categoryId',     params.categoryId);
  return instructorsFetch<InstructorsListResponse>(`/instructors?${qs.toString()}`);
}

export function getInstructorsStats(): Promise<InstructorsStats> {
  return instructorsFetch<InstructorsStats>('/instructors/stats');
}

export function getInstructorsAnalytics(): Promise<InstructorsAnalytics> {
  return instructorsFetch<InstructorsAnalytics>('/instructors/analytics');
}

export function getInstructor(id: string): Promise<InstructorDetail> {
  return instructorsFetch<InstructorDetail>(`/instructors/${encodeURIComponent(id)}`);
}

export function createInstructor(body: CreateInstructorRequest): Promise<Instructor> {
  return instructorsFetch<Instructor>('/instructors', 'POST', body);
}

export function updateInstructor(id: string, body: UpdateInstructorRequest): Promise<InstructorDetail> {
  return instructorsFetch<InstructorDetail>(`/instructors/${encodeURIComponent(id)}`, 'PATCH', body);
}

export function verifyInstructor(id: string): Promise<InstructorDetail> {
  return instructorsFetch<InstructorDetail>(`/instructors/${encodeURIComponent(id)}/verify`, 'PATCH', {});
}

export function suspendInstructor(id: string, body: SuspendInstructorRequest): Promise<InstructorDetail> {
  return instructorsFetch<InstructorDetail>(`/instructors/${encodeURIComponent(id)}/suspend`, 'PATCH', body);
}

export function reactivateInstructor(id: string): Promise<InstructorDetail> {
  return instructorsFetch<InstructorDetail>(`/instructors/${encodeURIComponent(id)}/reactivate`, 'PATCH', {});
}

export function deleteInstructor(id: string): Promise<{ id: string }> {
  return instructorsFetch<{ id: string }>(`/instructors/${encodeURIComponent(id)}`, 'DELETE');
}

// ── Applications ────────────────────────────────────────────────────────────

export interface InstructorApplicationsParams {
  page?:   number;
  limit?:  number;
  status?: 'pending' | 'changes_requested' | 'approved' | 'rejected';
  search?: string;
}

export function listInstructorApplications(
  params: InstructorApplicationsParams = {},
): Promise<InstructorApplicationsListResponse> {
  const qs = new URLSearchParams();
  if (params.page  !== undefined) qs.set('page',  String(params.page));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.status)              qs.set('status', params.status);
  if (params.search)              qs.set('search', params.search);
  return instructorsFetch<InstructorApplicationsListResponse>(`/instructor-applications?${qs.toString()}`);
}

export function getInstructorApplication(id: string): Promise<InstructorApplication> {
  return instructorsFetch<InstructorApplication>(`/instructor-applications/${encodeURIComponent(id)}`);
}

export function approveInstructorApplication(
  id: string, reviewNotes?: string,
): Promise<{ application: InstructorApplication; userId: string }> {
  return instructorsFetch(`/instructor-applications/${encodeURIComponent(id)}/approve`, 'PATCH', {
    ...(reviewNotes ? { reviewNotes } : {}),
  });
}

export function rejectInstructorApplication(
  id: string, rejectionReason: string,
): Promise<{ application: InstructorApplication }> {
  return instructorsFetch(`/instructor-applications/${encodeURIComponent(id)}/reject`, 'PATCH', { rejectionReason });
}

export function requestChangesInstructorApplication(
  id: string, changeRequest: string,
): Promise<{ application: InstructorApplication }> {
  return instructorsFetch(`/instructor-applications/${encodeURIComponent(id)}/request-changes`, 'PATCH', { changeRequest });
}

export type { ActionResponse };
export { InstructorApiError };
