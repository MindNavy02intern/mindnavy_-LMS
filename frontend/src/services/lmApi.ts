// Learning Management Overview — API service per LM Overview API Contract v1.
//
// USE_MOCK=true returns realistic mock data shaped exactly like the real
// endpoints. Flip it to false once Hassan's /lm/* routes are live — no other
// code in this file or in the widgets needs to change.

import { getStoredToken } from '../api/adminAuth';
import { fetchWithRetry } from '../lib/fetchWithRetry';
import type {
  ApiResult,
  LmStats,
  LmDistribution,
  ProgressPoint,
  ProgressRange,
  TopCourse,
  LmContentStats,
  CourseRow,
  LmCoursesResponse,
  LmActivity,
  LiveSession,
  LiveSessionStatus,
  LmFilterOptions,
} from '../types/lm';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

const USE_MOCK = false; // set back to true to use mock data instead of the real backend

export class LmApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'LmApiError';
  }
}

async function lmFetch<T>(path: string): Promise<T> {
  const token = getStoredToken();
  const res = await fetchWithRetry(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const json = await res.json().catch(() => ({ success: false, error: `HTTP ${res.status}` }));
  const body = json as ApiResult<T>;
  if (!res.ok || !body.success) {
    throw new LmApiError(res.status, body.message ?? body.error ?? `HTTP ${res.status}`);
  }
  return body.data;
}

function mockResolve<T>(data: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), 300));
}

// ── Mock data ──────────────────────────────────────────────────────────────────

const MOCK_STATS: LmStats = {
  totalCourses:       { value: 256,   growth: 12.5 },
  activeCourses:      { value: 198,   growth: 8.7 },
  totalEnrollments:   { value: 12584, growth: 15.3 },
  coursesCompleted:   { value: 3256,  growth: 13.8 },
  avgCompletionRate:  { value: 68.4,  growth: -2.1 },
  certificatesIssued: { value: 2845,  growth: null },
};

const MOCK_DISTRIBUTION: LmDistribution = {
  total: 256,
  items: [
    { category: 'Technology',           count: 98, percentage: 38.3 },
    { category: 'Business',             count: 56, percentage: 21.9 },
    { category: 'Design',               count: 42, percentage: 16.4 },
    { category: 'Marketing',            count: 32, percentage: 12.5 },
    { category: 'Personal Development', count: 18, percentage: 7.0 },
    { category: 'Other',                count: 10, percentage: 3.9 },
  ],
};

const MOCK_PROGRESS: Record<ProgressRange, ProgressPoint[]> = {
  week: [
    { date: 'Mon', completed: 820, inProgress: 540, notStarted: 210, overdue: 90 },
    { date: 'Tue', completed: 910, inProgress: 600, notStarted: 190, overdue: 85 },
    { date: 'Wed', completed: 860, inProgress: 560, notStarted: 200, overdue: 78 },
    { date: 'Thu', completed: 980, inProgress: 640, notStarted: 175, overdue: 70 },
    { date: 'Fri', completed: 1040, inProgress: 610, notStarted: 160, overdue: 65 },
    { date: 'Sat', completed: 620,  inProgress: 320, notStarted: 140, overdue: 55 },
    { date: 'Sun', completed: 540,  inProgress: 280, notStarted: 130, overdue: 50 },
  ],
  month: [
    { date: 'May 13', completed: 5400, inProgress: 3200, notStarted: 1800, overdue: 1100 },
    { date: 'May 20', completed: 6100, inProgress: 4400, notStarted: 1600, overdue: 950 },
    { date: 'May 27', completed: 5800, inProgress: 3800, notStarted: 1500, overdue: 800 },
    { date: 'Jun 3',  completed: 6700, inProgress: 4600, notStarted: 1400, overdue: 700 },
    { date: 'Jun 10', completed: 7200, inProgress: 4100, notStarted: 1300, overdue: 600 },
  ],
  year: [
    { date: 'Jan', completed: 18000, inProgress: 9800,  notStarted: 5200, overdue: 3100 },
    { date: 'Mar', completed: 21000, inProgress: 11200, notStarted: 4800, overdue: 2700 },
    { date: 'May', completed: 24500, inProgress: 12600, notStarted: 4300, overdue: 2300 },
    { date: 'Jul', completed: 27800, inProgress: 13900, notStarted: 3900, overdue: 1900 },
    { date: 'Sep', completed: 31200, inProgress: 15100, notStarted: 3500, overdue: 1600 },
    { date: 'Nov', completed: 34600, inProgress: 16400, notStarted: 3100, overdue: 1300 },
  ],
};

