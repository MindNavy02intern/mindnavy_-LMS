// Instructor self-service Competencies API — scoped to
// /api/instructor/competencies. Read-only both tabs.

import { getStoredInstructorToken } from './instructorAuth';
import type { MySkillRow, MyCompetencyCertification } from '../types/instructorCompetencies';
import { fetchWithRetry } from '../lib/fetchWithRetry';

const BASE = import.meta.env.VITE_INSTRUCTOR_API_BASE_URL2 ?? 'http://localhost:5001/api/instructor';

export class InstructorCompetenciesApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'InstructorCompetenciesApiError';
  }
}

async function competenciesFetch<T>(path: string): Promise<T> {
  const token = getStoredInstructorToken();
  const res = await fetchWithRetry(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  if (res.status === 401) throw new InstructorCompetenciesApiError(401, 'Your session has expired — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg = res.status === 429 ? 'Too many requests — slow down.' : json.message ?? `HTTP ${res.status}`;
    throw new InstructorCompetenciesApiError(res.status, msg);
  }

  return json.data as T;
}

export function getMySkillsInCourses(): Promise<MySkillRow[]> {
  return competenciesFetch<MySkillRow[]>('/competencies/skills-in-my-courses');
}

export function getMyCompetencyCertifications(): Promise<MyCompetencyCertification[]> {
  return competenciesFetch<MyCompetencyCertification[]>('/competencies/my-certifications');
}
