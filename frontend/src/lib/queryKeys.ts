// Query key factory — single source of truth for all cache keys.
// IMPACT_MAP.md §3 (Query Key Registry) is the authority; this file mirrors it.
// Never write key arrays inline in components or hooks — always call a factory here.

export type QueryKey = readonly unknown[];

export const queryKeys = {

  // ── Dashboard ──────────────────────────────────────────────────────────────
  dashboard: {
    stats:                 (): QueryKey => ['dashboard', 'stats'],
    revenue:               (): QueryKey => ['dashboard', 'revenue'],
    userAnalytics:         (): QueryKey => ['dashboard', 'user-analytics'],
    courseAnalytics:       (): QueryKey => ['dashboard', 'course-analytics'],
    instructorPerformance: (): QueryKey => ['dashboard', 'instructor-performance'],
    studentEngagement:     (): QueryKey => ['dashboard', 'student-engagement'],
    liveOverview:          (): QueryKey => ['dashboard', 'live-overview'],
  },

  reportsSnapshot:    (): QueryKey => ['reports', 'snapshot'],
  calendar:           (): QueryKey => ['calendar'],
  tasks:              (): QueryKey => ['tasks'],
  transactionsRecent: (): QueryKey => ['transactions', 'recent'],
  activity:           (): QueryKey => ['activity'],
  notifications:      (): QueryKey => ['notifications'],
  approvals:          (): QueryKey => ['approvals'],

  // ── Users ──────────────────────────────────────────────────────────────────
  users: {
    list:                (filters?: Record<string, unknown>): QueryKey =>
                           filters ? ['users', filters] : ['users'],
    detail:              (id: string): QueryKey => ['users', id],
    suspended:           (): QueryKey => ['users', 'suspended'],
    pendingVerification: (): QueryKey => ['users', 'pending-verification'],
    archived:            (): QueryKey => ['users', 'archived'],
    invitations:         (): QueryKey => ['users', 'invitations'],
    guests:              (): QueryKey => ['users', 'guests'],
    tags:                (): QueryKey => ['users', 'tags'],
  },
  admins: (): QueryKey => ['admins'],

  // ── Access domain ──────────────────────────────────────────────────────────
  roles: {
    list:    (): QueryKey => ['roles'],
    detail:  (id: string): QueryKey => ['roles', id],
    company: (): QueryKey => ['roles', 'company'],
  },
  roleTemplates:    (): QueryKey => ['role-templates'],
  roleAssignments:  (userId?: string): QueryKey =>
                      userId ? ['role-assignments', userId] : ['role-assignments'],
  permissionMatrix: (roleId?: string): QueryKey =>
                      roleId ? ['permission-matrix', roleId] : ['permission-matrix'],
  policies:         (): QueryKey => ['policies'],
  audit:            (filters?: Record<string, unknown>): QueryKey =>
                      filters ? ['audit', filters] : ['audit'],

  // ── Organization ───────────────────────────────────────────────────────────
  org: {
    departments: (): QueryKey => ['org', 'departments'],
    branches:    (): QueryKey => ['org', 'branches'],
    teams:       (): QueryKey => ['org', 'teams'],
    chart:       (): QueryKey => ['org', 'chart'],
  },
  groups:       (): QueryKey => ['groups'],
  competencies: (): QueryKey => ['competencies'],

  // ── Learning ───────────────────────────────────────────────────────────────
  courses: {
    list:     (filters?: Record<string, unknown>): QueryKey =>
                filters ? ['courses', filters] : ['courses'],
    detail:   (id: string): QueryKey => ['courses', id],
    sections: (courseId: string): QueryKey => ['courses', courseId, 'sections'],
  },
  categories:     (): QueryKey => ['categories'],
  learningPaths:  (): QueryKey => ['learning-paths'],
  quizzes:        (courseId?: string): QueryKey =>
                    courseId ? ['quizzes', courseId] : ['quizzes'],
  assignments:    (courseId?: string): QueryKey =>
                    courseId ? ['assignments', courseId] : ['assignments'],
  certificates:   (filters?: Record<string, unknown>): QueryKey =>
                    filters ? ['certificates', filters] : ['certificates'],
  certificateTemplates: (): QueryKey => ['certificate-templates'],
  contentLibrary: (): QueryKey => ['content-library'],
  liveSessions:   (filters?: Record<string, unknown>): QueryKey =>
                    filters ? ['live-sessions', filters] : ['live-sessions'],

  // ── Instructors ────────────────────────────────────────────────────────────
  instructors: {
    list:         (filters?: Record<string, unknown>): QueryKey =>
                    filters ? ['instructors', filters] : ['instructors'],
    detail:       (id: string): QueryKey => ['instructors', id],
    applications: (): QueryKey => ['instructor-applications'],
    earnings:     (id: string): QueryKey => ['instructors', id, 'earnings'],
    reviews:      (id: string): QueryKey => ['instructors', id, 'reviews'],
    documents:    (id: string): QueryKey => ['instructors', id, 'documents'],
    stats:        (): QueryKey => ['instructors', 'stats'],
    analytics:    (): QueryKey => ['instructors', 'analytics'],
  },

  // ── Students ───────────────────────────────────────────────────────────────
  students: {
    list:         (filters?: Record<string, unknown>): QueryKey =>
                    filters ? ['students', filters] : ['students'],
    detail:       (id: string): QueryKey => ['students', id],
    progress:     (id: string): QueryKey => ['students', id, 'progress'],
    certificates: (id: string): QueryKey => ['students', id, 'certificates'],
  },
  enrollments:    (entityId?: string): QueryKey =>
                    entityId ? ['enrollments', entityId] : ['enrollments'],
  attendance:     (sessionId?: string): QueryKey =>
                    sessionId ? ['attendance', sessionId] : ['attendance'],
  billing:        (studentId?: string): QueryKey =>
                    studentId ? ['billing', studentId] : ['billing'],
  supportTickets: (): QueryKey => ['support-tickets'],

  // ── Competencies ───────────────────────────────────────────────────────────
  competenciesCategories: (): QueryKey => ['competencies', 'categories'],
  competenciesFrameworks: (): QueryKey => ['competencies', 'frameworks'],
  competenciesLevels:     (): QueryKey => ['competencies', 'levels'],
  competenciesAnalytics:  (): QueryKey => ['competencies', 'analytics'],
  userSkills:             (userId: string): QueryKey => ['users', userId, 'skills'],

  // ── Finance ────────────────────────────────────────────────────────────────
  finance: {
    dashboard: (): QueryKey => ['finance', 'dashboard'],
    settings:  (): QueryKey => ['finance', 'settings'],
  },
  plans:         (): QueryKey => ['plans'],
  subscriptions: (filters?: Record<string, unknown>): QueryKey =>
                   filters ? ['subscriptions', filters] : ['subscriptions'],
  invoices:      (filters?: Record<string, unknown>): QueryKey =>
                   filters ? ['invoices', filters] : ['invoices'],
  payouts:       (filters?: Record<string, unknown>): QueryKey =>
                   filters ? ['payouts', filters] : ['payouts'],
  coupons:       (): QueryKey => ['coupons'],
  taxConfig:     (): QueryKey => ['tax', 'config'],
  gateways:      (): QueryKey => ['gateways'],

  // ── Notifications module ───────────────────────────────────────────────────
  notificationsStats:    (): QueryKey => ['notifications', 'stats'],
  notificationsRules:    (): QueryKey => ['notifications', 'rules'],
  notificationTemplates: (): QueryKey => ['notification-templates'],
  campaigns:             (filters?: Record<string, unknown>): QueryKey =>
                           filters ? ['campaigns', filters] : ['campaigns'],
  notificationsSettings: (): QueryKey => ['notifications', 'settings'],

  // ── Integrations ───────────────────────────────────────────────────────────
  integrations:      (): QueryKey => ['integrations'],
  integrationsStats: (): QueryKey => ['integrations', 'stats'],
  integrationsSync:  (): QueryKey => ['integrations', 'sync'],
  apiKeys:           (): QueryKey => ['api-keys'],
  webhooks:          (): QueryKey => ['webhooks'],

  // ── Settings / Security ────────────────────────────────────────────────────
  settings:          (domain?: string): QueryKey =>
                       domain ? ['settings', domain] : ['settings'],
  systemBackups:     (): QueryKey => ['system', 'backups'],
  securityStats:     (): QueryKey => ['security', 'stats'],
  securitySessions:  (): QueryKey => ['security', 'sessions'],
  securityThreats:   (): QueryKey => ['security', 'threats'],
  securityDevices:   (): QueryKey => ['security', 'devices'],
  securityIp:        (): QueryKey => ['security', 'ip'],
  securityIncidents: (): QueryKey => ['security', 'incidents'],
  securityRetention: (): QueryKey => ['security', 'retention'],
  securityAlerts:    (): QueryKey => ['security', 'alerts'],
  reportsTemplates:  (): QueryKey => ['reports', 'templates'],
  reportSchedules:   (): QueryKey => ['report-schedules'],
  imports:           (jobId?: string): QueryKey =>
                       jobId ? ['imports', jobId] : ['imports'],
  exportSchedules:   (): QueryKey => ['export-schedules'],
  importTemplates:   (): QueryKey => ['import-templates'],
};
