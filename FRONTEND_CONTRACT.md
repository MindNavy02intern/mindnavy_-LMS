# Frontend Contract Sheet — MindNavy LMS Backend

> **Date:** 2026-07-08 · **Backend branch:** `hasan1` (after Phases 1–3 backend hardening)
> **Rule:** the backend is the source of truth for API contracts. This sheet documents the REAL,
> current backend behavior. Where the frontend currently disagrees, the fix needed is listed in §2.
> Verified against the running code — not the blueprint.

---

## 1. Basics (auth, envelopes, errors, pagination)

### Base URL
- All endpoints live under **`/api/admin`** (default dev: `http://localhost:5001/api/admin`).
- Frontend env var: `VITE_API_BASE_URL`.
- `frontend/src/api/index.ts` (port 3000, no auth header) is **dead code with zero imports — delete it.**

### Auth
- Header on every protected call: `Authorization: Bearer <token>`.
- Token comes from `POST /login`. Sessions last **24 h**, no refresh endpoint — after expiry any call returns 401.
- Every route below requires auth **except**: `POST /login`, `POST /forgot-password`, `POST /reset-password`.
- Auth failures: `401 {"success":false,"message":"Unauthorized." | "Invalid session." | "Session expired." | "Session revoked."}`,
  `403 {"success":false,"message":"Access denied."}` (disabled admin).
- **Recommended:** add ONE global 401 handler (clear token → redirect to /login). Today an expired
  token produces silent empty screens because each module swallows errors separately.

### Error envelope (all endpoints)
```json
{ "success": false, "message": "Human-readable reason." }
```
- Some validators additionally return `"errors": ["...","..."]` (login, forgot/reset-password, organization).
- **Read `message` first, fall back to `error`** — nothing returns `error` anymore, but old code did.
- 500s never contain internal details (fixed in Phase 1 — previously 2 endpoints leaked `{error, code}`).
- 429 (rate limit) also returns `{ success:false, message }`.

### Rate limits (429 when exceeded)
| Scope | Limit |
|---|---|
| `POST /login`, `/forgot-password`, `/reset-password` | 20 / 15 min per IP |
| All admin write actions (`adminUserActionRateLimiter`) | 60 / 10 min |
| `/lm/*` (all), `/users/analytics` | 30 / min prod · 300 / min dev |
| `/courses*` reads | 120 / min |
| `POST /users/import` | 5 / 10 min |
| `POST /otp/send` | 10 / 15 min |

### Pagination — TWO formats exist (not yet standardized)
| Format | Fields | Used by |
|---|---|---|
| A | `{ page, limit, total, totalPages }` | users list, invitations |
| B | `{ page, limit, total, pages }` | organization, groups, roles, permissions, templates, assignments, access policies, courses, LM courses, user messages |

Keep per-module types matching the module's format. Standardization may come in a later contract pass.

---

## 2. ⚠️ ACTION REQUIRED — frontend fixes (current real mismatches)

These break TODAY against the real backend (mocks hide them):

1. **Course tab counts are lowercase.** `GET /courses` returns
   `statusCounts: { all, draft, pending, published, archived }`.
   Frontend indexes `statusCounts['All' | 'Draft' | ...]` → every badge is `undefined`.
   Fix: `frontend/src/types/courses.ts` (`CourseStatusCounts`), `CoursesTab.tsx` (line ~213), and the mock in `coursesApi.ts`.

2. **LM distribution field is `percentage`, not `percent`.**
   `GET /lm/distribution` → `data.items[] = { category, count, percentage }`.
   Fix: `frontend/src/types/lm.ts` (line ~28), `DistributionChart.tsx` (line ~77), mock in `lmApi.ts`.

3. **`lmFetch` reads the wrong error field.** Backend sends `message`; `lmApi.ts` reads `body.error`.
   Fix: read `message ?? error`.

4. **Admin header "Messages" panel can never work.**
   `AdminLayout.tsx` (~line 406) calls `GET /messages?recipientId=<ADMIN id>` — but `recipientId`
   must be an **AppUser** id (it lists messages admins sent TO a user). There is **no admin inbox
   endpoint**. Decision needed: remove the panel, or request an admin-inbox endpoint from backend.

5. **Password minimum is now 12 characters** (was effectively 8) for: create user, admin reset of a
   user password, admin's own reset-password flow, CSV import rows. Add client-side 12+ validation /
   hint so users don't discover it via the 400 message. Existing passwords still log in fine.

