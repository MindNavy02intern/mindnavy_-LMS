# Graph Report - mindnavy LMS  (2026-06-06)

## Corpus Check
- 67 files · ~65,534 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 603 nodes · 887 edges · 34 communities (30 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `38c20c96`
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

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 17 edges
2. `useAuth()` - 17 edges
3. `compilerOptions` - 16 edges
4. `getStoredToken()` - 12 edges
5. `createUserAuditLog()` - 9 edges
6. `scripts` - 8 edges
7. `createAuditLog()` - 8 edges
8. `validatePasswordStrength()` - 8 edges
9. `adminFetch()` - 8 edges
10. `compilerOptions` - 7 edges

## Surprising Connections (you probably didn't know these)
- `ProtectedRoute()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/routes/ProtectedRoute.tsx → frontend/src/AuthContext.tsx
- `createFirstAdmin()` --calls--> `validatePasswordStrength()`  [EXTRACTED]
  backend/src/scripts/createFirstAdmin.js → backend/src/utils/passwordPolicy.js
- `resetFirstAdminPassword()` --calls--> `validatePasswordStrength()`  [EXTRACTED]
  backend/src/scripts/resetFirstAdminPassword.js → backend/src/utils/passwordPolicy.js
- `LoginForm()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/components/auth/LoginForm.tsx → frontend/src/AuthContext.tsx
- `AdminLayout()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/layouts/AdminLayout.tsx → frontend/src/AuthContext.tsx

## Communities (34 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (14): updatePassword(), Props, getPasswordStrength(), PasswordStrengthMeter(), REQUIREMENTS, Props, ResetPasswordForm(), ForgotPasswordStep (+6 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (7): AVATAR_PALETTES, Props, sk(), SkeletonRow(), STATUS_MAP, TD, TH

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
Cohesion: 0.08
Nodes (47): adminForgotPasswordController(), adminGetTrustedDevicesController(), adminLoginController(), adminLogoutController(), adminMeController(), adminResetPasswordController(), adminRevokeTrustedDeviceController(), adminSendOtpController() (+39 more)

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
Cohesion: 0.07
Nodes (40): adapter, prisma, { PrismaClient }, { PrismaPg }, assignUserRole(), createUser(), deleteUser(), EMPTY_LIST_RESPONSE (+32 more)

### Community 10 - "Community 10"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, skipLibCheck, strict, target, types, include

### Community 11 - "Community 11"
Cohesion: 0.33
Nodes (5): code:js (export default defineConfig([), code:js (// eslint.config.js), Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 19 - "Community 19"
Cohesion: 0.08
Nodes (20): adminRoutes, app, cors, corsOptions, dashboardRoutes, express, server, usersRoutes (+12 more)

### Community 20 - "Community 20"
Cohesion: 0.38
Nodes (10): adminFetch(), apiForgotPassword(), apiGetMe(), apiLogin(), apiLogout(), apiResetPassword(), apiSendOtp(), apiVerifyOtp() (+2 more)

### Community 21 - "Community 21"
Cohesion: 0.04
Nodes (50): ActivityItem, ActivityType, AdminWidgetsFilters, AiInsightItem, AlertSeverity, AlertStatus, AnalyticsFilters, ApprovalPriority (+42 more)

### Community 22 - "Community 22"
Cohesion: 0.18
Nodes (13): getStoredToken(), ADMIN_WIDGETS_MOCK, AdminWidgetsParams, ANALYTICS_MOCK, AnalyticsParams, CORE_MOCK, getAdminWidgets(), getDashboardAnalytics() (+5 more)

### Community 23 - "Community 23"
Cohesion: 0.67
Nodes (3): DashboardPage(), formatDate(), getGreeting()

### Community 24 - "Community 24"
Cohesion: 0.12
Nodes (6): NAV, NAV_SECTIONS, NavItem, NavSection, Props, QA_TOPBAR_ACTIONS

### Community 25 - "Community 25"
Cohesion: 0.18
Nodes (9): AdminUser, removeToken(), storeToken(), AuthContext, AuthContextType, AuthProvider(), DEMO_PROFILE, DEMO_USER (+1 more)

### Community 26 - "Community 26"
Cohesion: 0.21
Nodes (9): getUsers(), USERS_MOCK, UsersParams, LIMIT_OPTIONS, pageRange(), TabKey, TABS, UserManagementPage() (+1 more)

### Community 27 - "Community 27"
Cohesion: 0.18
Nodes (10): LoginForm(), Props, Props, AdminLayout(), LoginPage(), SignupPage(), TrustedDevicesPage(), VerifyDevicePage() (+2 more)

### Community 29 - "Community 29"
Cohesion: 0.18
Nodes (5): CardDef, CARDS, Props, sk(), SkeletonCard()

### Community 30 - "Community 30"
Cohesion: 0.29
Nodes (4): Props, ProtectedRoute(), Profile, UserRole

### Community 31 - "Community 31"
Cohesion: 0.29
Nodes (5): ACTION_BTN, ICON_BTN, INPUT, Props, SELECT

### Community 32 - "Community 32"
Cohesion: 0.33
Nodes (5): KpiSummary, Pagination, User, UserStatus, VerificationState

### Community 33 - "Community 33"
Cohesion: 0.20
Nodes (21): assertUserExists(), assignUserRole(), bcrypt, createUser(), createUserAuditLog(), deleteUser(), ensureEmailAvailable(), getUserDetails() (+13 more)

## Knowledge Gaps
- **265 isolated node(s):** `name`, `version`, `description`, `main`, `start` (+260 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAuth()` connect `Community 27` to `Community 2`, `Community 6`, `Community 23`, `Community 24`, `Community 25`, `Community 30`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `getStoredToken()` connect `Community 22` to `Community 25`, `Community 2`, `Community 26`, `Community 20`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `supabase` connect `Community 28` to `Community 25`, `Community 27`, `Community 20`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _265 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08866995073891626 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08858858858858859 - nodes in this community are weakly interconnected._