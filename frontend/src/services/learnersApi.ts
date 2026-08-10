// Learners API — per LEARNERS_CONTRACT.md (Part 10). Mirrors instructorsApi.ts
// exactly: same fetch wrapper shape, same error class pattern. Real backend only.

import { getStoredToken } from '../api/adminAuth';
import {
  LearnerApiError,
  type ActionResponse,
  type BulkEnrollLearnersRequest,
  type ConfirmLearnerDocumentRequest,
  type CreateLearnerEnrollmentRequest,
  type CreateLearnerRequest,
  type EnrollResult,
  type GradeAssessmentRequest,
  type Learner,
  type LearnerActivityResponse,
  type LearnerActivityType,
  type LearnerAssessment,
  type LearnerAssessmentsResponse,
  type LearnerAttendanceResponse,
  type LearnerCertificatesResponse,
  type LearnerDetail,
  type LearnerDocument,
  type LearnerDocumentsResponse,
  type LearnerDocumentType,
  type LearnerEnrollmentsResponse,
  type LearnerProgressResponse,
  type LearnerTicket,
  type LearnerTicketsResponse,
  type LearnersAnalytics,
  type LearnersListResponse,
  type LearnersStats,
  type ReissueCertificateRequest,
  type ResetLearnerPasswordRequest,
  type RevokeCertificateRequest,
  type SignLearnerDocumentRequest,
  type SignLearnerDocumentResponse,
  type SuspendLearnerRequest,
  type SuspensionHistoryResponse,
  type TicketStatus,
  type UpdateLearnerRequest,
} from '../types/learners';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

async function learnersFetch<T>(
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

  if (res.status === 401) throw new LearnerApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 429 ? 'Rate limited — slow down and retry.' :
      res.status === 500 ? 'Something went wrong on the server.' :
      json.message ?? (res.status === 404 ? 'Not found.' : `HTTP ${res.status}`);
    const errData = json.data as unknown as { activeEnrollments?: number } | undefined;
    throw new LearnerApiError(res.status, msg, errData);
  }

  return json.data as T;
}

// ── List / stats / analytics / detail ─────────────────────────────────────────

export interface LearnersListParams {
  page?:       number;
  limit?:      number;
  tab?:        'all' | 'active' | 'inactive' | 'suspended' | 'at-risk' | 'completed' | 'pending-verification' | 'graduated';
  sort?:       'recent' | 'name' | 'courses' | 'progress';
  search?:     string;
  department?: string;
  program?:    string;
}

export function listLearners(params: LearnersListParams = {}): Promise<LearnersListResponse> {
  const qs = new URLSearchParams();
  if (params.page       !== undefined) qs.set('page',       String(params.page));
  if (params.limit      !== undefined) qs.set('limit',      String(params.limit));
  if (params.tab)                      qs.set('tab',        params.tab);
  if (params.sort)                     qs.set('sort',       params.sort);
  if (params.search)                   qs.set('search',     params.search);
  if (params.department)               qs.set('department', params.department);
  if (params.program)                  qs.set('program',    params.program);
  return learnersFetch<LearnersListResponse>(`/learners?${qs.toString()}`);
}

export function getLearnersStats(): Promise<LearnersStats> {
  return learnersFetch<LearnersStats>('/learners/stats');
}

export function getLearnersAnalytics(): Promise<LearnersAnalytics> {
  return learnersFetch<LearnersAnalytics>('/learners/analytics');
}

export function getLearner(id: string): Promise<LearnerDetail> {
  return learnersFetch<LearnerDetail>(`/learners/${encodeURIComponent(id)}`);
}

export function createLearner(body: CreateLearnerRequest): Promise<Learner> {
  return learnersFetch<Learner>('/learners', 'POST', body);
}

// Real backend PATCH /learners/:id returns mapLearner(updated) — a bare
// Learner, not LearnerDetail (suspend/reactivate DO return LearnerDetail,
// since their service functions end with getLearner(id) — same asymmetry as
// instructorsApi.updateInstructor).
export function updateLearner(id: string, body: UpdateLearnerRequest): Promise<Learner> {
  return learnersFetch<Learner>(`/learners/${encodeURIComponent(id)}`, 'PATCH', body);
}

export function suspendLearner(id: string, body: SuspendLearnerRequest): Promise<LearnerDetail> {
  return learnersFetch<LearnerDetail>(`/learners/${encodeURIComponent(id)}/suspend`, 'PATCH', body);
}

export function reactivateLearner(id: string): Promise<LearnerDetail> {
  return learnersFetch<LearnerDetail>(`/learners/${encodeURIComponent(id)}/reactivate`, 'PATCH', {});
}

