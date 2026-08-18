// Reports & Analytics — types per REPORTS_CONTRACT.md. Field names mirror the
// backend service response shapes 1:1 (reports.service.js / reports.controller.js),
// same convention as types/competencies.ts / types/instructors.ts. Every shape
// here was live-verified against the real API during the build, not guessed.

export class ReportsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ReportsApiError';
  }
}

export type DateRangeKey = 'week' | 'month' | 'quarter' | 'custom';

export interface DateRangeParams {
  dateRange?: DateRangeKey;
  dateFrom?: string; // required when dateRange === 'custom'
  dateTo?:   string;
}

// { value, changePercent, available, reason? } — available:false NEVER
// means the value is 0, it means no source table/model exists for it yet.
export type Metric = {
  value:         number | null;
  changePercent: number | null;
  available:     boolean;
  reason?:       string;
};

export interface Pagination {
  total: number;
  page:  number;
  limit: number;
  pages: number;
}

export interface TrendSeries {
  labels: string[];
  values: number[];
}

// ── 1. Overview ──────────────────────────────────────────────────────────

export interface ReportsOverview {
  totalUsers:          Metric;
  activeLearners:       Metric;
  activeInstructors:    Metric;
  coursesCompleted:     Metric;
  avgLearningProgress:  Metric;
  liveSessionsToday:    Metric;
  totalRevenue:         Metric;
  certificatesIssued:   Metric;
  engagementScore:      Metric;
  systemActivity:       Metric;
}

// ── 2. Learner Analytics ─────────────────────────────────────────────────

export interface RiskUser {
  id:        string;
  name:      string | null;
  riskScore: number | null;
}

export interface LearnerPerformer {
  userId:      string;
  name:        string | null;
  avgProgress: number;
  enrollments: number;
}

export interface InactiveUser {
  id:             string;
  name:           string | null;
  lastActivityAt: string | null;
}

export interface SlowLearner {
  id:                string;
  userId:            string | null;
  name:              string | null;
  courseTitle:       string | null;
  progress:          number;
  daysSinceEnrolled: number;
}

export interface LearnerAnalytics {
  activityTrend:       { labels: string[]; activeUsers: number[] };
  progressDistribution: { excellent: number; good: number; average: number; poor: number };
  completionRate:      { value: number; trend: number[] };
  dropoutRisk:         { high: RiskUser[]; medium: RiskUser[]; low: RiskUser[] };
  retentionRate:       Metric;
  // Raw count backing completionRate.value — "completed courses", not
  // "completed lessons" (no per-lesson tracking model exists in this schema).
  completedEnrollments: number;
  topPerformers:       LearnerPerformer[];
  inactiveUsers:       InactiveUser[];
  // avg days from enrollment to completion, over completions in this window.
  learningSpeedDays:   Metric;
  // still-in-progress enrollments, started 30+ days ago, progress < 20%.
  slowLearners:        SlowLearner[];
  // topPerformers threshold-filtered to avgProgress > 80 (same data, no new query).
  highPerformers:      LearnerPerformer[];
}

// ── 3. Instructor Analytics ──────────────────────────────────────────────

export interface TopInstructorRow {
  id:               string;
  name:             string | null;
  publishedCourses: number;
  liveSessions:     number;
}

export interface InstructorPerformanceRow {
  id:               string;
  name:             string;
  publishedCourses: number;
  totalCourses:     number;
  liveSessions:     number;
  completionRate:   number | null; // null = no enrollments in their courses
}

export interface InstructorAnalytics {
  avgRating:             Metric;
  courseCompletionRate:  Metric;
  liveSessionAttendance: Metric;
  topInstructors:        TopInstructorRow[];
  performanceComparison: InstructorPerformanceRow[];
}

// ── 4. Course Analytics ───────────────────────────────────────────────────

export interface CourseCompletionRow {
  id:             string;
  title:          string;
  enrollments:    number;
  completed:      number;
  completionRate: number;
}

export interface PopularCourseRow {
  id:          string;
  title:       string;
  enrollments: number;
}

export interface CategoryPerformanceRow {
  name:        string;
  avgProgress: number;
  enrollments: number;
}

export interface CourseAnalytics {
  enrollmentTrend: TrendSeries;
  completionRates: CourseCompletionRow[];
  mostPopular:     PopularCourseRow[];
  dropOffPoints:   Metric;
  bestCategories:  CategoryPerformanceRow[];
  watchTime:       Metric;
}

// ── 5. Assessment Reports ────────────────────────────────────────────────

export interface QuizAttemptRow {
  id:          string;
  userId:      string | null;
  userName:    string | null;
  quizId:      string | null;
  quizTitle:   string | null;
  score:       number | null;
  status:      string;
  attemptNo:   number;
  submittedAt: string | null;
}

export interface AssessmentReports {
  totalAttempts:    Metric;
  avgScore:         Metric;
  passRate:         Metric;
  failRate:         Metric;
  recentAttempts:   QuizAttemptRow[];
  hardestQuestions: Metric;
  pagination:       Pagination;
}

// ── 6. Certificate Reports ────────────────────────────────────────────────

export interface CertificateRow {
  id:               string;
  courseId:         string | null;
  courseTitle:      string | null;
  userId:           string | null;
  userName:         string | null;
  issuedAt:         string;
  revoked:          boolean;
  expiresAt:        string | null;
  expired:          boolean;
  verificationCode: string | null;
}

export interface CertificateReports {
  totalIssued:          Metric;
  expired:              Metric;
  expiringSoon:         Metric;
  revoked:              Metric;
  verificationRequests: Metric;
  issuedTrend:          TrendSeries;
  recentCertificates:   CertificateRow[];
  pagination:           Pagination;
}

