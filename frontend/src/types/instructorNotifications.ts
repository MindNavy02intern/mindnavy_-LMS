// Instructor "Notifications" + "Notification Preferences" domain types —
// source of truth: backend/src/services/notifications.service.js
// mapLog/mapPrefs, self-scoped via instructorNotifications.controller.js.

export interface InstructorNotification {
  id:         string;
  userId:     string | null;
  channel:    string;
  status:     string;
  subject:    string | null;
  body:       string;
  priority:   string;
  sourceType: string | null;
  sourceId:   string | null;
  read:       boolean;
  sentAt:     string | null;
  openedAt:   string | null;
  clickedAt:  string | null;
  createdAt:  string;
}

export interface ListMyNotificationsResult {
  items: InstructorNotification[];
  total: number;
  page:  number;
  limit: number;
}

export interface NotificationPreferences {
  id:                    string | null;
  userId:                string;
  emailEnabled:          boolean;
  pushEnabled:           boolean;
  smsEnabled:            boolean;
  marketingEnabled:      boolean;
  learningAlertsEnabled: boolean;
  securityEnabled:       boolean;
  quietHoursStart:       string | null;
  quietHoursEnd:         string | null;
  updatedAt:             string | null;
}

export type NotificationPreferencesUpdate = Partial<Pick<NotificationPreferences,
  'emailEnabled' | 'pushEnabled' | 'smsEnabled' | 'marketingEnabled' | 'learningAlertsEnabled' | 'securityEnabled' | 'quietHoursStart' | 'quietHoursEnd'
>>;
