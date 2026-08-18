// Field names match GET /api/admin/dashboard/core (TASK 5A.3 contract).
// Do NOT rename these — they must stay in sync with the backend response.

export interface WelcomeInfo {
  adminName:        string;
  adminRole:        string;
  organizationName: string;
  currentDateTime:  string;
  lastLoginAt:      string | null;
  systemStatus:     'operational' | 'degraded' | 'maintenance' | 'down';
}

export interface DashboardKpis {
  totalUsers:          number;
  activeStudents:      number;
  activeInstructors:   number;
  publishedCourses:    number;
  pendingApprovals:    number;
  totalRevenue:        number;
  activeSubscriptions: number;
  certificatesIssued:  number;
  liveSessionsRunning: number;
}

export type ActivityType =
  | 'course'
  | 'user'
  | 'certificate'
  | 'assignment'
  | 'live_session'
  | 'system';

export interface ActivityItem {
  id:        string;
  title:     string;
  actorName: string;
  type:      ActivityType;
  createdAt: string;
}

export type NotificationType = 'security' | 'approval' | 'system' | 'payment' | 'course';

export interface NotificationItem {
  id:        string;
  title:     string;
  message:   string;
  type:      NotificationType;
  isRead:    boolean;
  createdAt: string;
}

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus   = 'open' | 'investigating' | 'resolved';

export interface SecurityAlert {
  id:        string;
  title:     string;
  severity:  AlertSeverity;
  status:    AlertStatus;
  createdAt: string;
}

export type QuickActionKey =
  | 'add_user'
  | 'create_course'
  | 'approve_instructor'
  | 'generate_report'
  | 'create_live_session'
  | 'system_settings';

export interface QuickActionItem {
  key:     QuickActionKey;
  label:   string;
  enabled: boolean;
  path:    string | null;
}

export type SystemStatus = 'operational' | 'degraded' | 'maintenance' | 'down';

export interface SystemHealth {
  status:  SystemStatus;
  message: string;
  version: string;
}

export interface DashboardCoreResponse {
  welcome:                  WelcomeInfo;
  kpis:                     DashboardKpis;
  recentActivities:         ActivityItem[];
  notificationsPreview:     NotificationItem[];
  // Real unread count — NotificationLog{channel:IN_APP, status NOT IN
  // [OPENED,CLICKED]} — same source the sidebar bell badge reads.
  unreadNotificationsCount: number;
  securityAlertsPreview:    SecurityAlert[];
  quickActions:             QuickActionItem[];
  systemHealth:             SystemHealth;
}

// ── TASK 5B.1 Analytics types ─────────────────────────────────────────────────
// Field names match GET /api/admin/dashboard/analytics contract exactly.
// Do NOT rename these — they must stay in sync with the backend response.

export interface AnalyticsFilters {
  dateFrom:     string | null;
  dateTo:       string | null;
  departmentId: string | null;
}

export interface LearningActivityItem {
  date:      string;
  enrolled:  number;
  completed: number;
}

export type UserRole = 'learners' | 'instructors' | 'admins' | 'managers' | 'adminAssistants' | 'others';

export interface UsersByRoleItem {
  role:       UserRole;
  count:      number;
  percentage: number;
}

export interface RevenueOverview {
  dailyRevenue:        number;
  monthlyRevenue:      number;
  annualRevenue:       number;
  subscriptionRevenue: number;
  refundTotal:         number;
  instructorPayouts:   number;
  growthPercentage:    number;
}

export interface UserAnalytics {
  newRegistrations: number;
  activeUsers:      number;
  // null = fewer than 30-day-old-cohort users exist to measure yet — not a
  // real 0% retention. See dashboard.service.js for the exact definition.
  retentionRate:    number | null;
  verifiedUsers:    number;
  suspendedUsers:   number;
}

export interface CourseAnalytics {
  totalCourses:            number;
  activeCourses:           number;
  pendingApprovalCourses:  number;
  // null = no enrollments exist yet to measure completion from.
  averageCompletionRate:   number | null;
  mostPopularCourse:       string | null;
  // null = no quiz-attempt/submission system exists yet (not a stub that
  // will fill in soon from THIS table — a different, unbuilt system entirely).
  averageQuizScore:        number | null;
}

export interface CourseCompletionCategory {
  name:           string;
  completionRate: number;
}

export interface CourseCompletion {
  // null = no enrollments exist yet to measure completion from.
  averageCompletion: number | null;
  categories:        CourseCompletionCategory[];
}

export interface InstructorPerformance {
  averageRating:          number;
  averageCompletionRate:  number;
  averageAttendanceRate:  number;
  averageReviewScore:     number;
}

export interface StudentEngagement {
  dailyActiveStudents:        number;
  quizParticipationRate:      number;
  assignmentCompletionRate:   number;
  averageLearningTimeMinutes: number;
}

