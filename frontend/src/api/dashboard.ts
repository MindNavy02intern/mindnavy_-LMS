import { getStoredToken } from './adminAuth';
import type {
  AdminWidgetsResponse,
  DashboardAnalyticsResponse,
  DashboardCoreResponse,
} from '../types/dashboard';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

// TODO: Remove demo dashboard core data after backend real dashboard data is connected.
const CORE_MOCK: DashboardCoreResponse = {
  welcome: {
    adminName:        'MindNavy Admin',
    adminRole:        'super_admin',
    organizationName: 'MindNavy LMS',
    currentDateTime:  new Date().toISOString(),
    lastLoginAt:      new Date(Date.now() - 86_400_000).toISOString(),
    systemStatus:     'operational',
  },
  kpis: {
    totalUsers:          12584,
    activeStudents:      8756,
    activeInstructors:   34,
    publishedCourses:    482,
    pendingApprovals:    8,
    totalRevenue:        48678,
    activeSubscriptions: 1240,
    certificatesIssued:  3256,
    liveSessionsRunning: 3,
  },
  recentActivities: [
    { id: '1', type: 'course',       title: 'completed Leadership Fundamentals', actorName: 'John Doe',     createdAt: new Date(Date.now() - 120_000).toISOString() },
    { id: '2', type: 'user',         title: 'enrolled in Data Science Course',   actorName: 'Sarah Wilson', createdAt: new Date(Date.now() - 900_000).toISOString() },
    { id: '3', type: 'certificate',  title: 'earned Python Programming Cert.',   actorName: 'Mike Johnson', createdAt: new Date(Date.now() - 3_600_000).toISOString() },
    { id: '4', type: 'assignment',   title: 'uploaded New Training Material',    actorName: 'Emily Davis',  createdAt: new Date(Date.now() - 7_200_000).toISOString() },
    { id: '5', type: 'course',       title: 'completed Cyber Security Basics',   actorName: 'David Brown',  createdAt: new Date(Date.now() - 10_800_000).toISOString() },
  ],
  notificationsPreview: [
    { id: '1', title: 'System Update',        message: 'New features have been added',         type: 'system',   isRead: false, createdAt: new Date(Date.now() - 600_000).toISOString()    },
    { id: '2', title: 'Maintenance Alert',     message: 'System maintenance on Saturday',       type: 'system',   isRead: false, createdAt: new Date(Date.now() - 3_600_000).toISOString()  },
    { id: '3', title: 'New User Registration', message: '25 new users registered today',        type: 'approval', isRead: false, createdAt: new Date(Date.now() - 7_200_000).toISOString()  },
    { id: '4', title: 'Course Approval',       message: '3 courses pending approval',           type: 'course',   isRead: true,  createdAt: new Date(Date.now() - 10_800_000).toISOString() },
  ],
  securityAlertsPreview: [
    { id: '1', title: 'Multiple Failed Logins',       severity: 'high',     status: 'open',          createdAt: new Date(Date.now() - 1_800_000).toISOString()  },
    { id: '2', title: 'New Device Login',             severity: 'medium',   status: 'investigating',  createdAt: new Date(Date.now() - 7_200_000).toISOString()  },
    { id: '3', title: 'Unauthorized Access Attempt',  severity: 'critical', status: 'investigating',  createdAt: new Date(Date.now() - 14_400_000).toISOString() },
  ],
  quickActions: [
    { key: 'add_user',            label: 'Add User',            enabled: true, path: null },
    { key: 'create_course',       label: 'Create Course',       enabled: true, path: null },
    { key: 'approve_instructor',  label: 'Approve Instructor',  enabled: true, path: null },
    { key: 'generate_report',     label: 'Generate Report',     enabled: true, path: null },
    { key: 'create_live_session', label: 'Create Live Session', enabled: true, path: null },
    { key: 'system_settings',     label: 'System Settings',     enabled: true, path: null },
  ],
  systemHealth: {
    status:  'operational',
    message: 'All systems are running normally.',
    version: '1.0.0',
  },
};

export async function getDashboardCore(): Promise<{ data: DashboardCoreResponse; isDemo: boolean }> {
  const token = getStoredToken();
  try {
    const res = await fetch(`${BASE_URL}/dashboard/core`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });
    if (res.ok) {
      const apiData = await res.json() as DashboardCoreResponse;
      const hasRealData =
        apiData.recentActivities.length > 0 ||
        apiData.notificationsPreview.length > 0;
      if (hasRealData) return { data: apiData, isDemo: false };
      // Backend returned empty sections — inject demo content, keep real welcome/kpis
      // TODO: Remove demo dashboard core data after backend real dashboard data is connected.
      return {
        data: {
          ...apiData,
          recentActivities:      CORE_MOCK.recentActivities,
          notificationsPreview:  CORE_MOCK.notificationsPreview,
          securityAlertsPreview: CORE_MOCK.securityAlertsPreview,
        },
        isDemo: true,
      };
    }
  } catch {
    // network error — fall through to demo data
  }
  // TODO: Remove demo dashboard core data after backend real dashboard data is connected.
  return { data: CORE_MOCK, isDemo: true };
}

