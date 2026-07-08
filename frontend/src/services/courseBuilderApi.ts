// Course Builder API — per FRONTEND_CONTRACT.md §3.11.
// Clone of the coursesApi fetch wrapper (reads json.data, uses message for errors).
// Flip USE_MOCK to false once you have verified mock behaviour — no other changes needed.

import { getStoredToken } from '../api/adminAuth';
import {
  CourseBuilderApiError,
  type CourseSection,
  type Lesson,
  type CreateSectionPayload,
  type UpdateSectionPayload,
  type CreateLessonPayload,
  type UpdateLessonPayload,
  type ReorderPayload,
} from '../types/courseBuilder';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

export const USE_MOCK = false; // set back to true to use mock data instead of the real backend

// ── Fetch wrapper ─────────────────────────────────────────────────────────────

async function builderFetch<T>(
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

  if (res.status === 401) throw new CourseBuilderApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body on 204 */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 429 ? 'Too many requests — please slow down and retry.' :
      res.status === 404 ? 'Resource not found.' :
      res.status === 500 ? 'Something went wrong on the server.' :
      json.message ?? `HTTP ${res.status}`;
    throw new CourseBuilderApiError(res.status, msg);
  }

  return json.data as T;
}

function mockDelay<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), 250));
}

// ── Mock store ────────────────────────────────────────────────────────────────

let NEXT_SECTION_ID = 10;
let NEXT_LESSON_ID  = 100;

function nowISO(): string { return new Date().toISOString(); }

const MOCK_SECTIONS: CourseSection[] = [
  {
    id:        'sec-1',
    courseId:  '__mock__',
    title:     'Getting Started',
    order:     1,
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
    lessons: [
      {
        id:          'les-1',
        sectionId:   'sec-1',
        title:       'Introduction',
        type:        'TEXT',
        content:     'Welcome to this course! In this lesson we cover the fundamentals.',
        durationMin: 5,
        order:       1,
        createdAt:   '2026-07-01T10:01:00.000Z',
        updatedAt:   '2026-07-01T10:01:00.000Z',
      },
      {
        id:          'les-2',
        sectionId:   'sec-1',
        title:       'Course Overview Video',
        type:        'VIDEO_URL',
        content:     'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        durationMin: 12,
        order:       2,
        createdAt:   '2026-07-01T10:02:00.000Z',
        updatedAt:   '2026-07-01T10:02:00.000Z',
      },
      {
        id:          'les-3',
        sectionId:   'sec-1',
        title:       'Setting Up Your Environment',
        type:        'TEXT',
        content:     'Follow these steps to install the required tools before starting the exercises.',
        durationMin: 8,
        order:       3,
        createdAt:   '2026-07-01T10:03:00.000Z',
        updatedAt:   '2026-07-01T10:03:00.000Z',
      },
    ],
  },
  {
    id:        'sec-2',
    courseId:  '__mock__',
    title:     'Core Concepts',
    order:     2,
    createdAt: '2026-07-01T10:10:00.000Z',
    updatedAt: '2026-07-01T10:10:00.000Z',
    lessons: [
      {
        id:          'les-4',
        sectionId:   'sec-2',
        title:       'Key Principles',
        type:        'TEXT',
        content:     'The three core principles you need to master are explained here.',
        durationMin: 10,
        order:       1,
        createdAt:   '2026-07-01T10:11:00.000Z',
        updatedAt:   '2026-07-01T10:11:00.000Z',
      },
      {
        id:          'les-5',
        sectionId:   'sec-2',
        title:       'Live Demo Walkthrough',
        type:        'VIDEO_URL',
        content:     'https://www.youtube.com/watch?v=Sagg08DrO5U',
        durationMin: 20,
        order:       2,
        createdAt:   '2026-07-01T10:12:00.000Z',
        updatedAt:   '2026-07-01T10:12:00.000Z',
      },
    ],
  },
];

// Deep-clone the mock store so mutations don't corrupt the original reference.
function cloneSections(): CourseSection[] {
  return JSON.parse(JSON.stringify(MOCK_SECTIONS)) as CourseSection[];
}

// Mutable working copy used by all mock write operations.
let mockStore: CourseSection[] = cloneSections();

// ── Mock helpers ──────────────────────────────────────────────────────────────