6. **Update all mocks to match the shapes in this sheet field-by-field** (`USE_MOCK` files:
   `coursesApi.ts`, `lmApi.ts`). Items 1–2 shipped precisely because the mocks drifted.

7. **Delete `frontend/src/api/index.ts`** (dead, wrong port, no auth header).

Also fresh but non-breaking: org/groups/invitations mutations now write audit entries, so the
Dashboard "Recent Activity" feed shows new actions like `BRANCH_CREATED` (auto-formatted labels).

---

## 3. Endpoint catalog (current, verified)

All paths relative to `/api/admin`. All responses are JSON. `…user` below means the mapped user
object (see §3.2).

### 3.1 Auth (`/`)
| Method & path | Body | Success response |
|---|---|---|
| `POST /login` | `{email, password}` | `200 {success, message, token, admin:{id,email,fullName,role,status}}` · 401 bad creds · 400 `{success,message,errors[]}` |
| `GET /me` | — | `200 {success, admin:{id,email,fullName,name,role,status}, session:{id,expiresAt}}` |
| `POST /logout` | — | `200 {success, message}` |
| `POST /otp/send` | — (auth) | `200 {success, message}` — code goes to server console in dev · rate-limited 10/15 min |
| `POST /otp/verify` | `{code}` (6 digits) | `200 {success, message}` — **currently verifies only; grants nothing; `trustDevice` is IGNORED** (see §5) |
| `GET /trusted-devices` | — | `200 {success, devices:[]}` — **always empty today** (nothing creates devices yet) |
| `DELETE /trusted-devices/:deviceId` | — | `200 {success,message}` · 404 |
| `POST /forgot-password` | `{email}` | always `200 {success, message}` (never reveals if email exists) |
| `POST /reset-password` | `{email, code, newPassword(≥12)}` | `200 {success,message}` · 400 invalid/expired code — **revokes all sessions on success** |

### 3.2 Users (`/users`)
Mapped user object (list + detail + mutation responses):
```json
{ "id","fullName","email","avatar","role":"learner|instructor|manager|admin_assistant",
  "status":"active|suspended|pending|archived|invited",
  "verificationState":"verified|pending|rejected|expired",
  "emailVerified","phoneVerified","phone","department","branch","groupId","accessLevel",
  "managerId","skills":[], "lastActivityAt","riskScore","suspendedAt","enrollmentCount":0,
  "createdAt", "updatedAt (detail/mutations only)" }
```
| Method & path | Body / query | Success response |
|---|---|---|
| `GET /users` | `?page&limit(≤100)&search&role&status&verificationState&department&branch&createdAfter&createdBefore` | `200 {success, kpiSummary:{totalUsers,totalUsersChange,activeUsers,activeUsersChange,pendingVerification,pendingVerificationChange,suspendedUsers,suspendedUsersChange,invitationsPending,invitationsPendingChange}, users:[…user], pagination(A)}` |
| `GET /users/export` | same filters, no paging | `200 {success, users:[…user], total}` — capped at 5000 rows |
| `GET /users/analytics` | — | `200 {success, analytics:{usersByRole[], usersByDepartment[], newUsersThisMonth:{count,changePercentage}, userActivity:{activeToday,activeThisWeek,dailyTrend[{date,count}]}, verificationStatus[]}}` |
| `GET /users/:id` | — | `200 {user, roles:[], securityOverview:{mfaEnabled,activeSessions,lastIpAddress,lastLocation,riskScore}, recentActivity:[{id,action,timestamp,ipAddress}], enrolledCourses:[]}` — **NO `success` flag**; `roles`/`securityOverview`/`enrolledCourses` are STUBS (§5) |
| `POST /users` | `{fullName, email, password(≥12, omit if status INVITED), role, status?, verificationState?, phone?, department?, branch?, groupId?, accessLevel?, managerId?, skills?}` | `201 {success, message, user}` · 409 duplicate email |
| `PATCH /users/:id` | any of: fullName,email,avatar,verificationState,riskScore,phone,department,branch,groupId,accessLevel,managerId,skills,role | `200 {success,message,user}` · 400 unknown fields rejected |
| `PATCH /users/:id/status` | `{status, reason?}` | `200 {success,message,user}` |
| `PATCH /users/:id/suspend` | `{reason (required), notes?}` | `200 {success,message,user}` |
| `PATCH /users/:id/reactivate` | `{}` | `200 {success,message,user}` |
| `PATCH /users/:id/approve-verification` | `{}` | `200 {success,message,user}` (sets VERIFIED + ACTIVE) |
| `PATCH /users/:id/reject-verification` | `{}` | `200 {success,message,user}` (sets REJECTED + SUSPENDED) |
| `POST /users/:id/reset-password` | `{newPassword(≥12)}` | `200 {success,message}` — also revokes ALL of that user's app sessions |
| `PATCH /users/:id/role` | `{roleId: enum name OR role-table UUID, reason?}` | `200 {success,message,user}` |
| `DELETE /users/:id` | — | `200 {success,message}` — soft delete (status→ARCHIVED) |
| `DELETE /users/:id/permanent` | — | `200 {success,message}` — only if already ARCHIVED, else 400 |
| `POST /users/:id/force-logout` | `{reason?}` | `200 {success, message, data:{userId, revokedSessionsCount}}` |
| `POST /users/import` | multipart, field **`file`**, CSV ≤ 1 MB | `200 {success, message, summary:{totalRows,created,failed,skipped}, errors:[{row,email,message}]}` |
| `POST /users/bulk-action` | `{action:"suspend"\|"reactivate"\|"archive"\|"delete"\|"assign_role"\|"notify", userIds:[≤500], params?:{roleId?, reason?}}` | `200 {success, message, succeeded, failed, errors:[]}` |
| `POST /users/:id/messages` | `{message(≤2000), subject?(≤150)}` | `201 {success, message, adminMessage}` |
| `GET /users/:id/messages` | `?page&limit(≤50)` | `200 {success, messages[], pagination(B)}` |

