// Courses API — per "Courses API — Frontend Contract".
// Flip USE_MOCK to false once Hassan's /courses/* endpoints are live; no
// other code changes needed.

import { getStoredToken } from '../api/adminAuth';
import {
  CourseApiError,
  type CourseDetail,
  type CourseListRow,
  type CoursesListParams,
  type CoursesListResponse,
  type CourseStatusCounts,
  type CreateCoursePayload,
  type UpdateCoursePayload,
} from '../types/courses';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

const USE_MOCK = false; // set back to true to use mock data instead of the real backend

// ── Fetch wrapper ─────────────────────────────────────────────────────────────

async function coursesFetch<T>(
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

  // 401 → caller should redirect to login
  if (res.status === 401) throw new CourseApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 429 ? 'Please slow down and retry.' :
      res.status === 404 ? 'Course not found.' :
      res.status === 500 ? 'Something went wrong on the server.' :
      json.message ?? `HTTP ${res.status}`;
    throw new CourseApiError(res.status, msg);
  }

  return json.data as T;
}

function mockDelay<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), 300));
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const INSTRUCTORS = [
  { id: 'u1', name: 'Sarah Johnson' },
  { id: 'u2', name: 'Michael Brown' },
  { id: 'u3', name: 'Emily Davis' },
  { id: 'u4', name: 'David Wilson' },
  { id: 'u5', name: 'James Taylor' },
  { id: 'u6', name: 'Lisa Anderson' },
  { id: 'u7', name: 'Robert Johnson' },
];
const CATEGORIES = ['Technology', 'Business', 'Design', 'Marketing', 'Personal Development'];
const LEVELS     = ['Beginner', 'Intermediate', 'Advanced'] as const;

type MockRow = CourseListRow;

function buildMockCourses(): MockRow[] {
  const titles = [
    // Published (12)
    'Advanced Python Programming',       // 0
    'Business Analytics Fundamentals',   // 1
    'UI/UX Design Principles',           // 2
    'Digital Marketing Strategy',        // 3
    'Data Science with Python',          // 4
    'Leadership and Management',         // 5
    'Complete React Developer',          // 6
    'Data Science Fundamentals',         // 7
    'Financial Modeling Basics',         // 8
    'Motion Graphics in After Effects',  // 9
    'SQL for Analysts',                  // 10
    'Email Marketing Automation',        // 11
    // Draft (8)
    'Communication Skills',              // 12
    'Node.js Microservices',             // 13
    'Brand Strategy Workshop',           // 14
    'Figma for Product Design',          // 15
    'Time Management Mastery',           // 16
    'Public Speaking Confidence',        // 17
    'Negotiation Skills',                // 18
    'Mindfulness at Work',               // 19
    // Pending (5)
    'SEO and Content Marketing',         // 20
    'Mobile App Design',                 // 21
    'Cloud Computing Essentials',        // 22
    'Machine Learning for Beginners',    // 23
    'Project Management Essentials',     // 24
    // Archived (4)
    'Legacy PHP Development',            // 25
    'Flash Animation Basics',            // 26
    'Internet Explorer Compatibility',   // 27
    'Windows XP Administration',         // 28
  ];

  const statuses: MockRow['status'][] = [
    ...Array(12).fill('Published'),
    ...Array(8).fill('Draft'),
    ...Array(5).fill('Pending'),
    ...Array(4).fill('Archived'),
  ];

  return titles.map((title, i) => {
    const inst = INSTRUCTORS[i % INSTRUCTORS.length];
    return {
      id:           `course-${i + 1}`,
      title,
      instructor:   inst.name,
      instructorId: inst.id,
      category:     CATEGORIES[i % CATEGORIES.length],
      level:        LEVELS[i % LEVELS.length],
      enrolledCount: 100 + ((i * 97) % 1400),
      status:       statuses[i],
      isRejected:      false,
      rejectionReason: null,
      submittedAt:     null,
      reviewedAt:      null,
      thumbnail:    null,
      updatedAt:    new Date(2026, 0, i + 1).toISOString(),
    };
  });
}

const MOCK_COURSES: MockRow[] = buildMockCourses();

const MOCK_STATUS_COUNTS: CourseStatusCounts = {
  all:       25, // excludes Archived (12 + 8 + 5)
  published: 12,
  draft:     8,
  pending:   5,
  archived:  4,
  rejected:  0,
};

