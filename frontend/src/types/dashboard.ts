// Field names match GET /api/admin/dashboard/core integration contract.
// Do NOT rename these — they must stay in sync with the backend response.

export interface WelcomeInfo {
  adminName: string;
  role: string;
  organization: string;
  lastLoginAt: string | null;
}

export type ActivityType =
  | 'enrollment'
  | 'completion'
  | 'login'
  | 'payment'
  | 'approval'
  | 'revocation'
  | 'other';

export type NotificationSeverity = 'info' | 'warning' | 'error' | 'success';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SystemStatus = 'healthy' | 'degraded' | 'down';

export interface DashboardKpi {
  value: number | string;
  /** Percentage change vs last month — positive = up */
  trend: number;
  sparkline: number[];
}

export interface DashboardKpis {
  totalUsers: DashboardKpi;
  activeStudents: DashboardKpi;
  activeInstructors: DashboardKpi;
  publishedCourses: DashboardKpi;
  pendingApprovals: DashboardKpi;
  totalRevenue: DashboardKpi;
  certificatesIssued: DashboardKpi;
  liveSessions: DashboardKpi;
}

export interface ActivityItem {
  id: string;
  type: ActivityType;
  description: string;
  actor: string;
  actorAvatar?: string | null;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  timestamp: string;
  read: boolean;
}

export interface SecurityAlert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  timestamp: string;
  resolved: boolean;
}

export interface QuickActionItem {
  id: string;
  label: string;
  icon: string;
  href: string;
}

export interface SystemService {
  name: string;
  status: SystemStatus;
  latencyMs?: number;
  uptime?: string;
}

export interface SystemHealth {
  overall: SystemStatus;
  services: SystemService[];
  lastCheckedAt: string;
}

export interface DashboardCoreResponse {
  welcome: WelcomeInfo;
  kpis: DashboardKpis;
  recentActivities: ActivityItem[];
  notificationsPreview: NotificationItem[];
  securityAlertsPreview: SecurityAlert[];
  quickActions: QuickActionItem[];
  systemHealth: SystemHealth;
  generatedAt: string;
}