export function resetLearnerPassword(id: string, body: ResetLearnerPasswordRequest): Promise<{ id: string }> {
  return learnersFetch<{ id: string }>(`/learners/${encodeURIComponent(id)}/reset-password`, 'PATCH', body);
}

export function getSuspensionHistory(
  id: string, params: { page?: number; limit?: number } = {},
): Promise<SuspensionHistoryResponse> {
  const qs = new URLSearchParams();
  if (params.page  !== undefined) qs.set('page',  String(params.page));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  return learnersFetch<SuspensionHistoryResponse>(`/learners/${encodeURIComponent(id)}/suspension-history?${qs.toString()}`);
}

export function deleteLearner(id: string): Promise<{ id: string }> {
  return learnersFetch<{ id: string }>(`/learners/${encodeURIComponent(id)}`, 'DELETE');
}

// ── Enrollments / progress / activity (Part 3) ────────────────────────────────

export function listLearnerEnrollments(
  id: string, params: { page?: number; limit?: number; status?: string } = {},
): Promise<LearnerEnrollmentsResponse> {
  const qs = new URLSearchParams();
  if (params.page   !== undefined) qs.set('page',   String(params.page));
  if (params.limit  !== undefined) qs.set('limit',  String(params.limit));
  if (params.status)               qs.set('status', params.status);
  return learnersFetch<LearnerEnrollmentsResponse>(`/learners/${encodeURIComponent(id)}/enrollments?${qs.toString()}`);
}

export function createLearnerEnrollment(id: string, body: CreateLearnerEnrollmentRequest): Promise<EnrollResult | LearnerEnrollmentsResponse['enrollments'][number]> {
  return learnersFetch(`/learners/${encodeURIComponent(id)}/enrollments`, 'POST', body);
}

export function deleteLearnerEnrollment(id: string, enrollmentId: string): Promise<{ id: string }> {
  return learnersFetch<{ id: string }>(`/learners/${encodeURIComponent(id)}/enrollments/${encodeURIComponent(enrollmentId)}`, 'DELETE');
}

// Not nested under :id — one call enrolls many learners into one course/path.
export function bulkEnrollLearners(body: BulkEnrollLearnersRequest): Promise<EnrollResult> {
  return learnersFetch<EnrollResult>('/learners/bulk-enroll', 'POST', body);
}

export function getLearnerProgress(id: string): Promise<LearnerProgressResponse> {
  return learnersFetch<LearnerProgressResponse>(`/learners/${encodeURIComponent(id)}/progress`);
}

export function resetLearnerProgress(id: string, courseId: string): Promise<LearnerProgressResponse['courses'][number]> {
  return learnersFetch(`/learners/${encodeURIComponent(id)}/progress/${encodeURIComponent(courseId)}/reset`, 'POST', {});
}

export function getLearnerActivity(
  id: string, params: { page?: number; limit?: number; type?: LearnerActivityType } = {},
): Promise<LearnerActivityResponse> {
  const qs = new URLSearchParams();
  if (params.page  !== undefined) qs.set('page',  String(params.page));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.type)                qs.set('type',  params.type);
  return learnersFetch<LearnerActivityResponse>(`/learners/${encodeURIComponent(id)}/activity?${qs.toString()}`);
}

// ── Assessments / Certificates / Attendance (Part 5/6) ────────────────────────

export function listLearnerAssessments(
  id: string, params: { page?: number; limit?: number } = {},
): Promise<LearnerAssessmentsResponse> {
  const qs = new URLSearchParams();
  if (params.page  !== undefined) qs.set('page',  String(params.page));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  return learnersFetch<LearnerAssessmentsResponse>(`/learners/${encodeURIComponent(id)}/assessments?${qs.toString()}`);
}

export function reopenAssessment(id: string, attemptId: string): Promise<LearnerAssessment> {
  return learnersFetch<LearnerAssessment>(`/learners/${encodeURIComponent(id)}/assessments/${encodeURIComponent(attemptId)}/reopen`, 'POST', {});
}

export function resetAssessment(id: string, attemptId: string): Promise<LearnerAssessment> {
  return learnersFetch<LearnerAssessment>(`/learners/${encodeURIComponent(id)}/assessments/${encodeURIComponent(attemptId)}/reset`, 'POST', {});
}

export function gradeAssessment(id: string, attemptId: string, body: GradeAssessmentRequest): Promise<LearnerAssessment> {
  return learnersFetch<LearnerAssessment>(`/learners/${encodeURIComponent(id)}/assessments/${encodeURIComponent(attemptId)}/grade`, 'PATCH', body);
}

export function listLearnerCertificates(
  id: string, params: { page?: number; limit?: number } = {},
): Promise<LearnerCertificatesResponse> {
  const qs = new URLSearchParams();
  if (params.page  !== undefined) qs.set('page',  String(params.page));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  return learnersFetch<LearnerCertificatesResponse>(`/learners/${encodeURIComponent(id)}/certificates?${qs.toString()}`);
}

