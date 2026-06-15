# Graph Report - mindnavy LMS  (2026-06-15)

## Corpus Check
- 117 files · ~115,112 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1182 nodes · 1998 edges · 60 communities (54 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b172bb7c`
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
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
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
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]

## God Nodes (most connected - your core abstractions)
1. `serverError()` - 26 edges
2. `orgFetch()` - 26 edges
3. `validateId()` - 21 edges
4. `getStoredToken()` - 21 edges
5. `badRequest()` - 20 edges
6. `compilerOptions` - 17 edges
7. `useAuth()` - 17 edges
8. `compilerOptions` - 16 edges
9. `serverError()` - 13 edges
10. `createUserAuditLog()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `ProtectedRoute()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/routes/ProtectedRoute.tsx → frontend/src/AuthContext.tsx
- `apiCall()` --calls--> `getStoredToken()`  [EXTRACTED]
  frontend/src/api/rolesPermissions.ts → frontend/src/api/adminAuth.ts
- `resetUserPassword()` --calls--> `validateUuidParam()`  [EXTRACTED]
  backend/src/controllers/users.controller.js → backend/src/validators/users.validator.js
- `createFirstAdmin()` --calls--> `validatePasswordStrength()`  [EXTRACTED]
  backend/src/scripts/createFirstAdmin.js → backend/src/utils/passwordPolicy.js
- `resetFirstAdminPassword()` --calls--> `validatePasswordStrength()`  [EXTRACTED]
  backend/src/scripts/resetFirstAdminPassword.js → backend/src/utils/passwordPolicy.js

## Communities (60 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.15
Nodes (11): getPasswordStrength(), PasswordStrengthMeter(), REQUIREMENTS, Props, ResetPasswordForm(), PasswordChecks, PasswordResetConfirm, PasswordResetRequest (+3 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (6): NAV, NAV_SECTIONS, NavItem, NavSection, Props, QA_TOPBAR_ACTIONS

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (22): apiCall(), authHeaders(), delay(), getTrustedDevices(), MOCK_DEVICES, mockDeviceStore, revokeDevice(), sendOtp() (+14 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (31): author, dependencies, bcryptjs, cors, csv-parse, dotenv, express, express-rate-limit (+23 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (29): dependencies, bootstrap, react, react-dom, react-router-dom, recharts, @supabase/supabase-js, devDependencies (+21 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (45): adminForgotPasswordController(), adminGetTrustedDevicesController(), adminLoginController(), adminLogoutController(), adminMeController(), adminResetPasswordController(), adminRevokeTrustedDeviceController(), adminSendOtpController() (+37 more)

### Community 6 - "Community 6"
Cohesion: 0.03
Nodes (27): ACTIVITY_ICON_BG, ACTIVITY_ICON_COLOR, AVATAR_COLORS, CALENDAR_COLOR, CHART_COMPLETED, CHART_ENROLLED, CHART_LABELS, COMPLETION_COURSES (+19 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (21): approveVerification(), assignUserRole(), bulkActionUsers(), deleteUser(), EMPTY_LIST_RESPONSE, getUserDetails(), getUsersAnalytics(), getUsersList() (+13 more)

### Community 10 - "Community 10"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, skipLibCheck, strict, target, types, include

### Community 11 - "Community 11"
Cohesion: 0.33
Nodes (5): code:js (export default defineConfig([), code:js (// eslint.config.js), Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 19 - "Community 19"
Cohesion: 0.06
Nodes (49): adminRoutes, app, cors, corsOptions, dashboardRoutes, express, organizationRoutes, permissionsRoutes (+41 more)

### Community 20 - "Community 20"
Cohesion: 0.10
Nodes (11): UserStatus, AVATAR_PALETTES, ColKey, COLUMNS, loadVisibleCols(), Props, sk(), SkeletonRow() (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.04
Nodes (54): ActivityItem, ActivityType, AdminWidgetsFilters, AiInsightItem, AlertSeverity, AlertStatus, AnalyticsFilters, ApprovalPriority (+46 more)

### Community 22 - "Community 22"
Cohesion: 0.16
Nodes (14): getStoredToken(), ADMIN_WIDGETS_MOCK, AdminWidgetsParams, ANALYTICS_MOCK, AnalyticsParams, CORE_MOCK, getAdminWidgets(), getDashboardAnalytics() (+6 more)

### Community 23 - "Community 23"
Cohesion: 0.67
Nodes (3): DashboardPage(), formatDate(), getGreeting()

### Community 24 - "Community 24"
Cohesion: 0.16
Nodes (12): useOrgOptions(), useRoles(), INPUT_BASE, LIMIT_OPTIONS, pageRange(), TabKey, TABS, UserManagementPage() (+4 more)

### Community 25 - "Community 25"
Cohesion: 0.14
Nodes (13): AdminUser, removeToken(), storeToken(), Props, ProtectedRoute(), AuthContext, AuthContextType, AuthProvider() (+5 more)

### Community 26 - "Community 26"
Cohesion: 0.14
Nodes (26): assignDepartmentsToBranch(), assignTeamMembers(), assignUsersToDepartment(), BranchListParams, createBranch(), createDepartment(), createTeam(), deleteBranch() (+18 more)

### Community 27 - "Community 27"
Cohesion: 0.14
Nodes (16): actionFetch(), approveVerification(), assignRole(), createUser(), deleteUser(), DETAILS_MOCK, reactivateUser(), resetPassword() (+8 more)

### Community 29 - "Community 29"
Cohesion: 0.17
Nodes (6): KpiSummary, CardDef, CARDS, Props, sk(), SkeletonCard()

### Community 31 - "Community 31"
Cohesion: 0.15
Nodes (15): BTN_GHOST, BTN_PRIMARY, CATEGORY_COLOR, CATEGORY_LABEL, FIELD, INPUT, LABEL, MODAL_BOX() (+7 more)

### Community 32 - "Community 32"
Cohesion: 0.05
Nodes (32): getAnalytics(), Props, Props, BAR_COLORS, Props, Props, ROLE_COLORS, ROLE_LABELS (+24 more)

### Community 33 - "Community 33"
Cohesion: 0.08
Nodes (43): { getUsersAnalytics }, prisma, approveVerification(), assertUserExists(), assignUserRole(), bcrypt, bulkActionUsers(), createUser() (+35 more)

### Community 34 - "Community 34"
Cohesion: 0.06
Nodes (13): CourseStatus, Props, AVATAR_PALETTES, avatarPalette(), DRAWER_TABS, DrawerTab, formatDate(), formatRelative() (+5 more)

### Community 35 - "Community 35"
Cohesion: 0.18
Nodes (6): UsersParams, FieldKey, FIELDS, FormatKey, FORMATS, Props

### Community 36 - "Community 36"
Cohesion: 0.10
Nodes (20): adminLoginRateLimiter, adminUserActionRateLimiter, adminUsersAnalyticsRateLimiter, adminUsersImportRateLimiter, rateLimit, { adminUserActionRateLimiter }, { adminUserActionRateLimiter, adminUsersAnalyticsRateLimiter }, {
  adminUserActionRateLimiter,
  adminUsersAnalyticsRateLimiter,
  adminUsersImportRateLimiter,
} (+12 more)

### Community 37 - "Community 37"
Cohesion: 0.15
Nodes (11): LoginForm(), Props, Props, AdminLayout(), LoginPage(), SignupPage(), TrustedDevicesPage(), VerifyDevicePage() (+3 more)

### Community 38 - "Community 38"
Cohesion: 0.14
Nodes (10): DetailDrawer(), FW, INPUT, LABEL, locationLabel(), Props, BranchDetail, BranchLocationType (+2 more)

### Community 39 - "Community 39"
Cohesion: 0.35
Nodes (11): adminFetch(), apiForgotPassword(), apiGetMe(), apiLogin(), apiLogout(), apiResetPassword(), apiSendOtp(), apiVerifyOtp() (+3 more)

### Community 40 - "Community 40"
Cohesion: 0.07
Nodes (20): adapter, prisma, { PrismaClient }, { PrismaPg }, PERMISSIONS, prisma, ROLES, prisma (+12 more)

### Community 41 - "Community 41"
Cohesion: 0.22
Nodes (5): PALETTES, sk(), SkeletonRow(), TD, TH

### Community 42 - "Community 42"
Cohesion: 0.09
Nodes (20): getBranches(), getDepartments(), BriefItem, FIELD_WRAP, INPUT, LABEL, ModalProps, Props (+12 more)

### Community 43 - "Community 43"
Cohesion: 0.17
Nodes (7): FW, INPUT, LABEL, Props, CreateTeamBody, Team, TeamDetail

### Community 44 - "Community 44"
Cohesion: 0.12
Nodes (12): buildTree(), NODE_COLORS, OrganizationChart(), Props, TreeNode, TYPE_LABEL, Props, SUB_TABS (+4 more)

### Community 45 - "Community 45"
Cohesion: 0.15
Nodes (10): BTN_GHOST, BTN_PRIMARY, CAT_META, FIELD, INPUT, LABEL, MODAL_BOX(), MODAL_OVERLAY (+2 more)

### Community 46 - "Community 46"
Cohesion: 0.09
Nodes (23): ACCESS_LEVEL_OPTIONS, BRANCH_OPTIONS, DEPARTMENT_OPTIONS, ROLE_OPTIONS, CreateUserRequest, UpdateUserRequest, ACCESS, ERR_INPUT (+15 more)

### Community 47 - "Community 47"
Cohesion: 0.22
Nodes (8): importUsers(), ImportResult, CSVPreview, formatBytes(), ImportUsersModal(), Props, REQUIRED_HEADERS, VALID_IMPORT_ROLES

### Community 48 - "Community 48"
Cohesion: 0.22
Nodes (7): bulkAction(), BulkActionType, ACTION_LABELS, ActionKey, ACTIONS, Props, ROLE_OPTIONS

### Community 49 - "Community 49"
Cohesion: 0.12
Nodes (11): getUsers(), User, sk(), SkeletonRow(), TD, TH, PALETTES, sk() (+3 more)

### Community 50 - "Community 50"
Cohesion: 0.16
Nodes (9): SuspendUserRequest, INPUT, Props, Props, TA, ContainerProps, ToastContainer(), ToastItem (+1 more)

### Community 51 - "Community 51"
Cohesion: 0.18
Nodes (5): ApiError, DEFAULTS, Props, Settings, HierarchySettings

### Community 52 - "Community 52"
Cohesion: 0.23
Nodes (9): bcrypt, createFirstAdmin(), prisma, { validatePasswordStrength }, bcrypt, prisma, resetFirstAdminPassword(), { validatePasswordStrength } (+1 more)

### Community 53 - "Community 53"
Cohesion: 0.20
Nodes (8): Permission, Role, AssignRoleRequest, RoleType, INPUT, Props, ROLES, TYPES

### Community 54 - "Community 54"
Cohesion: 0.22
Nodes (6): apiCall(), RolesApiError, rolesPermissionsAPI, ENUM_ROLES, ROLE_ALIAS, RoleOption

### Community 57 - "Community 57"
Cohesion: 0.13
Nodes (52): assignDepartmentsToBranch(), assignTeamMembers(), assignUsersToDepartment(), badRequest(), conflict(), createBranch(), createDepartment(), createTeam() (+44 more)

### Community 58 - "Community 58"
Cohesion: 0.08
Nodes (9): buildPagination(), getTeamMembers(), HIERARCHY_DEFAULTS, listBranches(), listDepartments(), listTeams(), paginate(), prisma (+1 more)

### Community 60 - "Community 60"
Cohesion: 0.22
Nodes (8): createUser(), resetUserPassword(), VALID_ROLES, VALID_STATUSES, VALID_VERIFICATION_STATES, validateCreateUserInput(), { validatePasswordStrength }, validateResetUserPasswordInput()

### Community 61 - "Community 61"
Cohesion: 0.29
Nodes (5): ALLOWED_MIME_TYPES, multer, storage, _upload, uploadUsersCsv()

## Knowledge Gaps
- **461 isolated node(s):** `name`, `version`, `description`, `main`, `start` (+456 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getStoredToken()` connect `Community 22` to `Community 32`, `Community 2`, `Community 39`, `Community 47`, `Community 48`, `Community 49`, `Community 54`, `Community 25`, `Community 26`, `Community 27`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `Community 37` to `Community 1`, `Community 2`, `Community 6`, `Community 23`, `Community 25`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `getUsers()` connect `Community 49` to `Community 35`, `Community 41`, `Community 42`, `Community 43`, `Community 22`, `Community 24`, `Community 27`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _461 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14619883040935672 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08858858858858859 - nodes in this community are weakly interconnected._