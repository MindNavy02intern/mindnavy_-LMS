// Learners — types per LEARNERS_CONTRACT.md (written in Part 10). Mirrors
// types/instructors.ts exactly. A learner IS an AppUser with role = LEARNER;
// `id` === `userId` === CourseEnrollment.userId === Certificate.userId.
//
// TERMINOLOGY: "Learner" only. See learners.prisma header note — the dead
// queryKeys.students.*/'student.*' scaffolding in lib/invalidation.ts predates
// this module and is deliberately left untouched, not reused.

import type { Pagination } from './lm';
import type { Certificate } from './certificates';

export class LearnerApiError extends Error {
  status: number;
  // 409 delete-blocked responses carry { activeEnrollments } — see the
  // contract's delete section.
  data?: { activeEnrollments?: number };
  constructor(status: number, message: string, data?: { activeEnrollments?: number }) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'LearnerApiError';
  }
}

export type LearnerStatus = 'active' | 'suspended' | 'pending' | 'invited' | 'archived';
export type VerificationState = 'verified' | 'pending' | 'rejected' | 'expired';
export type LearnerLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';
export type LearnerVerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface Learner {
  id:       string;
  userId:   string;
  fullName: string;
  email:    string;
  avatar:   string | null;
  phone:    string | null;
  status:   LearnerStatus;
  verificationState: VerificationState;
  orgDepartment: string | null; // AppUser.department (org hierarchy) — distinct from profile.department below
  branch:        string | null;

  learnerCode:        string | null; // null only when hasProfile is false
  program:            string | null;
  level:              LearnerLevel | null;
  department:         string | null; // academic department (LearnerProfile), not org department
  batch:               string | null;
  advisorId:          string | null;
  verificationStatus: LearnerVerificationStatus | null;
  riskScore:          number | null; // null = no signal, NEVER treat as 0
  joinedDate:         string;
  hasProfile:          boolean;

  coursesCount:          number;
  completedCoursesCount: number;
  avgProgress:           number | null; // null when they have zero enrollments
  certificatesCount:     number;

  lastActiveAt: string | null;
  suspendedAt:  string | null;
  createdAt:    string;
  updatedAt:    string;
}

export interface LearnerDetail extends Learner {
  advisorName: string | null; // detail-only enrichment — list rows only carry advisorId
  badges: {
    active:   boolean;
    atRisk:   boolean;
    verified: boolean;
  };
}

// ── Enrollments (Part 3) — thin wrapper over ENROLLMENTS_CONTRACT.md's shape ──

export type EnrollmentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';

export interface LearnerEnrollment {
  id:          string;
  courseId:    string;
  courseTitle: string | null;
  userId:      string;
  userName:    string | null;
  userEmail:   string | null;
  userAvatar:  string | null;
  progress:    number;
  status:      EnrollmentStatus;
  enrolledAt:  string;
  completedAt: string | null;
  updatedAt:   string;
  startDate:   string | null;
  expiryDate:  string | null;
  cohortId:    string | null;
}

export interface LearnerEnrollmentsResponse {
  enrollments: LearnerEnrollment[];
  pagination: { total: number; page: number; limit: number; pages: number };
  statusCounts: { All: number; NOT_STARTED: number; IN_PROGRESS: number; COMPLETED: number; OVERDUE: number };
}

export interface CreateLearnerEnrollmentRequest {
  courseId?:       string;
  learningPathId?: string;
  startDate?:      string;
  expiryDate?:     string;
  cohortId?:       string;
}

export interface EnrollResult {
  enrolledCount: number;
  failedCount?: number; // present on bulk-enroll (POST /learners/bulk-enroll); absent on the path-expansion variant
  results: Array<{ courseId?: string; learnerId?: string; success: boolean; error?: string; enrollment?: LearnerEnrollment }>;
}

export interface BulkEnrollLearnersRequest {
  learnerIds: string[];
  courseId?: string;
  learningPathId?: string;
  startDate?: string;
  expiryDate?: string;
  cohortId?: string;
}

// ── Progress (Part 3) ──────────────────────────────────────────────────────────

export interface LearnerProgressCourse {
  enrollmentId:    string;
  courseId:        string;
  courseTitle:     string | null;
  courseThumbnail: string | null;
  progress:        number;
  status:          EnrollmentStatus;
  completedAt:     string | null;
  updatedAt:       string;
}

export interface LearnerProgressResponse {
  courses: LearnerProgressCourse[];
}