export function reissueLearnerCertificate(id: string, certId: string, body: ReissueCertificateRequest = {}) {
  return learnersFetch(`/learners/${encodeURIComponent(id)}/certificates/${encodeURIComponent(certId)}/reissue`, 'POST', body);
}

export function revokeLearnerCertificate(id: string, certId: string, body: RevokeCertificateRequest = {}) {
  return learnersFetch(`/learners/${encodeURIComponent(id)}/certificates/${encodeURIComponent(certId)}/revoke`, 'POST', body);
}

export function getLearnerAttendance(
  id: string, params: { page?: number; limit?: number } = {},
): Promise<LearnerAttendanceResponse> {
  const qs = new URLSearchParams();
  if (params.page  !== undefined) qs.set('page',  String(params.page));
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  return learnersFetch<LearnerAttendanceResponse>(`/learners/${encodeURIComponent(id)}/attendance?${qs.toString()}`);
}

// ── Documents (Part 7/8) — sign -> client PUT -> confirm, mirrors instructor
// documents exactly (this API never receives file bytes). ────────────────────

export function listLearnerDocuments(
  id: string, params: { type?: LearnerDocumentType; status?: string; includeArchived?: boolean } = {},
): Promise<LearnerDocumentsResponse> {
  const qs = new URLSearchParams();
  if (params.type)   qs.set('type',   params.type);
  if (params.status) qs.set('status', params.status);
  if (params.includeArchived) qs.set('includeArchived', 'true');
  return learnersFetch<LearnerDocumentsResponse>(`/learners/${encodeURIComponent(id)}/documents?${qs.toString()}`);
}

export function signLearnerDocument(id: string, body: SignLearnerDocumentRequest): Promise<SignLearnerDocumentResponse> {
  return learnersFetch<SignLearnerDocumentResponse>(`/learners/${encodeURIComponent(id)}/documents/sign`, 'POST', body);
}

export function confirmLearnerDocument(id: string, body: ConfirmLearnerDocumentRequest): Promise<LearnerDocument> {
  return learnersFetch<LearnerDocument>(`/learners/${encodeURIComponent(id)}/documents/confirm`, 'POST', body);
}

export function verifyLearnerDocument(id: string, docId: string): Promise<LearnerDocument> {
  return learnersFetch<LearnerDocument>(`/learners/${encodeURIComponent(id)}/documents/${encodeURIComponent(docId)}/verify`, 'PATCH', {});
}

export function rejectLearnerDocument(id: string, docId: string, reason: string): Promise<LearnerDocument> {
  return learnersFetch<LearnerDocument>(`/learners/${encodeURIComponent(id)}/documents/${encodeURIComponent(docId)}/reject`, 'PATCH', { reason });
}

export function archiveLearnerDocument(id: string, docId: string): Promise<LearnerDocument> {
  return learnersFetch<LearnerDocument>(`/learners/${encodeURIComponent(id)}/documents/${encodeURIComponent(docId)}`, 'DELETE');
}

// ── Tickets (Part 7/8) — no create endpoint (see the backend validator's
// header note). ────────────────────────────────────────────────────────────────

export function listLearnerTickets(
  id: string, params: { page?: number; limit?: number; status?: TicketStatus } = {},
): Promise<LearnerTicketsResponse> {
  const qs = new URLSearchParams();
  if (params.page   !== undefined) qs.set('page',   String(params.page));
  if (params.limit  !== undefined) qs.set('limit',  String(params.limit));
  if (params.status)               qs.set('status', params.status);
  return learnersFetch<LearnerTicketsResponse>(`/learners/${encodeURIComponent(id)}/tickets?${qs.toString()}`);
}

export function respondToLearnerTicket(id: string, ticketId: string, body: string): Promise<LearnerTicket> {
  return learnersFetch<LearnerTicket>(`/learners/${encodeURIComponent(id)}/tickets/${encodeURIComponent(ticketId)}/respond`, 'PATCH', { body });
}

export function resolveLearnerTicket(id: string, ticketId: string, resolution?: string): Promise<LearnerTicket> {
  return learnersFetch<LearnerTicket>(`/learners/${encodeURIComponent(id)}/tickets/${encodeURIComponent(ticketId)}/resolve`, 'PATCH', resolution ? { resolution } : {});
}

export function escalateLearnerTicket(id: string, ticketId: string, priority?: string): Promise<LearnerTicket> {
  return learnersFetch<LearnerTicket>(`/learners/${encodeURIComponent(id)}/tickets/${encodeURIComponent(ticketId)}/escalate`, 'PATCH', priority ? { priority } : {});
}

export type { ActionResponse };
export { LearnerApiError };