### 3.3 Messages (`/messages`) — canonical messaging surface
| Method & path | Body / query | Success response |
|---|---|---|
| `POST /messages` | `{recipientId (AppUser UUID), body(10–2000), subject?(≤150), type?: DIRECT\|WARNING\|POLICY_UPDATE\|ANNOUNCEMENT\|FEEDBACK, priority?: NORMAL\|HIGH\|URGENT}` | `201 {success, message, adminMessage:{id,receiverUserId,subject,body,messageType,priority,status,readAt,createdAt}}` |
| `GET /messages` | `?recipientId=<AppUser UUID>&page&limit(≤50)` | `200 {success, messages[], pagination(B)}` — messages RECEIVED BY that app user. **NOT an admin inbox** (§2.4) |

### 3.4 Invitations (`/invitations`)
Invitation object: `{id,email,role(lowercase),department,status:"pending|accepted|expired|revoked",expiresAt,invitedBy,invitedByName,personalMessage,createdAt,updatedAt}`
| Method & path | Body / query | Success response |
|---|---|---|
| `GET /invitations` | `?page&limit&search&status` | `200 {success, invitations[], pagination(A), pendingCount}` |
| `POST /invitations` | `{email, role, department?, personalMessage?, expiresInDays?(1–90, default 7)}` | `201 {success, message, invitation}` · 409 pending invite exists |
| `POST /invitations/:id/resend` | — | `200 {success,message,invitation}` (resets PENDING + 7 days) |
| `DELETE /invitations/:id` | — | `200 {success,message,invitation}` (status→REVOKED) |
| `PATCH /invitations/:id/expiration` | `{expiresAt (future ISO date)}` | `200 {success,message,invitation}` |

**No email is actually sent, and there is no public accept endpoint yet** — see §5.

