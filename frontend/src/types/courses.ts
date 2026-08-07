// Courses API — types per backend source (courses.service + courseWorkflow.service).
// Field names match the backend mapFull() / mapSettings() responses 1:1.
// IDs are uuid strings. `thumbnail` = URL string | null.

import type { Pagination } from './lm';

export type { Pagination };

export type CourseLevel  = 'Beginner' | 'Intermediate' | 'Advanced';
export type CourseStatus = 'Published' | 'Draft' | 'Pending' | 'Archived';
export type CourseVisibility = 'Public' | 'Private' | 'Unlisted';

// 'All' excludes Archived; Archived only shown when ?status=Archived.
// 'Rejected' is a query-only filter, never a real status — see isRejected below.
export type CourseStatusFilter = 'All' | CourseStatus | 'Rejected';

export interface CourseStatusCounts {
  all:       number;
  draft:     number;
  pending:   number;
  published: number;
  archived:  number;
  rejected:  number;  // Draft rows with isRejected true — draft + rejected = all drafts
}

// Validated keys for accessRules (backend allow-lists exactly these).
export interface AccessRules {
  requiresEnrollment?:    boolean;
  startDate?:             string;   // ISO 8601
  endDate?:               string;   // ISO 8601
  allowedGroupIds?:       string[]; // max 50
  prerequisiteCourseIds?: string[]; // max 50
}

// Settings sub-object returned by GET /courses/:id (embedded in CourseDetail)
// and by PATCH /courses/:id/settings.
export interface CourseSettings {
  isFree:             boolean;
  price:              number | null;       // integer cents
  currency:           string | null;       // 3-letter ISO, e.g. "USD"
  enrollmentLimit:    number | null;
  visibility:         CourseVisibility;
  certificateEnabled: boolean;
  dripContentEnabled: boolean;
  accessRules:        AccessRules | null;
  seoTitle:           string | null;       // max 70
  seoDescription:     string | null;       // max 200
}

// GET /courses list row (table display). No createdAt here — only CourseDetail
// has it; list-row consumers that need a date column use updatedAt.
export interface CourseListRow {
  id:           string;
  title:        string;
  instructor:   string;
  instructorId: string | null; // null when the instructor account was deleted
  category:     string | null;
  level:        CourseLevel;
  enrolledCount: number;
  status:       CourseStatus;
  isRejected:      boolean;         // status === 'Draft' && rejectionReason !== null — badge off this, not status
  rejectionReason: string | null;
  submittedAt:     string | null;   // stamped on every Draft->Pending transition; null pre-existing
  reviewedAt:      string | null;   // last approve/reject timestamp; survives unpublish
  thumbnail:    string | null;
  updatedAt:    string;        // ISO
}

// GET /courses/:id — full detail (used by form prefill + wizard steps)
export interface CourseDetail extends CourseListRow {
  subtitle:        string | null;
  description:     string | null;
  language:        string | null;
  tags:            string[];
  createdBy:       string | null;
  createdAt:       string;          // ISO
  categoryId:      string | null;   // Category table FK (null if unlinked)
  settings:        CourseSettings;  // wizard step 4 fields
}

// GET /courses response envelope data
export interface CoursesListResponse {
  courses:      CourseListRow[];
  pagination:   Pagination;
  statusCounts: CourseStatusCounts;
}

// Query params for GET /courses
export interface CoursesListParams {
  page?:       number;
  limit?:      number;
  status?:     CourseStatusFilter;
  category?:   string;
  instructor?: string;
  search?:     string;
}

// POST /courses — always saved as Draft
export interface CreateCoursePayload {
  title:        string;          // required
  subtitle?:    string;
  description?: string;
  category?:    string;
  categoryId?:  string | null;
  tags?:        string[];
  language?:    string;
  level?:       CourseLevel;
  thumbnail?:   string | null;
  instructorId: string;          // required
}

// PATCH /courses/:id — any subset (status field explicitly rejected by backend)
export type UpdateCoursePayload = Partial<CreateCoursePayload>;

// Settings returned by PATCH /courses/:id/settings (includes updatedAt)
export interface CourseSettingsResponse extends CourseSettings {
  id:        string;
  updatedAt: string;
}

// PATCH /courses/:id/settings body — any subset of settings fields
export interface UpdateSettingsPayload {
  isFree?:             boolean;
  price?:              number | null;   // integer cents; null clears price
  currency?:           string | null;   // 3-letter ISO
  enrollmentLimit?:    number | null;
  visibility?:         CourseVisibility;
  certificateEnabled?: boolean;
  dripContentEnabled?: boolean;
  accessRules?:        AccessRules | null;
  seoTitle?:           string | null;
  seoDescription?:     string | null;
}

// POST /courses/:id/submit response
export interface SubmitCourseResponse {
  id:     string;
  status: 'Pending';
}

// POST /courses/:id/approve response
export interface ApproveCourseResponse {
  id:         string;
  status:     'Published';
  reviewedAt: string;
}

// POST /courses/:id/reject response
export interface RejectCourseResponse {
  id:              string;
  status:          'Draft';
  rejectionReason: string;
  reviewedAt:      string;
}

// POST /courses/:id/unpublish response — Published -> Draft, not a rejection
export interface UnpublishCourseResponse {
  id:     string;
  status: 'Draft';
}

// Error thrown by every coursesApi / courseWizardApi function on non-2xx
export class CourseApiError extends Error {
  status: number;
  errors?: string[];
  constructor(status: number, message: string, errors?: string[]) {
    super(message);
    this.status = status;
    this.errors = errors;
    this.name = 'CourseApiError';
  }
}