// ── 7. Attendance Reports ────────────────────────────────────────────────

export interface SessionAttendanceRow {
  id:               string;
  sessionId:        string | null;
  sessionTitle:     string | null;
  sessionStartTime: string | null;
  userId:           string | null;
  userName:         string | null;
  status:           'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';
  joinedAt:         string | null;
  leftAt:           string | null;
}

export interface AttendanceReports {
  overallRate:       Metric;
  present:           Metric;
  late:              Metric;
  absent:            Metric;
  excused:           Metric;
  sessionAttendance: SessionAttendanceRow[];
  trend:             TrendSeries;
  pagination:        Pagination;
}

// ── 8. Audit Reports ──────────────────────────────────────────────────────

export interface AuditLogRow {
  id:         string;
  action:     string;
  userId:     string | null;
  userName:   string | null;
  targetId:   string | null;
  targetType: string | null;
  metadata:   Record<string, unknown> | null;
  createdAt:  string;
}

export interface AuditReports {
  logs:       AuditLogRow[];
  pagination: Pagination;
}

// ── 9. Engagement Analytics ──────────────────────────────────────────────

export interface EngagementUser {
  id:             string;
  name:           string | null;
  role:           string;
  lastActivityAt: string | null;
}

export interface EngagementAnalytics {
  dailyActiveUsers:   TrendSeries;
  weeklyActiveUsers:  TrendSeries;
  avgSessionDuration: Metric;
  videoWatchTime:     Metric;
  retentionRate:      Metric;
  lowEngagementUsers: EngagementUser[];
}

// ── 10. Export Center ─────────────────────────────────────────────────────

export type ExportType = 'learners' | 'instructors' | 'courses' | 'certificates' | 'assessments' | 'attendance' | 'audit';
export type ExportFormat = 'csv' | 'json';

export interface ExportColumn {
  key:   string;
  label: string;
}

// ── 11. Compliance Reports ────────────────────────────────────────────────

export interface AtRiskComplianceUser {
  id:         string;
  name:       string | null;
  department: string | null;
  riskScore:  number | null;
}

export interface ComplianceReports {
  mandatoryTrainingCompletion: Metric;
  expiredCertifications:       Metric;
  complianceViolations:        Metric;
  departmentCompliance:        { available: boolean; reason?: string; items: unknown[] };
  atRiskUsers:                 AtRiskComplianceUser[];
}

// ── 12. Scheduled Reports ─────────────────────────────────────────────────
// Field names mirror scheduledReports.service.js / the Prisma model 1:1.

export type ScheduledReportFormat    = 'CSV' | 'JSON';
export type ScheduledReportFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type ScheduledReportStatus    = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

export interface ScheduledReportFilters {
  dateRange?: DateRangeKey;
  dateFrom?:  string;
  dateTo?:    string;
  department?: string;
}

export interface ScheduledReport {
  id:          string;
  name:        string;
  reportType:  ExportType;
  format:      ScheduledReportFormat;
  frequency:   ScheduledReportFrequency;
  filters:     ScheduledReportFilters | null;
  recipients:  string[];
  status:      ScheduledReportStatus;
  lastRunAt:   string | null;
  nextRunAt:   string;
  createdById: string | null;
  createdAt:   string;
  updatedAt:   string;
}

export interface ScheduledReportsList {
  reports:    ScheduledReport[];
  pagination: Pagination;
}

// ── Saved Reports (Custom Reports builder) ────────────────────────────────
// dataSource reuses the same 7 sources as ExportType above (uppercased for
// storage/response — matches GET /reports/export's `type` values 1:1, see
// savedReports.service.js's header comment).

export type SavedReportDataSource = 'LEARNERS' | 'INSTRUCTORS' | 'COURSES' | 'CERTIFICATES' | 'ASSESSMENTS' | 'ATTENDANCE' | 'AUDIT';
export const SAVED_REPORT_DATA_SOURCES: SavedReportDataSource[] = ['LEARNERS', 'INSTRUCTORS', 'COURSES', 'CERTIFICATES', 'ASSESSMENTS', 'ATTENDANCE', 'AUDIT'];

export type SavedReportVisualization = 'TABLE' | 'LINE_CHART' | 'BAR_CHART' | 'PIE_CHART' | 'KPI_CARDS';
export const SAVED_REPORT_VISUALIZATIONS: SavedReportVisualization[] = ['TABLE', 'LINE_CHART', 'BAR_CHART', 'PIE_CHART', 'KPI_CARDS'];

export interface SavedReportFilters {
  dateRange?: 'week' | 'month' | 'quarter' | 'custom';
  dateFrom?:  string;
  dateTo?:    string;
}

export interface SavedReport {
  id:              string;
  name:            string;
  description:     string | null;
  dataSource:      SavedReportDataSource;
  selectedColumns: string[];
  filters:         SavedReportFilters | null;
  visualization:   SavedReportVisualization;
  schedule:        string | null;
  lastRunAt:       string | null;
  createdById:     string | null;
  isPublic:        boolean;
  createdAt:       string;
  updatedAt:       string;
}

export interface SavedReportInput {
  name:             string;
  description?:     string | null;
  dataSource:       SavedReportDataSource;
  selectedColumns?: string[];
  filters?:         SavedReportFilters | null;
  visualization?:   SavedReportVisualization;
  schedule?:        string | null;
  isPublic?:        boolean;
}

export interface ReportColumn { key: string; label: string }

export interface SavedReportRunResult {
  columns:     ReportColumn[];
  rows:        Record<string, unknown>[];
  generatedAt: string;
}
