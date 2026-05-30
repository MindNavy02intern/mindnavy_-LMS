# Graph Report - mindnavy LMS  (2026-05-27)

## Corpus Check
- 54 files · ~53,257 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 410 nodes · 589 edges · 24 communities (21 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bd5e1673`
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

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 17 edges
2. `useAuth()` - 17 edges
3. `compilerOptions` - 16 edges
4. `scripts` - 8 edges
5. `createAuditLog()` - 8 edges
6. `getStoredToken()` - 8 edges
7. `adminFetch()` - 8 edges
8. `compilerOptions` - 7 edges
9. `sendAdminOtp()` - 7 edges
10. `forgotAdminPassword()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `TrustedDevicesPage()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/pages/TrustedDevicesPage.tsx → frontend/src/AuthContext.tsx
- `ProtectedRoute()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/routes/ProtectedRoute.tsx → frontend/src/AuthContext.tsx
- `createFirstAdmin()` --calls--> `validatePasswordStrength()`  [EXTRACTED]
  backend/src/scripts/createFirstAdmin.js → backend/src/utils/passwordPolicy.js
- `resetFirstAdminPassword()` --calls--> `validatePasswordStrength()`  [EXTRACTED]
  backend/src/scripts/resetFirstAdminPassword.js → backend/src/utils/passwordPolicy.js
- `LoginForm()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/components/auth/LoginForm.tsx → frontend/src/AuthContext.tsx

## Communities (24 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (15): updatePassword(), Props, getPasswordStrength(), PasswordStrengthMeter(), REQUIREMENTS, Props, ResetPasswordForm(), ForgotPasswordStep (+7 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (16): LoginForm(), Props, Props, AdminLayout(), NAV, NAV_SECTIONS, NavItem, NavSection (+8 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (24): getStoredToken(), apiCall(), authHeaders(), delay(), getTrustedDevices(), MOCK_DEVICES, mockDeviceStore, revokeDevice() (+16 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (29): author, dependencies, bcryptjs, cors, dotenv, express, express-rate-limit, pg (+21 more)

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (28): dependencies, bootstrap, react, react-dom, react-router-dom, @supabase/supabase-js, devDependencies, eslint (+20 more)

### Community 5 - "Community 5"
Cohesion: 0.08
Nodes (46): adminForgotPasswordController(), adminGetTrustedDevicesController(), adminLoginController(), adminLogoutController(), adminMeController(), adminResetPasswordController(), adminRevokeTrustedDeviceController(), adminSendOtpController() (+38 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (17): ACTIVITY_ICON_BG, ACTIVITY_ICON_COLOR, AVATAR_COLORS, CHART_COMPLETED, CHART_ENROLLED, CHART_LABELS, COMPLETION_COURSES, DEPT_DATA (+9 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 8 - "Community 8"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 9 - "Community 9"
Cohesion: 0.13
Nodes (15): adapter, prisma, { PrismaClient }, { PrismaPg }, prisma, requireAdminAuth(), bcrypt, createFirstAdmin() (+7 more)

### Community 10 - "Community 10"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, skipLibCheck, strict, target, types, include

### Community 11 - "Community 11"
Cohesion: 0.33
Nodes (5): code:js (export default defineConfig([), code:js (// eslint.config.js), Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 19 - "Community 19"
Cohesion: 0.29
Nodes (6): adminRoutes, app, cors, corsOptions, express, server

### Community 20 - "Community 20"
Cohesion: 0.11
Nodes (23): adminFetch(), AdminUser, apiForgotPassword(), apiGetMe(), apiLogin(), apiLogout(), apiResetPassword(), apiSendOtp() (+15 more)

### Community 21 - "Community 21"
Cohesion: 0.14
Nodes (13): ActivityItem, ActivityType, AlertSeverity, DashboardKpi, DashboardKpis, NotificationItem, NotificationSeverity, QuickActionItem (+5 more)

### Community 22 - "Community 22"
Cohesion: 0.50
Nodes (3): getDashboardCore(), MOCK, DashboardCoreResponse

### Community 23 - "Community 23"
Cohesion: 0.67
Nodes (3): DashboardPage(), formatDate(), getGreeting()

## Knowledge Gaps
- **182 isolated node(s):** `name`, `version`, `description`, `main`, `start` (+177 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAuth()` connect `Community 1` to `Community 2`, `Community 20`, `Community 6`, `Community 23`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `getStoredToken()` connect `Community 2` to `Community 20`, `Community 22`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `supabase` connect `Community 1` to `Community 0`, `Community 20`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _182 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07394957983193277 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0728744939271255 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08636977058029689 - nodes in this community are weakly interconnected._