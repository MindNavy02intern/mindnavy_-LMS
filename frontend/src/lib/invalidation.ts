// Invalidation enforcement layer — IMPACT_MAP.md §6.
//
// Architecture note: the app currently uses raw fetch + a DOM CustomEvent bus
// for data refresh (no TanStack Query installed). This file provides:
//   1. A `MinimalQueryClient` interface compatible with TanStack Query's API so
//      call sites are forward-compatible when TQ is added.
//   2. `appQueryClient` — a singleton that is a no-op at the TanStack layer;
//      `invalidateFor` handles actual cache refresh via `dispatchBridgeEvents`.
//   3. `invalidateFor` — the ONLY place mutation → key mapping runs. Callers
//      never call `window.dispatchEvent` directly; they call this.
//
// Migration path: once @tanstack/react-query is installed, replace
// `appQueryClient` with `new QueryClient()`, wrap <App> with
// <QueryClientProvider>, and remove `dispatchBridgeEvents` one component at a
// time as each migrates to `useQuery`.

import { queryKeys } from './queryKeys';
import type { QueryKey } from './queryKeys';

// ── QueryClient interface ─────────────────────────────────────────────────────

export interface MinimalQueryClient {
  invalidateQueries(filter: { queryKey: QueryKey }): void | Promise<void>;
}

// Singleton — import this in every mutation site.
export const appQueryClient: MinimalQueryClient = {
  // No-op at the TanStack layer; dispatchBridgeEvents in invalidateFor handles
  // notification of current raw-fetch consumers (Dashboard, org hooks, etc.).
  invalidateQueries: () => {},
};

// ── Mutation context ──────────────────────────────────────────────────────────

export interface MutationCtx {
  id?:           string;   // generic ID (role, course, policy…)
  userId?:       string;
  courseId?:     string;
  studentId?:    string;
  sessionId?:    string;
  pathId?:       string;
  domain?:       string;   // for settings.update
  jobId?:        string;   // for imports
  instructorId?: string;   // course.approve/.reject fired from the instructor
                            // side panel — also refresh that instructor's own
                            // GET /instructors/:id (coursesCount/publishedCoursesCount
                            // changed) and the list row behind it.
}

// ── MutationName union ────────────────────────────────────────────────────────
// Every mutation in IMPACT_MAP.md §5.1–§5.17. This type enforces that
// INVALIDATION_MAP covers all mutations at compile time.

export type MutationName =
  // §5.1 USER
  | 'user.create' | 'user.import' | 'user.invite'
  | 'invite.resend' | 'invite.cancel'
  | 'user.verify.approve' | 'user.verify.reject'
  | 'user.suspend' | 'user.reactivate'
  | 'user.archive' | 'user.restore'
  | 'user.delete' | 'user.update' | 'user.merge'
  | 'user.tag.add' | 'user.tag.remove'
  // §5.2 STUDENT / ENROLLMENT
  | 'enrollment.create' | 'enrollment.statusUpdate' | 'enrollment.cancel' | 'student.dropout'
  | 'progress.update' | 'course.complete'
  | 'quiz.submit' | 'assignment.submit'
  | 'attendance.record' | 'student.suspend'
  // §5.3 INSTRUCTOR
  | 'instructorApplication.submit'
  | 'instructorApplication.approve'
  | 'instructorApplication.reject'
  | 'instructorApplication.requestChanges'
  | 'instructor.create' | 'instructor.update' | 'instructor.verify'
  | 'instructor.suspend' | 'instructor.reactivate' | 'instructor.delete'
  | 'review.moderate'
  | 'instructorDoc.upload' | 'instructorDoc.verify' | 'instructorDoc.reject' | 'instructorDoc.archive'
  // NOT in INSTRUCTORS_CONTRACT.md v1 (Certifications documented as a
  // deliberately unshipped, separate entity) — shipped 2026-08-07 at the
  // user's explicit direction. See types/instructors.ts for the full note.
  | 'instructorCert.upload' | 'instructorCert.verify' | 'instructorCert.reject' | 'instructorCert.delete'
  // §5.4 COURSE / LEARNING
  | 'course.createDraft' | 'course.update' | 'course.settings.update'
  | 'course.submitForApproval'
  | 'course.approve' | 'course.reject' | 'course.requestChanges'
  | 'course.archive' | 'course.restore' | 'course.unpublish'
  | 'category.create' | 'category.rename' | 'category.delete'
  | 'learningPath.create' | 'learningPath.update' | 'learningPath.delete'
  | 'learningPath.item.add' | 'learningPath.item.remove' | 'learningPath.item.reorder'
  | 'quiz.create' | 'quiz.update' | 'quiz.delete'
  | 'question.create' | 'question.update' | 'question.delete' | 'question.reorder'
  | 'liveSession.create' | 'liveSession.update' | 'liveSession.delete' | 'liveSession.end'
  | 'content.confirm' | 'content.update' | 'content.delete'
  // §5.4 Course Builder (sections & lessons)
  | 'section.create' | 'section.update' | 'section.delete'
  | 'lesson.create'  | 'lesson.update'  | 'lesson.delete'
  | 'sections.reorder'
  // §5.5 ROLE / PERMISSION
  | 'role.create' | 'role.edit' | 'role.duplicate' | 'role.delete'
  | 'role.assignToUser' | 'template.apply'
  | 'policy.create' | 'policy.update' | 'policy.delete'
  // §5.6 ORGANIZATION / GROUPS
  | 'department.create' | 'department.rename' | 'department.delete'
  | 'branch.create' | 'branch.rename' | 'branch.delete'
  | 'team.create' | 'team.rename' | 'team.delete'
  | 'orgChart.moveUser'
  | 'group.create' | 'group.update' | 'group.delete'
  // §5.7 FINANCE
  | 'transaction.purchase'
  | 'refund.request' | 'refund.approve' | 'refund.reject'
  | 'payout.execute' | 'payout.hold'
  | 'subscription.cancel'
  // §5.8 CERTIFICATE
  | 'certificate.issue' | 'certificate.revoke' | 'certificate.reissue'
  | 'certificateTemplate.create' | 'certificateTemplate.update' | 'certificateTemplate.delete'
  // §5.11 COMPETENCY / SKILL
  | 'skill.create' | 'skill.update' | 'skill.delete'
  | 'skillCategory.create' | 'skillCategory.update' | 'skillCategory.archive'
  | 'framework.create' | 'framework.update' | 'framework.delete'
  | 'skillLevel.configure'
  | 'competencyMap.link' | 'competencyMap.unlink'
  | 'competencyCert.assign' | 'competencyCert.verify' | 'competencyCert.revoke'
  // §5.12 NOTIFICATION CAMPAIGNS
  | 'emailCampaign.create' | 'pushCampaign.send'
  | 'smsCampaign.send' | 'announcement.send'
  | 'campaign.schedule' | 'campaign.pause' | 'campaign.cancel' | 'campaign.duplicate'
  | 'notificationTemplate.create' | 'notificationTemplate.update' | 'notificationTemplate.duplicate'
  | 'notificationRule.create' | 'notificationRule.update'
  | 'notificationRule.delete' | 'notificationRule.toggle'
  | 'notification.markRead' | 'notification.archive' | 'notification.pin'
  | 'emergencyAlert.send' | 'delivery.retry'
  // §5.13 FINANCE CONFIG
  | 'plan.create' | 'plan.update'
  | 'invoice.generate' | 'invoice.void' | 'invoice.update' | 'invoice.send'
  | 'coupon.create' | 'coupon.update' | 'coupon.disable'
  | 'tax.configure' | 'billingSettings.update'
  | 'gateway.connect' | 'gateway.configure' | 'gateway.testMode'
  | 'commission.update'
  | 'payment.retry' | 'payment.approve'
  // §5.14 SUPPORT TICKETS
  | 'ticket.create' | 'ticket.assign' | 'ticket.respond'
  | 'ticket.resolve' | 'ticket.escalate'
  // §5.15 INTEGRATIONS
  | 'integration.connect' | 'integration.disconnect'
  | 'integration.configure' | 'integration.testMode'
  | 'apiKey.generate' | 'apiKey.revoke'
  | 'webhook.create' | 'webhook.update' | 'webhook.delete' | 'webhook.toggle'
  | 'sync.run'
  // §5.16 SYSTEM SETTINGS
  | 'settings.update' | 'featureToggle.set'
  | 'maintenance.enable' | 'maintenance.disable'
  | 'backup.run' | 'backup.restore'
  | 'retention.update' | 'settings.restoreVersion'
  // §5.17 SECURITY ACTIONS
  | 'securityAlert.resolve'
  | 'incident.create' | 'incident.update' | 'incident.close'
  | 'device.block' | 'device.approve'
  | 'ip.block' | 'ip.unblock';

