# Graph Report - backend  (2026-06-12)

## Corpus Check
- 29 files · ~15,286 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 313 nodes · 616 edges · 11 communities
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

## God Nodes (most connected - your core abstractions)
1. `serverError()` - 26 edges
2. `validateId()` - 21 edges
3. `badRequest()` - 20 edges
4. `createUserAuditLog()` - 12 edges
5. `validatePasswordStrength()` - 12 edges
6. `notFound()` - 11 edges
7. `assertUserExists()` - 9 edges
8. `validateUuidParam()` - 9 edges
9. `scripts` - 8 edges
10. `updateDepartment()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `adminResetPasswordController()` --calls--> `validateResetPasswordInput()`  [EXTRACTED]
  src/controllers/admin.controller.js → src/validators/adminAuth.validator.js
- `createFirstAdmin()` --calls--> `validatePasswordStrength()`  [EXTRACTED]
  src/scripts/createFirstAdmin.js → src/utils/passwordPolicy.js
- `resetFirstAdminPassword()` --calls--> `validatePasswordStrength()`  [EXTRACTED]
  src/scripts/resetFirstAdminPassword.js → src/utils/passwordPolicy.js
- `importUsersFromCsv()` --calls--> `validateImportRows()`  [EXTRACTED]
  src/services/users.service.js → src/validators/usersImport.validator.js
- `validateCreateUserInput()` --calls--> `validatePasswordStrength()`  [EXTRACTED]
  src/validators/users.validator.js → src/utils/passwordPolicy.js

## Communities (11 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.10
Nodes (40): adminForgotPasswordController(), adminGetTrustedDevicesController(), adminLoginController(), adminLogoutController(), adminMeController(), adminResetPasswordController(), adminRevokeTrustedDeviceController(), adminSendOtpController() (+32 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (31): author, dependencies, bcryptjs, cors, csv-parse, dotenv, express, express-rate-limit (+23 more)

### Community 2 - "Community 2"
Cohesion: 0.13
Nodes (52): assignDepartmentsToBranch(), assignTeamMembers(), assignUsersToDepartment(), badRequest(), conflict(), createBranch(), createDepartment(), createTeam() (+44 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (24): adapter, prisma, { PrismaClient }, { PrismaPg }, prisma, bcrypt, createFirstAdmin(), prisma (+16 more)

### Community 4 - "Community 4"
Cohesion: 0.12
Nodes (13): dashboardService, getDashboardAdminWidgets(), getDashboardAnalytics(), getDashboardCore(), prisma, requireAdminAuth(), express, {
  getDashboardCore,
  getDashboardAnalytics,
  getDashboardAdminWidgets,
} (+5 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (44): assignUserRole(), bulkActionUsers(), createUser(), deleteUser(), EMPTY_LIST_RESPONSE, getUserDetails(), getUsersAnalytics(), getUsersList() (+36 more)

### Community 6 - "Community 6"
Cohesion: 0.16
Nodes (28): assertUserExists(), assignUserRole(), bcrypt, bulkActionUsers(), createUser(), createUserAuditLog(), deleteUser(), ensureEmailAvailable() (+20 more)

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, skipLibCheck, strict, target, types, include

### Community 8 - "Community 8"
Cohesion: 0.20
Nodes (9): adminRoutes, app, cors, corsOptions, dashboardRoutes, express, organizationRoutes, server (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (9): buildPagination(), getTeamMembers(), HIERARCHY_DEFAULTS, listBranches(), listDepartments(), listTeams(), paginate(), prisma (+1 more)

## Knowledge Gaps
- **126 isolated node(s):** `name`, `version`, `description`, `main`, `start` (+121 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `validatePasswordStrength()` connect `Community 3` to `Community 5`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `requireAdminAuth()` connect `Community 4` to `Community 0`, `Community 2`, `Community 5`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `adminUserActionRateLimiter` connect `Community 5` to `Community 2`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _126 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09725158562367865 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12525252525252525 - nodes in this community are weakly interconnected._