### 3.5 Organization (`/organization`)
| Method & path | Notes |
|---|---|
| `GET /branches?search&page&limit` | `200 {success, data:[branch row], pagination(B)}` |
| `GET /branches/:branchId` | `200 {success, data}` (detail incl. departments, users≤20, metrics) |
| `POST /branches` · `PATCH /branches/:branchId` · `DELETE /branches/:branchId` | `{success, message, data?}` — errors 400/404/409 |
| `POST /branches/:branchId/assign-departments` | body `{departmentIds:[]}` → `{success,message,assignedCount}` |
| `GET/POST/PATCH/DELETE /departments…` | same pattern; `POST /departments/:id/assign-users` body `{userIds:[]}` → `{success,message,assignedCount,failedCount}`; `GET /departments/:id/kpis` |
| `GET/POST/PATCH/DELETE /teams…` | same pattern; `POST /teams/:teamId/assign-members` `{userIds:[]}`; `GET /teams/:teamId/members?search&page&limit` |
| `GET /chart` | `200 {success, nodes:[{id,label,type,parentId?,data}], edges:[{id,source,target,animated}]}` — 30 s server cache, **invalidated on every org mutation**, so a refetch after create/move/delete is always fresh |
| `PATCH /chart/move` | `{nodeId, newParentId, action:"MOVE_DEPARTMENT"|"MOVE_TEAM"|"MOVE_USER"}` → `{success,message,data}` |
| `GET /hierarchy/settings` · `PATCH /hierarchy/settings` · `POST /hierarchy/settings/reset` | `{success, message?, data:settings}` |

### 3.6 Groups (`/groups`)
| Method & path | Success response |
|---|---|
| `GET /groups?search&status&departmentId&page&limit(≤200)` | `200 {success, data:[group], pagination(B)}` |
| `GET /groups/:id` | `200 {success, data:{…group, members:[{userId,role,joinedAt,user:{id,fullName,email,avatar}}]}}` |
| `POST /groups` `{name, description?, departmentId?, leaderId?, status?: ACTIVE\|INACTIVE}` | `201 {success,message,data}` · 409 duplicate name · 400 invalid status |
| `PATCH /groups/:id` · `DELETE /groups/:id` | `{success,message,data?}` |
| `GET /groups/:id/members` | `200 {success, data:[member]}` |
| `POST /groups/:id/members` `{userIds:[], role?}` | `201 {success,message,data:[all members]}` |
| `DELETE /groups/:id/members/:userId` | `200 {success,message}` |