// ── INVALIDATION_MAP ──────────────────────────────────────────────────────────
// Maps each mutation → its EXTRA keys beyond the §2 defaults.
// §2 defaults ('activity', 'notifications', 'dashboard.stats') are added
// automatically by invalidateFor — do NOT repeat them here.

export const INVALIDATION_MAP: Record<MutationName, (ctx?: MutationCtx) => QueryKey[]> = {

  // ── §5.1 USER ──────────────────────────────────────────────────────────────
  'user.create': (ctx) => [
    queryKeys.users.list(),
    queryKeys.dashboard.userAnalytics(),
    queryKeys.org.departments(),
    queryKeys.org.branches(),
    queryKeys.org.teams(),
    queryKeys.groups(),
    queryKeys.users.pendingVerification(),
    queryKeys.users.invitations(),
    ...(ctx?.id ? [queryKeys.users.detail(ctx.id)] : []),
  ],
  'user.import': (ctx) => [
    queryKeys.users.list(),
    queryKeys.dashboard.userAnalytics(),
    queryKeys.org.departments(),
    queryKeys.org.branches(),
    queryKeys.org.teams(),
    queryKeys.groups(),
    queryKeys.users.pendingVerification(),
    queryKeys.users.invitations(),
    queryKeys.reportsSnapshot(),
    // A CSV import can include INSTRUCTOR-role rows (ImportUsersModal allows
    // any of LEARNER/INSTRUCTOR/MANAGER/ADMIN_ASSISTANT) — this domain was
    // never invalidated on import before the Instructors module existed.
    queryKeys.instructors.list(),
    ...(ctx?.id ? [queryKeys.users.detail(ctx.id)] : []),
  ],
  'user.invite': () => [
    queryKeys.users.invitations(),
  ],
  'invite.resend': () => [
    queryKeys.users.invitations(),
  ],
  'invite.cancel': () => [
    queryKeys.users.invitations(),
  ],
  'user.verify.approve': () => [
    queryKeys.users.list(),
    queryKeys.users.pendingVerification(),
    queryKeys.approvals(),
    queryKeys.dashboard.userAnalytics(),
  ],
  'user.verify.reject': () => [
    queryKeys.users.list(),
    queryKeys.users.pendingVerification(),
    queryKeys.approvals(),
    queryKeys.dashboard.userAnalytics(),
  ],
  'user.suspend': (ctx) => [
    queryKeys.users.list(),
    queryKeys.users.suspended(),
    queryKeys.dashboard.userAnalytics(),
    ...(ctx?.id ? [queryKeys.users.detail(ctx.id)] : []),
  ],
  'user.reactivate': (ctx) => [
    queryKeys.users.list(),
    queryKeys.users.suspended(),
    queryKeys.dashboard.userAnalytics(),
    ...(ctx?.id ? [queryKeys.users.detail(ctx.id)] : []),
  ],
  'user.archive': (ctx) => [
    queryKeys.users.list(),
    queryKeys.users.archived(),
    ...(ctx?.id ? [queryKeys.users.detail(ctx.id)] : []),
  ],
  'user.restore': (ctx) => [
    queryKeys.users.list(),
    queryKeys.users.archived(),
    ...(ctx?.id ? [queryKeys.users.detail(ctx.id)] : []),
  ],
  'user.delete': (ctx) => [
    queryKeys.users.list(),
    queryKeys.enrollments(),
    queryKeys.roleAssignments(),
    queryKeys.org.departments(),
    queryKeys.org.branches(),
    queryKeys.org.teams(),
    queryKeys.groups(),
    ...(ctx?.id ? [queryKeys.users.detail(ctx.id)] : []),
  ],
  'user.update': (ctx) => [
    queryKeys.users.list(),
    queryKeys.org.departments(),
    queryKeys.org.branches(),
    queryKeys.org.teams(),
    ...(ctx?.id ? [queryKeys.users.detail(ctx.id)] : []),
  ],
  'user.merge': (ctx) => [
    queryKeys.users.list(),
    queryKeys.enrollments(),
    queryKeys.certificates(),
    queryKeys.billing(),
    ...(ctx?.id ? [queryKeys.users.detail(ctx.id)] : []),
  ],
  'user.tag.add': (ctx) => [
    queryKeys.users.tags(),
    ...(ctx?.id ? [queryKeys.users.detail(ctx.id)] : []),
  ],
  'user.tag.remove': (ctx) => [
    queryKeys.users.tags(),
    ...(ctx?.id ? [queryKeys.users.detail(ctx.id)] : []),
  ],

  // ── §5.2 STUDENT / ENROLLMENT ─────────────────────────────────────────────
  'enrollment.create': (ctx) => [
    queryKeys.enrollments(ctx?.studentId),
    queryKeys.enrollments(ctx?.courseId),
    queryKeys.students.list(),
    ...(ctx?.studentId ? [queryKeys.students.detail(ctx.studentId)] : []),
    queryKeys.courses.list(),
    ...(ctx?.courseId ? [queryKeys.courses.detail(ctx.courseId)] : []),
    queryKeys.dashboard.courseAnalytics(),
    queryKeys.dashboard.studentEngagement(),
  ],
  'enrollment.statusUpdate': (ctx) => [
    queryKeys.enrollments(ctx?.studentId),
    queryKeys.enrollments(ctx?.courseId),
    queryKeys.students.list(),
    ...(ctx?.studentId ? [queryKeys.students.detail(ctx.studentId)] : []),
    queryKeys.courses.list(),
    ...(ctx?.courseId ? [queryKeys.courses.detail(ctx.courseId)] : []),
    queryKeys.dashboard.courseAnalytics(),
    queryKeys.dashboard.studentEngagement(),
  ],
  // IMPACT_MAP §5.2 documents this row as "same as create + drop-off metrics" —
  // it was previously missing students.detail/courses.list/courses.detail
  // relative to enrollment.create (found and fixed during Enrollments review).
  'enrollment.cancel': (ctx) => [
    queryKeys.enrollments(ctx?.studentId),
    queryKeys.enrollments(ctx?.courseId),
    queryKeys.students.list(),
    ...(ctx?.studentId ? [queryKeys.students.detail(ctx.studentId)] : []),
    queryKeys.courses.list(),
    ...(ctx?.courseId ? [queryKeys.courses.detail(ctx.courseId)] : []),
    queryKeys.dashboard.courseAnalytics(),
    queryKeys.dashboard.studentEngagement(),
  ],
  'student.dropout': (ctx) => [
    queryKeys.enrollments(ctx?.studentId),
    queryKeys.students.list(),
    queryKeys.dashboard.courseAnalytics(),
    queryKeys.dashboard.studentEngagement(),
  ],
  'progress.update': (ctx) => [
    ...(ctx?.studentId ? [queryKeys.students.progress(ctx.studentId)] : []),
    queryKeys.dashboard.studentEngagement(),
  ],
  'course.complete': (ctx) => [
    ...(ctx?.studentId ? [queryKeys.students.progress(ctx.studentId)] : []),
    queryKeys.enrollments(ctx?.studentId),
    queryKeys.dashboard.courseAnalytics(),
    queryKeys.dashboard.studentEngagement(),
  ],
  'quiz.submit': (ctx) => [
    queryKeys.quizzes(ctx?.courseId),
    queryKeys.assignments(ctx?.courseId),
    ...(ctx?.studentId ? [queryKeys.students.detail(ctx.studentId)] : []),
    queryKeys.dashboard.courseAnalytics(),
    queryKeys.dashboard.studentEngagement(),
  ],
  'assignment.submit': (ctx) => [
    queryKeys.assignments(ctx?.courseId),
    ...(ctx?.studentId ? [queryKeys.students.detail(ctx.studentId)] : []),
    queryKeys.dashboard.courseAnalytics(),
    queryKeys.dashboard.studentEngagement(),
  ],
  'attendance.record': (ctx) => [
    queryKeys.attendance(ctx?.sessionId),
    ...(ctx?.studentId ? [queryKeys.students.detail(ctx.studentId)] : []),
    queryKeys.dashboard.liveOverview(),
  ],
  'student.suspend': (ctx) => [
    queryKeys.users.list(),
    queryKeys.users.suspended(),
    queryKeys.students.list(),
    queryKeys.dashboard.userAnalytics(),
    ...(ctx?.studentId ? [queryKeys.students.detail(ctx.studentId)] : []),
  ],

  // ── §5.3 INSTRUCTOR ───────────────────────────────────────────────────────
  'instructorApplication.submit': () => [
    queryKeys.instructors.applications(),
    queryKeys.approvals(),
    queryKeys.tasks(),
  ],
  'instructorApplication.approve': () => [
    queryKeys.instructors.applications(),
    queryKeys.instructors.list(),
    queryKeys.approvals(),
    queryKeys.users.list(),
    queryKeys.dashboard.userAnalytics(),
  ],
  'instructorApplication.reject': () => [
    queryKeys.instructors.applications(),
    queryKeys.approvals(),
  ],
  'instructorApplication.requestChanges': () => [
    queryKeys.instructors.applications(),
    queryKeys.approvals(),
  ],
  'instructor.create': (ctx) => [
    queryKeys.instructors.list(),
    queryKeys.users.list(),
    queryKeys.dashboard.userAnalytics(),
    ...(ctx?.id ? [queryKeys.instructors.detail(ctx.id)] : []),
  ],
  'instructor.update': (ctx) => [
    queryKeys.instructors.list(),
    ...(ctx?.id ? [queryKeys.instructors.detail(ctx.id)] : []),
  ],
  'instructor.verify': (ctx) => [
    queryKeys.instructors.list(),
    queryKeys.users.list(),
    ...(ctx?.id ? [queryKeys.instructors.detail(ctx.id)] : []),
  ],
  // Delegates to users.service (same AppUser row the Users table shows) —
  // ['users'] is required here per INSTRUCTORS_CONTRACT.md, not optional.
  'instructor.suspend': (ctx) => [
    queryKeys.instructors.list(),
    queryKeys.users.list(),
    queryKeys.courses.list(),
    queryKeys.dashboard.instructorPerformance(),
    ...(ctx?.id ? [queryKeys.instructors.detail(ctx.id)] : []),
  ],
  'instructor.reactivate': (ctx) => [
    queryKeys.instructors.list(),
    queryKeys.users.list(),
    queryKeys.dashboard.userAnalytics(),
    ...(ctx?.id ? [queryKeys.instructors.detail(ctx.id)] : []),
  ],
  'instructor.delete': () => [
    queryKeys.instructors.list(),
    queryKeys.users.list(),
    queryKeys.courses.list(),
    queryKeys.dashboard.userAnalytics(),
  ],
  'review.moderate': (ctx) => [
    queryKeys.dashboard.instructorPerformance(),
    ...(ctx?.id ? [queryKeys.instructors.reviews(ctx.id)] : []),
  ],

  // Documents (INSTRUCTORS_CONTRACT.md "Documents" section — administrative
  // paperwork only, no CERTIFICATION type). ctx.id is the instructorId.
  'instructorDoc.upload': (ctx) => [
    ...(ctx?.id ? [queryKeys.instructors.documents(ctx.id), queryKeys.instructors.detail(ctx.id)] : []),
  ],
  'instructorDoc.verify': (ctx) => [
    ...(ctx?.id ? [queryKeys.instructors.documents(ctx.id)] : []),
    queryKeys.approvals(),
  ],
  'instructorDoc.reject': (ctx) => [
    ...(ctx?.id ? [queryKeys.instructors.documents(ctx.id)] : []),
    queryKeys.approvals(),
  ],
  'instructorDoc.archive': (ctx) => [
    ...(ctx?.id ? [queryKeys.instructors.documents(ctx.id)] : []),
  ],

  // Certifications — NOT in INSTRUCTORS_CONTRACT.md v1, shipped 2026-08-07 at
  // the user's explicit direction (see the MutationName union above). ctx.id
  // is the instructorId, matching the instructorDoc.* rows above.
  'instructorCert.upload': (ctx) => [
    ...(ctx?.id ? [queryKeys.instructors.certifications(ctx.id), queryKeys.instructors.detail(ctx.id)] : []),
  ],
  'instructorCert.verify': (ctx) => [
    ...(ctx?.id ? [queryKeys.instructors.certifications(ctx.id)] : []),
    queryKeys.approvals(),
  ],
  'instructorCert.reject': (ctx) => [
    ...(ctx?.id ? [queryKeys.instructors.certifications(ctx.id)] : []),
    queryKeys.approvals(),
  ],
  'instructorCert.delete': (ctx) => [
    ...(ctx?.id ? [queryKeys.instructors.certifications(ctx.id)] : []),
  ],

  // ── §5.4 COURSE / LEARNING ────────────────────────────────────────────────
  'course.createDraft': () => [
    queryKeys.courses.list(),
    queryKeys.dashboard.courseAnalytics(),
  ],
  'course.update': () => [
    queryKeys.courses.list(),
    queryKeys.dashboard.courseAnalytics(),
  ],
  'course.settings.update': (ctx) => [
    ...(ctx?.id ? [queryKeys.courses.detail(ctx.id)] : []),
  ],
  'course.submitForApproval': (ctx) => [
    queryKeys.courses.list(),
    queryKeys.approvals(),
    queryKeys.tasks(),
    queryKeys.dashboard.courseAnalytics(),
    ...(ctx?.id ? [queryKeys.courses.detail(ctx.id)] : []),
  ],
  'course.approve': (ctx) => [
    queryKeys.courses.list(),
    queryKeys.approvals(),
    queryKeys.categories(),
    queryKeys.dashboard.courseAnalytics(),
    queryKeys.learningPaths(),
    ...(ctx?.id ? [queryKeys.courses.detail(ctx.id)] : []),
    ...(ctx?.instructorId ? [queryKeys.instructors.detail(ctx.instructorId), queryKeys.instructors.list()] : []),
  ],
  'course.reject': (ctx) => [
    queryKeys.courses.list(),
    queryKeys.approvals(),
    queryKeys.notifications(),
    ...(ctx?.id ? [queryKeys.courses.detail(ctx.id)] : []),
    ...(ctx?.instructorId ? [queryKeys.instructors.detail(ctx.instructorId), queryKeys.instructors.list()] : []),
  ],
  'course.requestChanges': (ctx) => [
    queryKeys.courses.list(),
    queryKeys.approvals(),
    queryKeys.notifications(),
    ...(ctx?.id ? [queryKeys.courses.detail(ctx.id)] : []),
  ],
  // instructorId is set when archived from the Instructor Courses tab — their
  // coursesCount (non-archived) changes, so the panel/list must refresh too.
  'course.archive': (ctx) => [
    queryKeys.courses.list(),
    queryKeys.dashboard.courseAnalytics(),
    queryKeys.learningPaths(),
    ...(ctx?.id ? [queryKeys.courses.detail(ctx.id)] : []),
    ...(ctx?.instructorId ? [queryKeys.instructors.detail(ctx.instructorId), queryKeys.instructors.list()] : []),
  ],
  'course.restore': () => [
    queryKeys.courses.list(),
    queryKeys.dashboard.courseAnalytics(),
    queryKeys.learningPaths(),
  ],
  // Published -> Draft. reviewedAt/rejectionReason untouched (not a rejection,
  // not an un-approval) — per COURSES_API.md §4.6.
  'course.unpublish': (ctx) => [
    queryKeys.courses.list(),
    queryKeys.dashboard.courseAnalytics(),
    ...(ctx?.id ? [queryKeys.courses.detail(ctx.id)] : []),
    ...(ctx?.instructorId ? [queryKeys.instructors.detail(ctx.instructorId), queryKeys.instructors.list()] : []),
  ],
  'category.create': () => [
    queryKeys.categories(),
    queryKeys.courses.list(),
  ],
  'category.rename': () => [
    queryKeys.categories(),
    queryKeys.courses.list(),
  ],
  'category.delete': () => [
    queryKeys.categories(),
    queryKeys.courses.list(),
  ],
  'learningPath.create': () => [
    queryKeys.learningPaths(),
    queryKeys.dashboard.courseAnalytics(),
  ],
  'learningPath.update': () => [
    queryKeys.learningPaths(),
    queryKeys.dashboard.courseAnalytics(),
  ],
  'learningPath.delete': () => [
    queryKeys.learningPaths(),
    queryKeys.dashboard.courseAnalytics(),
  ],
  'learningPath.item.add': () => [
    queryKeys.learningPaths(),
  ],
  'learningPath.item.remove': () => [
    queryKeys.learningPaths(),
  ],
  'learningPath.item.reorder': () => [
    queryKeys.learningPaths(),
  ],
  // Quizzes & Exams — courseId is the QUIZ's courseId (undefined for
  // unattached quizzes), so the course-scoped keys are only added when set.
  'quiz.create': (ctx) => [
    queryKeys.quizzes(),
    ...(ctx?.courseId ? [queryKeys.quizzes(ctx.courseId), queryKeys.courses.detail(ctx.courseId)] : []),
  ],
  'quiz.update': (ctx) => [
    queryKeys.quizzes(),
    ...(ctx?.courseId ? [queryKeys.quizzes(ctx.courseId), queryKeys.courses.detail(ctx.courseId)] : []),
  ],
  'quiz.delete': (ctx) => [
    queryKeys.quizzes(),
    ...(ctx?.courseId ? [queryKeys.quizzes(ctx.courseId), queryKeys.courses.detail(ctx.courseId)] : []),
  ],
  // Question writes change quiz-derived counts (questionCount/totalPoints) —
  // same invalidation set as quiz.update.
  'question.create': (ctx) => [
    queryKeys.quizzes(),
    ...(ctx?.courseId ? [queryKeys.quizzes(ctx.courseId), queryKeys.courses.detail(ctx.courseId)] : []),
  ],
  'question.update': (ctx) => [
    queryKeys.quizzes(),
    ...(ctx?.courseId ? [queryKeys.quizzes(ctx.courseId), queryKeys.courses.detail(ctx.courseId)] : []),
  ],
  'question.delete': (ctx) => [
    queryKeys.quizzes(),
    ...(ctx?.courseId ? [queryKeys.quizzes(ctx.courseId), queryKeys.courses.detail(ctx.courseId)] : []),
  ],
  'question.reorder': (ctx) => [
    queryKeys.quizzes(),
    ...(ctx?.courseId ? [queryKeys.quizzes(ctx.courseId), queryKeys.courses.detail(ctx.courseId)] : []),
  ],
  // Status is schedule-derived server-side (no manual start/end action in v1) —
  // create/update/delete are the only live-session mutations. Full row per
  // IMPACT_MAP §5.4: live-sessions + calendar + live-overview + learning-paths
  // (deleted sessions leave missing:true items in any path that references them).
  'liveSession.create': () => [
    queryKeys.liveSessions(),
    queryKeys.calendar(),
    queryKeys.dashboard.liveOverview(),
    queryKeys.learningPaths(),
  ],
  'liveSession.update': () => [
    queryKeys.liveSessions(),
    queryKeys.calendar(),
    queryKeys.dashboard.liveOverview(),
    queryKeys.learningPaths(),
  ],
  'liveSession.delete': () => [
    queryKeys.liveSessions(),
    queryKeys.calendar(),
    queryKeys.dashboard.liveOverview(),
    queryKeys.learningPaths(),
  ],
  // Manual admin "End Session" override (2026-07-29 — new v2 action, not part
  // of the original v1 contract) — same full row as create/update/delete.
  'liveSession.end': () => [
    queryKeys.liveSessions(),
    queryKeys.calendar(),
    queryKeys.dashboard.liveOverview(),
    queryKeys.learningPaths(),
  ],
  'content.confirm': (ctx) => [
    queryKeys.contentLibrary(),
    ...(ctx?.courseId ? [queryKeys.courses.detail(ctx.courseId)] : []),
  ],
  'content.update': (ctx) => [
    queryKeys.contentLibrary(),
    ...(ctx?.courseId ? [queryKeys.courses.detail(ctx.courseId)] : []),
  ],
  'content.delete': (ctx) => [
    queryKeys.contentLibrary(),
    ...(ctx?.courseId ? [queryKeys.courses.detail(ctx.courseId)] : []),
  ],

  // Course Builder — sections & lessons (§5.4 addendum)
  'section.create': (ctx) => [
    ...(ctx?.courseId ? [queryKeys.courses.sections(ctx.courseId)] : []),
    queryKeys.contentLibrary(),
  ],
  'section.update': (ctx) => [
    ...(ctx?.courseId ? [queryKeys.courses.sections(ctx.courseId)] : []),
  ],
  'section.delete': (ctx) => [
    ...(ctx?.courseId ? [queryKeys.courses.sections(ctx.courseId)] : []),
    queryKeys.contentLibrary(),
  ],
  'lesson.create': (ctx) => [
    ...(ctx?.courseId ? [queryKeys.courses.sections(ctx.courseId)] : []),
    queryKeys.contentLibrary(),
  ],
  'lesson.update': (ctx) => [
    ...(ctx?.courseId ? [queryKeys.courses.sections(ctx.courseId)] : []),
  ],
  'lesson.delete': (ctx) => [
    ...(ctx?.courseId ? [queryKeys.courses.sections(ctx.courseId)] : []),
    queryKeys.contentLibrary(),
  ],
  'sections.reorder': (ctx) => [
    ...(ctx?.courseId ? [queryKeys.courses.sections(ctx.courseId)] : []),
  ],

  // ── §5.5 ROLE / PERMISSION ────────────────────────────────────────────────
  'role.create': () => [
    queryKeys.roles.list(),
  ],
  'role.edit': (ctx) => [
    queryKeys.roles.list(),
    queryKeys.permissionMatrix(),
    queryKeys.roleAssignments(),
    ...(ctx?.id ? [queryKeys.roles.detail(ctx.id)] : []),
  ],
  'role.duplicate': () => [
    queryKeys.roles.list(),
  ],
  'role.delete': () => [
    queryKeys.roles.list(),
    queryKeys.roleAssignments(),
    queryKeys.users.list(),
  ],
  'role.assignToUser': (ctx) => [
    queryKeys.roleAssignments(ctx?.userId),
    queryKeys.users.list(),
    queryKeys.dashboard.userAnalytics(),
    ...(ctx?.userId ? [queryKeys.users.detail(ctx.userId)] : []),
  ],
  'template.apply': (ctx) => [
    queryKeys.roleAssignments(ctx?.userId),
    queryKeys.users.list(),
    queryKeys.dashboard.userAnalytics(),
    ...(ctx?.userId ? [queryKeys.users.detail(ctx.userId)] : []),
  ],
  'policy.create': () => [
    queryKeys.policies(),
  ],
  'policy.update': () => [
    queryKeys.policies(),
  ],
  'policy.delete': () => [
    queryKeys.policies(),
  ],

  // ── §5.6 ORGANIZATION / GROUPS ────────────────────────────────────────────
  'department.create': () => [
    queryKeys.org.departments(), queryKeys.org.chart(), queryKeys.users.list(),
  ],
  'department.rename': () => [
    queryKeys.org.departments(), queryKeys.org.chart(), queryKeys.users.list(),
  ],
  'department.delete': () => [
    queryKeys.org.departments(), queryKeys.org.chart(), queryKeys.users.list(),
  ],
  'branch.create': () => [
    queryKeys.org.branches(), queryKeys.org.chart(), queryKeys.users.list(),
  ],
  'branch.rename': () => [
    queryKeys.org.branches(), queryKeys.org.chart(), queryKeys.users.list(),
  ],
  'branch.delete': () => [
    queryKeys.org.branches(), queryKeys.org.chart(), queryKeys.users.list(),
  ],
  'team.create': () => [
    queryKeys.org.teams(), queryKeys.org.chart(), queryKeys.users.list(),
  ],
  'team.rename': () => [
    queryKeys.org.teams(), queryKeys.org.chart(), queryKeys.users.list(),
  ],
  'team.delete': () => [
    queryKeys.org.teams(), queryKeys.org.chart(), queryKeys.users.list(),
  ],
  'orgChart.moveUser': (ctx) => [
    queryKeys.org.chart(),
    queryKeys.org.teams(),
    ...(ctx?.userId ? [queryKeys.users.detail(ctx.userId)] : []),
  ],
  'group.create': () => [
    queryKeys.groups(), queryKeys.users.list(),
  ],
  'group.update': () => [
    queryKeys.groups(), queryKeys.users.list(),
  ],
  'group.delete': () => [
    queryKeys.groups(), queryKeys.users.list(),
  ],

  // ── §5.7 FINANCE ─────────────────────────────────────────────────────────
  'transaction.purchase': (ctx) => [
    queryKeys.transactionsRecent(),
    queryKeys.dashboard.revenue(),
    queryKeys.billing(ctx?.studentId),
    queryKeys.enrollments(ctx?.studentId),
    queryKeys.subscriptions(),
  ],
  'refund.request': () => [
    queryKeys.approvals(),
    queryKeys.tasks(),
  ],
  'refund.approve': (ctx) => [
    queryKeys.approvals(),
    queryKeys.transactionsRecent(),
    queryKeys.dashboard.revenue(),
    queryKeys.billing(ctx?.studentId),
    queryKeys.enrollments(ctx?.studentId),
  ],
  'refund.reject': () => [
    queryKeys.approvals(),
  ],
  'payout.execute': (ctx) => [
    queryKeys.dashboard.revenue(),
    queryKeys.transactionsRecent(),
    ...(ctx?.id ? [queryKeys.instructors.earnings(ctx.id)] : []),
  ],
  'payout.hold': (ctx) => [
    queryKeys.payouts(),
    ...(ctx?.id ? [queryKeys.instructors.earnings(ctx.id)] : []),
  ],
  'subscription.cancel': (ctx) => [
    queryKeys.dashboard.revenue(),
    queryKeys.billing(ctx?.studentId),
    queryKeys.subscriptions(),
  ],

  // ── §5.8 CERTIFICATE ──────────────────────────────────────────────────────
  'certificate.issue': (ctx) => [
    queryKeys.certificates(),
    queryKeys.dashboard.courseAnalytics(),
    ...(ctx?.studentId ? [queryKeys.students.certificates(ctx.studentId)] : []),
  ],
  'certificate.revoke': (ctx) => [
    queryKeys.certificates(),
    queryKeys.dashboard.courseAnalytics(),
    ...(ctx?.studentId ? [queryKeys.students.certificates(ctx.studentId)] : []),
  ],
  // Reissue mints a fresh code/issuedAt and clears revokedAt (can move a
  // revoked cert back to active) — same surfaces as issue/revoke.
  'certificate.reissue': (ctx) => [
    queryKeys.certificates(),
    queryKeys.dashboard.courseAnalytics(),
    ...(ctx?.studentId ? [queryKeys.students.certificates(ctx.studentId)] : []),
  ],
  // Template writes don't touch the dashboard KPI, but certificate rows read
  // templateName live off the relation (not snapshotted like studentName/
  // courseTitle) — a rename or delete changes what the certificates list shows.
  'certificateTemplate.create': () => [
    queryKeys.certificateTemplates(),
  ],
  'certificateTemplate.update': () => [
    queryKeys.certificateTemplates(),
    queryKeys.certificates(),
  ],
  'certificateTemplate.delete': () => [
    queryKeys.certificateTemplates(),
    queryKeys.certificates(),
  ],

  // ── §5.11 COMPETENCY / SKILL ──────────────────────────────────────────────
  'skill.create': () => [queryKeys.competencies()],
  'skill.update': () => [queryKeys.competencies()],
  'skill.delete': () => [queryKeys.competencies()],
  'skillCategory.create': () => [
    queryKeys.competenciesCategories(), queryKeys.competencies(),
  ],
  'skillCategory.update': () => [
    queryKeys.competenciesCategories(), queryKeys.competencies(),
  ],
  'skillCategory.archive': () => [
    queryKeys.competenciesCategories(), queryKeys.competencies(),
  ],
  'framework.create': () => [queryKeys.competenciesFrameworks()],
  'framework.update': () => [queryKeys.competenciesFrameworks()],
  'framework.delete': () => [queryKeys.competenciesFrameworks()],
  'skillLevel.configure': () => [queryKeys.competenciesLevels()],
  'competencyMap.link': (ctx) => [
    queryKeys.competencies(),
    ...(ctx?.courseId ? [queryKeys.courses.detail(ctx.courseId)] : []),
    queryKeys.learningPaths(),
  ],
  'competencyMap.unlink': (ctx) => [
    queryKeys.competencies(),
    ...(ctx?.courseId ? [queryKeys.courses.detail(ctx.courseId)] : []),
    queryKeys.learningPaths(),
  ],
  'competencyCert.assign': (ctx) => [
    queryKeys.competenciesAnalytics(),
    ...(ctx?.userId ? [queryKeys.userSkills(ctx.userId)] : []),
  ],
  'competencyCert.verify': (ctx) => [
    queryKeys.competenciesAnalytics(),
    ...(ctx?.userId ? [queryKeys.userSkills(ctx.userId)] : []),
  ],
  'competencyCert.revoke': (ctx) => [
    queryKeys.competenciesAnalytics(),
    ...(ctx?.userId ? [queryKeys.userSkills(ctx.userId)] : []),
  ],

  // ── §5.12 NOTIFICATION CAMPAIGNS ─────────────────────────────────────────
  'emailCampaign.create':            () => [queryKeys.campaigns(), queryKeys.notificationsStats()],
  'pushCampaign.send':               () => [queryKeys.campaigns(), queryKeys.notificationsStats()],
  'smsCampaign.send':                () => [queryKeys.campaigns(), queryKeys.notificationsStats()],
  'announcement.send':               () => [queryKeys.campaigns(), queryKeys.notificationsStats()],
  'campaign.schedule':               () => [queryKeys.campaigns(), queryKeys.calendar()],
  'campaign.pause':                  () => [queryKeys.campaigns()],
  'campaign.cancel':                 () => [queryKeys.campaigns()],
  'campaign.duplicate':              () => [queryKeys.campaigns()],
  'notificationTemplate.create':     () => [queryKeys.notificationTemplates()],
  'notificationTemplate.update':     () => [queryKeys.notificationTemplates()],
  'notificationTemplate.duplicate':  () => [queryKeys.notificationTemplates()],
  'notificationRule.create':         () => [queryKeys.notificationsRules()],
  'notificationRule.update':         () => [queryKeys.notificationsRules()],
  'notificationRule.delete':         () => [queryKeys.notificationsRules()],
  'notificationRule.toggle':         () => [queryKeys.notificationsRules()],
  // notification.mark*/archive/pin are feed-state only — skip §2 defaults per IMPACT_MAP §5.12
  'notification.markRead':  () => [queryKeys.notifications()],
  'notification.archive':   () => [queryKeys.notifications()],
  'notification.pin':       () => [queryKeys.notifications()],
  'emergencyAlert.send':    () => [queryKeys.campaigns(), queryKeys.securityAlerts()],
  'delivery.retry':         () => [queryKeys.notificationsStats()],

  // ── §5.13 FINANCE CONFIG ──────────────────────────────────────────────────
  'plan.create':           () => [queryKeys.plans(), queryKeys.subscriptions()],
  'plan.update':           () => [queryKeys.plans(), queryKeys.subscriptions()],
  'invoice.generate':      (ctx) => [
    queryKeys.invoices(), queryKeys.billing(ctx?.studentId),
  ],
  'invoice.void':          (ctx) => [
    queryKeys.invoices(), queryKeys.billing(ctx?.studentId),
  ],
  'invoice.update':        () => [queryKeys.invoices()],
  'invoice.send':          () => [queryKeys.invoices()],
  'coupon.create':         () => [queryKeys.coupons()],
  'coupon.update':         () => [queryKeys.coupons()],
  'coupon.disable':        () => [queryKeys.coupons()],
  'tax.configure':         () => [queryKeys.taxConfig(), queryKeys.invoices()],
  'billingSettings.update': () => [queryKeys.finance.settings()],
  'gateway.connect':       () => [queryKeys.gateways(), queryKeys.integrations()],
  'gateway.configure':     () => [queryKeys.gateways()],
  'gateway.testMode':      () => [queryKeys.gateways(), queryKeys.integrations()],
  'commission.update':     () => [
    queryKeys.payouts(), queryKeys.instructors.list(), queryKeys.dashboard.revenue(),
  ],
  'payment.retry':         () => [
    queryKeys.transactionsRecent(), queryKeys.finance.dashboard(),
  ],
  'payment.approve':       (ctx) => [
    queryKeys.transactionsRecent(), queryKeys.dashboard.revenue(),
    queryKeys.billing(ctx?.studentId),
    queryKeys.enrollments(ctx?.studentId),
    queryKeys.subscriptions(),
  ],

  // ── §5.14 SUPPORT TICKETS ─────────────────────────────────────────────────
  'ticket.create':   () => [queryKeys.supportTickets(), queryKeys.tasks()],
  'ticket.assign':   () => [queryKeys.supportTickets()],
  'ticket.respond':  () => [queryKeys.supportTickets()],
  'ticket.resolve':  () => [queryKeys.supportTickets()],
  'ticket.escalate': () => [queryKeys.supportTickets()],

  // ── §5.15 INTEGRATIONS ────────────────────────────────────────────────────
  'integration.connect':    () => [queryKeys.integrations(), queryKeys.integrationsStats()],
  'integration.disconnect': () => [queryKeys.integrations(), queryKeys.integrationsStats()],
  'integration.configure':  () => [queryKeys.integrations()],
  'integration.testMode':   () => [queryKeys.integrations()],
  'apiKey.generate':        () => [queryKeys.apiKeys()],
  'apiKey.revoke':          () => [queryKeys.apiKeys()],
  'webhook.create':         () => [queryKeys.webhooks()],
  'webhook.update':         () => [queryKeys.webhooks()],
  'webhook.delete':         () => [queryKeys.webhooks()],
  'webhook.toggle':         () => [queryKeys.webhooks()],
  'sync.run':               () => [queryKeys.integrationsSync(), queryKeys.users.list()],

  // ── §5.16 SYSTEM SETTINGS ─────────────────────────────────────────────────
  'settings.update':      (ctx) => [queryKeys.settings(ctx?.domain)],
  'featureToggle.set':    () => [queryKeys.settings('features')],
  'maintenance.enable':   () => [queryKeys.settings('maintenance')],
  'maintenance.disable':  () => [queryKeys.settings('maintenance')],
  'backup.run':           () => [queryKeys.systemBackups()],
  'backup.restore':       () => [queryKeys.systemBackups()],
  'retention.update':     () => [queryKeys.securityRetention()],
  'settings.restoreVersion': (ctx) => [queryKeys.settings(ctx?.domain)],

  // ── §5.17 SECURITY ACTIONS ────────────────────────────────────────────────
  'securityAlert.resolve': () => [
    queryKeys.securityAlerts(), queryKeys.securityThreats(), queryKeys.securityStats(),
  ],
  'incident.create': () => [queryKeys.securityIncidents(), queryKeys.tasks()],
  'incident.update': () => [queryKeys.securityIncidents()],
  'incident.close':  () => [queryKeys.securityIncidents()],
  'device.block':    () => [queryKeys.securityDevices(), queryKeys.securitySessions()],
  'device.approve':  () => [queryKeys.securityDevices(), queryKeys.securitySessions()],
  'ip.block':        () => [queryKeys.securityIp()],
  'ip.unblock':      () => [queryKeys.securityIp()],
};

