// Instructor self-service Reports API — scoped to /api/instructor/reports.

import { getStoredInstructorToken } from './instructorAuth';
import type { MyReportsOverview, MyCourseBreakdownRow } from '../types/instructorReports';

const BASE = import.meta.env.VITE_INSTRUCTOR_API_BASE_URL2 ?? 'http://localhost:5001/api/instructor';

export class InstructorReportsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'InstructorReportsApiError';
  }
}

async function reportsFetch<T>(path: string): Promise<T> {
  const token = getStoredInstructorToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  if (res.status === 401) throw new InstructorReportsApiError(401, 'Your session has expired — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg = res.status === 429 ? 'Too many requests — slow down.' : json.message ?? `HTTP ${res.status}`;
    throw new InstructorReportsApiError(res.status, msg);
  }

  return json.data as T;
}

export function getMyReportsOverview(): Promise<MyReportsOverview> {
  return reportsFetch<MyReportsOverview>('/reports/overview');
}

export function getMyCourseBreakdown(): Promise<MyCourseBreakdownRow[]> {
  return reportsFetch<MyCourseBreakdownRow[]>('/reports/courses');
}
