// Instructor self-service Reviews API — same fetch-wrapper shape as
// instructorStudentsApi.ts, scoped to /api/instructor/reviews. Read-only.

import { getStoredInstructorToken } from './instructorAuth';
import type { ListMyReviewsResult, MyReviewStats, ReviewStatus } from '../types/instructorReviews';
import { fetchWithRetry } from '../lib/fetchWithRetry';

const BASE = import.meta.env.VITE_INSTRUCTOR_API_BASE_URL2 ?? 'http://localhost:5001/api/instructor';

export class InstructorReviewsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'InstructorReviewsApiError';
  }
}

async function reviewsFetch<T>(path: string): Promise<T> {
  const token = getStoredInstructorToken();
  const res = await fetchWithRetry(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  if (res.status === 401) throw new InstructorReviewsApiError(401, 'Your session has expired — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg = res.status === 429 ? 'Too many requests — slow down.' : json.message ?? `HTTP ${res.status}`;
    throw new InstructorReviewsApiError(res.status, msg);
  }

  return json.data as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}`;
}

export function listMyReviews(params: { status?: ReviewStatus; page?: number; limit?: number } = {}): Promise<ListMyReviewsResult> {
  return reviewsFetch<ListMyReviewsResult>(`/reviews${qs(params)}`);
}

export function getMyReviewStats(): Promise<MyReviewStats> {
  return reviewsFetch<MyReviewStats>('/reviews/stats');
}
