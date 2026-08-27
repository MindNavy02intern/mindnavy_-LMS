const express = require("express");
const cors = require("cors");
require("dotenv").config();

const adminRoutes = require("./src/routes/admin.routes");
const instructorAuthRoutes = require("./src/routes/instructorAuth.routes");
const instructorDashboardRoutes = require("./src/routes/instructorDashboard.routes");
const instructorProfileRoutes = require("./src/routes/instructorProfile.routes");
const instructorCoursesRoutes = require("./src/routes/instructorCourses.routes");
const instructorLiveSessionsRoutes = require("./src/routes/instructorLiveSessions.routes");
const mfaRoutes = require("./src/routes/mfa.routes");
const dashboardRoutes = require("./src/routes/dashboard.routes");
const usersRoutes = require("./src/routes/users.routes");
const organizationRoutes = require("./src/routes/organization.routes");
const rolesRoutes = require("./src/routes/roles.routes");
const permissionsRoutes = require("./src/routes/permissions.routes");
const permissionMatrixRoutes = require("./src/routes/permissionMatrix.routes");
const roleTemplatesRoutes = require("./src/routes/roleTemplates.routes");
const userRoleAssignmentsRoutes = require("./src/routes/userRoleAssignments.routes");
const { expireNow: expireRoleAssignments } = require("./src/services/userRoleAssignments.service");
const accessPoliciesRoutes = require("./src/routes/accessPolicies.routes");
const companyRolesRoutes = require("./src/routes/companyRoles.routes");
const delegatedAdminsRoutes = require("./src/routes/delegatedAdmins.routes");
const groupsRoutes       = require("./src/routes/groups.routes");
const invitationsRoutes  = require("./src/routes/invitations.routes");
const messagesRoutes     = require("./src/routes/messages.routes");
const lmRoutes           = require("./src/routes/lm.routes");
const coursesRoutes      = require("./src/routes/courses.routes");
const courseBuilderRoutes = require("./src/routes/courseBuilder.routes");
const courseWorkflowRoutes = require("./src/routes/courseWorkflow.routes");
const categoriesRoutes   = require("./src/routes/categories.routes");
const learningPathsRoutes = require("./src/routes/learningPaths.routes");
const quizzesRoutes      = require("./src/routes/quizzes.routes");
const certificateTemplatesRoutes = require("./src/routes/certificateTemplates.routes");
const certificatesRoutes = require("./src/routes/certificates.routes");
const publicCertificatesRoutes = require("./src/routes/publicCertificates.routes");
const uploadsRoutes      = require("./src/routes/uploads.routes");
const liveSessionsRoutes = require("./src/routes/liveSessions.routes");
const enrollmentsRoutes  = require("./src/routes/enrollments.routes");
const contentRoutes      = require("./src/routes/content.routes");
const instructorsRoutes  = require("./src/routes/instructors.routes");
const instructorApplicationsRoutes = require("./src/routes/instructorApplications.routes");
const publicInstructorApplicationsRoutes = require("./src/routes/publicInstructorApplications.routes");
const learnersRoutes     = require("./src/routes/learners.routes");
const competenciesRoutes = require("./src/routes/competencies.routes");
const reportsRoutes      = require("./src/routes/reports.routes");
const scheduledReportsRoutes = require("./src/routes/scheduledReports.routes");
const financeRoutes      = require("./src/routes/finance.routes");
const notificationsRoutes = require("./src/routes/notifications.routes");
const integrationsRoutes = require("./src/routes/integrations.routes");
const settingsRoutes = require("./src/routes/settings.routes");
const trackRoutes = require("./src/routes/track.routes");
const { blockDuringMaintenance } = require("./src/middlewares/maintenanceMode.middleware");
const { runDueReports: runDueScheduledReports } = require("./src/services/scheduledReports.service");
const { sendDueAnnouncements, retryPendingDeliveries } = require("./src/services/notifications.service");
const { checkExpiringSubscriptions } = require("./src/services/finance.service");

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
const corsOptions = {
  origin: /^http:\/\/localhost(:\d+)?$/,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json({ limit: "50kb" }));

// Health check route
app.get("/", (req, res) => {
  res.send("Server is running smoothly!");
});

// Admin routes
app.use("/api/admin", adminRoutes);
app.use("/api/instructor/auth", instructorAuthRoutes);
app.use("/api/instructor/dashboard", instructorDashboardRoutes);
app.use("/api/instructor/profile", instructorProfileRoutes);
app.use("/api/instructor/courses", instructorCoursesRoutes);
app.use("/api/instructor/live-sessions", instructorLiveSessionsRoutes);
app.use("/api/admin/auth/mfa", mfaRoutes);

// Dashboard routes
app.use("/api/admin/dashboard", dashboardRoutes);

