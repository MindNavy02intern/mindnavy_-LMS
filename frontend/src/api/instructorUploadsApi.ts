// Instructor self-service Uploads API — same sign->PUT->confirm pattern as
// api/uploadsApi.ts (admin), scoped to /api/instructor/courses/:id/uploads.
// courseId travels in the URL only — the backend forces it server-side and
// ignores any body value, so these functions never take a courseId field in
// the request body (unlike admin's UploadSignRequest/UploadConfirmRequest).

import { getStoredInstructorToken } from './instructorAuth';
import { fetchWithRetry } from '../lib/fetchWithRetry';
import {
  UploadApiError,
  type UploadKind,
  type UploadSignResponse,
  type UploadConfirmResponse,
} from '../types/uploads';

const BASE = import.meta.env.VITE_INSTRUCTOR_API_BASE_URL2 ?? 'http://localhost:5001/api/instructor';

async function uploadFetch<T>(path: string, options: RequestInit): Promise<T> {
  const token = getStoredInstructorToken();
  const res = await fetchWithRetry(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    throw new UploadApiError(res.status, json.message ?? `HTTP ${res.status}`);
  }
  return json.data as T;
}

export interface InstructorUploadSignRequest {
  fileName: string;
  fileType: string;
  kind:     UploadKind;
}

export interface InstructorUploadConfirmRequest {
  path:      string;
  kind:      UploadKind;
  lessonId?: string;
}

export function signMyUpload(courseId: string, req: InstructorUploadSignRequest): Promise<UploadSignResponse> {
  return uploadFetch<UploadSignResponse>(`/courses/${encodeURIComponent(courseId)}/uploads/sign`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export function confirmMyUpload(courseId: string, req: InstructorUploadConfirmRequest): Promise<UploadConfirmResponse> {
  return uploadFetch<UploadConfirmResponse>(`/courses/${encodeURIComponent(courseId)}/uploads/confirm`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function deleteMyUpload(courseId: string, path: string, kind: UploadKind = 'thumbnail'): Promise<void> {
  await uploadFetch<void>(`/courses/${encodeURIComponent(courseId)}/uploads?path=${encodeURIComponent(path)}&kind=${kind}`, {
    method: 'DELETE',
  });
}

export { UploadApiError };