function filterMock(params: CoursesListParams): CoursesListResponse {
  let list = MOCK_COURSES;

  if (!params.status || params.status === 'All') {
    list = list.filter((c) => c.status !== 'Archived');
  } else {
    list = list.filter((c) => c.status === params.status);
  }

  if (params.category)   list = list.filter((c) => c.category === params.category);
  if (params.instructor) list = list.filter((c) => c.instructorId === params.instructor);
  if (params.search) {
    const q = params.search.toLowerCase();
    list = list.filter((c) => c.title.toLowerCase().includes(q));
  }

  const total = list.length;
  const limit = params.limit ?? 10;
  const page  = params.page  ?? 1;
  const pages = Math.max(1, Math.ceil(total / limit));
  const data  = list.slice((page - 1) * limit, page * limit);

  return { courses: data, pagination: { total, page, limit, pages }, statusCounts: MOCK_STATUS_COUNTS };
}

const MOCK_SETTINGS_DEFAULT = {
  isFree:             true,
  price:              null,
  currency:           null,
  enrollmentLimit:    null,
  visibility:         'Public' as const,
  certificateEnabled: false,
  dripContentEnabled: false,
  accessRules:        null,
  seoTitle:           null,
  seoDescription:     null,
};

const MOCK_DETAIL: CourseDetail = {
  id:              'course-1',
  title:           'Advanced Python Programming',
  subtitle:        'Master advanced Python concepts and real-world patterns',
  description:     'A comprehensive course covering decorators, generators, async/await, metaclasses, and production-grade Python patterns.',
  category:        'Technology',
  categoryId:      null,
  tags:            ['python', 'advanced', 'programming'],
  language:        'English',
  level:           'Advanced',
  thumbnail:       null,
  instructor:      'Sarah Johnson',
  instructorId:    'u1',
  status:          'Published',
  enrolledCount:   600,
  isRejected:      false,
  rejectionReason: null,
  submittedAt:     null,
  reviewedAt:      null,
  createdBy:       null,
  createdAt:       '2026-01-15T10:00:00.000Z',
  updatedAt:       '2026-06-30T14:05:00.000Z',
  settings:        MOCK_SETTINGS_DEFAULT,
};

let NEXT_ID = 30;

// ── Public API functions ──────────────────────────────────────────────────────

export async function listCourses(params: CoursesListParams = {}): Promise<CoursesListResponse> {
  if (USE_MOCK) return mockDelay(filterMock(params));
  const qs = new URLSearchParams();
  if (params.page)       qs.set('page',       String(params.page));
  if (params.limit)      qs.set('limit',      String(params.limit));
  if (params.status)     qs.set('status',     params.status);
  if (params.category)   qs.set('category',   params.category);
  if (params.instructor) qs.set('instructor', params.instructor);
  if (params.search)     qs.set('search',     params.search);
  return coursesFetch<CoursesListResponse>(`/courses?${qs.toString()}`);
}

export async function getCourse(id: string): Promise<CourseDetail> {
  if (USE_MOCK) {
    const found = MOCK_COURSES.find((c) => c.id === id);
    if (!found) throw new CourseApiError(404, 'Course not found.');
    return mockDelay<CourseDetail>({
      ...MOCK_DETAIL,
      id:              found.id,
      title:           found.title,
      category:        found.category,
      level:           found.level,
      instructor:      found.instructor,
      instructorId:    found.instructorId,
      status:          found.status,
      enrolledCount:   found.enrolledCount,
      updatedAt:       found.updatedAt ?? MOCK_DETAIL.updatedAt,
    });
  }
  return coursesFetch<CourseDetail>(`/courses/${encodeURIComponent(id)}`);
}

export async function createCourse(payload: CreateCoursePayload): Promise<CourseDetail> {
  if (USE_MOCK) {
    const id  = `course-${NEXT_ID++}`;
    const inst = INSTRUCTORS.find((i) => i.id === payload.instructorId) ?? INSTRUCTORS[0];
    const newRow: CourseListRow = {
      id,
      title:         payload.title,
      instructor:    inst.name,
      instructorId:  inst.id,
      category:      payload.category ?? '',
      level:         payload.level    ?? 'Beginner',
      enrolledCount: 0,
      status:        'Draft',           // always Draft per contract
      isRejected:      false,
      rejectionReason: null,
      submittedAt:     null,
      reviewedAt:      null,
      thumbnail:     payload.thumbnail ?? null,
      updatedAt:     new Date().toISOString(),
    };
    MOCK_COURSES.push(newRow);
    MOCK_STATUS_COUNTS.draft += 1;
    MOCK_STATUS_COUNTS.all   += 1;
    return mockDelay<CourseDetail>({
      ...MOCK_DETAIL,
      ...payload,
      id,
      instructor:      inst.name,
      instructorId:    inst.id,
      status:          'Draft',
      enrolledCount:   0,
      subtitle:        payload.subtitle    ?? null,
      description:     payload.description ?? null,
      tags:            payload.tags        ?? [],
      language:        payload.language    ?? null,
      thumbnail:       payload.thumbnail   ?? null,
      categoryId:      payload.categoryId  ?? null,
      createdBy:       null,
      createdAt:       new Date().toISOString(),
      updatedAt:       new Date().toISOString(),
      settings:        MOCK_SETTINGS_DEFAULT,
      rejectionReason: null,
      reviewedAt:      null,
    });
  }
  return coursesFetch<CourseDetail>('/courses', 'POST', payload);
}