// Learning Management (Overview tab) routes
app.use("/api/admin/lm", lmRoutes);

// Courses tab routes
app.use("/api/admin/courses", coursesRoutes);

// Course Builder (Step 2 — sections & lessons). Mounted at /api/admin because its
// paths span /courses/:id/sections, /sections/:id and /lessons/:id. courses.routes
// above only matches single-segment /:id, so these fall through to here.
app.use("/api/admin", courseBuilderRoutes);

// Course Wizard workflow (Steps 4–6 + approval): /courses/:id/settings, /preview,
// /submit, /approve, /reject — two-segment paths, same fall-through as above.
app.use("/api/admin", courseWorkflowRoutes);

// Categories (Category Management Center — 2-level hierarchy).
app.use("/api/admin/categories", categoriesRoutes);

// Learning Paths (ordered bundles of courses + live sessions).
app.use("/api/admin/learning-paths", learningPathsRoutes);

// Quizzes & Exams (assessment builder — quizzes + questions + reorder).
app.use("/api/admin/quizzes", quizzesRoutes);

// Certificates (templates + issued certificates + PDF download).
app.use("/api/admin/certificate-templates", certificateTemplatesRoutes);
app.use("/api/admin/certificates", certificatesRoutes);

// Unauthenticated API surfaces — exactly two, both deliberate, each with its own
// per-IP rate limiter and a minimal response that leaks nothing:
//   • certificate verification (phones scanning QR codes) — read only
//   • the public "Become Instructor" form — write only, no read counterpart
app.use("/api/public/certificates", blockDuringMaintenance, publicCertificatesRoutes);
app.use("/api/public/instructor-applications", blockDuringMaintenance, publicInstructorApplicationsRoutes);

// Email open/click tracking (self-hosted, no 3rd party — DEFERRED_ITEMS.md).
// Deliberately NOT behind blockDuringMaintenance: a pixel/redirect firing in
// an already-sent email shouldn't 503 just because maintenance mode is on.
app.use("/api/track", trackRoutes);

// File uploads (sign → confirm → delete) for thumbnails (Phase 1).
app.use("/api/admin/uploads", uploadsRoutes);

// Live Sessions (scheduling CRUD — creates real Zoom meetings via the meetings adapter).
app.use("/api/admin/live-sessions", liveSessionsRoutes);

// Enrollments (admin enroll/unenroll/status — built on course_enrollments).
app.use("/api/admin/enrollments", enrollmentsRoutes);

// Content Library (searchable media repository — sign/confirm uploads + metadata).
app.use("/api/admin/content", contentRoutes);

// Instructors (AppUser role=INSTRUCTOR + profile side table) and the
// "Become Instructor" review queue.
app.use("/api/admin/instructors", instructorsRoutes);
app.use("/api/admin/instructor-applications", instructorApplicationsRoutes);

// Learners (AppUser role=LEARNER + profile side table). Mirrors Instructors.
app.use("/api/admin/learners", learnersRoutes);

// Competencies (Skills, Skill Categories, Frameworks, Skill Profiles,
// Assessments — Skill<->Course mappings).
app.use("/api/admin/competencies", competenciesRoutes);

// Reports & Analytics (cross-module read-only aggregation — reuses existing
// services' getStats()/getAnalytics() where they own a metric, fresh
// aggregation only where nothing else defines it yet; see REPORTS_CONTRACT.md).
app.use("/api/admin/reports", reportsRoutes);

// Scheduled Reports CRUD (separate router — see scheduledReports.routes.js
// header note on why this isn't inline in reports.routes.js).
app.use("/api/admin/reports/scheduled", scheduledReportsRoutes);

// Finance (Payments, Subscriptions, Invoices, Transactions, Refunds,
// Instructor Payouts, Coupons, Tax Rules, Billing Settings — see
// FINANCE_CONTRACT.md). No real payment gateway yet — data models + UI only.
app.use("/api/admin/finance", financeRoutes);

// Notifications (Templates, Announcements, Automations, delivery logs,
// per-user preferences, emergency alerts — see NOTIFICATIONS_CONTRACT.md).
// The existing topbar bell / Dashboard Notifications widget is untouched —
// this is the separate admin management module (blueprint 10).
app.use("/api/admin/notifications", notificationsRoutes);

// Integrations (registry over Zoom/Supabase/SMTP + a COMING_SOON catalog,
// API keys, webhooks, logs, data syncs — see INTEGRATIONS_CONTRACT.md).
// Reuses the existing meetings/zoomProvider and storage/supabaseProvider
// adapters; never reimplements their auth.
app.use("/api/admin/integrations", integrationsRoutes);

// System Settings (single-row platform config, maintenance mode, backup/
// restore, per-field config log trail — see SYSTEM_SETTINGS_CONTRACT.md).
app.use("/api/admin/system-settings", settingsRoutes);

