# Graph Report - mindnavy LMS  (2026-06-08)

## Corpus Check
- 76 files · ~75,057 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 721 nodes · 1102 edges · 38 communities (32 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `62d5c758`
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
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 17 edges
2. `useAuth()` - 17 edges
3. `compilerOptions` - 16 edges
4. `getStoredToken()` - 14 edges
5. `createUserAuditLog()` - 11 edges
6. `assertUserExists()` - 9 edges
7. `validateUuidParam()` - 9 edges
8. `actionFetch()` - 9 edges
9. `scripts` - 8 edges
10. `createAuditLog()` - 8 edges

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

## Communities (38 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.15
Nodes (11): getPasswordStrength(), PasswordStrengthMeter(), REQUIREMENTS, Props, ResetPasswordForm(), PasswordChecks, PasswordResetConfirm, PasswordResetRequest (+3 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (9): User, UserStatus, AVATAR_PALETTES, Props, sk(), SkeletonRow(), STATUS_MAP, TD (+1 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (22): apiCall(), authHeaders(), delay(), getTrustedDevices(), MOCK_DEVICES, mockDeviceStore, revokeDevice(), sendOtp() (+14 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (29): author, dependencies, bcryptjs, cors, dotenv, express, express-rate-limit, pg (+21 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (28): dependencies, bootstrap, react, react-dom, react-router-dom, @supabase/supabase-js, devDependencies, eslint (+20 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (44): adminForgotPasswordController(), adminGetTrustedDevicesController(), adminLoginController(), adminLogoutController(), adminMeController(), adminResetPasswordController(), adminRevokeTrustedDeviceController(), adminSendOtpController() (+36 more)

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
Cohesion: 0.08
Nodes (40): assignUserRole(), createUser(), deleteUser(), EMPTY_LIST_RESPONSE, getUserDetails(), getUsersAnalytics(), getUsersList(), reactivateUser() (+32 more)

### Community 10 - "Community 10"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, skipLibCheck, strict, target, types, include

### Community 11 - "Community 11"
Cohesion: 0.33
Nodes (5): code:js (export default defineConfig([), code:js (// eslint.config.js), Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 19 - "Community 19"
Cohesion: 0.05
Nodes (34): adminRoutes, app, cors, corsOptions, dashboardRoutes, express, server, usersRoutes (+26 more)

### Community 20 - "Community 20"
Cohesion: 0.35
Nodes (11): adminFetch(), apiForgotPassword(), apiGetMe(), apiLogin(), apiLogout(), apiResetPassword(), apiSendOtp(), apiVerifyOtp() (+3 more)

### Community 21 - "Community 21"
Cohesion: 0.04
Nodes (50): ActivityItem, ActivityType, AdminWidgetsFilters, AiInsightItem, AlertSeverity, AlertStatus, AnalyticsFilters, ApprovalPriority (+42 more)

### Community 22 - "Community 22"
Cohesion: 0.15
Nodes (15): getStoredToken(), ADMIN_WIDGETS_MOCK, AdminWidgetsParams, ANALYTICS_MOCK, AnalyticsParams, CORE_MOCK, getAdminWidgets(), getDashboardAnalytics() (+7 more)

### Community 23 - "Community 23"
Cohesion: 0.67
Nodes (3): DashboardPage(), formatDate(), getGreeting()

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (6): NAV, NAV_SECTIONS, NavItem, NavSection, Props, QA_TOPBAR_ACTIONS

### Community 25 - "Community 25"
Cohesion: 0.14
Nodes (13): AdminUser, removeToken(), storeToken(), Props, ProtectedRoute(), AuthContext, AuthContextType, AuthProvider() (+5 more)

### Community 26 - "Community 26"
Cohesion: 0.15
Nodes (13): LIMIT_OPTIONS, pageRange(), TabKey, TABS, UserManagementPage(), UsersResponse, INPUT, Props (+5 more)

### Community 27 - "Community 27"
Cohesion: 0.16
Nodes (15): actionFetch(), ApiError, assignRole(), createUser(), deleteUser(), DETAILS_MOCK, reactivateUser(), resetPassword() (+7 more)

### Community 29 - "Community 29"
Cohesion: 0.17
Nodes (6): KpiSummary, CardDef, CARDS, Props, sk(), SkeletonCard()

### Community 32 - "Community 32"
Cohesion: 0.11
Nodes (17): ActionResponse, ActivityItem, AssignRoleRequest, CourseStatus, EnrolledCourse, Pagination, RiskScore, RoleType (+9 more)

### Community 33 - "Community 33"
Cohesion: 0.18
Nodes (23): assertUserExists(), assignUserRole(), bcrypt, createUser(), createUserAuditLog(), deleteUser(), ensureEmailAvailable(), getUserDetails() (+15 more)

### Community 34 - "Community 34"
Cohesion: 0.07
Nodes (11): AVATAR_PALETTES, avatarPalette(), DRAWER_TABS, DrawerTab, formatDate(), formatRelative(), initials(), Props (+3 more)

### Community 36 - "Community 36"
Cohesion: 0.11
Nodes (16): ACCESS_LEVEL_OPTIONS, BRANCH_OPTIONS, DEPARTMENT_OPTIONS, ROLE_OPTIONS, CreateUserRequest, ACCESS, ERR_INPUT, FormKey (+8 more)

### Community 37 - "Community 37"
Cohesion: 0.15
Nodes (11): LoginForm(), Props, Props, AdminLayout(), LoginPage(), SignupPage(), TrustedDevicesPage(), VerifyDevicePage() (+3 more)

### Community 38 - "Community 38"
Cohesion: 0.20
Nodes (7): UpdateUserRequest, ACCESS, DISABLED, EditInitialData, ERR_INPUT, INPUT, Props

## Knowledge Gaps
- **305 isolated node(s):** `name`, `version`, `description`, `main`, `start` (+300 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getStoredToken()` connect `Community 22` to `Community 25`, `Community 2`, `Community 27`, `Community 20`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `Community 37` to `Community 2`, `Community 6`, `Community 23`, `Community 24`, `Community 25`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `supabase` connect `Community 37` to `Community 25`, `Community 20`, `Community 30`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _305 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14619883040935672 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08858858858858859 - nodes in this community are weakly interconnected._