const MOCK_TOP_COURSES: TopCourse[] = [
  { id: 'c1', title: 'Complete React Developer',   instructor: 'John Smith',    completionRate: 92, enrolledCount: 1245, thumbnail: null },
  { id: 'c2', title: 'Data Science Fundamentals',  instructor: 'Sarah Johnson', completionRate: 89, enrolledCount: 1856, thumbnail: null },
  { id: 'c3', title: 'UI/UX Design Masterclass',   instructor: 'Michael Brown', completionRate: 87, enrolledCount: 1023, thumbnail: null },
  { id: 'c4', title: 'Python for Data Analysis',   instructor: 'Emily Davis',   completionRate: 85, enrolledCount: 1456, thumbnail: null },
  { id: 'c5', title: 'Digital Marketing Strategy', instructor: 'David Wilson',  completionRate: 83, enrolledCount: 977,  thumbnail: null },
  { id: 'c6', title: 'Advanced Node.js',           instructor: 'James Taylor',  completionRate: 79, enrolledCount: 845,  thumbnail: null },
  { id: 'c7', title: 'Leadership and Management',  instructor: 'Lisa Anderson', completionRate: 74, enrolledCount: 712,  thumbnail: null },
];

const MOCK_CONTENT_STATS: LmContentStats = {
  totalContentItems: 1245,
  videoLessons:      642,
  documents:          256,
  pdfFiles:           187,
  quizzes:            96,
  scormPackages:      64,
};

const MOCK_INSTRUCTORS = [
  { id: 'u1', name: 'Sarah Johnson' },
  { id: 'u2', name: 'Michael Brown' },
  { id: 'u3', name: 'Emily Davis' },
  { id: 'u4', name: 'David Wilson' },
  { id: 'u5', name: 'James Taylor' },
  { id: 'u6', name: 'Lisa Anderson' },
  { id: 'u7', name: 'Robert Johnson' },
];

const MOCK_CATEGORIES = ['Technology', 'Business', 'Design', 'Marketing', 'Personal Development'];

function buildMockCourses(): CourseRow[] {
  const titles = [
    'Advanced Python Programming', 'Business Analytics Fundamentals', 'UI/UX Design Principles',
    'Digital Marketing Strategy', 'Data Science with Python', 'Leadership and Management',
    'Communication Skills', 'Complete React Developer', 'Data Science Fundamentals',
    'UI/UX Design Masterclass', 'Python for Data Analysis', 'Project Management Essentials',
    'Brand Strategy Workshop', 'Figma for Product Design', 'SEO and Content Marketing',
    'Time Management Mastery', 'Node.js Microservices', 'Financial Modeling Basics',
    'Motion Graphics in After Effects', 'Public Speaking Confidence', 'SQL for Analysts',
    'Negotiation Skills', 'Mobile App Design', 'Email Marketing Automation', 'Mindfulness at Work',
  ];
  const levels: CourseRow['level'][] = ['Beginner', 'Intermediate', 'Advanced'];
  const statuses: CourseRow['status'][] = ['Published', 'Published', 'Published', 'Draft'];

  return titles.map((title, i) => {
    const instructor = MOCK_INSTRUCTORS[i % MOCK_INSTRUCTORS.length];
    return {
      id:           `course-${i + 1}`,
      title,
      instructor:   instructor.name,
      instructorId: instructor.id,
      category:     MOCK_CATEGORIES[i % MOCK_CATEGORIES.length],
      level:        levels[i % levels.length],
      enrolledCount: 600 + ((i * 137) % 1200),
      thumbnail:    null,
      progress:     30 + ((i * 11) % 65),
      status:       statuses[i % statuses.length],
    };
  });
}

const MOCK_COURSES = buildMockCourses();

function buildMockActivities(): LmActivity[] {
  const hour = 3600 * 1000;
  const day = 24 * hour;
  const now = Date.now();
  return [
    { id: 'a1', type: 'course_created',      title: "New course 'Advanced Python' created",    actorName: 'Sarah Johnson',  createdAt: new Date(now - 2 * hour).toISOString() },
    { id: 'a2', type: 'session_completed',   title: "Live session 'UI/UX Workshop' completed", actorName: 'Michael Brown',  createdAt: new Date(now - 4 * hour).toISOString() },
    { id: 'a3', type: 'content_uploaded',    title: "New content uploaded to 'Data Science'",  actorName: 'Emily Davis',    createdAt: new Date(now - 1 * day).toISOString() },
    { id: 'a4', type: 'assessment_created',  title: "Assessment 'JavaScript Quiz' created",     actorName: 'David Wilson',   createdAt: new Date(now - 2 * day).toISOString() },
    { id: 'a5', type: 'certificate_issued',  title: 'Certificate issued to 12 students',        actorName: 'System',         createdAt: new Date(now - 2 * day - 3 * hour).toISOString() },
  ];
}

