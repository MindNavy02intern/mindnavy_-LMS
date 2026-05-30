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
  welcome:               WelcomeInfo;
  kpis:                  DashboardKpis;
  recentActivities:      ActivityItem[];
  notificationsPreview:  NotificationItem[];
  securityAlertsPreview: SecurityAlert[];
  quickActions:          QuickActionItem[];
  systemHealth:          SystemHealth;
}
