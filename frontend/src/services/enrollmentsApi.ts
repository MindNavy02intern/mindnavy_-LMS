// Enrollments API service — v1. Rides the EXISTING course_enrollments table.
// Endpoints: /api/admin/enrollments. Mirrors learningPathsApi.ts pattern:
// USE_MOCK flag, same fetch wrapper shape, Bearer auth.

import { getStoredToken } from '../api/adminAuth';
import { fetchWithRetry } from '../lib/fetchWithRetry';
import type {
  Enrollment,
  EnrollmentListData,
  EnrollmentListParams,
  CreateEnrollmentPayload,
  UpdateEnrollmentStatusPayload,
} from '../types/enrollments';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

const USE_MOCK = false;

// ── Error class ───────────────────────────────────────────────────────────────

export class EnrollmentApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name   = 'EnrollmentApiError';
  }
}

// ── Fetch wrapper ─────────────────────────────────────────────────────────────

async function enrollFetch<T>(
  path:   string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?:  unknown,
): Promise<T> {
  const token = getStoredToken();
  const res = await fetchWithRetry(`${BASE}/enrollments${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new EnrollmentApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 404 ? (json.message ?? 'Not found.')             :
      res.status === 429 ? 'Too many requests — slow down and retry.' :
      json.message ?? `HTTP ${res.status}`;
    throw new EnrollmentApiError(res.status, msg);
  }

  return json.data as T;
}

function mockDelay<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), 300));
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_DATA: EnrollmentListData = {
  enrollments: [],
  pagination: { total: 0, page: 1, limit: 10, pages: 1 },
  statusCounts: { All: 0, NOT_STARTED: 0, IN_PROGRESS: 0, COMPLETED: 0, OVERDUE: 0 },
};

// ── Public API ─────────────────────────────────────────────────────────────────

export async function listEnrollments(params: EnrollmentListParams = {}): Promise<EnrollmentListData> {
  if (USE_MOCK) return mockDelay(MOCK_DATA);
  const qs = new URLSearchParams();
  if (params.courseId)          qs.set('courseId', params.courseId);
  if (params.userId)            qs.set('userId',   params.userId);
  if (params.status && params.status !== 'All') qs.set('status', params.status);
  if (params.search)            qs.set('search',   params.search);
  if (params.page)              qs.set('page',     String(params.page));
  if (params.limit)             qs.set('limit',    String(params.limit));
  return enrollFetch<EnrollmentListData>(`/?${qs.toString()}`);
}

export async function createEnrollment(payload: CreateEnrollmentPayload): Promise<Enrollment> {
  if (USE_MOCK) {
    const now = new Date().toISOString();
    return mockDelay<Enrollment>({
      id: `enr-${Date.now()}`, courseId: payload.courseId, courseTitle: null,
      userId: payload.userId, userName: null, userEmail: null, userAvatar: null,
      progress: 0, status: 'NOT_STARTED', enrolledAt: now, completedAt: null, updatedAt: now,
    });
  }
  return enrollFetch<Enrollment>('/', 'POST', payload);
}

export async function updateEnrollmentStatus(id: string, payload: UpdateEnrollmentStatusPayload): Promise<Enrollment> {
  if (USE_MOCK) {
    return mockDelay<Enrollment>({
      id, courseId: 'mock', courseTitle: null, userId: 'mock', userName: null, userEmail: null,
      userAvatar: null, progress: 0, status: payload.status, enrolledAt: new Date().toISOString(),
      completedAt: payload.status === 'COMPLETED' ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    });
  }
  return enrollFetch<Enrollment>(`/${id}`, 'PATCH', payload);
}

export async function deleteEnrollment(id: string): Promise<{ id: string }> {
  if (USE_MOCK) return mockDelay({ id });
  return enrollFetch<{ id: string }>(`/${id}`, 'DELETE');
}
