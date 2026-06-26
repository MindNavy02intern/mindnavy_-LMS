# Graph Report - mindnavy LMS  (2026-06-26)

## Corpus Check
- 186 files · ~201,238 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2033 nodes · 3316 edges · 113 communities (108 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e33fdc32`
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
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 98|Community 98]]
- [[_COMMUNITY_Community 99|Community 99]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 106|Community 106]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]
- [[_COMMUNITY_Community 109|Community 109]]
- [[_COMMUNITY_Community 110|Community 110]]
- [[_COMMUNITY_Community 113|Community 113]]
- [[_COMMUNITY_Community 114|Community 114]]

## God Nodes (most connected - your core abstractions)
1. `getStoredToken()` - 39 edges
2. `serverError()` - 26 edges
3. `orgFetch()` - 26 edges
4. `validateId()` - 21 edges
5. `badRequest()` - 20 edges
6. `ToastType` - 20 edges
7. `useAuth()` - 19 edges
8. `createUserAuditLog()` - 18 edges
9. `serverError()` - 17 edges
10. `compilerOptions` - 17 edges

## Surprising Connections (you probably didn't know these)
- `LoginForm()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/components/auth/LoginForm.tsx → frontend/src/AuthContext.tsx
- `groupsFetch()` --calls--> `getStoredToken()`  [EXTRACTED]
  frontend/src/api/groups.ts → frontend/src/api/adminAuth.ts
- `apiCall()` --calls--> `getStoredToken()`  [EXTRACTED]
  frontend/src/api/rolesPermissions.ts → frontend/src/api/adminAuth.ts
- `apiFetch()` --calls--> `getStoredToken()`  [EXTRACTED]
  frontend/src/api/roleTemplates.ts → frontend/src/api/adminAuth.ts
- `patchUserRole()` --calls--> `getStoredToken()`  [EXTRACTED]
  frontend/src/components/rolesPermissionsPage/AssignUsersToRoleModal.tsx → frontend/src/api/adminAuth.ts

## Communities (113 total, 5 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (14): Props, getPasswordStrength(), PasswordStrengthMeter(), REQUIREMENTS, Props, ResetPasswordForm(), ForgotPasswordStep, PasswordChecks (+6 more)

### Community 1 - "Community 1"
Cohesion: 0.15
Nodes (5): LoginForm(), Props, Props, supabase, ResetPasswordStep

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (22): apiCall(), authHeaders(), delay(), getTrustedDevices(), MOCK_DEVICES, mockDeviceStore, revokeDevice(), sendOtp() (+14 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (33): author, dependencies, bcryptjs, cors, csv-parse, dotenv, express, express-rate-limit (+25 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (31): dependencies, bootstrap, @playwright/test, react, react-dom, react-router-dom, recharts, @supabase/supabase-js (+23 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (59): adminForgotPasswordController(), adminGetTrustedDevicesController(), adminLoginController(), adminLogoutController(), adminMeController(), adminResetPasswordController(), adminRevokeTrustedDeviceController(), adminSendOtpController() (+51 more)

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
Cohesion: 0.05
Nodes (63): approveVerification(), assignUserRole(), bulkActionUsers(), createUser(), deleteUser(), EMPTY_LIST_RESPONSE, exportUsers(), forceLogoutUser() (+55 more)

### Community 10 - "Community 10"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, skipLibCheck, strict, target, types, include

### Community 11 - "Community 11"
Cohesion: 0.33
Nodes (5): code:js (export default defineConfig([), code:js (// eslint.config.js), Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 19 - "Community 19"
Cohesion: 0.14
Nodes (32): assignPermissionsToRole(), badRequest(), createPermission(), createRole(), deletePermission(), deleteRole(), duplicateRole(), getPermission() (+24 more)

### Community 20 - "Community 20"
Cohesion: 0.07
Nodes (17): INPUT_BASE, LIMIT_OPTIONS, TabKey, TABS, UsersResponse, UserStatus, ToastContainer(), AVATAR_PALETTES (+9 more)

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
Cohesion: 0.07
Nodes (31): GroupMembersResponse, GroupResponse, groupsAPI, groupsFetch(), GroupsListResponse, getUsers(), Props, FIELD (+23 more)

### Community 25 - "Community 25"
Cohesion: 0.35
Nodes (11): adminFetch(), apiForgotPassword(), apiGetMe(), apiLogin(), apiLogout(), apiResetPassword(), apiSendOtp(), apiVerifyOtp() (+3 more)

### Community 26 - "Community 26"
Cohesion: 0.14
Nodes (26): assignDepartmentsToBranch(), assignTeamMembers(), assignUsersToDepartment(), BranchListParams, createBranch(), createDepartment(), createTeam(), deleteBranch() (+18 more)

### Community 27 - "Community 27"
Cohesion: 0.10
Nodes (24): actionFetch(), approveVerification(), assignRole(), cancelInvitation(), createUser(), deleteUser(), DETAILS_MOCK, InvitationParams (+16 more)

### Community 28 - "Community 28"
Cohesion: 0.10
Nodes (12): DashboardPage, ForgotPasswordPage, LoginPage, NotFoundPage, ProfilePage, ResetPasswordPage, RolesPermissionsStandalonePage, SignupPage (+4 more)

### Community 29 - "Community 29"
Cohesion: 0.17
Nodes (6): KpiSummary, CardDef, CARDS, Props, sk(), SkeletonCard()

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (6): PolicyStatus, ACTION_OPTIONS, INPUT, LABEL, Props, RESOURCE_OPTIONS

### Community 31 - "Community 31"
Cohesion: 0.13
Nodes (17): BTN_GHOST, BTN_PRIMARY, CATEGORY_COLOR, CATEGORY_LABEL, FIELD, INPUT, LABEL, MODAL_BOX() (+9 more)

### Community 32 - "Community 32"
Cohesion: 0.04
Nodes (34): getAnalytics(), Props, Props, BAR_COLORS, Props, Props, ROLE_COLORS, ROLE_LABELS (+26 more)

### Community 33 - "Community 33"
Cohesion: 0.06
Nodes (63): ACTION_NOTIF_TYPE, ACTION_TITLE, ACTION_TYPE, buildUserScope(), endOfUtcDay(), enumerateUtcDays(), getDashboardAdminWidgets(), getDashboardAnalytics() (+55 more)

### Community 34 - "Community 34"
Cohesion: 0.05
Nodes (20): CourseStatus, UserDetailsResponse, Props, INPUT, LABEL, MESSAGE_TYPE_OPTIONS, PRIORITY_OPTIONS, Props (+12 more)

### Community 35 - "Community 35"
Cohesion: 0.15
Nodes (8): exportAllUsers(), ExportParams, UsersParams, FieldKey, FIELDS, FormatKey, FORMATS, Props

### Community 36 - "Community 36"
Cohesion: 0.09
Nodes (25): getCachedSession(), prisma, requireAdminAuth(), SESSION_CACHE, setCachedSession(), adminLoginRateLimiter, adminUserActionRateLimiter, adminUsersAnalyticsRateLimiter (+17 more)

### Community 37 - "Community 37"
Cohesion: 0.08
Nodes (22): CreateGroupModal(), EditGroupModal(), useOrgOptions(), useRoles(), CURRENCIES, DATE_FORMATS, DEFAULT_SETTINGS, GeneralSettings (+14 more)

### Community 38 - "Community 38"
Cohesion: 0.14
Nodes (10): DetailDrawer(), FW, INPUT, LABEL, locationLabel(), Props, BranchDetail, BranchLocationType (+2 more)

### Community 39 - "Community 39"
Cohesion: 0.13
Nodes (24): addMembers(), badRequest(), createGroup(), deleteGroup(), getGroup(), getGroupMembers(), listGroups(), notFound() (+16 more)

### Community 40 - "Community 40"
Cohesion: 0.23
Nodes (14): autoExpire(), cancelInvitation(), countPendingInvitations(), listInvitations(), makeError(), mapInvitation(), prisma, resendInvitation() (+6 more)

### Community 41 - "Community 41"
Cohesion: 0.13
Nodes (19): APP_USER_ROLES, assignPermissionsToRole(), buildPagination(), createRole(), createRoleAuditLog(), deleteRole(), duplicateRole(), getPermissionMatrix() (+11 more)

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
Cohesion: 0.09
Nodes (20): AdminUser, removeToken(), storeToken(), AdminLayout(), LoginPage(), ProfilePage(), SignupPage(), TrustedDevicesPage() (+12 more)

### Community 46 - "Community 46"
Cohesion: 0.11
Nodes (10): duplicateRolePage(), RolesPageError, formatDate(), LEVEL_BADGE, Props, RISK_BADGE, RoleDetailsDrawer(), STATUS_BADGE (+2 more)

### Community 47 - "Community 47"
Cohesion: 0.22
Nodes (8): importUsers(), ImportResult, CSVPreview, formatBytes(), ImportUsersModal(), Props, REQUIRED_HEADERS, VALID_IMPORT_ROLES

### Community 48 - "Community 48"
Cohesion: 0.07
Nodes (29): 1. Basics, 2. Allowed enum values (use these EXACT strings), 3. The Policy object (what every endpoint returns), 4.1 List policies, 4.2 Stats (for the header / stat cards), 4.3 Get one policy, 4.4 Create policy, 4.5 Update policy (+21 more)

### Community 49 - "Community 49"
Cohesion: 0.11
Nodes (11): getInvitations(), Invitation, InvitationStatus, PALETTES, Props, ROLE_DISPLAY, sk(), SkeletonRow() (+3 more)

### Community 50 - "Community 50"
Cohesion: 0.09
Nodes (23): ACCESS_LEVEL_OPTIONS, BRANCH_OPTIONS, DEPARTMENT_OPTIONS, ROLE_OPTIONS, CreateUserRequest, UpdateUserRequest, ACCESS, ERR_INPUT (+15 more)

### Community 51 - "Community 51"
Cohesion: 0.18
Nodes (5): ApiError, DEFAULTS, Props, Settings, HierarchySettings

### Community 52 - "Community 52"
Cohesion: 0.11
Nodes (17): accessPoliciesRoutes, adminRoutes, app, cors, corsOptions, dashboardRoutes, express, groupsRoutes (+9 more)

### Community 53 - "Community 53"
Cohesion: 0.15
Nodes (7): getAllPermissions(), createRoleTemplate(), RoleTemplateError, INPUT, LABEL, Props, Permission

### Community 54 - "Community 54"
Cohesion: 0.12
Nodes (15): apiFetch(), applyRoleTemplate(), ApplyRoleTemplateResult, deleteRoleTemplate(), getRoleTemplateDetails(), getRoleTemplates(), Pagination, RoleTemplateDetails (+7 more)

### Community 55 - "Community 55"
Cohesion: 0.10
Nodes (15): bulkAction(), ENUM_ROLES, ROLE_ALIAS, RoleOption, BulkActionType, ACTION_LABELS, ActionKey, ACTIONS (+7 more)

### Community 56 - "Community 56"
Cohesion: 0.21
Nodes (10): dashboardService, getDashboardAdminWidgets(), getDashboardAnalytics(), getDashboardCore(), express, { getDashboardCore }, {
  getDashboardCore,
  getDashboardAnalytics,
}, {
  getDashboardCore,
  getDashboardAnalytics,
  getDashboardAdminWidgets,
} (+2 more)

### Community 57 - "Community 57"
Cohesion: 0.13
Nodes (52): assignDepartmentsToBranch(), assignTeamMembers(), assignUsersToDepartment(), badRequest(), conflict(), createBranch(), createDepartment(), createTeam() (+44 more)

### Community 58 - "Community 58"
Cohesion: 0.08
Nodes (9): buildPagination(), getTeamMembers(), HIERARCHY_DEFAULTS, listBranches(), listDepartments(), listTeams(), paginate(), prisma (+1 more)

### Community 59 - "Community 59"
Cohesion: 0.11
Nodes (13): apiFetch(), getRolesPageList(), KpiDef, LEVEL_BADGE, LEVEL_OPTIONS, LevelMeta, RISK_BADGE, RolesPermissionsStandalonePage() (+5 more)

### Community 60 - "Community 60"
Cohesion: 0.09
Nodes (25): assignRolePermissions(), createRolePage(), deleteRolePage(), getRolePageDetails(), getRolePermissions(), getRolesPageStats(), updateRolePage(), ACCESS_SCOPES (+17 more)

### Community 61 - "Community 61"
Cohesion: 0.22
Nodes (11): cancel(), invitationsService, list(), resend(), send(), updateExpiration(), { adminUserActionRateLimiter }, express (+3 more)

### Community 62 - "Community 62"
Cohesion: 0.07
Nodes (11): MSG_TYPE_LABEL, MsgPanelItem, NAV, NAV_SECTIONS, NavItem, NavSection, NOTIF_ICON_BG, NOTIF_ICON_COLOR (+3 more)

### Community 63 - "Community 63"
Cohesion: 0.10
Nodes (18): applyPromise, csvPath, __dirname, downloadPromise, emails, findUserRow(), fixtures, fullNameInput (+10 more)

### Community 64 - "Community 64"
Cohesion: 0.14
Nodes (26): badRequest(), createAccessPolicy(), deleteAccessPolicy(), getAccessPolicy(), getAccessPolicyStats(), listAccessPolicies(), notFound(), serverError() (+18 more)

### Community 65 - "Community 65"
Cohesion: 0.15
Nodes (12): assignModal, assignPromise, cell, checkbox, createRole(), gotoRoles(), modal, modalScope() (+4 more)

### Community 66 - "Community 66"
Cohesion: 0.29
Nodes (5): INPUT, Props, ContainerProps, ToastItem, ToastType

### Community 67 - "Community 67"
Cohesion: 0.15
Nodes (10): countAfter, countBeforeRemove, createGroup(), gotoGroups(), memberRow, modal, respPromise, row (+2 more)

### Community 68 - "Community 68"
Cohesion: 0.25
Nodes (7): code:block1 (Error: expect(locator).toBeVisible() failed), code:yaml (- complementary:), code:ts (1   | import { test, expect, type Page } from '@playwright/t), Error details, Instructions, Test info, Test source

### Community 69 - "Community 69"
Cohesion: 0.25
Nodes (7): code:block1 (Error: expect(locator).toBeVisible() failed), code:yaml (- complementary:), code:ts (1   | import { test, expect, type Page } from '@playwright/t), Error details, Instructions, Test info, Test source

### Community 70 - "Community 70"
Cohesion: 0.25
Nodes (7): code:block1 (Error: expect(locator).toBeVisible() failed), code:yaml (- complementary:), code:ts (1   | import { test, expect, type Page } from '@playwright/t), Error details, Instructions, Test info, Test source

### Community 71 - "Community 71"
Cohesion: 0.08
Nodes (14): getPermissionMatrix(), togglePermission(), LEGEND, Props, AccessState, CATEGORY_META, CATEGORY_ORDER, CatMeta (+6 more)

### Community 72 - "Community 72"
Cohesion: 0.11
Nodes (18): AccessPolicy, AccessPolicyError, AccessPolicyStats, apiFetch(), createAccessPolicy(), CreatePolicyPayload, deleteAccessPolicy(), getAccessPolicyStats() (+10 more)

### Community 73 - "Community 73"
Cohesion: 0.22
Nodes (5): PALETTES, sk(), SkeletonRow(), TD, TH

### Community 74 - "Community 74"
Cohesion: 0.22
Nodes (9): code:block1 (Error: expect(locator).not.toBeVisible() failed), code:yaml (- textbox "e.g. Development Team": MemberGroup 1782349618316), code:ts (1   | import { test, expect, type Page } from '@playwright/t), code:ts (1   | import { test, expect, type Page } from '@playwright/t), Error details, Instructions, Page snapshot, Test info (+1 more)

### Community 75 - "Community 75"
Cohesion: 0.28
Nodes (7): getMessages(), messagesService, sendMessage(), { validateSendAdminMessageInput }, VALID_PRIORITIES, VALID_TYPES, validateSendAdminMessageInput()

### Community 76 - "Community 76"
Cohesion: 0.20
Nodes (9): code:block1 (Test timeout of 30000ms exceeded.), code:block2 (Error: locator.check: Test timeout of 30000ms exceeded.), code:yaml (- generic [ref=e2]:), code:ts (1   | import { test, expect, type Page } from '@playwright/t), Error details, Instructions, Page snapshot, Test info (+1 more)

### Community 77 - "Community 77"
Cohesion: 0.20
Nodes (7): future, listPromise, roleSelect, row, rows, sendPromise, statusFilter

### Community 78 - "Community 78"
Cohesion: 0.22
Nodes (8): code:block1 (Error: expect(received).toBeGreaterThan(expected)), code:yaml (- generic [ref=e2]:), code:ts (70  |     await page.goto('/users')), Error details, Instructions, Page snapshot, Test info, Test source

### Community 79 - "Community 79"
Cohesion: 0.25
Nodes (8): code:block1 (Error: expect(received).toBeTruthy()), code:yaml (- generic [ref=e2]:), code:ts (1  | import { test, expect, type Page } from '@playwright/te), Error details, Instructions, Page snapshot, Test info, Test source

### Community 80 - "Community 80"
Cohesion: 0.25
Nodes (7): code:block1 (Error: expect(locator).toBeVisible() failed), code:yaml (- complementary:), code:ts (1   | import { test, expect, type Page } from '@playwright/t), Error details, Instructions, Test info, Test source

### Community 81 - "Community 81"
Cohesion: 0.29
Nodes (6): activeLearnersCard, from, lastMonth, to, today, totalUsersCard

### Community 82 - "Community 82"
Cohesion: 0.33
Nodes (7): createBranch(), createDepartment(), emptyState, gotoOrgSubTab(), respPromise, row, waitForApi()

### Community 91 - "Community 91"
Cohesion: 0.25
Nodes (7): code:block1 (Error: expect(locator).toBeVisible() failed), code:yaml (- complementary:), code:ts (1   | import { test, expect, type Page } from '@playwright/t), Error details, Instructions, Test info, Test source

### Community 92 - "Community 92"
Cohesion: 0.10
Nodes (37): applyRoleTemplate(), badRequest(), createRoleTemplate(), deleteRoleTemplate(), getRoleTemplate(), invalidPermissions(), listRoleTemplates(), notFound() (+29 more)

### Community 93 - "Community 93"
Cohesion: 0.12
Nodes (11): TAB_STYLE_BASE, BTN_GHOST, BTN_PRIMARY, CAT_META, FIELD, INPUT, LABEL, MODAL_BOX() (+3 more)

### Community 94 - "Community 94"
Cohesion: 0.25
Nodes (7): code:block1 (Error: expect(locator).not.toBeVisible() failed), code:yaml (- button "Save Changes"), code:ts (1   | import { test, expect, type Page } from '@playwright/t), Error details, Instructions, Test info, Test source

### Community 95 - "Community 95"
Cohesion: 0.25
Nodes (7): code:block1 (Error: expect(locator).not.toBeVisible() failed), code:yaml (- textbox "e.g. Development Team": SearchGroup 1782349635984), code:ts (40  | test.describe.serial('Group CRUD', () => {), Error details, Instructions, Test info, Test source

### Community 96 - "Community 96"
Cohesion: 0.25
Nodes (7): code:block1 (Error: expect(locator).toContainText(expected) failed), code:yaml (- row "invite.1782349134208546@mindnavy.com Instructor — Min), code:ts (1  | import { test, expect, type Page } from '@playwright/te), Error details, Instructions, Test info, Test source

### Community 97 - "Community 97"
Cohesion: 0.25
Nodes (7): code:block1 (Error: expect(locator).toBeVisible() failed), code:yaml (- complementary:), code:ts (1   | import { test, expect, type Page } from '@playwright/t), Error details, Instructions, Test info, Test source

### Community 98 - "Community 98"
Cohesion: 0.25
Nodes (7): code:block1 (Error: expect(locator).toBeVisible() failed), code:yaml (- complementary:), code:ts (1   | import { test, expect, type Page } from '@playwright/t), Error details, Instructions, Test info, Test source

### Community 99 - "Community 99"
Cohesion: 0.25
Nodes (7): code:block1 (Error: expect(locator).toBeVisible() failed), code:yaml (- complementary:), code:ts (1   | import { test, expect, type Page } from '@playwright/t), Error details, Instructions, Test info, Test source

### Community 100 - "Community 100"
Cohesion: 0.25
Nodes (7): code:block1 (Error: expect(locator).toBeVisible() failed), code:yaml (- complementary:), code:ts (1   | import { test, expect, type Page } from '@playwright/t), Error details, Instructions, Test info, Test source

### Community 101 - "Community 101"
Cohesion: 0.33
Nodes (5): { adminUserActionRateLimiter }, express, {
  listPermissions, getPermission, createPermission, updatePermission, deletePermission,
}, { requireAdminAuth }, router

### Community 102 - "Community 102"
Cohesion: 0.29
Nodes (4): sk(), SkeletonRow(), TD, TH

### Community 103 - "Community 103"
Cohesion: 0.21
Nodes (9): card, createPolicy(), CreatePolicyOpts, gotoAccessPolicies(), modal, modalScope(), respPromise, rows (+1 more)

### Community 104 - "Community 104"
Cohesion: 0.17
Nodes (9): apiCall(), RolesApiError, rolesPermissionsAPI, AssignRoleRequest, RoleType, INPUT, Props, ROLES (+1 more)

### Community 105 - "Community 105"
Cohesion: 0.24
Nodes (10): assertRoleExists(), buildPagination(), createAccessPolicy(), createPolicyAuditLog(), deleteAccessPolicy(), listAccessPolicies(), paginate(), POLICY_SELECT (+2 more)

### Community 106 - "Community 106"
Cohesion: 0.18
Nodes (6): adapter, prisma, { PrismaClient }, { PrismaPg }, prisma, prisma

### Community 107 - "Community 107"
Cohesion: 0.18
Nodes (9): BRANCH_NAME_PREFIXES, DEPARTMENT_PREFIXES, GROUP_NAME_PREFIXES, prisma, ROLE_NAME_PREFIXES, TEAM_NAME_PREFIXES, USER_EMAIL_PREFIXES, USER_NAME_PREFIXES (+1 more)

### Community 108 - "Community 108"
Cohesion: 0.39
Nodes (7): createUserAuditLog(), getAdminMessages(), makeError(), mapMessage(), MESSAGE_SELECT, prisma, sendAdminMessage()

### Community 109 - "Community 109"
Cohesion: 0.12
Nodes (12): dashboardCard, dashboardPromise, headerStatsPromise, kpiGrid, labelSpan, tabCardValue, tabPromise, tabStatsGrid (+4 more)

### Community 110 - "Community 110"
Cohesion: 0.33
Nodes (4): PERMISSIONS, prisma, ROLE_TEMPLATES, ROLES

### Community 113 - "Community 113"
Cohesion: 0.29
Nodes (6): { adminUserActionRateLimiter }, express, {
  listRoles, getRole, createRole, updateRole, deleteRole,
  getRolePermissions, assignPermissionsToRole,
}, {
  listRoles, getRolesStats, getRole, createRole, updateRole, deleteRole, duplicateRole,
  getRolePermissions, assignPermissionsToRole,
}, { requireAdminAuth }, router

### Community 114 - "Community 114"
Cohesion: 0.40
Nodes (3): assert, state, { test, describe, before, after }

## Knowledge Gaps
- **850 isolated node(s):** `name`, `version`, `description`, `main`, `start` (+845 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getStoredToken()` connect `Community 22` to `Community 2`, `Community 24`, `Community 25`, `Community 26`, `Community 27`, `Community 32`, `Community 34`, `Community 35`, `Community 45`, `Community 47`, `Community 49`, `Community 54`, `Community 55`, `Community 59`, `Community 60`, `Community 62`, `Community 72`, `Community 102`, `Community 104`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `ToastType` connect `Community 66` to `Community 34`, `Community 71`, `Community 72`, `Community 104`, `Community 59`, `Community 46`, `Community 49`, `Community 50`, `Community 53`, `Community 54`, `Community 55`, `Community 24`, `Community 27`, `Community 60`, `Community 30`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `requireAdminAuth()` connect `Community 36` to `Community 64`, `Community 5`, `Community 101`, `Community 9`, `Community 113`, `Community 56`, `Community 57`, `Community 92`, `Community 61`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _850 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11076923076923077 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08858858858858859 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._