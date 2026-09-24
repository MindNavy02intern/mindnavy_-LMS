// Learning Paths API service — v1.
// Endpoints: /api/admin/learning-paths (list + CRUD + items + reorder).
// Mirrors coursesApi.ts pattern: USE_MOCK flag, same fetch wrapper, Bearer auth.
// Mock data matches every shape field-by-field (title/status/startTime/missing).

import { getStoredToken } from '../api/adminAuth';
import { fetchWithRetry } from '../lib/fetchWithRetry';
import type {
  LearningPath,
  LearningPathDetail,
  LearningPathItem,
  CreatePathPayload,
  UpdatePathPayload,
  AddItemPayload,
  ReorderPayload,
} from '../types/learningPaths';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

const USE_MOCK = false;

// ── Error class ───────────────────────────────────────────────────────────────

export class LearningPathApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status  = status;
    this.name    = 'LearningPathApiError';
  }
}

// ── Fetch wrapper ─────────────────────────────────────────────────────────────

async function lpFetch<T>(
  path:    string,
  method:  'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?:   unknown,
): Promise<T> {
  const token = getStoredToken();
  const res = await fetchWithRetry(`${BASE}/learning-paths${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new LearningPathApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 404 ? (json.message ?? 'Not found.')      :
      res.status === 429 ? 'Too many requests — slow down.'    :
      res.status === 503 ? (json.message ?? 'Service unavailable.') :
      json.message ?? `HTTP ${res.status}`;
    throw new LearningPathApiError(res.status, msg);
  }

  return json.data as T;
}

function mockDelay<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), 300));
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_ITEMS: LearningPathItem[] = [
  {
    id: 'pi-1', itemType: 'COURSE', itemId: 'course-1', order: 0, createdAt: '2026-01-01T00:00:00.000Z',
    title: 'Advanced Python Programming', status: 'Published', startTime: null, missing: false,
  },
  {
    id: 'pi-2', itemType: 'LIVE_SESSION', itemId: 'session-1', order: 1, createdAt: '2026-01-02T00:00:00.000Z',
    title: 'Python Q&A Webinar', status: 'upcoming', startTime: '2026-02-15T14:00:00.000Z', missing: false,
  },
  {
    id: 'pi-3', itemType: 'COURSE', itemId: 'course-deleted', order: 2, createdAt: '2026-01-03T00:00:00.000Z',
    title: null, status: null, startTime: null, missing: true,
  },
  {
    id: 'pi-4', itemType: 'COURSE', itemId: 'course-25', order: 3, createdAt: '2026-01-04T00:00:00.000Z',
    title: 'Legacy PHP Development', status: 'Archived', startTime: null, missing: false,
  },
];

const MOCK_PATHS: LearningPath[] = [
  {
    id: 'lp-1', title: 'Python Full Stack Track', description: 'From basics to deployment.', sequential: true,
    itemCount: 4, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-10T00:00:00.000Z',
  },
  {
    id: 'lp-2', title: 'Design Fundamentals', description: null, sequential: false,
    itemCount: 0, createdAt: '2026-01-05T00:00:00.000Z', updatedAt: '2026-01-05T00:00:00.000Z',
  },
];

const MOCK_DETAIL: LearningPathDetail = { ...MOCK_PATHS[0], items: MOCK_ITEMS };

// ── Paths ─────────────────────────────────────────────────────────────────────

export async function listPaths(): Promise<LearningPath[]> {
  if (USE_MOCK) return mockDelay(MOCK_PATHS);
  return lpFetch<LearningPath[]>('/');
}

export async function getPath(id: string): Promise<LearningPathDetail> {
  if (USE_MOCK) return mockDelay(MOCK_DETAIL);
  return lpFetch<LearningPathDetail>(`/${id}`);
}

export async function createPath(payload: CreatePathPayload): Promise<LearningPath> {
  if (USE_MOCK) {
    const now = new Date().toISOString();
    return mockDelay<LearningPath>({
      id: `lp-${Date.now()}`, title: payload.title,
      description: payload.description ?? null, sequential: payload.sequential ?? false,
      itemCount: 0, createdAt: now, updatedAt: now,
    });
  }
  return lpFetch<LearningPath>('/', 'POST', payload);
}

export async function updatePath(id: string, patch: UpdatePathPayload): Promise<LearningPath> {
  if (USE_MOCK) {
    const p = MOCK_PATHS.find((x) => x.id === id) ?? MOCK_PATHS[0];
    return mockDelay<LearningPath>({ ...p, ...patch, updatedAt: new Date().toISOString() });
  }
  return lpFetch<LearningPath>(`/${id}`, 'PATCH', patch);
}

export async function deletePath(id: string): Promise<{ id: string }> {
  if (USE_MOCK) return mockDelay({ id });
  return lpFetch<{ id: string }>(`/${id}`, 'DELETE');
}

// ── Items ─────────────────────────────────────────────────────────────────────

export async function addItem(pathId: string, payload: AddItemPayload): Promise<LearningPathItem> {
  if (USE_MOCK) {
    return mockDelay<LearningPathItem>({
      id: `pi-${Date.now()}`, itemType: payload.itemType, itemId: payload.itemId,
      order: 99, createdAt: new Date().toISOString(),
      title: 'Mock Item', status: 'Published', startTime: null, missing: false,
    });
  }
  return lpFetch<LearningPathItem>(`/${pathId}/items`, 'POST', payload);
}

export async function removeItem(pathId: string, itemId: string): Promise<{ id: string }> {
  if (USE_MOCK) return mockDelay({ id: itemId });
  return lpFetch<{ id: string }>(`/${pathId}/items/${itemId}`, 'DELETE');
}

export async function reorderItems(pathId: string, payload: ReorderPayload): Promise<LearningPathDetail> {
  if (USE_MOCK) return mockDelay(MOCK_DETAIL);
  return lpFetch<LearningPathDetail>(`/${pathId}/reorder`, 'PATCH', payload);
}
