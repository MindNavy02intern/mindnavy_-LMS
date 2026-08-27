// Instructor self-service Dashboard + Profile API (Phase 2).
// Same envelope/fetch-wrapper convention as services/instructorsApi.ts
// (unwraps { success, data } and throws InstructorApiError on failure),
// pointed at the instructor's own Bearer token (getStoredInstructorToken,
// api/instructorAuth.ts — a DIFFERENT token from the admin one, see Phase 1).

import { getStoredInstructorToken } from './instructorAuth';
import {
  InstructorApiError,
  type InstructorDetail,
  type InstructorDocument,
  type InstructorDocumentsResponse,
  type SignDocumentRequest,
  type SignDocumentResponse,
  type ConfirmDocumentRequest,
  type InstructorCertification,
  type InstructorCertificationsResponse,
  type SignCertificationRequest,
  type SignCertificationResponse,
  type CreateCertificationRequest,
} from '../types/instructors';
import type {
  InstructorDashboardStats,
  InstructorEnrollmentTrend,
  InstructorSelfActivityItem,
  UpdateInstructorSelfProfileRequest,
} from '../types/instructorSelf';

const BASE = import.meta.env.VITE_INSTRUCTOR_API_BASE_URL2 ?? 'http://localhost:5001/api/instructor';

async function instructorSelfFetch<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const token = getStoredInstructorToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new InstructorApiError(401, 'Your session has expired — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 429 ? 'Rate limited — slow down and retry.' :
      res.status === 500 ? 'Something went wrong on the server.' :
      json.message ?? (res.status === 404 ? 'Not found.' : `HTTP ${res.status}`);
    throw new InstructorApiError(res.status, msg);
  }

  return json.data as T;
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export function getMyDashboardStats(): Promise<InstructorDashboardStats> {
  return instructorSelfFetch<InstructorDashboardStats>('/dashboard/stats');
}

export function getMyEnrollmentTrend(): Promise<InstructorEnrollmentTrend> {
  return instructorSelfFetch<InstructorEnrollmentTrend>('/dashboard/enrollment-trend');
}

export function getMyActivity(): Promise<InstructorSelfActivityItem[]> {
  return instructorSelfFetch<InstructorSelfActivityItem[]>('/dashboard/activity');
}

// ── Profile ─────────────────────────────────────────────────────────────────

export function getMyProfile(): Promise<InstructorDetail> {
  return instructorSelfFetch<InstructorDetail>('/profile');
}

export function updateMyProfile(body: UpdateInstructorSelfProfileRequest): Promise<InstructorDetail> {
  return instructorSelfFetch<InstructorDetail>('/profile', 'PATCH', body);
}

// ── Profile → Documents ──────────────────────────────────────────────────────

export function listMyDocuments(): Promise<InstructorDocumentsResponse> {
  return instructorSelfFetch<InstructorDocumentsResponse>('/profile/documents');
}

export function signMyDocumentUpload(body: SignDocumentRequest): Promise<SignDocumentResponse> {
  return instructorSelfFetch<SignDocumentResponse>('/profile/documents/sign', 'POST', body);
}

export function confirmMyDocumentUpload(body: ConfirmDocumentRequest): Promise<InstructorDocument> {
  return instructorSelfFetch<InstructorDocument>('/profile/documents/confirm', 'POST', body);
}

export function withdrawMyDocument(docId: string): Promise<InstructorDocument> {
  return instructorSelfFetch<InstructorDocument>(`/profile/documents/${encodeURIComponent(docId)}`, 'DELETE');
}

// ── Profile → Certifications ─────────────────────────────────────────────────

export function listMyCertifications(): Promise<InstructorCertificationsResponse> {
  return instructorSelfFetch<InstructorCertificationsResponse>('/profile/certifications');
}

export function signMyCertificationUpload(body: SignCertificationRequest): Promise<SignCertificationResponse> {
  return instructorSelfFetch<SignCertificationResponse>('/profile/certifications/sign', 'POST', body);
}

export function createMyCertification(body: CreateCertificationRequest): Promise<InstructorCertification> {
  return instructorSelfFetch<InstructorCertification>('/profile/certifications', 'POST', body);
}

// Raw upload PUT to the signed storage URL — same pattern as the admin
// upload flow (fetch, no library), used by both documents and certifications.
export async function uploadToSignedUrl(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
  if (!res.ok) throw new InstructorApiError(res.status, 'File upload failed — please try again.');
}
