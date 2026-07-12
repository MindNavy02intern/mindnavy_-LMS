// Courses API — types per "Courses API — Frontend Contract".
// Field names match the backend contract 1:1.
// IDs are uuid strings. `thumbnail` = URL string | null. `category` = plain string.

import type { Pagination } from './lm';

export type { Pagination };

export type CourseLevel  = 'Beginner' | 'Intermediate' | 'Advanced';
export type CourseStatus = 'Published' | 'Draft' | 'Pending' | 'Archived';

// 'All' excludes Archived; Archived only shown when ?status=Archived
export type CourseStatusFilter = 'All' | CourseStatus;

export interface CourseStatusCounts {
  all:       number;
  draft:     number;
  pending:   number;
  published: number;
  archived:  number;
}

// GET /courses list row (table display)
export interface CourseListRow {
  id:           string;
  title:        string;
  instructor:   string;
  instructorId: string | null; // null when the instructor account was deleted
  category:     string; // plain string — no Category table
  level:        CourseLevel;
  enrolledCount: number;
  status:       CourseStatus;
  thumbnail:    string | null;
}

// GET /courses/:id — full detail for form prefill
export interface CourseDetail {
  id:           string;
  title:        string;
  subtitle:     string | null;
  description:  string | null;
  category:     string;
  tags:         string[];
  language:     string | null;
  level:        CourseLevel;
  thumbnail:    string | null;
  instructor:   string;      // display name
  instructorId: string;      // sent back on PATCH
  status:       CourseStatus;
  enrolledCount: number;
  createdAt:    string;      // ISO
  updatedAt:    string;      // ISO
}

// GET /courses response envelope data
export interface CoursesListResponse {
  courses:      CourseListRow[]; // backend key is `courses`, not `data`
  pagination:   Pagination;      // uses `pages` not totalPages
  statusCounts: CourseStatusCounts;
}

// Query params for GET /courses
export interface CoursesListParams {
  page?:       number;
  limit?:      number;
  status?:     CourseStatusFilter;
  category?:   string;
  instructor?: string; // instructor id
  search?:     string; // title contains
}

// POST /courses — always saved as Draft regardless of status field
export interface CreateCoursePayload {
  title:        string;          // required
  subtitle?:    string;
  description?: string;
  category?:    string;
  tags?:        string[];
  language?:    string;
  level?:       CourseLevel;
  thumbnail?:   string | null;
  instructorId: string;          // required
}

// PATCH /courses/:id — any subset of editable fields
export type UpdateCoursePayload = Partial<CreateCoursePayload>;

// Error thrown by every coursesApi function on non-2xx
export class CourseApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'CourseApiError';
  }
}
