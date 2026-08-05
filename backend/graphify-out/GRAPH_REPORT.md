# Graph Report - backend  (2026-08-05)

## Corpus Check
- 152 files · ~102,681 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1763 nodes · 3237 edges · 79 communities (74 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `68494ce9`
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

## God Nodes (most connected - your core abstractions)
1. `requireAdminAuth()` - 31 edges
2. `serverError()` - 26 edges
3. `adminUserActionRateLimiter` - 26 edges
4. `validateId()` - 21 edges
5. `badRequest()` - 20 edges
6. `createUserAuditLog()` - 18 edges
7. `serverError()` - 17 edges
8. `invalidateOrgChartCache()` - 16 edges
9. `validateUuidParam()` - 15 edges
10. `coursesReadRateLimiter` - 14 edges

## Surprising Connections (you probably didn't know these)
- `getUsersList()` --calls--> `calcChange()`  [INFERRED]
  src/services/users.service.js → src/services/instructors.service.js
- `createFirstAdmin()` --calls--> `validatePasswordStrength()`  [EXTRACTED]
  src/scripts/createFirstAdmin.js → src/utils/passwordPolicy.js
- `resetFirstAdminPassword()` --calls--> `validatePasswordStrength()`  [EXTRACTED]
  src/scripts/resetFirstAdminPassword.js → src/utils/passwordPolicy.js
- `notifyApplicant()` --calls--> `sendMail()`  [EXTRACTED]
  src/services/instructorApplications.service.js → src/utils/mailer.js
- `requireConfigured()` --calls--> `getProvider()`  [EXTRACTED]
  src/services/uploads.service.js → src/services/storage/index.js

## Communities (79 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (66): adminForgotPasswordController(), adminGetTrustedDevicesController(), adminLoginController(), adminLogoutController(), adminMeController(), adminResetPasswordController(), adminRevokeTrustedDeviceController(), adminSendOtpController() (+58 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (36): author, dependencies, bcryptjs, cors, csv-parse, dotenv, express, express-rate-limit (+28 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (52): assignDepartmentsToBranch(), assignTeamMembers(), assignUsersToDepartment(), badRequest(), conflict(), createBranch(), createDepartment(), createTeam() (+44 more)

### Community 3 - "Community 3"
Cohesion: 0.18
Nodes (6): adapter, prisma, { PrismaClient }, { PrismaPg }, prisma, prisma

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (48): dashboardService, getDashboardAdminWidgets(), getDashboardAnalytics(), getDashboardCore(), getMeetingProvider(), PROVIDERS, zoomProvider, express (+40 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (51): approveVerification(), assignUserRole(), bulkActionUsers(), createUser(), deleteUser(), EMPTY_LIST_RESPONSE, exportUsers(), forceLogoutUser() (+43 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (48): approveVerification(), assertUserExists(), assignUserRole(), bcrypt, bulkActionUsers(), createUser(), createUserAuditLog(), deleteUser() (+40 more)

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, skipLibCheck, strict, target, types, include

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (37): accessPoliciesRoutes, adminRoutes, app, assignmentExpiryTimer, categoriesRoutes, certificatesRoutes, certificateTemplatesRoutes, contentRoutes (+29 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (42): autoExpire(), cancelInvitation(), countPendingInvitations(), { createAuditLog }, listInvitations(), makeError(), mapInvitation(), prisma (+34 more)

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (53): badRequest(), confirm, deleteContent, handleDomainError(), listContent, notFound(), serverError(), sign (+45 more)

### Community 12 - "Community 12"
Cohesion: 0.05
Nodes (47): getCachedSession(), prisma, requireAdminAuth(), SESSION_CACHE, setCachedSession(), adminUserActionRateLimiter, coursesReadRateLimiter, {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
} (+39 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (46): badRequest(), createLesson, createSection, deleteLesson, deleteSection, handleDomainError(), listSections, notFound() (+38 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (41): archiveCourse(), badRequest(), createCourse(), getCourse(), handleDomainError(), listCourses(), notFound(), restoreCourse() (+33 more)

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
Cohesion: 0.08
Nodes (36): badRequest(), conflict(), createInstructor, deleteInstructor, getAnalytics, getInstructor, getStats, handleDomainError() (+28 more)

### Community 19 - "Community 19"
Cohesion: 0.10
Nodes (35): badRequest(), conflict(), createAssignment(), deleteAssignment(), getAssignmentStats(), listAssignments(), notFound(), serverError() (+27 more)

### Community 20 - "Community 20"
Cohesion: 0.12
Nodes (38): assertIsInstructor(), AUDIT_ACTIVITY_TITLE, auditLog(), bcrypt, buildActivityFeed(), buildPerformanceChart(), buildWhere(), calcChange() (+30 more)

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
Cohesion: 0.10
Nodes (29): badRequest(), confirm, handleDomainError(), notFound(), remove, sign, svc, {
  validateSign,
  validateConfirm,
  validateDelete,
} (+21 more)

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
Nodes (27): 1. Basics, 2. Allowed enum values (use these EXACT strings), 3. The Course objects, 4.1 List courses, 4.2 Get one course, 4.3 Create course, 4.4 Update course (edit Basic Info), 4.5 Archive course (soft delete) (+19 more)

### Community 32 - "Community 32"
Cohesion: 0.12
Nodes (25): addItem, badRequest(), createPath, deletePath, getPath, handleDomainError(), listPaths, notFound() (+17 more)

### Community 33 - "Community 33"
Cohesion: 0.09
Nodes (22): adminUsersAnalyticsRateLimiter, publicInstructorApplicationRateLimiter, publicVerifyRateLimiter, rateLimit, {
  adminUserActionRateLimiter,
  adminUsersAnalyticsRateLimiter,
  coursesReadRateLimiter,
}, c, express, { requireAdminAuth } (+14 more)

### Community 34 - "Community 34"
Cohesion: 0.18
Nodes (25): assertTemplateRefExists(), CERT_SELECT, certAuditLog(), createTemplate(), crypto, deleteTemplate(), domainError(), getCertificateForPdf() (+17 more)

### Community 35 - "Community 35"
Cohesion: 0.15
Nodes (24): archiveCourse(), assertInstructorExists(), buildPagination(), courseAuditLog(), createCourse(), FULL_SELECT, getCourse(), iso() (+16 more)

### Community 36 - "Community 36"
Cohesion: 0.13
Nodes (19): APP_USER_ROLES, assignPermissionsToRole(), buildPagination(), createRole(), createRoleAuditLog(), deleteRole(), duplicateRole(), getPermissionMatrix() (+11 more)

### Community 37 - "Community 37"
Cohesion: 0.12
Nodes (19): getMessages(), messagesService, sendMessage(), { validateSendAdminMessageInput }, { adminUserActionRateLimiter }, express, { requireAdminAuth }, router (+11 more)

### Community 38 - "Community 38"
Cohesion: 0.17
Nodes (21): avgCompletionRate(), buildDayBuckets(), buildMonthBuckets(), countWithGrowth(), getActivities(), getContentStats(), getCourses(), getDistribution() (+13 more)

### Community 39 - "Community 39"
Cohesion: 0.19
Nodes (20): badRequest(), getActivities(), getContentStats(), getCourses(), getDistribution(), getFilterOptions(), getLiveSessions(), getProgress() (+12 more)

### Community 40 - "Community 40"
Cohesion: 0.23
Nodes (21): assertCourseExists(), createQuestion(), createQuiz(), deleteQuestion(), deleteQuiz(), domainError(), getQuestionInQuizOrThrow(), getQuiz() (+13 more)

### Community 41 - "Community 41"
Cohesion: 0.21
Nodes (19): addItem(), COURSE_STATUS_LABEL, createPath(), deletePath(), domainError(), getPath(), getPathOrThrow(), iso() (+11 more)

### Community 42 - "Community 42"
Cohesion: 0.22
Nodes (19): APPLICATION_SELECT, approveApplication(), assertOpen(), auditLog(), domainError(), getApplication(), getApplicationRow(), iso() (+11 more)

### Community 43 - "Community 43"
Cohesion: 0.23
Nodes (17): approveCourse(), auditLog(), courseBuilderService, coursesService, domainError(), getCourseOrThrow(), getPreview(), iso() (+9 more)

### Community 44 - "Community 44"
Cohesion: 0.22
Nodes (11): cancel(), invitationsService, list(), resend(), send(), updateExpiration(), { adminUserActionRateLimiter }, express (+3 more)

### Community 45 - "Community 45"
Cohesion: 0.42
Nodes (10): assertMeetingId(), createMeeting(), deleteMeeting(), getAccessToken(), providerError(), timedFetch(), toZoomSchedule(), updateMeeting() (+2 more)

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
Cohesion: 0.42
Nodes (8): createSignedUpload(), getClient(), getPublicUrl(), isConfigured(), objectExists(), removeObject(), splitPath(), statObject()

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
Cohesion: 0.33
Nodes (5): {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
}, c, express, { requireAdminAuth }, router

### Community 57 - "Community 57"
Cohesion: 0.33
Nodes (5): {
  adminUserActionRateLimiter,
  coursesReadRateLimiter,
}, c, express, { requireAdminAuth }, router

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
Cohesion: 0.33
Nodes (5): { adminUserActionRateLimiter }, c, express, { requireAdminAuth }, router

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

## Knowledge Gaps
- **693 isolated node(s):** `name`, `version`, `description`, `main`, `start` (+688 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `requireAdminAuth()` connect `Community 12` to `Community 0`, `Community 33`, `Community 2`, `Community 4`, `Community 37`, `Community 5`, `Community 44`, `Community 15`, `Community 17`, `Community 19`, `Community 62`, `Community 56`, `Community 57`, `Community 58`, `Community 59`, `Community 60`, `Community 61`, `Community 24`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `adminUserActionRateLimiter` connect `Community 12` to `Community 33`, `Community 2`, `Community 37`, `Community 5`, `Community 44`, `Community 15`, `Community 17`, `Community 19`, `Community 62`, `Community 56`, `Community 57`, `Community 58`, `Community 59`, `Community 60`, `Community 61`, `Community 24`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `coursesReadRateLimiter` connect `Community 12` to `Community 33`, `Community 56`, `Community 57`, `Community 58`, `Community 59`, `Community 60`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _693 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05117117117117117 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12525252525252525 - nodes in this community are weakly interconnected._