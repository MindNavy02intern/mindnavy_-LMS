// Learning Management Overview — types per LM Overview API Contract v1.
// Field names mirror the contract 1:1 so the frontend needs zero changes
// when lmApi.ts flips from mock data to the real endpoints.

export interface ApiResult<T> {
  success: boolean;
  data:    T;
  error?:  string;
}

export interface LmStatItem {
  value:  number;
  growth: number | null; // percent vs last month; null = not enough data yet
}

export interface LmStats {
  totalCourses:       LmStatItem;
  activeCourses:      LmStatItem;
  totalEnrollments:   LmStatItem;
  coursesCompleted:   LmStatItem;
  avgCompletionRate:  LmStatItem;
  certificatesIssued: LmStatItem;
}

export interface LmDistributionItem {
  category: string;
  count:    number;
  percent:  number;
}

export interface LmDistribution {
  total: number; // authoritative total — do not recompute from items
  items: LmDistributionItem[];
}

export type ProgressRange = 'week' | 'month' | 'year';

export interface ProgressPoint {
  date:       string;
  completed:  number;
  inProgress: number;
  notStarted: number;
  overdue:    number;
}

export interface TopCourse {
  id:             string;
  title:          string;
  instructor:     string;
  completionRate: number;
  enrolledCount:  number;   // contract field name (was `enrolled`)
  thumbnail:      string | null;
}

export interface LmContentStats {
  totalContentItems: number;
  videoLessons:      number;
  documents:         number;
  pdfFiles:          number;
  quizzes:           number;
  scormPackages:     number;
}

export type CourseLevel  = 'Beginner' | 'Intermediate' | 'Advanced';
export type CourseStatus = 'Published' | 'Draft' | 'Pending' | 'Archived';

export interface CourseRow {
  id:           string;
  title:        string;
  instructor:   string;
  instructorId: string;
  category:     string;
  level:        CourseLevel;
  enrolledCount: number;    // backend field name (was `enrolled`)
  progress:     number;
  status:       CourseStatus;
  thumbnail:    string | null;
}

export interface Pagination {
  total: number;
  page:  number;
  limit: number;
  pages: number;
}

export interface LmCoursesResponse {
  courses:    CourseRow[];  // backend key is `courses`, not `data`
  pagination: Pagination;
}

export type LmActivityType =
  | 'course_created'
  | 'session_completed'
  | 'content_uploaded'
  | 'assessment_created'
  | 'certificate_issued';

export interface LmActivity {
  id:        string;
  type:      LmActivityType;
  title:     string;
  actorName: string;        // contract field name (was `by`)
  createdAt: string;        // ISO timestamp — converted to relative time on the frontend
}

export type LiveSessionStatus = 'upcoming' | 'live' | 'ended';

// Contract: { id, title, startTime, enrolledCount, relatedCourse }
// `status` is only a query-param filter (upcoming|live|ended), not a response field.
export interface LiveSession {
  id:            string;
  title:         string;
  startTime:     string;        // ISO timestamp
  enrolledCount: number;        // was `attendees`
  relatedCourse: string | null; // course title or null
}

export interface LmFilterOptions {
  categories:  string[];
  instructors: { id: string; name: string }[];
}
