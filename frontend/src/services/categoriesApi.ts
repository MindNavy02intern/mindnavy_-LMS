// Categories API — GET/POST/PATCH/DELETE /api/admin/categories.
// Backend returns a full 2-level tree on every GET (list).
// Flip USE_MOCK to false once backend is live; no other code changes needed.

import { getStoredToken } from '../api/adminAuth';
import { appQueryClient, invalidateFor } from '../lib/invalidation';
import {
  CategoryApiError,
  type CategoryNode,
  type CreateCategoryPayload,
  type UpdateCategoryPayload,
} from '../types/categories';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

const USE_MOCK = false;

// ── Fetch wrapper ─────────────────────────────────────────────────────────────

async function categoriesFetch<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new CategoryApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 429 ? 'Please slow down and retry.' :
      res.status === 404 ? 'Category not found.' :
      res.status === 500 ? 'Something went wrong on the server.' :
      json.message ?? `HTTP ${res.status}`;
    // Surface the backend error code so the UI can render exact messages.
    const errorCode = (json as { errorCode?: string }).errorCode as Parameters<typeof CategoryApiError.prototype.constructor>[2] | undefined;
    throw new CategoryApiError(res.status, msg, errorCode);
  }

  return json.data as T;
}

function mockDelay<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), 300));
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_TREE: CategoryNode[] = [
  {
    id: 'cat-1', name: 'Technology', parentId: null, courseCount: 5,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    children: [
      { id: 'cat-1-1', name: 'Web Development',    parentId: 'cat-1', courseCount: 3, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'cat-1-2', name: 'Data Science',        parentId: 'cat-1', courseCount: 2, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    ],
  },
  {
    id: 'cat-2', name: 'Business', parentId: null, courseCount: 3,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    children: [
      { id: 'cat-2-1', name: 'Finance',    parentId: 'cat-2', courseCount: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'cat-2-2', name: 'Marketing',  parentId: 'cat-2', courseCount: 2, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
    ],
  },
  {
    id: 'cat-3', name: 'Design', parentId: null, courseCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    children: [],
  },
];

let MOCK_ID_COUNTER = 100;

// ── Public API functions ──────────────────────────────────────────────────────

export async function listCategories(): Promise<CategoryNode[]> {
  if (USE_MOCK) return mockDelay([...MOCK_TREE]);
  return categoriesFetch<CategoryNode[]>('/categories');
}

export async function createCategory(payload: CreateCategoryPayload): Promise<CategoryNode> {
  if (USE_MOCK) {
    const node: CategoryNode = {
      id:          `cat-mock-${MOCK_ID_COUNTER++}`,
      name:        payload.name,
      parentId:    payload.parentId ?? null,
      courseCount: 0,
      createdAt:   new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
      children:    payload.parentId ? undefined : [],
    };
    if (payload.parentId) {
      const parent = MOCK_TREE.find((n) => n.id === payload.parentId);
      if (parent?.children) parent.children.push(node);
    } else {
      MOCK_TREE.push(node);
    }
    return mockDelay({ ...node });
  }
  const result = await categoriesFetch<CategoryNode>('/categories', 'POST', payload);
  invalidateFor(appQueryClient, 'category.create');
  return result;
}

export async function updateCategory(
  categoryId: string,
  payload: UpdateCategoryPayload,
): Promise<CategoryNode> {
  if (USE_MOCK) {
    const now = new Date().toISOString();
    return mockDelay<CategoryNode>({
      id:          categoryId,
      name:        payload.name ?? 'Updated Category',
      parentId:    payload.parentId ?? null,
      courseCount: 0,
      createdAt:   now,
      updatedAt:   now,
    });
  }
  const result = await categoriesFetch<CategoryNode>(
    `/categories/${encodeURIComponent(categoryId)}`,
    'PATCH',
    payload,
  );
  // category.rename covers both name and parentId changes (same invalidation set)
  invalidateFor(appQueryClient, 'category.rename');
  return result;
}

export async function deleteCategory(categoryId: string): Promise<void> {
  if (USE_MOCK) {
    const idx = MOCK_TREE.findIndex((n) => n.id === categoryId);
    if (idx !== -1) MOCK_TREE.splice(idx, 1);
    return mockDelay<void>(undefined);
  }
  await categoriesFetch<{ id: string }>(
    `/categories/${encodeURIComponent(categoryId)}`,
    'DELETE',
  );
  invalidateFor(appQueryClient, 'category.delete');
}