export interface PerformanceOverview {
  averageScore: number;
  passRate:     number;
  engagement:   number;
  satisfaction: number;
}

export interface TopDepartmentItem {
  id:         string;
  name:       string;
  usersCount: number;
}

// New fields sourced from GET /api/admin/users/analytics via the dashboard service
export interface DashboardDeptItem {
  department: string;
  count:      number;
}

export interface DashboardDailyTrend {
  date:  string;
  count: number;
}

export interface DashboardActivityData {
  activeToday:    number;
  activeThisWeek: number;
  dailyTrend:     DashboardDailyTrend[];
}

export interface DashboardVerifItem {
  status:     string;
  count:      number;
  percentage: number;
}

export interface DashboardAnalyticsResponse {
  filters:               AnalyticsFilters;
  learningActivity:      LearningActivityItem[];
  usersByRole:           UsersByRoleItem[];
  usersByDepartment:     DashboardDeptItem[];
  userActivity:          DashboardActivityData;
  verificationStatus:    DashboardVerifItem[];
  revenueOverview:       RevenueOverview;
  userAnalytics:         UserAnalytics;
  courseAnalytics:       CourseAnalytics;
  courseCompletion:      CourseCompletion;
  instructorPerformance: InstructorPerformance;
  studentEngagement:     StudentEngagement;
  performanceOverview:   PerformanceOverview;
  topDepartments:        TopDepartmentItem[];
}

// ── TASK 5C Admin Widgets types ───────────────────────────────────────────────
// Field names match GET /api/admin/dashboard/admin-widgets contract exactly.

export interface AdminWidgetsFilters {
  dateFrom:     string | null;
  dateTo:       string | null;
  departmentId: string | null;
  courseId:     string | null;
}

export type ApprovalType     = 'course' | 'instructor' | 'user_verification' | 'refund' | 'certification' | 'content';
export type ApprovalPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface PendingApprovalItem {
  id:          string;
  type:        ApprovalType;
  title:       string;
  submittedBy: string;
  submittedAt: string;
  priority:    ApprovalPriority;
}

export interface PendingApprovals {
  total: number;
  items: PendingApprovalItem[];
}

export type LiveSessionStatus = 'active' | 'upcoming' | 'completed' | 'cancelled';

export interface LiveSessionItem {
  id:              string;
  title:           string;
  instructorName:  string;
  status:          LiveSessionStatus;
  startsAt:        string;
  // null = not tracked (no attendance system exists yet) — must render as
  // "not tracked", never as a fake 0.
  attendanceCount: number | null;
}

export interface LiveSessions {
  activeCount:          number;
  upcomingCount:        number;
  // null = not tracked (no monitoring system exists yet).
  technicalIssuesCount: number | null;
  items:                LiveSessionItem[];
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskType = 'user_verification' | 'refund' | 'instructor_application' | 'course_approval';

// Each row is a live pending-item count (from its owning module's queue),
// not an admin-completable to-do — there is no per-item "done" state to
// track, so unlike a real task list there is no `status`/`dueAt`.
export interface TaskItem {
  id:       string;
  type:     TaskType;
  title:    string;
  count:    number;
  priority: TaskPriority;
  link:     string | null;
}

export type TransactionType   = 'payment' | 'refund' | 'subscription' | 'payout' | 'failed_payment';
export type TransactionStatus = 'success' | 'pending' | 'failed' | 'refunded';

export interface TransactionItem {
  id:        string;
  type:      TransactionType;
  amount:    number;
  currency:  string;
  status:    TransactionStatus;
  createdAt: string;
}

export type CalendarEventType = 'live_session' | 'deadline' | 'meeting' | 'maintenance' | 'course_launch';

export interface CalendarEventItem {
  id:       string;
  title:    string;
  type:     CalendarEventType;
  startsAt: string;
  endsAt:   string | null;
}

export type ReportKey = 'overview' | 'learners' | 'courses' | 'certificates' | 'audit';

export interface ReportItem {
  key:   ReportKey;
  label: string;
  path:  string | null;
}

export interface ReportsSnapshot {
  availableReports: ReportItem[];
  lastGeneratedAt:  string | null;
}

export type InsightSeverity = 'info' | 'warning' | 'critical';

export interface AiInsightItem {
  id:        string;
  title:     string;
  message:   string;
  severity:  InsightSeverity;
  createdAt: string;
}

export interface AdminWidgetsResponse {
  filters:            AdminWidgetsFilters;
  pendingApprovals:   PendingApprovals;
  liveSessions:       LiveSessions;
  tasksAndReminders:  TaskItem[];
  recentTransactions: TransactionItem[];
  calendarEvents:     CalendarEventItem[];
  reportsSnapshot:    ReportsSnapshot;
  aiInsights:         AiInsightItem[];
}
