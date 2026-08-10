// Notifications — types per NOTIFICATIONS_CONTRACT.md. Field names mirror the
// backend response shapes 1:1 (notifications.service.js / .controller.js),
// same convention as types/competencies.ts.

export class NotificationsApiError extends Error {
  status: number;
  data?: Record<string, unknown>;
  constructor(status: number, message: string, data?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'NotificationsApiError';
  }
}

export type Metric = {
  value: number | null;
  changePercent: number | null;
  available: boolean;
  reason?: string;
};

export type NotificationChannelType = 'EMAIL' | 'PUSH' | 'SMS' | 'IN_APP';
export type NotificationCategory = 'SYSTEM' | 'MARKETING' | 'LEARNING' | 'SECURITY' | 'PAYMENT';
export type NotificationTemplateStatus = 'ACTIVE' | 'INACTIVE';
export type AnnouncementType = 'PLATFORM' | 'MAINTENANCE' | 'PROMOTION' | 'COMPANY' | 'EMERGENCY';
export type AnnouncementAudience = 'ALL' | 'LEARNERS' | 'INSTRUCTORS' | 'DEPARTMENTS' | 'GROUPS' | 'CUSTOM';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type AnnouncementStatus = 'DRAFT' | 'SCHEDULED' | 'SENT' | 'CANCELLED';
export type AutomationTrigger =
  | 'USER_REGISTRATION' | 'COURSE_ENROLLMENT' | 'COURSE_COMPLETION' | 'QUIZ_FAILURE'
  | 'ASSIGNMENT_DEADLINE' | 'PAYMENT_SUCCESS' | 'SUBSCRIPTION_EXPIRY'
  | 'LIVE_SESSION_START' | 'SECURITY_EVENT';
export type NotificationAutomationStatus = 'ACTIVE' | 'PAUSED';
export type NotificationLogStatus = 'SENT' | 'FAILED' | 'PENDING' | 'BOUNCED' | 'OPENED' | 'CLICKED';
export type NotificationSourceType = 'ANNOUNCEMENT' | 'AUTOMATION' | 'MANUAL' | 'EMERGENCY' | 'SYSTEM';

export const CHANNEL_TYPES: NotificationChannelType[] = ['EMAIL', 'PUSH', 'SMS', 'IN_APP'];
export const CATEGORIES: NotificationCategory[] = ['SYSTEM', 'MARKETING', 'LEARNING', 'SECURITY', 'PAYMENT'];
export const ANNOUNCEMENT_TYPES: AnnouncementType[] = ['PLATFORM', 'MAINTENANCE', 'PROMOTION', 'COMPANY', 'EMERGENCY'];
export const ANNOUNCEMENT_AUDIENCES: AnnouncementAudience[] = ['ALL', 'LEARNERS', 'INSTRUCTORS', 'DEPARTMENTS', 'GROUPS', 'CUSTOM'];
export const PRIORITIES: NotificationPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
export const AUTOMATION_TRIGGERS: AutomationTrigger[] = [
  'USER_REGISTRATION', 'COURSE_ENROLLMENT', 'COURSE_COMPLETION', 'QUIZ_FAILURE',
  'ASSIGNMENT_DEADLINE', 'PAYMENT_SUCCESS', 'SUBSCRIPTION_EXPIRY',
  'LIVE_SESSION_START', 'SECURITY_EVENT',
];

export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ── Stats (Dashboard tab, 8 cards) ────────────────────────────────────────────

export interface NotificationsStats {
  sentTotal: Metric;
  failedDeliveries: Metric;
  pendingNotifications: Metric;
  openRate: Metric;
  clickRate: Metric;
  scheduledCampaigns: Metric;
  activeAutomations: Metric;
  deliverySuccessRate: Metric;
}

export interface NotificationsAnalytics {
  deliveryTrend: { labels: string[]; sent: number[]; failed: number[] };
  channelBreakdown: { available: boolean; items: { channel: NotificationChannelType; count: number }[] };
  topCampaigns: { available: boolean; reason?: string; items: { id: string; title: string; sentCount: number; sentAt: string | null }[] };
  automationPerformance: { available: boolean; reason?: string; items: { id: string; name: string; sentCount: number; status: NotificationAutomationStatus }[] };
}

// ── Templates ──────────────────────────────────────────────────────────────────

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationChannelType;
  subject: string | null;
  body: string;
  variables: string[];
  category: NotificationCategory;
  status: NotificationTemplateStatus;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateRequest {
  name: string;
  type: NotificationChannelType;
  subject?: string | null;
  body: string;
  variables?: string[];
  category?: NotificationCategory;
  status?: NotificationTemplateStatus;
}
export type UpdateTemplateRequest = Partial<CreateTemplateRequest>;

export interface TemplatePreviewResponse {
  subject: string | null;
  body: string;
  variablesUsed: string[];
}

// ── Announcements ────────────────────────────────────────────────────────────

export interface Announcement {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  audience: AnnouncementAudience;
  targetIds: string[];
  priority: NotificationPriority;
  status: AnnouncementStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  sentCount: number;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAnnouncementRequest {
  title: string;
  body: string;
  type: AnnouncementType;
  audience: AnnouncementAudience;
  targetIds?: string[];
  priority?: NotificationPriority;
  scheduledAt?: string | null;
}
export type UpdateAnnouncementRequest = Partial<CreateAnnouncementRequest>;

// ── Automations ──────────────────────────────────────────────────────────────

export interface NotificationAutomation {
  id: string;
  name: string;
  description: string | null;
  trigger: AutomationTrigger;
  templateId: string;
  templateName: string | null;
  channels: NotificationChannelType[];
  status: NotificationAutomationStatus;
  sentCount: number;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutomationRequest {
  name: string;
  description?: string | null;
  trigger: AutomationTrigger;
  templateId: string;
  channels: NotificationChannelType[];
  status?: NotificationAutomationStatus;
}
export type UpdateAutomationRequest = Partial<CreateAutomationRequest>;

// ── In-app / delivery logs (NotificationLog, all channels) ──────────────────

export interface NotificationLogEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  channel: NotificationChannelType;
  status: NotificationLogStatus;
  subject: string | null;
  body: string;
  priority: NotificationPriority;
  sourceType: NotificationSourceType;
  sourceId: string | null;
  metadata: Record<string, unknown> | null;
  read: boolean;
  sentAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  createdAt: string;
}

export interface SendNotificationRequest {
  userIds: string[];
  title: string;
  body: string;
  type?: string;
  priority?: NotificationPriority;
}

// ── Preferences ───────────────────────────────────────────────────────────────

export interface UserNotificationPreferences {
  id: string | null;
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  marketingEnabled: boolean;
  learningAlertsEnabled: boolean;
  securityEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  updatedAt: string | null;
}

export type UpdatePreferencesRequest = Partial<Omit<UserNotificationPreferences, 'id' | 'userId' | 'updatedAt'>>;

// ── Emergency ─────────────────────────────────────────────────────────────────

export interface SendEmergencyRequest {
  title: string;
  message: string;
  channels: NotificationChannelType[];
}
