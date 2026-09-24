// Instructor self-service "My Students" API — same fetch-wrapper shape as
// instructorQuizzesApi.ts, scoped to /api/instructor/students. Read-only:
// no create/update/delete calls exist here (see the service's header
// comment for why).

import { getStoredInstructorToken } from './instructorAuth';
import { fetchWithRetry } from '../lib/fetchWithRetry';
import type {
  ListMyStudentsResult,
  StudentDetail,
  ListStudentAssessmentsResult,
  ListStudentAttendanceResult,
  ListStudentCertificatesResult,
  ListStudentActivityResult,
  EnrollmentStatus,
} from '../types/instructorStudents';

const BASE = import.meta.env.VITE_INSTRUCTOR_API_BASE_URL2 ?? 'http://localhost:5001/api/instructor';

export class InstructorStudentsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'InstructorStudentsApiError';
  }
}

async function studentsFetch<T>(path: string): Promise<T> {
  const token = getStoredInstructorToken();
  const res = await fetchWithRetry(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  if (res.status === 401) throw new InstructorStudentsApiError(401, 'Your session has expired — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 403 ? (json.message ?? 'You do not have access to this student.') :
      res.status === 404 ? (json.message ?? 'Not found.') :
      res.status === 429 ? 'Too many requests — slow down.' :
      json.message ?? `HTTP ${res.status}`;
    throw new InstructorStudentsApiError(res.status, msg);
  }

  return json.data as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}`;
}

export function listMyStudents(params: {
  search?: string;
  courseId?: string;
  status?: EnrollmentStatus;
  page?: number;
  limit?: number;
} = {}): Promise<ListMyStudentsResult> {
  return studentsFetch<ListMyStudentsResult>(`/students${qs(params)}`);
}

export function getMyStudent(id: string): Promise<StudentDetail> {
  return studentsFetch<StudentDetail>(`/students/${encodeURIComponent(id)}`);
}

export function getMyStudentAssessments(id: string, params: { page?: number; limit?: number } = {}): Promise<ListStudentAssessmentsResult> {
  return studentsFetch<ListStudentAssessmentsResult>(`/students/${encodeURIComponent(id)}/assessments${qs(params)}`);
}

export function getMyStudentAttendance(id: string, params: { page?: number; limit?: number } = {}): Promise<ListStudentAttendanceResult> {
  return studentsFetch<ListStudentAttendanceResult>(`/students/${encodeURIComponent(id)}/attendance${qs(params)}`);
}

export function getMyStudentCertificates(id: string, params: { page?: number; limit?: number } = {}): Promise<ListStudentCertificatesResult> {
  return studentsFetch<ListStudentCertificatesResult>(`/students/${encodeURIComponent(id)}/certificates${qs(params)}`);
}

export function getMyStudentActivity(id: string, params: { page?: number; limit?: number } = {}): Promise<ListStudentActivityResult> {
  return studentsFetch<ListStudentActivityResult>(`/students/${encodeURIComponent(id)}/activity${qs(params)}`);
}
