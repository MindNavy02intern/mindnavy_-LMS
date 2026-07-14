// Course Wizard API — Steps 4-6 + Approval workflow.
// Endpoints: PATCH /courses/:id/settings, GET /courses/:id/preview,
//            POST /courses/:id/submit, POST /courses/:id/approve,
//            POST /courses/:id/reject
// Flip USE_MOCK to false once backend is live; no other code changes needed.

import { getStoredToken } from '../api/adminAuth';
import { appQueryClient, invalidateFor } from '../lib/invalidation';
import {
  CourseApiError,
  type ApproveCourseResponse,
  type CourseDetail,
  type CourseSettingsResponse,
  type RejectCourseResponse,
  type SubmitCourseResponse,
  type UpdateSettingsPayload,
} from '../types/courses';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

const USE_MOCK = false;

// ── Fetch wrapper ─────────────────────────────────────────────────────────────

async function wizardFetch<T>(
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

  if (res.status === 401) throw new CourseApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string; errors?: string[] } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 429 ? 'Please slow down and retry.' :
      res.status === 404 ? 'Course not found.' :
      res.status === 500 ? 'Something went wrong on the server.' :
      json.message ?? `HTTP ${res.status}`;
    // submitCourse returns errors[] array on 400 when readiness checks fail
    throw new CourseApiError(res.status, msg, json.errors);
  }

  return json.data as T;
}

function mockDelay<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), 300));
}

// ── Mock preview type (mirrors GET /courses/:id/preview response shape) ───────

export interface CoursePreviewData {
  course:   CourseDetail;
  sections: Array<{
    id:       string;
    title:    string;
    order:    number;
    lessons:  Array<{
      id:       string;
      title:    string;
      type:     string;
      order:    number;
      duration: number | null;
      content:  string | null;    // VIDEO_URL: URL to render as <video src>
    }>;
  }>;
}

// ── Step 4: Settings ──────────────────────────────────────────────────────────

export async function updateSettings(
  courseId: string,
  payload: UpdateSettingsPayload,
): Promise<CourseSettingsResponse> {
  if (USE_MOCK) {
    const now = new Date().toISOString();
    return mockDelay<CourseSettingsResponse>({
      id:                 courseId,
      isFree:             payload.isFree             ?? true,
      price:              payload.price               ?? null,
      currency:           payload.currency            ?? null,
      enrollmentLimit:    payload.enrollmentLimit     ?? null,
      visibility:         payload.visibility          ?? 'Public',
      certificateEnabled: payload.certificateEnabled  ?? false,
      dripContentEnabled: payload.dripContentEnabled  ?? false,
      accessRules:        payload.accessRules         ?? null,
      seoTitle:           payload.seoTitle            ?? null,
      seoDescription:     payload.seoDescription      ?? null,
      updatedAt:          now,
    });
  }
  const result = await wizardFetch<CourseSettingsResponse>(
    `/courses/${encodeURIComponent(courseId)}/settings`,
    'PATCH',
    payload,
  );
  invalidateFor(appQueryClient, 'course.settings.update', { id: courseId });
  return result;
}

// ── Step 5: Preview ───────────────────────────────────────────────────────────

export async function getPreview(courseId: string): Promise<CoursePreviewData> {
  if (USE_MOCK) {
    return mockDelay<CoursePreviewData>({
      course: {
        id:              courseId,
        title:           'Mock Course Preview',
        subtitle:        null,
        description:     'This is a mock preview description.',
        category:        'Technology',
        categoryId:      null,
        tags:            [],
        language:        'English',
        level:           'Beginner',
        thumbnail:       null,
        instructor:      'Mock Instructor',
        instructorId:    null,
        status:          'Draft',
        enrolledCount:   0,
        createdBy:       null,
        createdAt:       new Date().toISOString(),
        updatedAt:       new Date().toISOString(),
        settings: {
          isFree:             true,
          price:              null,
          currency:           null,
          enrollmentLimit:    null,
          visibility:         'Public',
          certificateEnabled: false,
          dripContentEnabled: false,
          accessRules:        null,
          seoTitle:           null,
          seoDescription:     null,
        },
        rejectionReason: null,
        reviewedAt:      null,
      },
      sections: [
        {
          id:    'section-1',
          title: 'Introduction',
          order: 1,
          lessons: [
            { id: 'lesson-1', title: 'Welcome', type: 'VIDEO_URL', order: 1, duration: 300, content: null },
            { id: 'lesson-2', title: 'Overview', type: 'TEXT', order: 2, duration: null, content: null },
          ],
        },
      ],
    });
  }
  return wizardFetch<CoursePreviewData>(
    `/courses/${encodeURIComponent(courseId)}/preview`,
  );
}

// ── Step 6: Submit for approval ───────────────────────────────────────────────

export async function submitCourse(courseId: string): Promise<SubmitCourseResponse> {
  if (USE_MOCK) {
    return mockDelay<SubmitCourseResponse>({ id: courseId, status: 'Pending' });
  }
  const result = await wizardFetch<SubmitCourseResponse>(
    `/courses/${encodeURIComponent(courseId)}/submit`,
    'POST',
  );
  invalidateFor(appQueryClient, 'course.submitForApproval', { id: courseId });
  return result;
}

// ── Approval: approve ─────────────────────────────────────────────────────────

export async function approveCourse(courseId: string): Promise<ApproveCourseResponse> {
  if (USE_MOCK) {
    return mockDelay<ApproveCourseResponse>({
      id:         courseId,
      status:     'Published',
      reviewedAt: new Date().toISOString(),
    });
  }
  const result = await wizardFetch<ApproveCourseResponse>(
    `/courses/${encodeURIComponent(courseId)}/approve`,
    'POST',
  );
  invalidateFor(appQueryClient, 'course.approve', { id: courseId });
  return result;
}

// ── Approval: reject ──────────────────────────────────────────────────────────

export async function rejectCourse(
  courseId: string,
  reason: string,
): Promise<RejectCourseResponse> {
  if (USE_MOCK) {
    return mockDelay<RejectCourseResponse>({
      id:              courseId,
      status:          'Draft',
      rejectionReason: reason,
      reviewedAt:      new Date().toISOString(),
    });
  }
  const result = await wizardFetch<RejectCourseResponse>(
    `/courses/${encodeURIComponent(courseId)}/reject`,
    'POST',
    { reason },
  );
  invalidateFor(appQueryClient, 'course.reject', { id: courseId });
  return result;
}
