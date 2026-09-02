// Instructor self-service Learning Paths visibility API — same fetch-wrapper
// shape as instructorStudentsApi.ts, scoped to /api/instructor/learning-paths.
// Read-only: no create/edit/reorder calls exist here (admin-only concept).

import { getStoredInstructorToken } from './instructorAuth';
import type { MyLearningPathRow, MyLearningPathDetail } from '../types/instructorLearningPaths';
import { fetchWithRetry } from '../lib/fetchWithRetry';

const BASE = import.meta.env.VITE_INSTRUCTOR_API_BASE_URL2 ?? 'http://localhost:5001/api/instructor';

export class InstructorLearningPathsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'InstructorLearningPathsApiError';
  }
}

async function pathsFetch<T>(path: string): Promise<T> {
  const token = getStoredInstructorToken();
  const res = await fetchWithRetry(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  if (res.status === 401) throw new InstructorLearningPathsApiError(401, 'Your session has expired — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 403 ? (json.message ?? 'This learning path does not contain any of your courses.') :
      res.status === 404 ? (json.message ?? 'Not found.') :
      res.status === 429 ? 'Too many requests — slow down.' :
      json.message ?? `HTTP ${res.status}`;
    throw new InstructorLearningPathsApiError(res.status, msg);
  }

  return json.data as T;
}

export function listMyLearningPaths(): Promise<MyLearningPathRow[]> {
  return pathsFetch<MyLearningPathRow[]>('/learning-paths');
}

export function getMyLearningPath(id: string): Promise<MyLearningPathDetail> {
  return pathsFetch<MyLearningPathDetail>(`/learning-paths/${encodeURIComponent(id)}`);
}
