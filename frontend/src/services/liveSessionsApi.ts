// Live Sessions API service — v1 (real Zoom integration).
// Endpoints: /api/admin/live-sessions. Mirrors learningPathsApi.ts pattern:
// USE_MOCK flag, same fetch wrapper shape, Bearer auth.
//
// 503 = Zoom not configured on the server yet (expected right now — permanent
// info state, not a bug). 502 = Zoom API call failed (transient, retry-suggested).
// Callers must branch on LiveSessionApiError.status to tell these apart.

import { getStoredToken } from '../api/adminAuth';
import type {
  LiveSession,
  LiveSessionListParams,
  CreateLiveSessionPayload,
  UpdateLiveSessionPayload,
  MarkAttendanceRecord,
  AttendanceRecordResult,
} from '../types/liveSessions';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

const USE_MOCK = false;

// ── Error class ───────────────────────────────────────────────────────────────

export class LiveSessionApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name   = 'LiveSessionApiError';
  }
}

// ── Fetch wrapper ─────────────────────────────────────────────────────────────

async function lsFetch<T>(
  path:   string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?:  unknown,
): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}/live-sessions${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new LiveSessionApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 404 ? (json.message ?? 'Not found.')                        :
      res.status === 429 ? 'Too many requests — slow down and retry.'            :
      res.status === 503 ? (json.message ?? 'Zoom is not configured yet.')       :
      res.status === 502 ? (json.message ?? 'Zoom API request failed. Try again.') :
      json.message ?? `HTTP ${res.status}`;
    throw new LiveSessionApiError(res.status, msg);
  }

  return json.data as T;
}

function mockDelay<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), 300));
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_SESSIONS: LiveSession[] = [
  {
    id: 'ls-1', title: 'Intro Webinar', description: 'Kickoff session.',
    courseId: null, courseTitle: null,
    instructorId: 'u1', instructorName: 'Sarah Johnson',
    startTime: '2026-08-01T15:00:00.000Z', durationMin: 60, timezone: 'UTC',
    maxParticipants: 100, provider: 'ZOOM', zoomMeetingId: 'mock-1',
    joinUrl: 'https://zoom.us/j/mock1', startUrl: 'https://zoom.us/s/mock1',
    status: 'UPCOMING', endedAt: null, createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z',
  },
];

// ── Public API ─────────────────────────────────────────────────────────────────

export async function listLiveSessions(params: LiveSessionListParams = {}): Promise<LiveSession[]> {
  if (USE_MOCK) return mockDelay(MOCK_SESSIONS);
  const qs = new URLSearchParams();
  if (params.status)       qs.set('status',       params.status);
  if (params.courseId)     qs.set('courseId',     params.courseId);
  if (params.instructorId) qs.set('instructorId', params.instructorId);
  const query = qs.toString();
  return lsFetch<LiveSession[]>(query ? `/?${query}` : '/');
}

export async function getLiveSession(id: string): Promise<LiveSession> {
  if (USE_MOCK) {
    const found = MOCK_SESSIONS.find((s) => s.id === id);
    if (!found) throw new LiveSessionApiError(404, 'Session not found.');
    return mockDelay(found);
  }
  return lsFetch<LiveSession>(`/${id}`);
}

export async function createLiveSession(payload: CreateLiveSessionPayload): Promise<LiveSession> {
  if (USE_MOCK) {
    const now = new Date().toISOString();
    return mockDelay<LiveSession>({
      id: `ls-${Date.now()}`, title: payload.title, description: payload.description ?? null,
      courseId: payload.courseId ?? null, courseTitle: null,
      instructorId: payload.instructorId, instructorName: 'Mock Instructor',
      startTime: payload.startTime, durationMin: payload.durationMin ?? 60,
      timezone: payload.timezone ?? 'UTC', maxParticipants: payload.maxParticipants ?? null,
      provider: 'ZOOM', zoomMeetingId: `mock-${Date.now()}`,
      joinUrl: 'https://zoom.us/j/mock', startUrl: 'https://zoom.us/s/mock',
      status: 'UPCOMING', endedAt: null, createdAt: now, updatedAt: now,
    });
  }
  return lsFetch<LiveSession>('/', 'POST', payload);
}

export async function updateLiveSession(id: string, patch: UpdateLiveSessionPayload): Promise<LiveSession> {
  if (USE_MOCK) {
    const s = MOCK_SESSIONS.find((x) => x.id === id) ?? MOCK_SESSIONS[0];
    return mockDelay<LiveSession>({ ...s, ...patch, updatedAt: new Date().toISOString() } as LiveSession);
  }
  return lsFetch<LiveSession>(`/${id}`, 'PATCH', patch);
}

export async function deleteLiveSession(id: string): Promise<{ id: string }> {
  if (USE_MOCK) return mockDelay({ id });
  return lsFetch<{ id: string }>(`/${id}`, 'DELETE');
}

// Manual admin override — ends a LIVE/UPCOMING session early. DB-only; does
// not call Zoom to force-end the real meeting (see backend comment).
export async function endLiveSession(id: string): Promise<LiveSession> {
  if (USE_MOCK) {
    const s = MOCK_SESSIONS.find((x) => x.id === id) ?? MOCK_SESSIONS[0];
    const now = new Date().toISOString();
    return mockDelay<LiveSession>({ ...s, status: 'ENDED', endedAt: now, updatedAt: now });
  }
  return lsFetch<LiveSession>(`/${id}/end`, 'PATCH');
}

export async function markAttendance(id: string, records: MarkAttendanceRecord[]): Promise<AttendanceRecordResult[]> {
  if (USE_MOCK) return mockDelay(records.map((r, i) => ({
    id: `att-${i}`, userId: r.userId, status: r.status,
    joinedAt: null, leftAt: null,
    durationMin: r.durationMin ?? null, participationScore: r.participationScore ?? null,
  })));
  return lsFetch<AttendanceRecordResult[]>(`/${id}/attendance`, 'PATCH', { records });
}