### 3.7 Roles & Permissions family
All follow `{success, data | …result, message?}`; list endpoints return `{success, data:[], pagination(B)}`.
| Area | Endpoints |
|---|---|
| Roles `/roles` | `GET /` (`?search&status&page&limit`), `GET /stats`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id`, `GET /:id/permissions`, `POST /:id/permissions`, `POST /:id/duplicate` |
| Permissions `/permissions` | `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` |
| Matrix `/permission-matrix` | `GET /` → `{success,data}` · `POST /toggle` → `{success,message,data}` |
| Templates `/role-templates` | `GET /`, `GET /:id`, `POST /`, `POST /:id/apply` (body takes `roleId`), `DELETE /:id` |
| Assignments `/user-role-assignments` | `GET /stats`, `GET /`, `POST /`, `PATCH /:id`, `DELETE /:id` |
| Access policies `/access-policies` | `GET /`, `GET /stats`, `GET /:id`, `POST /`, `PATCH /:id`, `DELETE /:id` |

### 3.8 Dashboard (`/dashboard`) — fields are SPREAD at top level (no `data` wrapper)
| Method & path | Success response (top-level keys) |
|---|---|
| `GET /dashboard/core` | `{success, welcome, kpis, recentActivities[], notificationsPreview[], securityAlertsPreview[], quickActions[], systemHealth}` |
| `GET /dashboard/analytics?departmentId&dateFrom&dateTo` | `{success, filters, learningActivity[], usersByRole[], usersByDepartment[], userActivity, verificationStatus[], topDepartments[], revenueOverview, userAnalytics, courseAnalytics, courseCompletion, instructorPerformance, studentEngagement, performanceOverview}` — revenue/course/instructor blocks are **zero-filled stubs** |
| `GET /dashboard/admin-widgets?…` | `{success, filters, pendingApprovals:{total,items:[]}, liveSessions:{activeCount,…}, tasksAndReminders:[], recentTransactions:[], calendarEvents:[], reportsSnapshot, aiInsights:[]}` — mostly stubs |

### 3.9 Learning Management (`/lm`) — all return `{success, data}`
| Endpoint | data shape |
|---|---|
| `GET /lm/stats` | `{totalCourses:{value,growth}, activeCourses, totalEnrollments, coursesCompleted, avgCompletionRate, certificatesIssued}` (growth = number or **null**) |
| `GET /lm/distribution` | `{total, items:[{category, count, percentage}]}` ← **percentage** |
| `GET /lm/progress?range=week|month|year` | `[{date, completed, inProgress, notStarted, overdue}]` |
| `GET /lm/top-courses?limit` | `[{id,title,instructor,completionRate,enrolledCount,thumbnail}]` |
| `GET /lm/content-stats` | `{totalContentItems, videoLessons, documents, pdfFiles, quizzes, scormPackages}` |
| `GET /lm/courses?page&limit&category&instructor` | `{courses[], pagination(B)}` |
| `GET /lm/activities?limit` | `[{id,type,title,actorName,createdAt}]` |
| `GET /lm/live-sessions?status=upcoming|live|ended` | `[{id,title,instructor,startTime,status,enrolledCount,relatedCourse}]` |
| `GET /lm/filter-options` | `{categories:[], instructors:[{id,name}]}` |

### 3.10 Courses (`/courses`) — all return `{success, data, message?}`
| Method & path | Body / query | data |
|---|---|---|
| `GET /courses` | `?page&limit&status(All\|Draft\|Pending\|Published\|Archived)&category&instructor&search` | `{courses:[{id,title,instructor,instructorId,category,level("Beginner"…),enrolledCount,status("Draft"…),thumbnail,updatedAt}], pagination(B), statusCounts:{all,draft,pending,published,archived}}` ← **lowercase keys** |
| `GET /courses/:id` | — | full course (+subtitle, description, language, tags, createdBy, createdAt) |
| `POST /courses` | `{title, instructorId (must be an INSTRUCTOR), subtitle?, description?, category?, language?, level?, thumbnail?, tags?}` | `201`, always created as **Draft** |
| `PATCH /courses/:id` | any of the above + `status` | updated course |
| `DELETE /courses/:id` | — | `{id, status:"Archived"}` — soft archive |

### 3.11 Course Builder (backend READY, no frontend consumer yet) — `{success, data, message?}`
| Method & path | Body |
|---|---|
| `GET /courses/:courseId/sections` | → `data:[{id,courseId,title,order,createdAt,updatedAt,lessons:[{id,sectionId,title,type:"TEXT"\|"VIDEO_URL",content,durationMin,order,…}]}]` |
| `POST /courses/:courseId/sections` | `{title, order?}` → 201 |
| `PATCH /sections/:id` · `DELETE /sections/:id` | delete cascades lessons |
| `POST /sections/:sectionId/lessons` | `{title, type, content?, durationMin?, order?}` — VIDEO_URL requires a valid URL in `content` |
| `PATCH /lessons/:id` · `DELETE /lessons/:id` | |
| `PATCH /courses/:courseId/reorder` | `{sections:[{id,order}], lessons:[{id,sectionId,order}]}` → returns full fresh section list |

### 3.12 Uploads (`/uploads`) — thumbnails only; `kind:"video"` returns 400 "coming soon"
| Method & path | Body / query | data |
|---|---|---|
| `POST /uploads/sign` | `{fileName, fileType(image/jpeg\|png\|webp), kind:"thumbnail", courseId}` | `{uploadUrl, path, kind, maxBytes(5MB), expiresIn(600)}` — then PUT the file to `uploadUrl` directly |
| `POST /uploads/confirm` | `{courseId, path, kind, lessonId?}` | `{url}` — sets `course.thumbnail`; `path` MUST start with `<courseId>/` (else 400 "Invalid file path.") |
| `DELETE /uploads?path=…` | path must be `<courseId>/<file>` | `{deleted, path}` |

⚠️ **Currently returns `503 "File storage is not configured yet."`** — `@supabase/supabase-js`
is not yet installed in the backend and env vars may be unset. Don't build UI error states around
anything except: 503 = not available, 400/404 = your input, 502 = storage hiccup (retryable).

---

## 4. Recent backend changes that affect you (Phases 1–3, live now)

1. **500 error shape standardized** on `POST /messages` and `POST /users/:id/force-logout` — they now return `{success:false, message}` like everything else (previously `{error, code}`; your `message`-reading code now works on them too).
2. **Password minimum = 12** everywhere a new password is set (see §2.5).
3. **New audit actions** appear in Dashboard Recent Activity: `BRANCH_*`, `DEPARTMENT_*`, `TEAM_*`, `ORG_NODE_MOVED`, `HIERARCHY_SETTINGS_*`, `GROUP_*`, `INVITATION_*`, `USER_PERMANENTLY_DELETED`, `USER_VERIFICATION_REJECTED`, course-builder actions. Labels are auto-generated (lowercased words); friendly labels can be added on request.
4. **Org chart is no longer stale after mutations** — the 30 s server cache is invalidated on every org change, so your `invalidateFor()` refetch now always sees fresh data (drag-and-drop no longer "undoes" itself).
5. **`suspendedAt` invariant**: it is non-null exactly while `status === "suspended"` — reactivating (single or bulk) clears it, any status change sets/clears it correctly. If any UI showed a stale "suspended since" on active users, that's fixed.
6. **Admin reset of a user's password now revokes that user's app sessions** (no separate force-logout call needed for that flow).
7. **`POST /otp/send` is rate-limited** (10/15 min) — handle 429 on it like other limited endpoints.
8. **Groups `status` is validated**: only `ACTIVE`/`INACTIVE` accepted on create/update (400 otherwise) — matches your existing `types/groups.ts`.
9. No route names, methods, or success shapes changed.

---

## 5. Known-incomplete areas (don't build against these as if real)

| Area | Reality today |
|---|---|
| **OTP / 2FA** | `otp/verify` validates the code but grants NOTHING; login already returns a full token. `trustDevice` flag is ignored; `GET /trusted-devices` is always empty; `GET /api/devices/check` (referenced in `VerifyDevicePage.tsx`) does not exist. |
| **User details drawer** | `roles: []`, `securityOverview` (mfaEnabled:false, activeSessions:0, …), `enrolledCourses: []` are HARD-CODED STUBS — show as "coming soon", not as real data. |
| **Invitations** | No email is sent (server console log only); no public accept endpoint; `accepted` status is currently unreachable. |
| **Dashboard** | revenue/courseAnalytics/instructorPerformance/tasks/transactions/calendar/reports/aiInsights are zero/empty stubs. |
| **Learner auth** | App users cannot log in yet; `liveSessionsRunning` / online counts / force-logout act on an (almost always empty) session table. |
| **Signup page** | `SignupForm.tsx` uses Supabase auth the backend never reads — accounts created there don't exist for this backend. Remove or gate the `/signup` route. Note `supabase.ts` throws at import if env vars are missing. |

---

## 6. Heads-up: planned backend changes (NOT live yet — will be flagged)

Backend Phase 5 will introduce, **behind an env flag (`OTP_ENFORCEMENT`, default off)**:
- `POST /login` may return `otpRequired: true` with a RESTRICTED token that can only call `/otp/send`, `/otp/verify`, `/me`, `/logout` until verified.
- `POST /otp/verify` will accept `{code, trustDevice}` and upgrade the session; `trustDevice:true` creates a real TrustedDevice, and future logins from it skip OTP.
- Frontend will need: login → if `otpRequired` → OTP screen → on success continue to dashboard.
- Also coming: Helmet security headers, env-driven CORS (send exact dev/prod origins), admin role tiers (`super_admin` vs `admin` — some destructive endpoints will 403 for non-super-admins).
- Token storage stays **Bearer + localStorage** for now (no cookie migration without joint design).

**Nothing changes for you until we flip the flag together** — an updated contract addendum will precede it.

---

## 7. Frontend test checklist (run against the REAL backend, `USE_MOCK=false`)

1. Login → dashboard loads; `GET /me` restores session after reload.
2. Courses tab: tab count badges show real numbers (after §2.1 fix).
3. LM Overview: distribution chart shows percentages (after §2.2 fix); kill the backend and confirm LM errors show real messages (after §2.3 fix).
4. Users: list, search, filter, create (password ≥ 12), edit, suspend/reactivate, archive → permanent delete, CSV import (incl. one row with a short password → row error), export, bulk action.
5. Invitations: send / resend / cancel / change expiration.
6. Organization: create/edit/delete branch/department/team; drag a chart node and refetch — the chart must reflect the change immediately (stale-cache bug fixed in backend Phase 3).
7. Groups: CRUD + add/remove members.
8. Roles page: CRUD, permissions assign, matrix toggle, templates apply, assignments, access policies.
9. Error paths: expired/garbage token on any page → currently silent; after the global 401 handler → redirect to login.
10. Messages: send message to a USER from the user drawer (works); admin header messages panel (decide per §2.4).

---

*Questions / mismatches found while integrating → tell Hassan; the backend contract only changes with a documented update to this sheet.*
