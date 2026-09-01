// Instructor self-service Live Sessions API (Phase 3).
// Same fetch-wrapper convention as api/instructorCoursesApi.ts — reuses the
// exact admin types (types/liveSessions.ts) since the backend reuses the
// exact admin liveSessions.service functions.

import { getStoredInstructorToken } from './instructorAuth';
import { InstructorApiError } from '../types/instructors';
import type {
  LiveSession,
  LiveSessionListParams,
  CreateLiveSessionPayload,
  UpdateLiveSessionPayload,
  MarkAttendanceRecord,
  AttendanceRecordResult,
} from '../types/liveSessions';

const BASE = (import.meta.env.VITE_INSTRUCTOR_API_BASE_URL2 ?? 'http://localhost:5001/api/instructor') + '/live-sessions';

async function instructorLiveSessionsFetch<T>(
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
      res.status === 502 ? 'Zoom is temporarily unavailable — try again shortly.' :
      res.status === 503 ? (json.message ?? 'Zoom is not configured.') :
      res.status === 500 ? 'Something went wrong on the server.' :
      json.message ?? (res.status === 404 ? 'Not found.' : `HTTP ${res.status}`);
    throw new InstructorApiError(res.status, msg);
  }

  return json.data as T;
}

export function listMySessions(params: LiveSessionListParams = {}): Promise<LiveSession[]> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.courseId) qs.set('courseId', params.courseId);
  // Deliberately never sets ?instructorId= — server-forced regardless.
  return instructorLiveSessionsFetch<LiveSession[]>(`?${qs.toString()}`);
}

export function getMySession(id: string): Promise<LiveSession> {
  return instructorLiveSessionsFetch<LiveSession>(`/${encodeURIComponent(id)}`);
}

export function createMySession(body: Omit<CreateLiveSessionPayload, 'instructorId'>): Promise<LiveSession> {
  return instructorLiveSessionsFetch<LiveSession>('', 'POST', body);
}

export function updateMySession(id: string, body: Omit<UpdateLiveSessionPayload, 'instructorId'>): Promise<LiveSession> {
  return instructorLiveSessionsFetch<LiveSession>(`/${encodeURIComponent(id)}`, 'PATCH', body);
}

export function deleteMySession(id: string): Promise<{ id: string }> {
  return instructorLiveSessionsFetch(`/${encodeURIComponent(id)}`, 'DELETE');
}

export function endMySession(id: string): Promise<LiveSession> {
  return instructorLiveSessionsFetch<LiveSession>(`/${encodeURIComponent(id)}/end`, 'PATCH');
}

export function markMyAttendance(id: string, records: MarkAttendanceRecord[]): Promise<AttendanceRecordResult[]> {
  return instructorLiveSessionsFetch(`/${encodeURIComponent(id)}/attendance`, 'PATCH', { records });
}
