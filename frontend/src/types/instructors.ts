// Instructors & Applications — types per INSTRUCTORS_CONTRACT.md v1 (root).
// An instructor IS an AppUser with role = INSTRUCTOR; `id` === `userId` ===
// Course.instructorId. rating/revenue are always null — render "—", never 0.

import type { Pagination } from './lm';

export class InstructorApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'InstructorApiError';
  }
}

export type InstructorStatus = 'active' | 'suspended' | 'pending' | 'invited' | 'archived';
export type VerificationState = 'verified' | 'pending' | 'rejected' | 'expired';

export interface Instructor {
  id:       string;
  userId:   string;
  fullName: string;
  email:    string;
  avatar:   string | null;
  phone:    string | null;
  status:   InstructorStatus;
  verificationState: VerificationState;
  skills:     string[];
  department: string | null;
  branch:     string | null;

  specialization:   string | null;
  headline:         string | null;
  bio:              string | null;
  yearsExperience:  number | null;
  websiteUrl:       string | null;
  linkedinUrl:      string | null;
  revenueShareBps:  number | null;
  hasProfile:       boolean;

  coursesCount:          number;
  publishedCoursesCount: number;
  studentsCount:         number;

  rating:  null;
  revenue: null;

  verifiedAt:      string | null;
  verifiedById:    string | null;
  lastActivityAt:  string | null;
  suspendedAt:     string | null;
  createdAt:       string;
  updatedAt:       string;
}

export interface InstructorCourseRow {
  id:            string;
  title:         string;
  status:        'DRAFT' | 'PENDING' | 'PUBLISHED' | 'ARCHIVED';
  category:      string | null;
  thumbnail:     string | null;
  enrolledCount: number;
  createdAt:     string;
}

export interface InstructorPendingApproval {
  id:          string;
  title:       string;
  category:    string | null;
  submittedAt: string | null;
  createdAt:   string;
}

export interface InstructorRecentActivity {
  id:        string;
  type:      'course_created' | 'session_scheduled' | 'certificate_issued' | 'admin_action';
  title:     string;
  createdAt: string;
}

export interface InstructorPerformanceChart {
  labels:            string[];
  enrollments:       number[];
  revenue:           null;
  revenueAvailable:  false;
}

export interface InstructorDetail extends Instructor {
  liveSessionsCount: number;
  badges: {
    active:        boolean;
    verified:      boolean;
    topInstructor: boolean;
  };
  courses:           InstructorCourseRow[];
  pendingApprovals:  InstructorPendingApproval[];
  recentActivities:  InstructorRecentActivity[];
  performanceChart:  InstructorPerformanceChart;
}

export interface InstructorTabCounts {
  all:       number;
  active:    number;
  inactive:  number;
  suspended: number;
  pending:   number;
}

export interface InstructorsListResponse {
  instructors: Instructor[];
  tabCounts:   InstructorTabCounts;
  pagination:  Pagination;
}

export type Metric = {
  value:          number | null;
  changePercent:  number | null;
  available:      boolean;
  reason?:        string;
};

export interface InstructorsStats {
  totalInstructors:     Metric;
  activeInstructors:    Metric;
  suspendedInstructors: Metric;
  pendingApproval:      Metric;
  coursesPublished:     Metric;
  totalRevenue:         Metric;
  avgRating:            Metric;
}

export interface InstructorsAnalyticsBucket { name: string; count: number; percentage: number }
export interface InstructorsCourseStatusBucket { status: string; count: number; percentage: number }
export interface InstructorsTopItem {
  id: string; name: string; photo: string | null;
  studentsCount: number; publishedCoursesCount: number;
  rating: null; revenue: null;
}

export interface InstructorsAnalytics {
  distributionBySpecialization: { available: boolean; items: InstructorsAnalyticsBucket[] };
  coursesByStatus:              { available: boolean; items: InstructorsCourseStatusBucket[] };
  topInstructors:               { available: boolean; rankedBy: string; limit: number; items: InstructorsTopItem[] };
  earningsOverview:              Metric;
}

// ── Applications ─────────────────────────────────────────────────────────────

export type ApplicationStatus = 'PENDING' | 'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED';

export interface InstructorApplication {
  id:               string;
  fullName:         string;
  email:            string;
  phone:            string | null;
  headline:         string | null;
  bio:              string | null;
  specialization:   string | null;
  skills:           string[];
  yearsExperience:  number | null;
  cvUrl:            string | null;
  portfolioUrl:     string | null;
  status:           ApplicationStatus;
  reviewNotes:      string | null;
  rejectionReason:  string | null;
  changeRequest:    string | null;
  reviewedById:     string | null;
  reviewedAt:       string | null;
  createdUserId:    string | null;
  createdAt:        string;
  updatedAt:        string;
}

export interface InstructorApplicationsStatusCounts {
  PENDING:           number;
  CHANGES_REQUESTED: number;
  APPROVED:          number;
  REJECTED:          number;
}

export interface InstructorApplicationsListResponse {
  applications: InstructorApplication[];
  statusCounts: InstructorApplicationsStatusCounts;
  pagination:   Pagination;
}

// ── Request bodies ────────────────────────────────────────────────────────────

export interface CreateInstructorRequest {
  fullName:          string;
  email:             string;
  password?:         string;
  status?:           'ACTIVE' | 'PENDING' | 'INVITED';
  phone?:            string;
  skills?:           string[];
  specialization?:   string;
  headline?:         string;
  bio?:              string;
  yearsExperience?:  number;
  websiteUrl?:       string;
  linkedinUrl?:      string;
  revenueShareBps?:  number;
}

export interface UpdateInstructorRequest {
  fullName?:         string;
  phone?:            string;
  skills?:           string[];
  specialization?:   string;
  headline?:         string;
  bio?:              string;
  yearsExperience?:  number;
  websiteUrl?:       string;
  linkedinUrl?:      string;
  revenueShareBps?:  number;
}

export interface SuspendInstructorRequest {
  reason: string;
  notes?: string;
}

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?:   T;
  message?: string;
}
