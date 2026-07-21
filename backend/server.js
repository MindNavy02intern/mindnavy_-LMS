const express = require("express");
const cors = require("cors");
require("dotenv").config();

const adminRoutes = require("./src/routes/admin.routes");
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

// Public QR verification — the ONLY unauthenticated API surface, by design
// (phones scanning certificate QR codes). Own per-IP rate limiter inside.
app.use("/api/public/certificates", publicCertificatesRoutes);

// File uploads (sign → confirm → delete) for thumbnails (Phase 1).
app.use("/api/admin/uploads", uploadsRoutes);

// Live Sessions (scheduling CRUD — creates real Zoom meetings via the meetings adapter).
app.use("/api/admin/live-sessions", liveSessionsRoutes);

// Enrollments (admin enroll/unenroll/status — built on course_enrollments).
app.use("/api/admin/enrollments", enrollmentsRoutes);

// Content Library (searchable media repository — sign/confirm uploads + metadata).
app.use("/api/admin/content", contentRoutes);

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

server.on("error", (error) => {
  console.error("Server failed to start:", error.message);
  process.exit(1);
});