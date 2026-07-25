// Enrollments domain types — v1. Rides the EXISTING course_enrollments table
// (same rows behind LM KPIs, trend chart, top-courses, courses.enrolledCount).
// Source of truth: ENROLLMENTS_CONTRACT.md.
//
// CRITICAL: progress is learner-derived and READ-ONLY here — the PATCH payload
// type below structurally excludes it (only `status` exists), so sending
// progress alongside a status change is impossible to construct from this UI,
// not merely a convention.

import type { Pagination } from './lm';

export type { Pagination };

export type EnrollmentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';

export interface Enrollment {
  id:          string;
  courseId:    string;
  courseTitle: string | null;
  userId:      string;
  userName:    string | null;
  userEmail:   string | null;
  userAvatar:  string | null;
  progress:    number;              // 0-100, READ-ONLY (learner-derived)
  status:      EnrollmentStatus;
  enrolledAt:  string;               // ISO
  completedAt: string | null;        // server-managed by status transitions
  updatedAt:   string;
}

// Chips: counts share every active filter EXCEPT status (same as Courses tab)
export interface EnrollmentStatusCounts {
  All:          number;
  NOT_STARTED:  number;
  IN_PROGRESS:  number;
  COMPLETED:    number;
  OVERDUE:      number;
}

export interface EnrollmentListData {
  enrollments:  Enrollment[];
  pagination:   Pagination;
  statusCounts: EnrollmentStatusCounts;
}

export type EnrollmentStatusFilter = 'All' | EnrollmentStatus;

export interface EnrollmentListParams {
  courseId?: string;
  userId?:   string;
  status?:   EnrollmentStatusFilter;
  search?:   string;
  page?:     number;
  limit?:    number;
}

// POST / — manual enroll
export interface CreateEnrollmentPayload {
  courseId: string;
  userId:   string;
}

// PATCH /:id — the ONLY accepted field is status. No `progress` field exists
// on this type by design — sending it is structurally impossible from here.
export interface UpdateEnrollmentStatusPayload {
  status: EnrollmentStatus;
}