function sortedStore(): CourseSection[] {
  return mockStore
    .sort((a, b) => a.order - b.order)
    .map(s => ({ ...s, lessons: [...s.lessons].sort((a, b) => a.order - b.order) }));
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function getSections(courseId: string): Promise<CourseSection[]> {
  if (USE_MOCK) {
    // Reset mock store so each test run starts from a clean fixture.
    mockStore = cloneSections();
    return mockDelay(sortedStore().map(s => ({ ...s, courseId })));
  }
  return builderFetch<CourseSection[]>(`/courses/${encodeURIComponent(courseId)}/sections`);
}

export async function createSection(
  courseId: string,
  payload: CreateSectionPayload,
): Promise<CourseSection> {
  if (USE_MOCK) {
    const maxOrder = mockStore.reduce((m, s) => Math.max(m, s.order), 0);
    const section: CourseSection = {
      id:        `sec-${NEXT_SECTION_ID++}`,
      courseId,
      title:     payload.title,
      order:     payload.order ?? maxOrder + 1,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      lessons:   [],
    };
    mockStore.push(section);
    return mockDelay(section);
  }
  return builderFetch<CourseSection>(
    `/courses/${encodeURIComponent(courseId)}/sections`, 'POST', payload,
  );
}

export async function updateSection(
  sectionId: string,
  payload: UpdateSectionPayload,
): Promise<CourseSection> {
  if (USE_MOCK) {
    const idx = mockStore.findIndex(s => s.id === sectionId);
    if (idx === -1) throw new CourseBuilderApiError(404, 'Section not found.');
    const updated = { ...mockStore[idx], ...payload, updatedAt: nowISO() };
    mockStore[idx] = updated;
    return mockDelay(updated);
  }
  return builderFetch<CourseSection>(`/sections/${encodeURIComponent(sectionId)}`, 'PATCH', payload);
}

export async function deleteSection(sectionId: string): Promise<{ id: string }> {
  if (USE_MOCK) {
    const idx = mockStore.findIndex(s => s.id === sectionId);
    if (idx === -1) throw new CourseBuilderApiError(404, 'Section not found.');
    mockStore.splice(idx, 1);
    return mockDelay({ id: sectionId });
  }
  return builderFetch<{ id: string }>(`/sections/${encodeURIComponent(sectionId)}`, 'DELETE');
}

export async function createLesson(
  sectionId: string,
  payload: CreateLessonPayload,
): Promise<Lesson> {
  if (USE_MOCK) {
    const sec = mockStore.find(s => s.id === sectionId);
    if (!sec) throw new CourseBuilderApiError(404, 'Section not found.');
    const maxOrder = sec.lessons.reduce((m, l) => Math.max(m, l.order), 0);
    const lesson: Lesson = {
      id:          `les-${NEXT_LESSON_ID++}`,
      sectionId,
      title:       payload.title,
      type:        payload.type,
      content:     payload.content ?? null,
      durationMin: payload.durationMin ?? null,
      order:       payload.order ?? maxOrder + 1,
      createdAt:   nowISO(),
      updatedAt:   nowISO(),
    };
    sec.lessons.push(lesson);
    return mockDelay(lesson);
  }
  return builderFetch<Lesson>(
    `/sections/${encodeURIComponent(sectionId)}/lessons`, 'POST', payload,
  );
}

export async function updateLesson(
  lessonId: string,
  payload: UpdateLessonPayload,
): Promise<Lesson> {
  if (USE_MOCK) {
    for (const sec of mockStore) {
      const idx = sec.lessons.findIndex(l => l.id === lessonId);
      if (idx !== -1) {
        const updated: Lesson = { ...sec.lessons[idx], ...payload, updatedAt: nowISO() };
        sec.lessons[idx] = updated;
        return mockDelay(updated);
      }
    }
    throw new CourseBuilderApiError(404, 'Lesson not found.');
  }
  return builderFetch<Lesson>(`/lessons/${encodeURIComponent(lessonId)}`, 'PATCH', payload);
}

export async function deleteLesson(lessonId: string): Promise<{ id: string }> {
  if (USE_MOCK) {
    for (const sec of mockStore) {
      const idx = sec.lessons.findIndex(l => l.id === lessonId);
      if (idx !== -1) {
        sec.lessons.splice(idx, 1);
        return mockDelay({ id: lessonId });
      }
    }
    throw new CourseBuilderApiError(404, 'Lesson not found.');
  }
  return builderFetch<{ id: string }>(`/lessons/${encodeURIComponent(lessonId)}`, 'DELETE');
}

export async function reorderSections(
  courseId: string,
  payload: ReorderPayload,
): Promise<CourseSection[]> {
  if (USE_MOCK) {
    const sectionOrderMap = new Map(payload.sections.map(s => [s.id, s.order]));
    const lessonMeta = new Map(payload.lessons.map(l => [l.id, { order: l.order, sectionId: l.sectionId }]));

    // Apply new section orders
    mockStore = mockStore.map(s => ({
      ...s,
      order: sectionOrderMap.get(s.id) ?? s.order,
      lessons: s.lessons
        .map(l => ({ ...l, order: lessonMeta.get(l.id)?.order ?? l.order }))
        .sort((a, b) => a.order - b.order),
    })).sort((a, b) => a.order - b.order);

    return mockDelay(sortedStore().map(s => ({ ...s, courseId })));
  }
  return builderFetch<CourseSection[]>(
    `/courses/${encodeURIComponent(courseId)}/reorder`, 'PATCH', payload,
  );
}
