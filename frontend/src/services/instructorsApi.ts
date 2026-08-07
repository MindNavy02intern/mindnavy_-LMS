// Instructors & Applications API — per INSTRUCTORS_CONTRACT.md v1 (root).
// Real backend only (no mock flag — backend shipped 2026-08-03, 89/89 smoke green).

import { getStoredToken } from '../api/adminAuth';
import {
  InstructorApiError,
  type ActionResponse,
  type ConfirmDocumentRequest,
  type CreateCertificationRequest,
  type CreateInstructorRequest,
  type DocumentType,
  type Instructor,
  type InstructorApplication,
  type InstructorApplicationsListResponse,
  type InstructorCertification,
  type InstructorCertificationsResponse,
  type InstructorDetail,
  type InstructorDocument,
  type InstructorDocumentsResponse,
  type InstructorReview,
  type InstructorReviewsResponse,
  type InstructorsAnalytics,
  type InstructorsListResponse,
  type InstructorsStats,
  type SignCertificationRequest,
  type SignCertificationResponse,
  type SignDocumentRequest,
  type SignDocumentResponse,
  type SuspendInstructorRequest,
  type SuspensionHistoryResponse,
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
      res.status === 500 ? 'Something went wrong on the server.' :
      json.message ?? (res.status === 404 ? 'Not found.' : `HTTP ${res.status}`);
    // 409 delete-blocked responses carry { courses, liveSessions } — this helper
    // also backs the applications endpoints, so `data`'s shape varies by call;
    // callers that care (deleteInstructor) read it off the thrown error.
    const errData = json.data as unknown as { courses?: number; liveSessions?: number } | undefined;
    throw new InstructorApiError(res.status, msg, errData);
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

// Real backend PATCH /instructors/:id returns mapInstructor(updated) — a bare
// Instructor, not the full InstructorDetail (verify/suspend/reactivate DO
// return InstructorDetail, since their service functions end with
// getInstructor(id); update's does not).
export function updateInstructor(id: string, body: UpdateInstructorRequest): Promise<Instructor> {
  return instructorsFetch<Instructor>(`/instructors/${encodeURIComponent(id)}`, 'PATCH', body);
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

export function getSuspensionHistory(
  id: string, params: { page?: number; limit?: number } = {},
): Promise<SuspensionHistoryResponse> {
  const qs = new URLSearchParams();
  if (params.page  !== undefined) qs.set('page',  String(params.page));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  return instructorsFetch<SuspensionHistoryResponse>(`/instructors/${encodeURIComponent(id)}/suspension-history?${qs.toString()}`);
}

export function deleteInstructor(id: string): Promise<{ id: string }> {
  return instructorsFetch<{ id: string }>(`/instructors/${encodeURIComponent(id)}`, 'DELETE');
}

// ── Documents ──────────────────────────────────────────────────────────────
// Upload is 3 steps — this API never receives the file. sign() -> browser PUTs
// straight to storage -> confirm(). If the PUT fails, do not call confirm.

export function listInstructorDocuments(
  id: string, params: { type?: DocumentType; status?: string; includeArchived?: boolean } = {},
): Promise<InstructorDocumentsResponse> {
  const qs = new URLSearchParams();
  if (params.type)   qs.set('type',   params.type);
  if (params.status) qs.set('status', params.status);
  if (params.includeArchived) qs.set('includeArchived', 'true');
  return instructorsFetch<InstructorDocumentsResponse>(`/instructors/${encodeURIComponent(id)}/documents?${qs.toString()}`);
}

export function signInstructorDocument(id: string, body: SignDocumentRequest): Promise<SignDocumentResponse> {
  return instructorsFetch<SignDocumentResponse>(`/instructors/${encodeURIComponent(id)}/documents/sign`, 'POST', body);
}

export function confirmInstructorDocument(id: string, body: ConfirmDocumentRequest): Promise<InstructorDocument> {
  return instructorsFetch<InstructorDocument>(`/instructors/${encodeURIComponent(id)}/documents/confirm`, 'POST', body);
}

export function verifyInstructorDocument(id: string, docId: string): Promise<InstructorDocument> {
  return instructorsFetch<InstructorDocument>(`/instructors/${encodeURIComponent(id)}/documents/${encodeURIComponent(docId)}/verify`, 'PATCH', {});
}

export function rejectInstructorDocument(id: string, docId: string, reason: string): Promise<InstructorDocument> {
  return instructorsFetch<InstructorDocument>(`/instructors/${encodeURIComponent(id)}/documents/${encodeURIComponent(docId)}/reject`, 'PATCH', { reason });
}

export function archiveInstructorDocument(id: string, docId: string): Promise<InstructorDocument> {
  return instructorsFetch<InstructorDocument>(`/instructors/${encodeURIComponent(id)}/documents/${encodeURIComponent(docId)}`, 'DELETE');
}

// ── Reviews (moderation queue) ────────────────────────────────────────────────
// NOT in INSTRUCTORS_CONTRACT.md v1 — shipped 2026-08-07 at the user's explicit
// direction despite the contract documenting "no Review model" as a deliberate
// gap. See types/instructors.ts InstructorReview for the full note.

export function listInstructorReviews(
  id: string, params: { page?: number; limit?: number; status?: string } = {},
): Promise<InstructorReviewsResponse> {
  const qs = new URLSearchParams();
  if (params.page   !== undefined) qs.set('page',   String(params.page));
  if (params.limit  !== undefined) qs.set('limit',  String(params.limit));
  if (params.status)               qs.set('status', params.status);
  return instructorsFetch<InstructorReviewsResponse>(`/instructors/${encodeURIComponent(id)}/reviews?${qs.toString()}`);
}

export function approveInstructorReview(id: string, reviewId: string): Promise<InstructorReview> {
  return instructorsFetch<InstructorReview>(`/instructors/${encodeURIComponent(id)}/reviews/${encodeURIComponent(reviewId)}/approve`, 'PATCH', {});
}

export function removeInstructorReview(id: string, reviewId: string): Promise<InstructorReview> {
  return instructorsFetch<InstructorReview>(`/instructors/${encodeURIComponent(id)}/reviews/${encodeURIComponent(reviewId)}/remove`, 'PATCH', {});
}

export function flagInstructorReview(id: string, reviewId: string): Promise<InstructorReview> {
  return instructorsFetch<InstructorReview>(`/instructors/${encodeURIComponent(id)}/reviews/${encodeURIComponent(reviewId)}/flag`, 'PATCH', {});
}

// ── Certifications (teaching certs — separate entity from Documents) ─────────
// NOT in INSTRUCTORS_CONTRACT.md v1 — shipped 2026-08-07 at the user's explicit
// direction despite the contract documenting this as a deliberately unshipped,
// separate entity. Upload is sign -> client PUT -> create (same pattern as
// Documents; this API never receives file bytes).

export function listInstructorCertifications(
  id: string, params: { type?: string; status?: string } = {},
): Promise<InstructorCertificationsResponse> {
  const qs = new URLSearchParams();
  if (params.type)   qs.set('type',   params.type);
  if (params.status) qs.set('status', params.status);
  return instructorsFetch<InstructorCertificationsResponse>(`/instructors/${encodeURIComponent(id)}/certifications?${qs.toString()}`);
}

export function signInstructorCertification(id: string, body: SignCertificationRequest): Promise<SignCertificationResponse> {
  return instructorsFetch<SignCertificationResponse>(`/instructors/${encodeURIComponent(id)}/certifications/sign`, 'POST', body);
}

export function createInstructorCertification(id: string, body: CreateCertificationRequest): Promise<InstructorCertification> {
  return instructorsFetch<InstructorCertification>(`/instructors/${encodeURIComponent(id)}/certifications`, 'POST', body);
}

export function verifyInstructorCertification(id: string, certId: string): Promise<InstructorCertification> {
  return instructorsFetch<InstructorCertification>(`/instructors/${encodeURIComponent(id)}/certifications/${encodeURIComponent(certId)}/verify`, 'PATCH', {});
}

export function rejectInstructorCertification(id: string, certId: string): Promise<InstructorCertification> {
  return instructorsFetch<InstructorCertification>(`/instructors/${encodeURIComponent(id)}/certifications/${encodeURIComponent(certId)}/reject`, 'PATCH', {});
}

export function deleteInstructorCertification(id: string, certId: string): Promise<{ id: string }> {
  return instructorsFetch<{ id: string }>(`/instructors/${encodeURIComponent(id)}/certifications/${encodeURIComponent(certId)}`, 'DELETE');
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

// Real backend returns the mapped application flat (no `{ application }`
// wrapper) for reject/request-changes — only approve wraps it, since approve
// also returns a sibling `userId`.
export function rejectInstructorApplication(
  id: string, rejectionReason: string,
): Promise<InstructorApplication> {
  return instructorsFetch(`/instructor-applications/${encodeURIComponent(id)}/reject`, 'PATCH', { rejectionReason });
}

export function requestChangesInstructorApplication(
  id: string, changeRequest: string,
): Promise<InstructorApplication> {
  return instructorsFetch(`/instructor-applications/${encodeURIComponent(id)}/request-changes`, 'PATCH', { changeRequest });
}

export type { ActionResponse };
export { InstructorApiError };
