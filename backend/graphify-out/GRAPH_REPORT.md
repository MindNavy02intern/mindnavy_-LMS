# Graph Report - backend  (2026-06-05)

## Corpus Check
- 21 files · ~4,520 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 153 nodes · 223 edges · 11 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2b5eb206`
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

## God Nodes (most connected - your core abstractions)
1. `scripts` - 8 edges
2. `createAuditLog()` - 8 edges
3. `compilerOptions` - 7 edges
4. `sendAdminOtp()` - 7 edges
5. `forgotAdminPassword()` - 7 edges
6. `loginAdmin()` - 6 edges
7. `verifyAdminOtp()` - 5 edges
8. `resetAdminPassword()` - 5 edges
9. `validatePasswordStrength()` - 5 edges
10. `adminLoginController()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `adminLoginController()` --calls--> `loginAdmin()`  [EXTRACTED]
  src/controllers/admin.controller.js → src/services/admin.service.js
- `adminLogoutController()` --calls--> `logoutAdmin()`  [EXTRACTED]
  src/controllers/admin.controller.js → src/services/admin.service.js
- `adminSendOtpController()` --calls--> `sendAdminOtp()`  [EXTRACTED]
  src/controllers/admin.controller.js → src/services/admin.service.js
- `adminVerifyOtpController()` --calls--> `verifyAdminOtp()`  [EXTRACTED]
  src/controllers/admin.controller.js → src/services/admin.service.js
- `adminRevokeTrustedDeviceController()` --calls--> `revokeAdminTrustedDevice()`  [EXTRACTED]
  src/controllers/admin.controller.js → src/services/admin.service.js

## Communities (11 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (23): adminForgotPasswordController(), adminGetTrustedDevicesController(), adminLoginController(), adminLogoutController(), adminMeController(), adminResetPasswordController(), adminRevokeTrustedDeviceController(), adminSendOtpController() (+15 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (21): author, dependencies, bcryptjs, cors, dotenv, express, express-rate-limit, pg (+13 more)

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (20): bcrypt, createAuditLog(), forgotAdminPassword(), {
  generateOtpCode,
  hashOtpCode,
  compareOtpCode,
  getOtpExpiryDate,
}, { generateSessionToken, getSessionExpiryDate }, isLoginTemporarilyBlocked(), loginAdmin(), logoutAdmin() (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.15
Nodes (13): adapter, prisma, { PrismaClient }, { PrismaPg }, bcrypt, createFirstAdmin(), prisma, { validatePasswordStrength } (+5 more)

### Community 4 - "Community 4"
Cohesion: 0.18
Nodes (8): dashboardService, getDashboardAdminWidgets(), getDashboardAnalytics(), getDashboardCore(), express, {
  getDashboardCore,
  getDashboardAnalytics,
  getDashboardAdminWidgets,
}, { requireAdminAuth }, router

### Community 5 - "Community 5"
Cohesion: 0.19
Nodes (10): EMPTY_LIST_RESPONSE, getUserDetails(), getUsersList(), usersService, prisma, requireAdminAuth(), express, { getUsersList, getUserDetails } (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.22
Nodes (9): getUserDetails(), makeError(), mapUser(), prisma, ROLE_MAP, STATUS_MAP, VALID_ROLES, VALID_STATUSES (+1 more)

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, skipLibCheck, strict, target, types, include

### Community 8 - "Community 8"
Cohesion: 0.22
Nodes (8): adminRoutes, app, cors, corsOptions, dashboardRoutes, express, server, usersRoutes

### Community 9 - "Community 9"
Cohesion: 0.25
Nodes (8): scripts, create:first-admin, dev, prisma:generate, prisma:validate, reset:first-admin-password, start, test

## Knowledge Gaps
- **83 isolated node(s):** `name`, `version`, `description`, `main`, `start` (+78 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `requireAdminAuth()` connect `Community 5` to `Community 0`, `Community 4`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `scripts` connect `Community 9` to `Community 1`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _83 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.1282051282051282 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._