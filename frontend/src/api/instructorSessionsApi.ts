// Instructor self-service Sessions & Devices API — scoped to
// /api/instructor/sessions.

import { getStoredInstructorToken } from './instructorAuth';
import type { InstructorSession } from '../types/instructorSessions';
import { fetchWithRetry } from '../lib/fetchWithRetry';

const BASE = import.meta.env.VITE_INSTRUCTOR_API_BASE_URL2 ?? 'http://localhost:5001/api/instructor';

export class InstructorSessionsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'InstructorSessionsApiError';
  }
}

async function sessionsFetch<T>(path: string, method: 'GET' | 'DELETE' = 'GET'): Promise<T> {
  const token = getStoredInstructorToken();
  const res = await fetchWithRetry(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  if (res.status === 401) throw new InstructorSessionsApiError(401, 'Your session has expired — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg = res.status === 429 ? 'Too many requests — slow down.' : json.message ?? `HTTP ${res.status}`;
    throw new InstructorSessionsApiError(res.status, msg);
  }

  return json.data as T;
}

export function listMySessions(): Promise<InstructorSession[]> {
  return sessionsFetch<InstructorSession[]>('/sessions');
}

export function revokeMySession(id: string): Promise<{ id: string }> {
  return sessionsFetch<{ id: string }>(`/sessions/${encodeURIComponent(id)}`, 'DELETE');
}
