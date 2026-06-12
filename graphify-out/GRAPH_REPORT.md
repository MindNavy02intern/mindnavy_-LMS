# Graph Report - mindnavy LMS  (2026-06-12)

## Corpus Check
- 104 files · ~106,957 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1070 nodes · 1790 edges · 52 communities (49 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ad075334`
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
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
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
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]

## God Nodes (most connected - your core abstractions)
1. `serverError()` - 26 edges
2. `orgFetch()` - 26 edges
3. `validateId()` - 21 edges
4. `badRequest()` - 20 edges
5. `getStoredToken()` - 19 edges
6. `compilerOptions` - 17 edges
7. `useAuth()` - 17 edges
8. `compilerOptions` - 16 edges
9. `ApiError` - 13 edges
10. `createUserAuditLog()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `ProtectedRoute()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/routes/ProtectedRoute.tsx → frontend/src/AuthContext.tsx
- `createFirstAdmin()` --calls--> `validatePasswordStrength()`  [EXTRACTED]
  backend/src/scripts/createFirstAdmin.js → backend/src/utils/passwordPolicy.js
- `resetFirstAdminPassword()` --calls--> `validatePasswordStrength()`  [EXTRACTED]
  backend/src/scripts/resetFirstAdminPassword.js → backend/src/utils/passwordPolicy.js
- `validateCreateUserInput()` --calls--> `validatePasswordStrength()`  [EXTRACTED]
  backend/src/validators/users.validator.js → backend/src/utils/passwordPolicy.js
- `validateResetUserPasswordInput()` --calls--> `validatePasswordStrength()`  [EXTRACTED]
  backend/src/validators/users.validator.js → backend/src/utils/passwordPolicy.js

## Communities (52 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (13): Props, getPasswordStrength(), PasswordStrengthMeter(), REQUIREMENTS, Props, ResetPasswordForm(), ForgotPasswordStep, PasswordChecks (+5 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (6): NAV, NAV_SECTIONS, NavItem, NavSection, Props, QA_TOPBAR_ACTIONS

### Community 2 - "Community 2"
Cohesion: 0.14
Nodes (17): apiCall(), authHeaders(), delay(), getTrustedDevices(), MOCK_DEVICES, mockDeviceStore, revokeDevice(), sendOtp() (+9 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (31): author, dependencies, bcryptjs, cors, csv-parse, dotenv, express, express-rate-limit (+23 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (29): dependencies, bootstrap, react, react-dom, react-router-dom, recharts, @supabase/supabase-js, devDependencies (+21 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (61): adapter, prisma, { PrismaClient }, { PrismaPg }, adminForgotPasswordController(), adminGetTrustedDevicesController(), adminLoginController(), adminLogoutController() (+53 more)

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
Cohesion: 0.06
Nodes (52): assignUserRole(), bulkActionUsers(), createUser(), deleteUser(), EMPTY_LIST_RESPONSE, getUserDetails(), getUsersAnalytics(), getUsersList() (+44 more)

### Community 10 - "Community 10"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, skipLibCheck, strict, target, types, include

### Community 11 - "Community 11"
Cohesion: 0.33
Nodes (5): code:js (export default defineConfig([), code:js (// eslint.config.js), Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 19 - "Community 19"
Cohesion: 0.10
Nodes (19): adminRoutes, app, cors, corsOptions, dashboardRoutes, express, organizationRoutes, server (+11 more)

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
Cohesion: 0.20
Nodes (8): INPUT_BASE, LIMIT_OPTIONS, pageRange(), TabKey, TABS, UserManagementPage(), UsersResponse, useToast()

### Community 25 - "Community 25"
Cohesion: 0.12
Nodes (13): AdminUser, removeToken(), storeToken(), Props, ProtectedRoute(), AuthContext, AuthContextType, AuthProvider() (+5 more)

### Community 26 - "Community 26"
Cohesion: 0.13
Nodes (27): assignDepartmentsToBranch(), assignTeamMembers(), assignUsersToDepartment(), BranchListParams, createBranch(), createDepartment(), createTeam(), deleteBranch() (+19 more)

### Community 27 - "Community 27"
Cohesion: 0.16
Nodes (15): actionFetch(), assignRole(), createUser(), DETAILS_MOCK, reactivateUser(), resetPassword(), suspendUser(), updateUser() (+7 more)

### Community 28 - "Community 28"
Cohesion: 0.18
Nodes (5): DeviceCard(), DeviceCardProps, formatDate(), formatRelative(), DevicePlatform

### Community 29 - "Community 29"
Cohesion: 0.17
Nodes (6): KpiSummary, CardDef, CARDS, Props, sk(), SkeletonCard()

### Community 32 - "Community 32"
Cohesion: 0.06
Nodes (25): getAnalytics(), Props, Props, BAR_COLORS, Props, Props, ROLE_COLORS, ROLE_LABELS (+17 more)

### Community 33 - "Community 33"
Cohesion: 0.09
Nodes (39): { getUsersAnalytics }, prisma, assertUserExists(), assignUserRole(), bcrypt, bulkActionUsers(), createUser(), createUserAuditLog() (+31 more)

### Community 34 - "Community 34"
Cohesion: 0.06
Nodes (13): RiskScore, Props, AVATAR_PALETTES, avatarPalette(), DRAWER_TABS, DrawerTab, formatDate(), formatRelative() (+5 more)

### Community 36 - "Community 36"
Cohesion: 0.08
Nodes (23): ACCESS_LEVEL_OPTIONS, BRANCH_OPTIONS, DEPARTMENT_OPTIONS, ROLE_OPTIONS, CreateUserRequest, UpdateUserRequest, ACCESS, ERR_INPUT (+15 more)

### Community 37 - "Community 37"
Cohesion: 0.11
Nodes (12): LoginForm(), Props, Props, AdminLayout(), LoginPage(), SignupPage(), TrustedDevicesPage(), VerifyDevicePage() (+4 more)

### Community 38 - "Community 38"
Cohesion: 0.10
Nodes (19): DetailDrawer(), FW, INPUT, LABEL, locationLabel(), Props, Branch, BranchDetail (+11 more)

### Community 39 - "Community 39"
Cohesion: 0.35
Nodes (11): adminFetch(), apiForgotPassword(), apiGetMe(), apiLogin(), apiLogout(), apiResetPassword(), apiSendOtp(), apiVerifyOtp() (+3 more)

### Community 40 - "Community 40"
Cohesion: 0.29
Nodes (4): Props, STATUS_COLORS, STATUS_LABELS, VerificationStatusItem

### Community 41 - "Community 41"
Cohesion: 0.22
Nodes (5): PALETTES, sk(), SkeletonRow(), TD, TH

### Community 42 - "Community 42"
Cohesion: 0.13
Nodes (9): BriefItem, FIELD_WRAP, INPUT, LABEL, ModalProps, Props, UserItem, CreateDepartmentBody (+1 more)

### Community 43 - "Community 43"
Cohesion: 0.15
Nodes (8): getDepartments(), FW, INPUT, LABEL, Props, CreateTeamBody, Team, TeamDetail

### Community 44 - "Community 44"
Cohesion: 0.18
Nodes (9): buildTree(), NODE_COLORS, OrganizationChart(), Props, TreeNode, TYPE_LABEL, OrgChart, OrgChartNode (+1 more)

### Community 45 - "Community 45"
Cohesion: 0.22
Nodes (5): PALETTES, sk(), SkeletonRow(), TD, TH

### Community 47 - "Community 47"
Cohesion: 0.22
Nodes (8): importUsers(), ImportResult, CSVPreview, formatBytes(), ImportUsersModal(), Props, REQUIRED_HEADERS, VALID_IMPORT_ROLES

### Community 48 - "Community 48"
Cohesion: 0.18
Nodes (6): UsersParams, FieldKey, FIELDS, FormatKey, FORMATS, Props

### Community 49 - "Community 49"
Cohesion: 0.12
Nodes (11): getUsers(), User, sk(), SkeletonRow(), TD, TH, PALETTES, sk() (+3 more)

### Community 50 - "Community 50"
Cohesion: 0.22
Nodes (7): bulkAction(), BulkActionType, ACTION_LABELS, ActionKey, ACTIONS, Props, ROLE_OPTIONS

### Community 51 - "Community 51"
Cohesion: 0.18
Nodes (5): ApiError, DEFAULTS, Props, Settings, HierarchySettings

### Community 52 - "Community 52"
Cohesion: 0.12
Nodes (13): deleteUser(), AssignRoleRequest, RoleType, INPUT, Props, ROLES, TYPES, INPUT (+5 more)

### Community 56 - "Community 56"
Cohesion: 0.40
Nodes (3): Props, SUB_TABS, SubTab

### Community 57 - "Community 57"
Cohesion: 0.13
Nodes (52): assignDepartmentsToBranch(), assignTeamMembers(), assignUsersToDepartment(), badRequest(), conflict(), createBranch(), createDepartment(), createTeam() (+44 more)

### Community 58 - "Community 58"
Cohesion: 0.08
Nodes (9): buildPagination(), getTeamMembers(), HIERARCHY_DEFAULTS, listBranches(), listDepartments(), listTeams(), paginate(), prisma (+1 more)

## Knowledge Gaps
- **416 isolated node(s):** `name`, `version`, `description`, `main`, `start` (+411 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getStoredToken()` connect `Community 22` to `Community 32`, `Community 2`, `Community 39`, `Community 47`, `Community 49`, `Community 50`, `Community 25`, `Community 26`, `Community 27`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `getUsers()` connect `Community 49` to `Community 41`, `Community 42`, `Community 43`, `Community 45`, `Community 48`, `Community 22`, `Community 24`, `Community 27`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `orgFetch()` connect `Community 26` to `Community 43`, `Community 22`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _416 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09259259259259259 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.13768115942028986 - nodes in this community are weakly interconnected._