// User management routes
app.use("/api/admin/users", usersRoutes);

// Organization structure routes
app.use("/api/admin/organization", organizationRoutes);

// Roles & Permissions routes
app.use("/api/admin/roles", rolesRoutes);
app.use("/api/admin/permissions", permissionsRoutes);
app.use("/api/admin/permission-matrix", permissionMatrixRoutes);
app.use("/api/admin/role-templates", roleTemplatesRoutes);
app.use("/api/admin/user-role-assignments", userRoleAssignmentsRoutes);
app.use("/api/admin/access-policies", accessPoliciesRoutes);
app.use("/api/admin/company-roles", companyRolesRoutes);
app.use("/api/admin/delegated-admins", delegatedAdminsRoutes);

// Groups routes
app.use("/api/admin/groups", groupsRoutes);

// Invitations routes
app.use("/api/admin/invitations", invitationsRoutes);

// Messages routes
app.use("/api/admin/messages", messagesRoutes);

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found.",
  });
});

app.use((error, req, res, next) => {
  console.error("Server error:", error.message);

  return res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

const server = app.listen(PORT, () => {
  console.log(`Server is alive on http://localhost:${PORT}`);
});

// Background job: auto-expire temporary/emergency role assignments whose
// expiry has passed (flips ACTIVE → EXPIRED). One bounded updateMany every
// 5 minutes; errors are swallowed inside expireRoleAssignments so a DB hiccup
// can never crash the server. .unref() lets the process exit cleanly in tests.
const ASSIGNMENT_EXPIRY_INTERVAL_MS = 5 * 60 * 1000;
const assignmentExpiryTimer = setInterval(() => {
  expireRoleAssignments().catch(() => {});
}, ASSIGNMENT_EXPIRY_INTERVAL_MS);
assignmentExpiryTimer.unref();

// Background job: send every ACTIVE scheduled report whose nextRunAt has
// passed (generates the file, emails recipients, logs to AuditLog). Same
// setInterval + .unref() convention as the role-expiry sweep above — no
// node-cron dependency in this codebase. Errors are swallowed per-report
// inside runDueReports() itself, so a bad send can never crash this timer.
const SCHEDULED_REPORTS_INTERVAL_MS = 60 * 60 * 1000;
const scheduledReportsTimer = setInterval(() => {
  runDueScheduledReports().catch((err) => console.error("[scheduledReports] sweep failed:", err.message));
}, SCHEDULED_REPORTS_INTERVAL_MS);
scheduledReportsTimer.unref();

// Background job: send every SCHEDULED announcement whose scheduledAt has
// passed. Same setInterval + .unref() convention as the two sweeps above —
// checked more often (5 min) since announcements are a more time-sensitive
// surface than reports.
const ANNOUNCEMENTS_SWEEP_INTERVAL_MS = 5 * 60 * 1000;
const announcementsSweepTimer = setInterval(() => {
  sendDueAnnouncements().catch((err) => console.error("[notifications] scheduled sweep failed:", err.message));
}, ANNOUNCEMENTS_SWEEP_INTERVAL_MS);
announcementsSweepTimer.unref();

// Background job: retry EMAIL deliveries logged PENDING for BATCH_CAP
// (EMAIL_BLAST_CAP overflow) or QUIET_HOURS (deferred send) reasons. Same
// 5-minute cadence as the announcements sweep — see retryPendingDeliveries'
// own header note in notifications.service.js for why NOT_CONFIGURED rows
// are excluded from this sweep.
const DELIVERY_RETRY_INTERVAL_MS = 5 * 60 * 1000;
const deliveryRetryTimer = setInterval(() => {
  retryPendingDeliveries().catch((err) => console.error("[notifications] delivery retry sweep failed:", err.message));
}, DELIVERY_RETRY_INTERVAL_MS);
deliveryRetryTimer.unref();

// Background job: flip Subscription{status:ACTIVE, endDate<=now} to EXPIRED
// and fire the SUBSCRIPTION_EXPIRY automation trigger for each (nothing else
// in this codebase ever transitions a subscription to EXPIRED — see
// finance.service.js's checkExpiringSubscriptions header note). Checked
// hourly, same cadence as the scheduled-reports sweep — expiry isn't a
// minute-sensitive event the way announcements/OTP are.
const SUBSCRIPTION_EXPIRY_INTERVAL_MS = 60 * 60 * 1000;
const subscriptionExpiryTimer = setInterval(() => {
  checkExpiringSubscriptions().catch((err) => console.error("[finance] subscription expiry sweep failed:", err.message));
}, SUBSCRIPTION_EXPIRY_INTERVAL_MS);
subscriptionExpiryTimer.unref();

server.on("error", (error) => {
  console.error("Server failed to start:", error.message);
  process.exit(1);
});