# Graph Report - backend  (2026-08-07)

## Corpus Check
- 167 files · ~128,929 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2074 nodes · 3615 edges · 95 communities (88 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1dafc11e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]

## God Nodes (most connected - your core abstractions)
1. `requireAdminAuth()` - 31 edges
2. `serverError()` - 26 edges
3. `adminUserActionRateLimiter` - 26 edges
4. `validateId()` - 21 edges
5. `badRequest()` - 20 edges
6. `createUserAuditLog()` - 18 edges
7. `5. ENTITY IMPACT MATRICES` - 18 edges
8. `serverError()` - 17 edges
9. `invalidateOrgChartCache()` - 16 edges
10. `validateUuidParam()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `getUsersList()` --calls--> `calcChange()`  [INFERRED]
  src/services/users.service.js → src/services/instructors.service.js
- `createFirstAdmin()` --calls--> `validatePasswordStrength()`  [EXTRACTED]
  src/scripts/createFirstAdmin.js → src/utils/passwordPolicy.js
- `resetFirstAdminPassword()` --calls--> `validatePasswordStrength()`  [EXTRACTED]
  src/scripts/resetFirstAdminPassword.js → src/utils/passwordPolicy.js
- `requireConfigured()` --calls--> `getProvider()`  [EXTRACTED]
  src/services/content.service.js → src/services/storage/index.js
- `deleteContent()` --calls--> `getProvider()`  [EXTRACTED]
  src/services/content.service.js → src/services/storage/index.js

## Communities (95 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (68): adminForgotPasswordController(), adminGetTrustedDevicesController(), adminLoginController(), adminLogoutController(), adminMeController(), adminResetPasswordController(), adminRevokeTrustedDeviceController(), adminSendOtpController() (+60 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (36): author, dependencies, bcryptjs, cors, csv-parse, dotenv, express, express-rate-limit (+28 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (52): assignDepartmentsToBranch(), assignTeamMembers(), assignUsersToDepartment(), badRequest(), conflict(), createBranch(), createDepartment(), createTeam() (+44 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (7): adapter, prisma, { PrismaClient }, { PrismaPg }, prisma, prisma, prisma

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (58): dashboardService, getDashboardAdminWidgets(), getDashboardAnalytics(), getDashboardCore(), getMeetingProvider(), PROVIDERS, zoomProvider, assertMeetingId() (+50 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (61): approveVerification(), assignUserRole(), bulkActionUsers(), createUser(), deleteUser(), EMPTY_LIST_RESPONSE, exportUsers(), forceLogoutUser() (+53 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (49): approveVerification(), assertUserExists(), assignUserRole(), bcrypt, bulkActionUsers(), createUser(), createUserAuditLog(), deleteUser() (+41 more)

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, skipLibCheck, strict, target, types, include

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (37): accessPoliciesRoutes, adminRoutes, app, assignmentExpiryTimer, categoriesRoutes, certificatesRoutes, certificateTemplatesRoutes, contentRoutes (+29 more)

### Community 9 - "Community 9"
Cohesion: 0.05
Nodes (53): cancel(), invitationsService, list(), resend(), send(), updateExpiration(), { adminUserActionRateLimiter }, express (+45 more)

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (50): badRequest(), confirm, deleteContent, handleDomainError(), listContent, notFound(), serverError(), sign (+42 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (36): getCachedSession(), prisma, requireAdminAuth(), SESSION_CACHE, setCachedSession(), coursesReadRateLimiter, {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
}, c (+28 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (46): badRequest(), createLesson, createSection, deleteLesson, deleteSection, handleDomainError(), listSections, notFound() (+38 more)

### Community 14 - "Community 14"
Cohesion: 0.06
Nodes (60): archiveCourse(), badRequest(), createCourse(), getCourse(), handleDomainError(), listCourses(), notFound(), restoreCourse() (+52 more)

### Community 15 - "Community 15"
Cohesion: 0.11
Nodes (41): assignPermissionsToRole(), badRequest(), createPermission(), createRole(), deletePermission(), deleteRole(), duplicateRole(), getPermission() (+33 more)

### Community 16 - "Community 16"
Cohesion: 0.07
Nodes (39): badRequest(), createTemplate, deleteTemplate, downloadPdf, getTemplate, handleDomainError(), issueCertificate, listCertificates (+31 more)

### Community 17 - "Community 17"
Cohesion: 0.08
Nodes (36): badRequest(), createAccessPolicy(), deleteAccessPolicy(), getAccessPolicy(), getAccessPolicyStats(), listAccessPolicies(), notFound(), serverError() (+28 more)

### Community 18 - "Community 18"
Cohesion: 0.11
Nodes (19): badRequest(), conflict(), createInstructor, deleteInstructor, getAnalytics, getInstructor, getStats, getSuspensionHistory (+11 more)

### Community 19 - "Community 19"
Cohesion: 0.10
Nodes (35): badRequest(), conflict(), createAssignment(), deleteAssignment(), getAssignmentStats(), listAssignments(), notFound(), serverError() (+27 more)

### Community 20 - "Community 20"
Cohesion: 0.11
Nodes (41): assertIsInstructor(), AUDIT_ACTIVITY_TITLE, auditLog(), bcrypt, buildActivityFeed(), buildPerformanceChart(), buildWhere(), calcChange() (+33 more)

### Community 21 - "Community 21"
Cohesion: 0.05
Nodes (36): 1. GET /api/admin/courses, 1. `GET /lm/stats` — KPI cards (6), 2. GET /api/admin/courses/:id, 2. `GET /lm/distribution` — Course distribution donut, 3. `GET /lm/progress` — Learning progress line chart, 3. POST /api/admin/courses, 4. `GET /lm/top-courses` — Top performing courses, 4. PATCH /api/admin/courses/:id (+28 more)

### Community 22 - "Community 22"
Cohesion: 0.10
Nodes (32): badRequest(), createEnrollment, deleteEnrollment, handleDomainError(), listEnrollments, notFound(), serverError(), svc (+24 more)

### Community 23 - "Community 23"
Cohesion: 0.11
Nodes (33): badRequest(), createQuestion, createQuiz, deleteQuestion, deleteQuiz, getQuiz, handleDomainError(), listQuizzes (+25 more)

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (32): applyRoleTemplate(), badRequest(), createRoleTemplate(), deleteRoleTemplate(), getRoleTemplate(), invalidPermissions(), listRoleTemplates(), notFound() (+24 more)

### Community 25 - "Community 25"
Cohesion: 0.06
Nodes (62): badRequest(), confirm, handleDomainError(), notFound(), remove, sign, svc, {
  validateSign,
  validateConfirm,
  validateDelete,
} (+54 more)

### Community 26 - "Community 26"
Cohesion: 0.14
Nodes (30): badRequest(), createCategory(), deleteCategory(), handleDomainError(), listCategories(), notFound(), serverError(), svc (+22 more)

### Community 27 - "Community 27"
Cohesion: 0.12
Nodes (27): addMembers(), badRequest(), createGroup(), deleteGroup(), getGroup(), getGroupMembers(), listGroups(), normalizeGroupStatus() (+19 more)

### Community 28 - "Community 28"
Cohesion: 0.11
Nodes (28): badRequest(), createSession, deleteSession, endSession, getSession, handleDomainError(), listSessions, notFound() (+20 more)

### Community 29 - "Community 29"
Cohesion: 0.07
Nodes (29): 1. Basics, 2. Allowed enum values (use these EXACT strings), 3. The Policy object (what every endpoint returns), 4.1 List policies, 4.2 Stats (for the header / stat cards), 4.3 Get one policy, 4.4 Create policy, 4.5 Update policy (+21 more)

### Community 30 - "Community 30"
Cohesion: 0.11
Nodes (26): approveApplication, conflict(), getApplication, handleDomainError(), listApplications, notFound(), PUBLIC_ACK, rejectApplication (+18 more)

### Community 31 - "Community 31"
Cohesion: 0.07
Nodes (31): 1. Basics, 2. Allowed enum values (use these EXACT strings), 3. The Course objects, 4.1 List courses, 4.2 Get one course, 4.3 Create course, 4.4 Update course (edit Basic Info), 4.5 Archive course (soft delete) (+23 more)

### Community 32 - "Community 32"
Cohesion: 0.12
Nodes (25): addItem, badRequest(), createPath, deletePath, getPath, handleDomainError(), listPaths, notFound() (+17 more)

### Community 33 - "Community 33"
Cohesion: 0.10
Nodes (19): adminLoginRateLimiter, otpRequestRateLimiter, publicInstructorApplicationRateLimiter, publicVerifyRateLimiter, rateLimit, {
  adminLoginController,
  adminMeController,
  adminLogoutController,
  adminSendOtpController,
  adminVerifyOtpController,
  adminGetTrustedDevicesController,
  adminRevokeTrustedDeviceController,
  adminForgotPasswordController,
  adminResetPasswordController,

}, { adminLoginRateLimiter }, { adminLoginRateLimiter, otpRequestRateLimiter } (+11 more)

### Community 34 - "Community 34"
Cohesion: 0.18
Nodes (25): assertTemplateRefExists(), CERT_SELECT, certAuditLog(), createTemplate(), crypto, deleteTemplate(), domainError(), getCertificateForPdf() (+17 more)

### Community 35 - "Community 35"
Cohesion: 0.13
Nodes (26): archiveCourse(), assertInstructorExists(), buildPagination(), courseAuditLog(), createCourse(), FULL_SELECT, getCourse(), iso() (+18 more)

### Community 36 - "Community 36"
Cohesion: 0.13
Nodes (19): APP_USER_ROLES, assignPermissionsToRole(), buildPagination(), createRole(), createRoleAuditLog(), deleteRole(), duplicateRole(), getPermissionMatrix() (+11 more)

### Community 37 - "Community 37"
Cohesion: 0.28
Nodes (7): getMessages(), messagesService, sendMessage(), { validateSendAdminMessageInput }, VALID_PRIORITIES, VALID_TYPES, validateSendAdminMessageInput()

### Community 38 - "Community 38"
Cohesion: 0.09
Nodes (41): badRequest(), getActivities(), getContentStats(), getCourses(), getDistribution(), getFilterOptions(), getLiveSessions(), getProgress() (+33 more)

### Community 39 - "Community 39"
Cohesion: 0.06
Nodes (30): 1. AGENT PROTOCOL — follow on EVERY task, 2. DEFAULT INVALIDATION POLICY, 3. QUERY KEY REGISTRY (canonical), 4. SURFACE REGISTRY, 4a. Dashboard Overview widgets (from admin doc, Dashboard §3–§21), 4b. Dropdowns & selects (R2 — each one is a surface of its source entity), 4c. Instructors module surfaces (blueprint 05 — backend built 2026-08-03), 5.10 CROSS-CUTTING SINKS (write-only from mutations) (+22 more)

### Community 40 - "Community 40"
Cohesion: 0.23
Nodes (21): assertCourseExists(), createQuestion(), createQuiz(), deleteQuestion(), deleteQuiz(), domainError(), getQuestionInQuizOrThrow(), getQuiz() (+13 more)

### Community 41 - "Community 41"
Cohesion: 0.21
Nodes (19): addItem(), COURSE_STATUS_LABEL, createPath(), deletePath(), domainError(), getPath(), getPathOrThrow(), iso() (+11 more)

### Community 42 - "Community 42"
Cohesion: 0.07
Nodes (27): 1. Get a signed upload URL, 1. List a course's sections (with lessons), 2. Create a section, 2. Upload the file (direct to storage — not our API), 3. Confirm the upload, 3. Update a section, 4. Delete a section (cascade), 4. Delete an orphaned/replaced file (+19 more)

### Community 43 - "Community 43"
Cohesion: 0.15
Nodes (22): CREATABLE_STATUSES, FOREIGN_FIELDS, MAX, pickDefined(), readEmail(), readInt(), readProfileFields(), readSkills() (+14 more)

### Community 44 - "Community 44"
Cohesion: 0.09
Nodes (21): 10 · Download PDF, 11 · Verify by code — **no auth, no token header**, 1 · List templates, 2 · Template detail, 3 · Create template, 4 · Update template, 5 · Delete template, 6 · List issued certificates (+13 more)

### Community 45 - "Community 45"
Cohesion: 0.09
Nodes (21): code:ts (export type CourseVisibility = 'Public' | 'Private' | 'Unlis), code:ts (export interface Category {), Course ↔ category linking (migration), Course Wizard (Steps 4–6) + Approval + Categories — API Contract v1, `DELETE /categories/:id`, `GET /categories`, `GET /courses/:id/preview`, Part 1 — Course detail additions (GET /courses/:id) (+13 more)

### Community 46 - "Community 46"
Cohesion: 0.20
Nodes (8): BRANCH_NAME_PREFIXES, DEPARTMENT_PREFIXES, GROUP_NAME_PREFIXES, ROLE_NAME_PREFIXES, TEAM_NAME_PREFIXES, USER_EMAIL_PREFIXES, USER_NAME_PREFIXES, USER_WHERE

### Community 47 - "Community 47"
Cohesion: 0.36
Nodes (9): BASE, call(), email(), main(), ok(), publicReq(), report(), req() (+1 more)

### Community 48 - "Community 48"
Cohesion: 0.25
Nodes (8): adapter, line(), main(), prisma, { PrismaClient }, { PrismaPg }, REAL_ROLE_NAMES, REAL_TEMPLATE_NAMES

### Community 49 - "Community 49"
Cohesion: 0.33
Nodes (7): BASE, { ensureLibraryBucket }, main(), ok(), PDF_BYTES, req(), ensureLibraryBucket()

### Community 50 - "Community 50"
Cohesion: 0.11
Nodes (18): 1 · List quizzes, 2 · Quiz detail (with ordered questions), 3 · Create quiz, 4 · Update quiz, 5 · Delete quiz, 6 · Add question, 7 · Update question, 8 · Delete question (+10 more)

### Community 51 - "Community 51"
Cohesion: 0.25
Nodes (6): adapter, isConfirmed, prisma, { PrismaClient }, { PrismaPg }, REAL_TEMPLATE_NAMES

### Community 52 - "Community 52"
Cohesion: 0.25
Nodes (6): adapter, isConfirmed, prisma, { PrismaClient }, { PrismaPg }, PROTECTED_NAMES

### Community 53 - "Community 53"
Cohesion: 0.29
Nodes (7): countReferencing(), crypto, DEPENDENT_TABLES, main(), path, prisma, TARGET_IDS

### Community 54 - "Community 54"
Cohesion: 0.29
Nodes (5): prisma, TEST_COURSE_PREFIXES, TEST_EMAIL_PREFIXES, TEST_GROUP_PREFIXES, TEST_ROLE_PREFIXES

### Community 55 - "Community 55"
Cohesion: 0.33
Nodes (4): PERMISSIONS, prisma, ROLE_TEMPLATES, ROLES

### Community 56 - "Community 56"
Cohesion: 0.11
Nodes (18): code:jsonc (// 409), code:jsonc ({ "success": true, "data": {), code:jsonc ({ "success": true, "data": {), code:jsonc ({ "success": true, "data": {), code:jsonc ({), code:jsonc ({), code:jsonc ({ "success": true, "data": {), `DELETE /api/admin/instructors/:id` (+10 more)

### Community 57 - "Community 57"
Cohesion: 0.11
Nodes (17): 1 · List paths, 2 · Path detail (with ordered items), 3 · Create path, 4 · Update path, 5 · Delete path, 6 · Add item, 7 · Remove item, 8 · Reorder (bulk — the drag-and-drop endpoint) (+9 more)

### Community 58 - "Community 58"
Cohesion: 0.33
Nodes (5): {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
}, c, express, { requireAdminAuth }, router

### Community 59 - "Community 59"
Cohesion: 0.33
Nodes (5): {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
}, c, express, { requireAdminAuth }, router

### Community 60 - "Community 60"
Cohesion: 0.33
Nodes (5): {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
}, c, express, { requireAdminAuth }, router

### Community 61 - "Community 61"
Cohesion: 0.33
Nodes (5): { adminUserActionRateLimiter }, express, {
  getPermissionMatrix, togglePermissionMatrixCell,
}, { requireAdminAuth }, router

### Community 62 - "Community 62"
Cohesion: 0.11
Nodes (16): adminUserActionRateLimiter, { adminUserActionRateLimiter }, ctrl, express, { requireAdminAuth }, router, { adminUserActionRateLimiter }, express (+8 more)

### Community 63 - "Community 63"
Cohesion: 0.53
Nodes (5): BASE, main(), ok(), req(), reqPublic()

### Community 64 - "Community 64"
Cohesion: 0.60
Nodes (5): BASE, createSubmittableCourse(), main(), ok(), req()

### Community 65 - "Community 65"
Cohesion: 0.33
Nodes (4): adapter, prisma, { PrismaClient }, { PrismaPg }

### Community 66 - "Community 66"
Cohesion: 0.53
Nodes (5): BASE, inOneHour(), main(), ok(), req()

### Community 67 - "Community 67"
Cohesion: 0.47
Nodes (5): BASE, main(), ok(), PNG_1x1, req()

### Community 68 - "Community 68"
Cohesion: 0.60
Nodes (4): BASE, main(), ok(), req()

### Community 69 - "Community 69"
Cohesion: 0.60
Nodes (4): BASE, main(), ok(), req()

### Community 70 - "Community 70"
Cohesion: 0.60
Nodes (4): BASE, main(), ok(), req()

### Community 71 - "Community 71"
Cohesion: 0.60
Nodes (4): BASE, main(), ok(), req()

### Community 72 - "Community 72"
Cohesion: 0.60
Nodes (4): BASE, main(), ok(), req()

### Community 73 - "Community 73"
Cohesion: 0.40
Nodes (3): crypto, path, prisma

### Community 76 - "Community 76"
Cohesion: 0.16
Nodes (14): archiveDocument, badRequest(), confirmUpload, handleDomainError(), listDocuments, notFound(), rejectDocument, serverError() (+6 more)

### Community 77 - "Community 77"
Cohesion: 0.14
Nodes (14): code:ts (export type DocumentType   = 'IDENTITY' | 'CONTRACT' | 'AGRE), code:jsonc ({ "success": true, "data": { "documents": [ /* InstructorDoc), code:jsonc ({ "fileName": "passport.pdf", "fileType": "application/pdf",), code:jsonc ({ "path": "<the path from step 1>", "fileName": "passport.pd), code:jsonc ({ "reason": "Illegible scan." }   // REQUIRED, ≥3 chars → 40), `DELETE …/documents/:docId` — **soft**, Documents, ⚠️ `downloadUrl` expires — do not cache it (+6 more)

### Community 79 - "Community 79"
Cohesion: 0.14
Nodes (12): adminUsersAnalyticsRateLimiter, {
  adminUserActionRateLimiter,
  adminUsersAnalyticsRateLimiter,
  coursesReadRateLimiter,
}, c, docs, express, { requireAdminAuth }, router, { adminUsersAnalyticsRateLimiter } (+4 more)

### Community 80 - "Community 80"
Cohesion: 0.17
Nodes (11): code:ts (export type ContentType =), code:jsonc ({ "fileName": "Report.pdf", "fileType": "application/pdf" }), code:jsonc ({), Content Library — API Contract v1, `DELETE /:id` — remove item + its stored file, Endpoints, `GET /` — list (paginated, newest first), `PATCH /:id` — metadata only (+3 more)

### Community 81 - "Community 81"
Cohesion: 0.29
Nodes (11): ALLOWED_MIME, DOCUMENT_STATUSES, DOCUMENT_TYPES, isNonEmptyString(), MAX, readExpiresAt(), readType(), validateConfirm() (+3 more)

### Community 82 - "Community 82"
Cohesion: 0.18
Nodes (10): code:ts (export type EnrollmentStatus = 'NOT_STARTED' | 'IN_PROGRESS'), code:jsonc ({ "courseId": "<uuid>", "userId": "<uuid>" }   // both requi), code:jsonc ({ "status": "COMPLETED" }   // the ONLY accepted field), `DELETE /:id` — unenroll, Endpoints, Enrollments — API Contract v1, `GET /` — list (paginated, newest first), `PATCH /:id` — status only (+2 more)

### Community 83 - "Community 83"
Cohesion: 0.18
Nodes (10): code:ts (export type LiveSessionStatus = 'UPCOMING' | 'LIVE' | 'ENDED), code:jsonc ({), `DELETE /:id` — cancel, Endpoints, `GET /:id` — detail, `GET /` — list (max 500, newest `startTime` first), Live Sessions — API Contract v1, `PATCH /:id` — edit (+2 more)

### Community 84 - "Community 84"
Cohesion: 0.20
Nodes (10): Applications, code:jsonc ({ "success": true, "data": {), code:jsonc ({ "success": true, "message": "Application approved — instru), code:jsonc ({ "success": true, "message": "Your application has been rec), `GET /api/admin/instructor-applications`, `GET /api/admin/instructor-applications/:id` → `InstructorApplication`, `PATCH …/:id/approve`, `PATCH …/:id/reject` (+2 more)

### Community 85 - "Community 85"
Cohesion: 0.20
Nodes (9): code:ts (// Same lowercase vocabulary the Users module already return), code:block19 (node src/scripts/ensureInstructorDocsBucket.js), Error codes, Instructors & Applications — API Contract v1, Known gaps — decisions for Hassan, not bugs, Mutation IDs to add to `invalidation.ts` + IMPACT_MAP §5.3, ⚠️ Read these five notes before building, Setup note for other environments (+1 more)

### Community 86 - "Community 86"
Cohesion: 0.39
Nodes (7): createUserAuditLog(), getAdminMessages(), makeError(), mapMessage(), MESSAGE_SELECT, prisma, sendAdminMessage()

### Community 87 - "Community 87"
Cohesion: 0.29
Nodes (6): Backend work (Hassan), code:block1 (mindnavy LMS/), Frontend work (Bilal), Mandatory references (both people), MindNavy LMS — Monorepo Root, Structure

### Community 88 - "Community 88"
Cohesion: 0.33
Nodes (5): {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
}, c, express, { requireAdminAuth }, router

### Community 89 - "Community 89"
Cohesion: 0.33
Nodes (5): {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
}, c, express, { requireAdminAuth }, router

### Community 90 - "Community 90"
Cohesion: 0.33
Nodes (5): {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
}, c, express, { requireAdminAuth }, router

## Knowledge Gaps
- **869 isolated node(s):** `name`, `version`, `description`, `main`, `start` (+864 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `requireAdminAuth()` connect `Community 12` to `Community 33`, `Community 2`, `Community 4`, `Community 90`, `Community 5`, `Community 9`, `Community 79`, `Community 15`, `Community 17`, `Community 19`, `Community 24`, `Community 88`, `Community 89`, `Community 58`, `Community 59`, `Community 60`, `Community 61`, `Community 62`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `adminUserActionRateLimiter` connect `Community 62` to `Community 33`, `Community 2`, `Community 90`, `Community 5`, `Community 9`, `Community 12`, `Community 79`, `Community 15`, `Community 17`, `Community 19`, `Community 88`, `Community 89`, `Community 58`, `Community 59`, `Community 60`, `Community 61`, `Community 24`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `coursesReadRateLimiter` connect `Community 12` to `Community 33`, `Community 90`, `Community 79`, `Community 88`, `Community 89`, `Community 58`, `Community 59`, `Community 60`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _869 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.055905220288781934 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12525252525252525 - nodes in this community are weakly interconnected._