const MOCK_ACTIVITIES = buildMockActivities();

function buildMockLiveSessions(): LiveSession[] {
  const hour = 3600 * 1000;
  const day = 24 * hour;
  const now = Date.now();
  return [
    { id: 'ls1', title: 'UI/UX Workshop Q&A',        startTime: new Date(now + 4 * hour).toISOString(),            enrolledCount: 34, relatedCourse: 'UI/UX Design Masterclass' },
    { id: 'ls2', title: 'React Patterns Deep Dive',  startTime: new Date(now + 1 * day).toISOString(),             enrolledCount: 58, relatedCourse: 'Complete React Developer' },
    { id: 'ls3', title: 'Data Science Office Hours', startTime: new Date(now + 2 * day + 3 * hour).toISOString(),  enrolledCount: 21, relatedCourse: 'Data Science Fundamentals' },
    { id: 'ls4', title: 'Marketing Strategy Recap',  startTime: new Date(now - 1 * day).toISOString(),             enrolledCount: 47, relatedCourse: null },
  ];
}

const MOCK_LIVE_SESSIONS = buildMockLiveSessions();

const MOCK_FILTER_OPTIONS: LmFilterOptions = {
  categories:  MOCK_CATEGORIES,
  instructors: MOCK_INSTRUCTORS,
};

// ── Endpoints ──────────────────────────────────────────────────────────────────

export async function getLmStats(): Promise<LmStats> {
  if (USE_MOCK) return mockResolve(MOCK_STATS);
  return lmFetch<LmStats>('/lm/stats');
}

export async function getLmDistribution(): Promise<LmDistribution> {
  if (USE_MOCK) return mockResolve(MOCK_DISTRIBUTION);
  return lmFetch<LmDistribution>('/lm/distribution');
}

export async function getLmProgress(range: ProgressRange): Promise<ProgressPoint[]> {
  if (USE_MOCK) return mockResolve(MOCK_PROGRESS[range]);
  return lmFetch<ProgressPoint[]>(`/lm/progress?range=${range}`);
}

export async function getLmTopCourses(limit = 5): Promise<TopCourse[]> {
  if (USE_MOCK) return mockResolve(MOCK_TOP_COURSES.slice(0, limit));
  return lmFetch<TopCourse[]>(`/lm/top-courses?limit=${limit}`);
}

export async function getLmContentStats(): Promise<LmContentStats> {
  if (USE_MOCK) return mockResolve(MOCK_CONTENT_STATS);
  return lmFetch<LmContentStats>('/lm/content-stats');
}

export async function getLmCourses(params: {
  page?:       number;
  limit?:      number;
  category?:   string;
  instructor?: string;
} = {}): Promise<LmCoursesResponse> {
  const page  = params.page  ?? 1;
  const limit = params.limit ?? 10;

  if (USE_MOCK) {
    let filtered = MOCK_COURSES;
    if (params.category)   filtered = filtered.filter((c) => c.category === params.category);
    if (params.instructor) filtered = filtered.filter((c) => c.instructorId === params.instructor);
    const total = filtered.length;
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit);
    return mockResolve({
      courses: data, // backend key is `courses`
      pagination: { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  }

  const qs = new URLSearchParams();
  qs.set('page', String(page));
  qs.set('limit', String(limit));
  if (params.category)   qs.set('category', params.category);
  if (params.instructor) qs.set('instructor', params.instructor);
  return lmFetch<LmCoursesResponse>(`/lm/courses?${qs.toString()}`);
}

export async function getLmActivities(limit = 5): Promise<LmActivity[]> {
  if (USE_MOCK) return mockResolve(MOCK_ACTIVITIES.slice(0, limit));
  return lmFetch<LmActivity[]>(`/lm/activities?limit=${limit}`);
}

export async function getLmLiveSessions(status: LiveSessionStatus = 'upcoming'): Promise<LiveSession[]> {
  if (USE_MOCK) {
    const now = Date.now();
    const filtered = status === 'upcoming' ? MOCK_LIVE_SESSIONS.filter((s) => new Date(s.startTime).getTime() > now)
                   : status === 'ended'    ? MOCK_LIVE_SESSIONS.filter((s) => new Date(s.startTime).getTime() < now)
                   : MOCK_LIVE_SESSIONS; // 'live' — return all for mock
    return mockResolve(filtered);
  }
  return lmFetch<LiveSession[]>(`/lm/live-sessions?status=${status}`);
}

export async function getLmFilterOptions(): Promise<LmFilterOptions> {
  if (USE_MOCK) return mockResolve(MOCK_FILTER_OPTIONS);
  return lmFetch<LmFilterOptions>('/lm/filter-options');
}