// ── Analytics API (TASK 5B.1) ─────────────────────────────────────────────────

export interface AnalyticsParams {
  dateFrom:     string | null;
  dateTo:       string | null;
  departmentId: string | null;
}

// TODO: Remove demo analytics data after backend real analytics is connected.
const ANALYTICS_MOCK: DashboardAnalyticsResponse = {
  filters: { dateFrom: null, dateTo: null, departmentId: null },
  learningActivity: [
    { date: '2026-05-13', enrolled: 1200, completed: 500  },
    { date: '2026-05-20', enrolled: 1800, completed: 900  },
    { date: '2026-05-27', enrolled: 2200, completed: 1200 },
    { date: '2026-06-03', enrolled: 2800, completed: 1500 },
    { date: '2026-06-10', enrolled: 2600, completed: 1650 },
  ],
  usersByRole: [
    { role: 'learners',    count: 7842, percentage: 62.3 },
    { role: 'instructors', count: 1253, percentage: 9.9  },
    { role: 'admins',      count: 562,  percentage: 4.5  },
    { role: 'managers',    count: 1687, percentage: 13.4 },
    { role: 'others',      count: 1240, percentage: 9.9  },
  ],
  revenueOverview: {
    dailyRevenue:        2340,
    monthlyRevenue:      48678,
    annualRevenue:       584136,
    subscriptionRevenue: 38400,
    refundTotal:         1200,
    instructorPayouts:   8900,
    growthPercentage:    12.5,
  },
  userAnalytics: {
    newRegistrations: 347,
    activeUsers:      8756,
    retentionRate:    84.2,
    verifiedUsers:    11820,
    suspendedUsers:   24,
  },
  courseAnalytics: {
    totalCourses:           482,
    activeCourses:          394,
    pendingApprovalCourses: 8,
    averageCompletionRate:  68.4,
    mostPopularCourse:      'Leadership Fundamentals',
    averageQuizScore:       76.8,
  },
  courseCompletion: {
    averageCompletion: 68,
    categories: [
      { name: 'Leadership',      completionRate: 85 },
      { name: 'Data Science',    completionRate: 72 },
      { name: 'Cyber Security',  completionRate: 65 },
      { name: 'Marketing',       completionRate: 58 },
      { name: 'Design Thinking', completionRate: 45 },
    ],
  },
  instructorPerformance: {
    averageRating:         4.6,
    averageCompletionRate: 82.3,
    averageAttendanceRate: 91.2,
    averageReviewScore:    4.4,
  },
  studentEngagement: {
    dailyActiveStudents:        3240,
    quizParticipationRate:      73.5,
    assignmentCompletionRate:   81.2,
    averageLearningTimeMinutes: 48,
  },
  performanceOverview: {
    averageScore: 76.8,
    passRate:     82.3,
    engagement:   68.5,
    satisfaction: 4.6,
  },
  topDepartments: [
    { id: '1', name: 'IT Department',        usersCount: 2856 },
    { id: '2', name: 'Sales Department',     usersCount: 2124 },
    { id: '3', name: 'HR Department',        usersCount: 1856 },
    { id: '4', name: 'Marketing Department', usersCount: 1254 },
    { id: '5', name: 'Finance Department',   usersCount: 1023 },
  ],
};

export async function getDashboardAnalytics(
  params: AnalyticsParams = { dateFrom: null, dateTo: null, departmentId: null },
): Promise<{ data: DashboardAnalyticsResponse; isDemo: boolean }> {
  const token = getStoredToken();
  const qs = new URLSearchParams();
  if (params.dateFrom)     qs.set('dateFrom',     params.dateFrom);
  if (params.dateTo)       qs.set('dateTo',       params.dateTo);
  if (params.departmentId) qs.set('departmentId', params.departmentId);
  const query = qs.toString();
  try {
    const res = await fetch(
      `${BASE_URL}/dashboard/analytics${query ? `?${query}` : ''}`,
      { headers: { Authorization: token ? `Bearer ${token}` : '' } },
    );
    if (res.ok) {
      // Frontend consumes flat response directly — no success/data wrapper expected
      const apiData = await res.json() as DashboardAnalyticsResponse;
      // Use real data only when the backend has populated values; zeros mean it's not ready yet
      const hasRealData =
        apiData.learningActivity.length > 0 ||
        apiData.userAnalytics.activeUsers > 0;
      if (hasRealData) return { data: apiData, isDemo: false };
      // Backend returned zeros/empty arrays — fall through to demo data for design preview
    }
  } catch {
    // network error — fall through to demo data
  }
  // TODO: Remove demo analytics data after backend real analytics is connected.
  return {
    data: {
      ...ANALYTICS_MOCK,
      filters: {
        dateFrom:     params.dateFrom,
        dateTo:       params.dateTo,
        departmentId: params.departmentId,
      },
    },
    isDemo: true,
  };
}