// ── Activity (Part 3) ──────────────────────────────────────────────────────────

export type LearnerActivityType = 'login' | 'lesson_viewed' | 'video_watched' | 'quiz_attempt' | 'assignment_upload' | 'session_attended';

export interface LearnerActivityEntry {
  id:        string;
  type:      LearnerActivityType;
  title:     string;
  createdAt: string;
}

export interface LearnerActivityResponse {
  activities: LearnerActivityEntry[];
  pagination: { total: number; page: number; limit: number; pages: number };
  // Types with no source table in this system (see learners.service —
  // lesson_viewed/video_watched/assignment_upload) — always present so the
  // frontend can render "not tracked" honestly instead of an empty result
  // looking like "nothing happened".
  unavailableTypes: LearnerActivityType[];
}

export interface LearnerTabCounts {
  all:       number;
  active:    number;
  inactive:  number;
  suspended: number;
  'at-risk': number;
  completed: number;
  'pending-verification': number;
  graduated: number;
}

export interface LearnersListResponse {
  learners:   Learner[];
  tabCounts:  LearnerTabCounts;
  pagination: Pagination;
}

export type Metric = {
  value:         number | null;
  changePercent: number | null;
  available:     boolean;
  reason?:       string;
};

export interface LearnersStats {
  totalLearners:    Metric;
  activeLearners:   Metric;
  newLearners:      Metric;
  completedCourses: Metric;
  avgProgress:      Metric;
  atRiskLearners:   Metric;
}

// ── Analytics (7 sections, Part 9 consumes these) ─────────────────────────────

export interface LearnersByProgramBucket { name: string; count: number; percentage: number }
export interface ProgressOverviewSeries { labels: string[]; avgProgress: number[] }
export interface AtRiskListItem { id: string; name: string; photo: string | null; riskScore: number | null; program: string | null }
export interface EnrollmentTrendSeries { labels: string[]; enrollments: number[] }
export interface TopPerformerItem { id: string; name: string; photo: string | null; completedCoursesCount: number; avgProgress: number | null }
export interface RecentCertificateItem { id: string; learnerId: string | null; learnerName: string | null; courseTitle: string | null; issuedAt: string; revoked: boolean }
export interface EngagementBucket { name: string; count: number; percentage: number }

export interface LearnersAnalytics {
  learnersByProgram:     { available: boolean; items: LearnersByProgramBucket[] };
  progressOverview:      { available: boolean } & ProgressOverviewSeries;
  atRiskLearners:        { available: boolean; items: AtRiskListItem[] };
  enrollmentTrend:       { available: boolean } & EnrollmentTrendSeries;
  topPerformingLearners: { available: boolean; items: TopPerformerItem[] };
  recentCertificates:    { available: boolean; items: RecentCertificateItem[] };
  learnerEngagement:     { available: boolean; score: number; items: EngagementBucket[] };
}

// ── Request bodies ────────────────────────────────────────────────────────────

export interface CreateLearnerRequest {
  fullName:  string;
  email:     string;
  password?: string;
  status?:   'ACTIVE' | 'PENDING' | 'INVITED';
  phone?:    string;
  program?:  string;
  level?:    LearnerLevel;
  department?: string;
  batch?:      string;
  advisorId?:  string;
  verificationStatus?: LearnerVerificationStatus;
  riskScore?:          number;
}

export interface UpdateLearnerRequest {
  fullName?: string;
  phone?:    string;
  program?:  string;
  level?:    LearnerLevel;
  department?: string;
  batch?:      string;
  advisorId?:  string;
  verificationStatus?: LearnerVerificationStatus;
  riskScore?:          number | null;
}

// Extends the SHARED violation taxonomy (users.validator.js VIOLATION_TYPES) —
// this is the learner-relevant subset, same pattern as InstructorViolationType
// scoping the same shared enum to the instructor-relevant subset.
export type LearnerViolationType = 'CHEATING' | 'POLICY' | 'BEHAVIOR' | 'ACCOUNT_ABUSE' | 'PAYMENT_FRAUD' | 'SECURITY';

export interface SuspendLearnerRequest {
  reason: string;
  violationType?: LearnerViolationType;
  notes?: string;
}

export interface ResetLearnerPasswordRequest {
  newPassword: string;
}

// ── Suspension history — GET /learners/:id/suspension-history ────────────────

export type SuspensionHistoryAction = 'suspended' | 'reactivated';