// ── Bridge: custom events for raw-fetch consumers ─────────────────────────────
// Dispatches the custom events that current components listen to, derived from
// which query-key domains are being invalidated. Remove per-component as each
// migrates to useQuery + QueryClientProvider.

function dispatchBridgeEvents(keys: QueryKey[]): void {
  const toDispatch = new Set<string>();

  for (const key of keys) {
    const domain = key[0] as string;

    if (domain === 'org') {
      toDispatch.add('organizationUpdated');
      toDispatch.add('userDataChanged');
      toDispatch.add('analyticsUpdated');
    } else if (domain === 'groups') {
      toDispatch.add('groupsUpdated');
      toDispatch.add('userDataChanged');
      toDispatch.add('analyticsUpdated');
    } else if (
      domain === 'roles' || domain === 'role-templates' ||
      domain === 'role-assignments' || domain === 'permission-matrix' ||
      domain === 'policies'
    ) {
      toDispatch.add('rolesUpdated');
      toDispatch.add('analyticsUpdated');
    } else if (
      domain === 'users' || domain === 'admins' ||
      domain === 'students' || domain === 'enrollments' ||
      domain === 'billing' || domain === 'support-tickets'
    ) {
      toDispatch.add('userDataChanged');
      toDispatch.add('analyticsUpdated');
    } else {
      // dashboard, courses, categories, learning-paths, certificates,
      // activity, notifications, approvals, tasks, finance, integrations,
      // settings, security, competencies, instructors, live-sessions, etc.
      toDispatch.add('analyticsUpdated');
    }
  }

  toDispatch.forEach(event => window.dispatchEvent(new CustomEvent(event)));
}