// ── Admin Widgets API (TASK 5C) ───────────────────────────────────────────────

export interface AdminWidgetsParams {
  dateFrom:     string | null;
  dateTo:       string | null;
  departmentId: string | null;
  courseId:     string | null;
}

// TODO: Remove demo admin widgets data after backend real admin widgets data is connected.
const ADMIN_WIDGETS_MOCK: AdminWidgetsResponse = {
  filters: { dateFrom: null, dateTo: null, departmentId: null, courseId: null },
  pendingApprovals: {
    total: 12,
    items: [
      { id: '1', type: 'instructor',        title: 'Instructor Application – Ahmad Al-Hassan',  submittedBy: 'Ahmad Al-Hassan', submittedAt: new Date(Date.now() - 1_800_000).toISOString(),  priority: 'high'   },
      { id: '2', type: 'course',            title: 'New Course: Advanced Cloud Architecture',   submittedBy: 'Sara Mitchell',   submittedAt: new Date(Date.now() - 3_600_000).toISOString(),  priority: 'medium' },
      { id: '3', type: 'refund',            title: 'Refund Request – Premium Subscription',     submittedBy: 'James Carter',    submittedAt: new Date(Date.now() - 7_200_000).toISOString(),  priority: 'urgent' },
      { id: '4', type: 'user_verification', title: 'ID Verification – Maria Gonzalez',         submittedBy: 'Maria Gonzalez',  submittedAt: new Date(Date.now() - 10_800_000).toISOString(), priority: 'low'    },
    ],
  },
  liveSessions: {
    activeCount:          3,
    upcomingCount:        8,
    technicalIssuesCount: 1,
    items: [
      { id: '1', title: 'Leadership Masterclass – Live Q&A',   instructorName: 'Dr. Emma Wilson', status: 'active',   startsAt: new Date(Date.now() - 900_000).toISOString(),   attendanceCount: 124 },
      { id: '2', title: 'Python for Data Science – Session 4', instructorName: 'Prof. James Li',  status: 'active',   startsAt: new Date(Date.now() - 600_000).toISOString(),   attendanceCount: 87  },
      { id: '3', title: 'Cybersecurity Fundamentals',          instructorName: 'Mark Donovan',    status: 'upcoming', startsAt: new Date(Date.now() + 3_600_000).toISOString(),  attendanceCount: 0   },
      { id: '4', title: 'Marketing Strategy Workshop',         instructorName: 'Lisa Chen',       status: 'upcoming', startsAt: new Date(Date.now() + 7_200_000).toISOString(),  attendanceCount: 0   },
    ],
  },
  tasksAndReminders: [
    { id: '1', title: 'Review instructor applications (4 pending)', priority: 'high',   status: 'pending',   dueAt: new Date(Date.now() + 86_400_000).toISOString()  },
    { id: '2', title: 'Approve 3 courses for publication',          priority: 'medium', status: 'pending',   dueAt: new Date(Date.now() + 172_800_000).toISOString() },
    { id: '3', title: 'Monthly performance report due',             priority: 'high',   status: 'pending',   dueAt: new Date(Date.now() + 259_200_000).toISOString() },
    { id: '4', title: 'Update system backup schedule',              priority: 'low',    status: 'completed', dueAt: null },
    { id: '5', title: 'Review refund request – James Carter',       priority: 'urgent', status: 'pending',   dueAt: new Date(Date.now() + 43_200_000).toISOString()  },
  ],
  recentTransactions: [
    { id: '1', type: 'subscription',   amount: 299.00,  currency: 'USD', status: 'success',  createdAt: new Date(Date.now() - 600_000).toISOString()    },
    { id: '2', type: 'payment',        amount: 49.99,   currency: 'USD', status: 'success',  createdAt: new Date(Date.now() - 3_600_000).toISOString()  },
    { id: '3', type: 'refund',         amount: 49.99,   currency: 'USD', status: 'refunded', createdAt: new Date(Date.now() - 7_200_000).toISOString()  },
    { id: '4', type: 'payout',         amount: 1250.00, currency: 'USD', status: 'success',  createdAt: new Date(Date.now() - 14_400_000).toISOString() },
    { id: '5', type: 'payment',        amount: 129.00,  currency: 'USD', status: 'pending',  createdAt: new Date(Date.now() - 18_000_000).toISOString() },
    { id: '6', type: 'failed_payment', amount: 299.00,  currency: 'USD', status: 'failed',   createdAt: new Date(Date.now() - 21_600_000).toISOString() },
  ],
  calendarEvents: [
    { id: '1', title: 'Leadership Masterclass – Live Q&A',           type: 'live_session',  startsAt: new Date(Date.now() - 900_000).toISOString(),    endsAt: new Date(Date.now() + 2_700_000).toISOString()   },
    { id: '2', title: 'Course Registration Deadline – Cybersecurity', type: 'deadline',      startsAt: new Date(Date.now() + 86_400_000).toISOString(),  endsAt: null },
    { id: '3', title: 'Monthly Admin Team Meeting',                   type: 'meeting',       startsAt: new Date(Date.now() + 172_800_000).toISOString(), endsAt: new Date(Date.now() + 176_400_000).toISOString() },
    { id: '4', title: 'LMS Scheduled Maintenance',                    type: 'maintenance',   startsAt: new Date(Date.now() + 259_200_000).toISOString(), endsAt: new Date(Date.now() + 266_400_000).toISOString() },
    { id: '5', title: 'New Course Launch: AI for Beginners',          type: 'course_launch', startsAt: new Date(Date.now() + 345_600_000).toISOString(), endsAt: null },
  ],
  reportsSnapshot: {
    availableReports: [
      { key: 'revenue',    label: 'Revenue Report',    path: null },
      { key: 'users',      label: 'Users Report',      path: null },
      { key: 'courses',    label: 'Courses Report',    path: null },
      { key: 'engagement', label: 'Engagement Report', path: null },
      { key: 'audit',      label: 'Audit Log Report',  path: null },
    ],
    lastGeneratedAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
  aiInsights: [
    { id: '1', title: 'Course Completion Drop Detected', message: 'Completion rate for "Data Science Advanced" dropped 18% this week. Consider reviewing course content or scheduling an instructor check-in.', severity: 'warning',  createdAt: new Date(Date.now() - 3_600_000).toISOString()  },
    { id: '2', title: 'Revenue Growth Opportunity',      message: 'Subscription conversions from trial users increased 24%. Targeted outreach to 847 active trial users could yield ~$42K additional monthly revenue.', severity: 'info', createdAt: new Date(Date.now() - 7_200_000).toISOString()  },
    { id: '3', title: 'Suspicious Login Activity',       message: '47 failed login attempts from a single IP in the last 2 hours. Automated rate limiting is active. Manual review is recommended.',                severity: 'critical', createdAt: new Date(Date.now() - 1_800_000).toISOString()  },
    { id: '4', title: 'High Instructor Demand',          message: '12 courses are awaiting instructor assignment. Current instructor-to-course ratio is below target. Consider recruiting additional instructors.',    severity: 'warning',  createdAt: new Date(Date.now() - 10_800_000).toISOString() },
  ],
};

export async function getAdminWidgets(
  params: AdminWidgetsParams = { dateFrom: null, dateTo: null, departmentId: null, courseId: null },
): Promise<{ data: AdminWidgetsResponse; isDemo: boolean }> {
  const token = getStoredToken();
  const qs = new URLSearchParams();
  if (params.dateFrom)     qs.set('dateFrom',     params.dateFrom);
  if (params.dateTo)       qs.set('dateTo',       params.dateTo);
  if (params.departmentId) qs.set('departmentId', params.departmentId);
  if (params.courseId)     qs.set('courseId',     params.courseId);
  const query = qs.toString();
  try {
    const res = await fetch(
      `${BASE_URL}/dashboard/admin-widgets${query ? `?${query}` : ''}`,
      { headers: { Authorization: token ? `Bearer ${token}` : '' } },
    );
    // Frontend consumes flat response directly — no success/data wrapper expected
    if (res.ok) {
      const apiData = await res.json() as AdminWidgetsResponse;
      const hasRealData =
        apiData.pendingApprovals.items.length > 0 ||
        apiData.liveSessions.items.length > 0 ||
        apiData.tasksAndReminders.length > 0 ||
        apiData.aiInsights.length > 0;
      if (hasRealData) return { data: apiData, isDemo: false };
    }
  } catch {
    // network error — fall through to demo data
  }
  // TODO: Remove demo admin widgets data after backend real admin widgets data is connected.
  return {
    data: {
      ...ADMIN_WIDGETS_MOCK,
      filters: {
        dateFrom:     params.dateFrom,
        dateTo:       params.dateTo,
        departmentId: params.departmentId,
        courseId:     params.courseId,
      },
    },
    isDemo: true,
  };
}