export interface SuspensionHistoryEntry {
  id:            string;
  action:        SuspensionHistoryAction;
  reason:        string | null;
  notes:         string | null;
  violationType: LearnerViolationType | null;
  adminId:       string | null;
  adminName:     string | null;
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

// ── Assessments (Part 5/6) — QuizAttempt ──────────────────────────────────────

export type AssessmentStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'REOPENED';

export interface LearnerAssessment {
  id:           string;
  quizId:       string;
  quizTitle:    string | null;
  passingGrade: number | null;
  courseId:     string | null;
  courseTitle:  string | null;
  status:       AssessmentStatus;
  score:        number | null;
  feedback:     string | null;
  attemptNo:    number;
  startedAt:    string;
  submittedAt:  string | null;
  gradedAt:     string | null;
  gradedById:   string | null;
  createdAt:    string;
  updatedAt:    string;
}

export interface LearnerAssessmentsResponse {
  assessments: LearnerAssessment[];
  pagination:  Pagination;
}

export interface GradeAssessmentRequest {
  score:     number;
  feedback?: string;
}

// ── Certificates (Part 5/6) — thin wrapper over the Certificates module ──────
// `certificates` reuses types/certificates.ts's `Certificate` directly — same
// shape, same source (certificates.service), no second type for one row.

export interface LearnerCertificatesResponse {
  certificates: Certificate[];
  pagination:   Pagination;
}

export interface ReissueCertificateRequest {
  templateId?: string | null;
}

export interface RevokeCertificateRequest {
  reason?: string;
}

// ── Attendance (Part 5/6) — SessionAttendance ─────────────────────────────────

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';

export interface LearnerAttendanceRecord {
  id:                  string;
  sessionId:           string | null;
  sessionTitle:        string | null;
  sessionStartTime:    string | null;
  status:              AttendanceStatus;
  joinedAt:            string | null;
  leftAt:              string | null;
  durationMin:         number | null;
  participationScore:  number | null;
  createdAt:           string;
}

export interface LearnerAttendanceResponse {
  records: LearnerAttendanceRecord[];
  summary: { present: number; late: number; absent: number; excused: number };
  pagination: Pagination;
}

// ── Documents (Part 7/8) — mirrors InstructorDocument's shape exactly,
// different type taxonomy. See learners.prisma LearnerDocument. ────────────────

export type LearnerDocumentType   = 'IDENTITY' | 'ENROLLMENT_AGREEMENT' | 'ACADEMIC_RECORD' | 'COMPLIANCE_FORM' | 'CERTIFICATE';
export type LearnerDocumentStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'ARCHIVED';

export interface LearnerDocument {
  id:                string;
  learnerId:         string;
  type:              LearnerDocumentType;
  status:            LearnerDocumentStatus;
  fileName:          string;
  fileSize:          number;
  mimeType:          string;
  downloadUrl:       string | null; // SIGNED, expires in 5 min — never cache
  downloadExpiresIn: number | null;
  rejectionReason:   string | null;
  expiresAt:         string | null;
  uploadedById:      string | null;
  uploadedAt:        string;
  verifiedAt:        string | null;
  verifiedById:      string | null;
  updatedAt:         string;
}

export interface LearnerDocumentsResponse {
  documents: LearnerDocument[];
  total:     number;
}

export interface SignLearnerDocumentRequest {
  fileName: string;
  fileType: string;
  type:     LearnerDocumentType;
}

export interface SignLearnerDocumentResponse {
  uploadUrl: string;
  path:      string;
  type:      LearnerDocumentType;
  maxBytes:  number;
  expiresIn: number;
}

export interface ConfirmLearnerDocumentRequest {
  path:      string;
  fileName:  string;
  type:      LearnerDocumentType;
  expiresAt?: string;
}

// ── Tickets (Part 7/8) — SupportTicket, no create endpoint (see the backend
// validator's header note — no learner-facing app raises one yet). ──────────────

export type TicketStatus   = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ESCALATED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type TicketCategory = 'TECHNICAL' | 'ENROLLMENT' | 'PAYMENT' | 'ACCESS' | 'GENERAL';

export interface LearnerTicket {
  id:           string;
  subject:      string;
  body:         string;
  category:     TicketCategory;
  status:       TicketStatus;
  priority:     TicketPriority;
  assignedToId: string | null;
  resolvedAt:   string | null;
  resolution:   string | null;
  messageCount: number;
  createdAt:    string;
  updatedAt:    string;
}

export interface LearnerTicketsResponse {
  tickets:    LearnerTicket[];
  pagination: Pagination;
}
