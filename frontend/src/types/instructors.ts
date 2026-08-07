// Instructors & Applications — types per INSTRUCTORS_CONTRACT.md v1 (root).
// An instructor IS an AppUser with role = INSTRUCTOR; `id` === `userId` ===
// Course.instructorId. rating/revenue are always null — render "—", never 0.

import type { Pagination } from './lm';

export class InstructorApiError extends Error {
  status: number;
  // 409 delete-blocked responses carry { courses, liveSessions } per contract
  // ("Show those counts in the confirm dialog") — everything else omits it.
  data?: { courses?: number; liveSessions?: number };
  constructor(status: number, message: string, data?: { courses?: number; liveSessions?: number }) {
    super(message);
    this.status = status;
    this.data = data;
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
  // Sent unconditionally (may be '') when editing — an omitted key means "no
  // change" server-side, so clearing a previously-set value requires an
  // explicit empty string / null, not omission.
  phone?:            string;
  skills?:           string[];
  specialization?:   string;
  headline?:         string;
  bio?:              string;
  yearsExperience?:  number | null;
  websiteUrl?:       string;
  linkedinUrl?:      string;
  revenueShareBps?:  number;
}

export type InstructorViolationType = 'COPYRIGHT' | 'POLICY' | 'FRAUD' | 'BEHAVIOR' | 'FAKE_CERT' | 'SECURITY';

export interface SuspendInstructorRequest {
  reason: string;
  violationType?: InstructorViolationType;
  notes?: string;
}

// ── Suspension history — GET /instructors/:id/suspension-history ─────────────
// Reads the audit log (USER_SUSPENDED/USER_REACTIVATED), not a suspensions
// table — AppUser.suspendedAt only holds the latest timestamp.

export type SuspensionHistoryAction = 'suspended' | 'reactivated';

export interface SuspensionHistoryEntry {
  id:            string;
  action:        SuspensionHistoryAction;
  reason:        string | null;
  notes:         string | null;
  violationType: InstructorViolationType | null; // null on suspensions recorded before this field existed — render "—"
  adminId:       string | null;
  adminName:     string | null; // null if the acting admin's account has since been removed
  createdAt:     string;
}

export interface SuspensionHistoryResponse {
  history:    SuspensionHistoryEntry[];
  pagination: Pagination;
}

export interface ActionResponse<T = unknown> {
  success: boolean;
  data?:   T;
  message?: string;
}

// ── Documents — INSTRUCTORS_CONTRACT.md "Documents" section ──────────────────
// Administrative paperwork only. Deliberately NO 'CERTIFICATION' type — teaching
// certs/licences/degrees are a separate entity with their own queue (not built
// here); sending CERTIFICATION here is a 400.

export type DocumentType   = 'IDENTITY' | 'CONTRACT' | 'AGREEMENT' | 'TAX' | 'COMPLIANCE';
export type DocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'ARCHIVED';

export interface InstructorDocument {
  id:                string;
  instructorId:      string;
  type:              DocumentType;
  status:            DocumentStatus;
  fileName:          string;
  fileSize:          number;
  mimeType:          string;
  downloadUrl:       string | null;      // SIGNED, expires in 5 min — never cache
  downloadExpiresIn: number | null;
  rejectionReason:   string | null;
  expiresAt:         string | null;
  uploadedById:      string | null;
  uploadedAt:        string;
  verifiedAt:        string | null;
  verifiedById:      string | null;
  updatedAt:         string;
}

export interface InstructorDocumentsResponse {
  documents: InstructorDocument[];
  total:     number;
}

export interface SignDocumentRequest {
  fileName: string;
  fileType: string; // application/pdf | image/png | image/jpeg | image/webp
  type:     DocumentType;
}

export interface SignDocumentResponse {
  uploadUrl: string;
  path:      string;
  type:      DocumentType;
  maxBytes:  number;
  expiresIn: number;
}

export interface ConfirmDocumentRequest {
  path:      string;
  fileName:  string;
  type:      DocumentType;
  expiresAt?: string;
}

// ── Reviews — moderation queue ────────────────────────────────────────────────
// NOT in INSTRUCTORS_CONTRACT.md v1 ("no Review model" is documented as a
// deliberate [planned] gap — decision for Hassan, not a bug). Shipped anyway at
// the user's explicit direction 2026-08-07; see backend instructors.prisma
// InstructorReview for the full note.

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'REMOVED' | 'FLAGGED';

export interface InstructorReview {
  id:           string;
  instructorId: string;
  studentId:    string;
  studentName:  string | null;
  courseId:     string;
  courseTitle:  string | null;
  rating:       number;
  comment:      string | null;
  status:       ReviewStatus;
  createdAt:    string;
  updatedAt:    string;
}

export interface InstructorReviewsResponse {
  reviews:    InstructorReview[];
  pagination: Pagination;
}

// ── Certifications — teaching certs/licences/degrees ─────────────────────────
// NOT in INSTRUCTORS_CONTRACT.md v1 ("Certifications deliberately did NOT ship"
// is documented as a [planned] gap — separate entity from Documents). Shipped
// anyway at the user's explicit direction 2026-08-07; see backend
// instructors.prisma InstructorCertification for the full note.

export type CertificationType   = 'TEACHING' | 'PROFESSIONAL' | 'ACADEMIC' | 'TECHNICAL' | 'TRAINING';
export type CertificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface InstructorCertification {
  id:           string;
  instructorId: string;
  name:         string;
  type:         CertificationType;
  issuer:       string;
  fileUrl:      string | null; // SIGNED, expires in 5 min — never cache, like InstructorDocument.downloadUrl
  status:       CertificationStatus;
  createdAt:    string;
  updatedAt:    string;
  verifiedAt:   string | null;
  verifiedById: string | null;
}

export interface InstructorCertificationsResponse {
  certifications: InstructorCertification[];
  total:          number;
}

export interface SignCertificationRequest {
  fileName: string;
  fileType: string; // application/pdf | image/png | image/jpeg | image/webp
}

export interface SignCertificationResponse {
  uploadUrl: string;
  path:      string;
  maxBytes:  number;
  expiresIn: number;
}

export interface CreateCertificationRequest {
  name:      string;
  issuer:    string;
  type:      CertificationType;
  path?:     string;     // present only when a file was signed + uploaded first
  fileName?: string;
}
