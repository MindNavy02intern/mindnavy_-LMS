import { getStoredToken } from './adminAuth';
import type { DashboardCoreResponse } from '../types/dashboard';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

// Fallback mock — matches TASK 5A.3 contract exactly.
// TODO: remove when backend returns populated data (non-zero KPIs, real activities, etc.)
const MOCK: DashboardCoreResponse = {
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
    { id: '1', title: 'Multiple Failed Logins', severity: 'high',   status: 'open',        createdAt: new Date(Date.now() - 1_800_000).toISOString() },
    { id: '2', title: 'New Device Login',       severity: 'medium', status: 'investigating', createdAt: new Date(Date.now() - 7_200_000).toISOString() },
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

export async function getDashboardCore(): Promise<DashboardCoreResponse> {
  const token = getStoredToken();
  try {
    const res = await fetch(`${BASE_URL}/dashboard/core`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });
    if (res.ok) return res.json() as Promise<DashboardCoreResponse>;
  } catch {
    // network error — fall through to mock
  }
  return MOCK;
}