// ── §2 Default keys ───────────────────────────────────────────────────────────

const DEFAULT_KEYS: QueryKey[] = [
  queryKeys.activity(),
  queryKeys.notifications(),
  queryKeys.dashboard.stats(),
];

// ── invalidateFor ─────────────────────────────────────────────────────────────
// The ONLY entry point for cache invalidation. Every mutation calls this.
// Ad-hoc `window.dispatchEvent` in mutation handlers is forbidden after a
// component adopts this function.

export function invalidateFor(
  queryClient: MinimalQueryClient,
  mutationName: MutationName,
  ctx?: MutationCtx,
): void {
  // notification.mark* skip the §2 defaults per IMPACT_MAP §5.12
  const skipDefaults =
    mutationName === 'notification.markRead' ||
    mutationName === 'notification.archive' ||
    mutationName === 'notification.pin';

  const extraKeys = INVALIDATION_MAP[mutationName](ctx);
  const allKeys   = skipDefaults ? extraKeys : [...extraKeys, ...DEFAULT_KEYS];

  // Invalidate in the TanStack QueryClient (no-op in appQueryClient; real
  // when QueryClientProvider + useQuery are wired up).
  allKeys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));

  // Bridge: notify raw-fetch components via custom events during migration.
  dispatchBridgeEvents(allKeys);
}