export async function updateCourse(id: string, payload: UpdateCoursePayload): Promise<CourseDetail> {
  if (USE_MOCK) {
    const idx = MOCK_COURSES.findIndex((c) => c.id === id);
    if (idx === -1) throw new CourseApiError(404, 'Course not found.');
    const orig = MOCK_COURSES[idx];
    const inst = payload.instructorId
      ? (INSTRUCTORS.find((i) => i.id === payload.instructorId) ?? { name: orig.instructor, id: orig.instructorId })
      : { name: orig.instructor, id: orig.instructorId };
    MOCK_COURSES[idx] = {
      ...orig,
      ...(payload.title    !== undefined && { title: payload.title }),
      ...(payload.category !== undefined && { category: payload.category }),
      ...(payload.level    !== undefined && { level: payload.level }),
      ...(payload.thumbnail !== undefined && { thumbnail: payload.thumbnail }),
      instructor:   inst.name,
      instructorId: inst.id,
    };
    return mockDelay<CourseDetail>({
      ...MOCK_DETAIL,
      id,
      ...payload,
      instructor:      inst.name,
      instructorId:    inst.id,
      status:          orig.status,
      enrolledCount:   orig.enrolledCount,
      subtitle:        payload.subtitle    ?? null,
      description:     payload.description ?? null,
      tags:            payload.tags        ?? [],
      language:        payload.language    ?? null,
      thumbnail:       payload.thumbnail   ?? null,
      categoryId:      payload.categoryId  ?? null,
      updatedAt:       new Date().toISOString(),
      createdAt:       MOCK_DETAIL.createdAt,
      createdBy:       null,
      settings:        MOCK_SETTINGS_DEFAULT,
      rejectionReason: null,
      reviewedAt:      null,
    });
  }
  return coursesFetch<CourseDetail>(`/courses/${encodeURIComponent(id)}`, 'PATCH', payload);
}

export async function archiveCourse(id: string): Promise<void> {
  if (USE_MOCK) {
    const idx = MOCK_COURSES.findIndex((c) => c.id === id);
    if (idx === -1) throw new CourseApiError(404, 'Course not found.');
    const prev = MOCK_COURSES[idx].status;
    MOCK_COURSES[idx] = { ...MOCK_COURSES[idx], status: 'Archived' };
    // adjust counts
    if (prev !== 'Archived') {
      const key = prev.toLowerCase();
      if (key in MOCK_STATUS_COUNTS) (MOCK_STATUS_COUNTS as unknown as Record<string, number>)[key] -= 1;
      MOCK_STATUS_COUNTS.all = Math.max(0, MOCK_STATUS_COUNTS.all - 1);
      MOCK_STATUS_COUNTS.archived += 1;
    }
    return mockDelay<void>(undefined);
  }
  await coursesFetch<void>(`/courses/${encodeURIComponent(id)}`, 'DELETE');
}

export async function restoreCourse(id: string): Promise<{ id: string; status: string }> {
  if (USE_MOCK) {
    const idx = MOCK_COURSES.findIndex((c) => c.id === id);
    if (idx === -1) throw new CourseApiError(404, 'Course not found.');
    if (MOCK_COURSES[idx].status !== 'Archived') throw new CourseApiError(400, 'Only archived courses can be restored.');
    MOCK_COURSES[idx] = { ...MOCK_COURSES[idx], status: 'Draft' };
    MOCK_STATUS_COUNTS.archived = Math.max(0, MOCK_STATUS_COUNTS.archived - 1);
    MOCK_STATUS_COUNTS.draft += 1;
    MOCK_STATUS_COUNTS.all += 1;
    return mockDelay({ id, status: 'Draft' });
  }
  return coursesFetch<{ id: string; status: string }>(`/courses/${encodeURIComponent(id)}/restore`, 'POST');
}
