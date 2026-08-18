// System Settings — types per SYSTEM_SETTINGS_CONTRACT.md. Field names
// mirror settings.service.js / settings.prisma 1:1, same convention as
// types/finance.ts / types/competencies.ts.

export class SettingsApiError extends Error {
  status: number;
  data?: Record<string, unknown>;
  constructor(status: number, message: string, data?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'SettingsApiError';
  }
}

export type RegistrationMode = 'OPEN' | 'INVITE_ONLY' | 'APPROVAL_REQUIRED';
export type DefaultUserRole = 'LEARNER' | 'INSTRUCTOR';
export type CourseVisibility = 'PUBLIC' | 'PRIVATE' | 'ENROLLED_ONLY';

export const REGISTRATION_MODES: RegistrationMode[] = ['OPEN', 'INVITE_ONLY', 'APPROVAL_REQUIRED'];
export const COURSE_VISIBILITIES: CourseVisibility[] = ['PUBLIC', 'PRIVATE', 'ENROLLED_ONLY'];

export interface SystemSettings {
  id: string;

  // General
  platformName: string;
  platformDescription: string | null;
  timezone: string;
  defaultLanguage: string;
  dateFormat: string;
  currency: string;
  contactEmail: string | null;
  contactPhone: string | null;

  // Registration
  registrationMode: RegistrationMode;
  emailVerificationRequired: boolean;
  phoneVerificationRequired: boolean;
  captchaEnabled: boolean;
  allowedEmailDomains: string[];
  defaultUserRole: DefaultUserRole;

  // Learning
  defaultCourseVisibility: CourseVisibility;
  autoEnrollmentEnabled: boolean;
  certificatesEnabled: boolean;
  quizPassingScore: number;
  maxQuizAttempts: number;
  scormEnabled: boolean;
  progressTrackingEnabled: boolean;

  // Security
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSymbols: boolean;
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  mfaEnabled: boolean;
  ipRestrictionEnabled: boolean;
  allowedIPs: string[];

  // Media
  maxUploadSizeMb: number;
  allowedFileTypes: string[];
  videoProcessingEnabled: boolean;
  imageCompressionEnabled: boolean;

  // Branding
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;

  // Email / Notifications / Automation / Domain
  emailFromName: string | null;
  emailFromEmail: string | null;
  emailNotificationsEnabled: boolean;
  digestEmailsEnabled: boolean;
  autoCertificationEnabled: boolean;
  reminderNotificationsEnabled: boolean;
  metaTitle: string | null;
  metaDescription: string | null;

  // Video conferencing (Zoom meeting defaults)
  zoomDefaultDuration: number;
  zoomRecordingEnabled: boolean;

  // Roles & Permissions settings tab
  roleInheritanceEnabled: boolean;
  maxRolesPerUser: number;

  // Maintenance
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  scheduledMaintenanceAt: string | null;

  // Features
  liveSessionsEnabled: boolean;
  certificatesModuleEnabled: boolean;
  marketplaceEnabled: boolean;
  aiEnabled: boolean;
  gamificationEnabled: boolean;
  scormModuleEnabled: boolean;
  mobileAppEnabled: boolean;

  lastBackupAt: string | null;

  updatedAt: string;
  createdAt: string;
  updatedById: string | null;

  // Derived, env-only status — never the underlying secret values. Present
  // on every response from settings.controller.js's withEnvStatus() wrapper.
  smtpConfigured?: boolean;
  storageConfigured?: boolean;
}

export type UpdateSystemSettingsRequest = Partial<Omit<SystemSettings, 'id' | 'createdAt' | 'updatedAt' | 'updatedById'>>;

export interface SystemConfigLog {
  id: string;
  setting: string;
  oldValue: string | null;
  newValue: string | null;
  changedById: string;
  createdAt: string;
  changedBy: { id: string; fullName: string; email: string } | null;
}

export interface ConfigLogsResult {
  logs: SystemConfigLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ConfigLogsParams {
  [key: string]: string | number | undefined;
  page?: number;
  limit?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface TestEmailResult {
  success: boolean;
  message: string;
}

export interface BackupPayload {
  exportedAt: string;
  platformName: string;
  settings: Record<string, unknown>;
}

export interface StorageBucketUsage {
  bucket: string;
  public: boolean;
  fileCount: number;
  totalSizeBytes: number;
}

export interface StorageUsage {
  provider: string;
  buckets: StorageBucketUsage[];
  totalFiles: number;
  totalSizeBytes: number;
}

export interface BrandingSignResult {
  uploadUrl: string;
  path: string;
  kind: 'logo' | 'favicon';
  maxBytes: number;
}
