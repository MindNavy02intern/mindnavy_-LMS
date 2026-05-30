import { getStoredToken } from './adminAuth';
import type { DashboardCoreResponse } from '../types/dashboard';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

// TODO: remove mock when GET /api/admin/dashboard/core is implemented on the backend
const MOCK: DashboardCoreResponse = {
  welcome: {
    adminName: 'Super Admin',
    role: 'System Administrator',
    organization: 'MindNavy LMS',
    lastLoginAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
  kpis: {
    totalUsers:        { value: 12584,     trend: 12.5, sparkline: [9200, 9800, 10500, 11000, 11600, 12100, 12584] },
    activeStudents:    { value: 8756,      trend: 8.2,  sparkline: [6200, 6900, 7400, 7900, 8300, 8600, 8756] },
    activeInstructors: { value: 34,        trend: 6,    sparkline: [28, 29, 30, 31, 32, 33, 34] },
    publishedCourses:  { value: 482,       trend: 4.7,  sparkline: [380, 400, 420, 440, 455, 470, 482] },
    pendingApprovals:  { value: 8,         trend: -3,   sparkline: [12, 10, 9, 11, 8, 9, 8] },
    totalRevenue:      { value: '$48,678', trend: 18.6, sparkline: [28000, 32000, 36000, 40000, 43000, 46000, 48678] },
    certificatesIssued:{ value: 3256,      trend: 15.3, sparkline: [1800, 2100, 2400, 2700, 2950, 3100, 3256] },
    liveSessions:      { value: 3,         trend: 0,    sparkline: [1, 2, 3, 2, 4, 3, 3] },
  },
  recentActivities: [
    { id: '1', type: 'completion', description: 'completed Leadership Fundamentals',  actor: 'John Doe',     timestamp: new Date(Date.now() - 120_000).toISOString() },
    { id: '2', type: 'enrollment', description: 'enrolled in Data Science Course',    actor: 'Sarah Wilson', timestamp: new Date(Date.now() - 900_000).toISOString() },
    { id: '3', type: 'approval',   description: 'earned Python Programming Cert.',    actor: 'Mike Johnson', timestamp: new Date(Date.now() - 3_600_000).toISOString() },
    { id: '4', type: 'approval',   description: 'uploaded New Training Material',     actor: 'Emily Davis',  timestamp: new Date(Date.now() - 7_200_000).toISOString() },
    { id: '5', type: 'completion', description: 'completed Cyber Security Basics',    actor: 'David Brown',  timestamp: new Date(Date.now() - 10_800_000).toISOString() },
  ],
  notificationsPreview: [
    { id: '1', title: 'System Update',          message: 'New features have been added',           severity: 'info',    timestamp: new Date(Date.now() - 600_000).toISOString(),    read: false },
    { id: '2', title: 'Maintenance Alert',       message: 'System maintenance on Saturday',         severity: 'warning', timestamp: new Date(Date.now() - 3_600_000).toISOString(),  read: false },
    { id: '3', title: 'New User Registration',   message: '25 new users registered today',          severity: 'success', timestamp: new Date(Date.now() - 7_200_000).toISOString(),  read: false },
    { id: '4', title: 'Course Approval',         message: '3 courses pending approval',             severity: 'warning', timestamp: new Date(Date.now() - 10_800_000).toISOString(), read: true },
  ],
  securityAlertsPreview: [
    { id: '1', title: 'Multiple Failed Logins', description: '5 failed attempts in the last hour', severity: 'high',   timestamp: new Date(Date.now() - 1_800_000).toISOString(), resolved: false },
    { id: '2', title: 'New Device Login',       description: 'Login from unrecognized device',     severity: 'medium', timestamp: new Date(Date.now() - 7_200_000).toISOString(), resolved: false },
  ],
  quickActions: [
    { id: '1', label: 'Add User',          icon: 'user-plus',    href: '/users/new' },
    { id: '2', label: 'Create Course',     icon: 'book-plus',    href: '/courses/new' },
    { id: '3', label: 'Assign Course',     icon: 'book-assign',  href: '/assignments/new' },
    { id: '4', label: 'Generate Report',   icon: 'chart-bar',    href: '/reports/new' },
    { id: '5', label: 'Send Notification', icon: 'bell',         href: '/notifications/new' },
    { id: '6', label: 'Manage Roles',      icon: 'shield',       href: '/roles' },
    { id: '7', label: 'Import Users',      icon: 'upload',       href: '/users/import' },
    { id: '8', label: 'System Settings',   icon: 'settings',     href: '/settings' },
  ],
  systemHealth: {
    overall: 'healthy',
    services: [
      { name: 'API Server',    status: 'healthy', latencyMs: 45,  uptime: '99.98%' },
      { name: 'Database',      status: 'healthy', latencyMs: 12,  uptime: '99.99%' },
      { name: 'File Storage',  status: 'healthy', latencyMs: 89,  uptime: '99.95%' },
      { name: 'Email Service', status: 'healthy', latencyMs: 210, uptime: '99.90%' },
    ],
    lastCheckedAt: new Date().toISOString(),
  },
  generatedAt: new Date().toISOString(),
};

export async function getDashboardCore(): Promise<DashboardCoreResponse> {
  const token = getStoredToken();
  try {
    const res = await fetch(`${BASE_URL}/dashboard/core`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });
    if (res.ok) return res.json() as Promise<DashboardCoreResponse>;
  } catch {
    // network error or endpoint not yet implemented — fall through to mock
  }
  // TODO: remove mock fallback when GET /api/admin/dashboard/core is implemented
  return MOCK;
}
