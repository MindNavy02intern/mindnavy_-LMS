# Instructors & Applications — API Contract v1

For the frontend (Bilal). Backend is built, mounted, migrated and smoke-tested
(**89/89 green** — `node src/scripts/instructorsSmokeTest.js`). This is the
source of truth for blueprint 05 (Instructors) tasks 103–108. If anything here
conflicts with a task description, **this contract wins**.

- **Base URLs:** `http://localhost:5001/api/admin/instructors` ·
  `…/api/admin/instructor-applications` · `…/api/public/instructor-applications`
- **Auth:** `Authorization: Bearer <admin token>` on every admin request (401 if missing/invalid)
- **Envelope (success):** `{ "success": true, "data": <payload>, "message"?: string }`
- **Envelope (error):** `{ "success": false, "message": string }`
- **IDs:** uuid strings · **Dates:** ISO 8601 strings
- **Rate limits:** reads 120/min · stats 30/min (300 in dev) · writes 60/10min ·
  public submit 5/hour per IP → on `429` show "slow down and retry"

---

## ⚠️ Read these five notes before building

> **1. An instructor IS an `AppUser` with `role = INSTRUCTOR`.** There is no
> separate instructors table. `:id` in every route below is the **AppUser id** —
> the exact value stored in `Course.instructorId` and `LiveSession.instructorId`,
> so one identifier links Instructors ↔ Courses ↔ Live Sessions. A new
> `InstructorProfile` side table holds only instructor-specific fields
> (specialization, bio, links…) and is **optional**: instructors created before
> this module — and any created through `POST /api/admin/users` — have no profile
> row and still appear here with `hasProfile: false` and null profile fields.
> Render that, don't filter it out.

> **2. Rating and revenue do not exist in this system.** There is no Review model
> and no Payment/Transaction/Payout model. `rating` and `revenue` on a row are
> always `null`; `avgRating` and `totalRevenue` in `/stats` come back as
> `{ value: null, available: false, reason }`. **Render `—`, never `$0` or
> `0.0/5`** — a zero reads as a real measurement. The design-doc numbers
> (1,256 · $248,560 · 4.7/5 · ↑8.6%) are mockups; none of them are data.

> **3. Status, verification, email and password are owned by the Users module.**
> `PATCH /instructors/:id` accepts profile fields (+ `fullName`, `phone`, `skills`)
> and returns **400** naming the right endpoint if you send `status`, `email`,
> `role`, `verificationState` or `password`. The verify/suspend/reactivate routes
> below exist so the Instructors screen has its own verbs, but they delegate to
> the Users module underneath — so a suspend here shows up instantly in the Users
> table, and vice versa. One field, one owner.

> **4. The Pending tab is a different table.** `?tab=pending` on the instructors
> list is a **400 on purpose**: people awaiting approval are not instructors yet.
> That tab reads `GET /api/admin/instructor-applications`. Its badge count comes
> from `tabCounts.pending` on the list response, which is the same number as
> `stats.pendingApproval` — both call one shared implementation, so they cannot drift.

> **5. Existing infra — use it, don't invent it.** `queryKeys.instructors.*`
> already exists in `queryKeys.ts` (`list`, `detail`, `applications`, `earnings`,
> `reviews`, `documents`). The sidebar link `/instructors` already exists in
> `AdminLayout.tsx` and is **dead — there is no route yet**; adding it is part of
> task 104. `invalidation.ts` already has `instructorApplication.submit/.approve/
> .reject`, `instructor.suspend` and `review.moderate`; the six new mutation IDs
> are listed at the bottom of this file and must be added with their IMPACT_MAP rows.

---

## Types

```ts
// Same lowercase vocabulary the Users module already returns — these are the
// same AppUser rows, so the two tables never disagree on a label.
export type InstructorStatus = 'active' | 'suspended' | 'pending' | 'invited' | 'archived';
export type VerificationState = 'verified' | 'pending' | 'rejected' | 'expired';

export interface Instructor {
  id: string;                       // AppUser id — same as Course.instructorId
  userId: string;                   // identical to `id`; kept explicit for clarity
  fullName: string;
  email: string;
  avatar: string | null;
  phone: string | null;
  status: InstructorStatus;
  verificationState: VerificationState;
  skills: string[];
  department: string | null;
  branch: string | null;

  // Profile side table — all null when hasProfile === false
  specialization: string | null;
  headline: string | null;
  bio: string | null;
  yearsExperience: number | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  revenueShareBps: number | null;   // basis points (1250 = 12.50%) — stored, unused in v1
  hasProfile: boolean;

  // Live aggregates — computed per request, never stored
  coursesCount: number;             // non-archived courses they own
  publishedCoursesCount: number;
  studentsCount: number;            // DISTINCT learners across their courses

  rating: null;                     // no Review model — render "—"
  revenue: null;                    // no Payment model — render "—"

  verifiedAt: string | null;
  verifiedById: string | null;
  lastActivityAt: string | null;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstructorDetail extends Instructor {
  liveSessionsCount: number;
  courses: Array<{
    id: string;
    title: string;
    status: 'DRAFT' | 'PENDING' | 'PUBLISHED' | 'ARCHIVED';
    category: string | null;
    thumbnail: string | null;
    enrolledCount: number;
    createdAt: string;
  }>;                               // most recent 50
}

export interface Metric {
  value: number | null;
  changePercent: number | null;     // vs last month; null when not computable
  available: boolean;               // false = no source table exists yet
  reason?: string;                  // present only when available === false
}

export type ApplicationStatus = 'PENDING' | 'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED';

export interface InstructorApplication {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  headline: string | null;
  bio: string | null;
  specialization: string | null;
  skills: string[];
  yearsExperience: number | null;
  cvUrl: string | null;             // link only — no file upload in v1
  portfolioUrl: string | null;
  status: ApplicationStatus;
  reviewNotes: string | null;
  rejectionReason: string | null;   // set by reject
  changeRequest: string | null;     // set by request-changes
  reviewedById: string | null;
  reviewedAt: string | null;
  createdUserId: string | null;     // the instructor created on approve
  createdAt: string;
  updatedAt: string;
}
```

---

## Instructors

### `GET /api/admin/instructors`

Query: `page` (default 1) · `limit` (default 10, max 100) · `tab` · `sort` ·
`search` (name/email) · `specialization` · `categoryId` (instructors who own a
course in that category).

| `tab` | Who it shows |
|---|---|
| `all` *(default)* | every instructor except archived |
| `active` | `status = ACTIVE` |
| `inactive` | `status IN (PENDING, INVITED)` — invited or never activated |
| `suspended` | `status = SUSPENDED` |
| `top` | all, ranked by course count (Top Performers) |
| `pending` | **400** → use `GET /api/admin/instructor-applications` |

`sort`: `recent` (default) · `name` · `courses` · `students`.
`?tab=top` implies `sort=courses` unless you pass a sort explicitly.
`sort=students` ranks by DISTINCT learners over a bounded candidate set of
**1000** filtered instructors — correct for any realistic roster, documented here
so nobody is surprised at 10k.

```jsonc
{ "success": true, "data": {
  "instructors": [ /* Instructor[] */ ],
  "tabCounts": { "all": 42, "active": 38, "inactive": 2, "suspended": 2, "pending": 7 },
  "pagination": { "total": 42, "page": 1, "limit": 10, "pages": 5 }
}}
```

`tabCounts` are **global** (not affected by search/filters) — they are tab
badges, so they must not move when you type in the search box.

### `GET /api/admin/instructors/stats`

Powers the six cards. Every metric uses the same `Metric` envelope so one card
component renders all of them.

```jsonc
{ "success": true, "data": {
  "totalInstructors":     { "value": 42, "changePercent": 8,  "available": true },
  "activeInstructors":    { "value": 38, "changePercent": 5,  "available": true },
  "suspendedInstructors": { "value": 2,  "changePercent": null, "available": true },
  "pendingApproval":      { "value": 7,  "changePercent": -3, "available": true },
  "coursesPublished":     { "value": 96, "changePercent": 12, "available": true },
  "totalRevenue": { "value": null, "changePercent": null, "available": false,
                    "reason": "No Payment/Transaction model exists yet — ships with the Finance module." },
  "avgRating":    { "value": null, "changePercent": null, "available": false,
                    "reason": "No Review/Rating model exists yet — ships with instructor reviews." }
}}
```

- `changePercent` = this month vs last month. `null` means "not computable",
  not zero — show no arrow at all.
- `coursesPublished`'s monthly change counts courses by their **approval date**
  (`reviewedAt`). Courses published before the approval workflow existed have no
  publish timestamp and count toward neither month — truthful rather than
  pretending `createdAt` is a publish date.

### `GET /api/admin/instructors/:id`
`200` → `InstructorDetail`. `404` for an unknown id **and** for a non-instructor
user id (a LEARNER id is indistinguishable from a missing one).

### `POST /api/admin/instructors`
Creates the AppUser **and** its profile in one atomic write. `role` is forced to
`INSTRUCTOR` server-side; sending `role` is a 400.

```jsonc
{
  "fullName": "Rana Haddad",           // required, 2–100
  "email": "rana@example.com",         // required, unique → 409 if taken
  "password": "…",                     // required unless status = INVITED; ≥12 chars, upper+lower+digit+symbol
  "status": "ACTIVE",                  // ACTIVE (default) | PENDING | INVITED
  "phone": "+961…",
  "skills": ["Python", "ML"],          // ≤30 entries, ≤60 chars each
  "specialization": "Machine Learning",// ≤120
  "headline": "…",                     // ≤200
  "bio": "…",                          // ≤5000
  "yearsExperience": 7,                // 0–70
  "websiteUrl": "https://…",           // http/https only — javascript:/data: rejected
  "linkedinUrl": "https://…",
  "revenueShareBps": 1250              // 0–10000
}
```
`201` → `Instructor`. Creating with `status: ACTIVE` also sets
`verificationState: verified` (an admin adding someone directly has vouched for them).

### `PATCH /api/admin/instructors/:id`
Profile fields + `fullName`, `phone`, `skills`. Empty body → 400.
`status` / `email` / `role` / `verificationState` / `password` → **400** naming
the Users endpoint that owns them. If the instructor had no profile row, this
creates it (upsert) rather than 404ing.

### `PATCH /api/admin/instructors/:id/verify`
Sets `verificationState = verified` (via the Users module) and stamps
`verifiedAt` / `verifiedById` on the profile. `200` → `InstructorDetail`.

**409 on a suspended instructor** — "Reactivate the account before verifying it."
The underlying Users write also flips status to ACTIVE, so allowing it would let
a button labelled *Verify* silently lift a suspension. Disable the Verify action
on suspended rows.

### `PATCH /api/admin/instructors/:id/suspend`
```jsonc
{ "reason": "Policy violation", "notes": "optional" }   // reason REQUIRED, ≥3 chars → 400 otherwise
```
`200` → `InstructorDetail` with `status: "suspended"`. Their courses are **not**
touched (unpublish-on-suspend is not a v1 rule — see the open question below).

### `PATCH /api/admin/instructors/:id/reactivate`
`200` → `InstructorDetail` with `status: "active"`, `suspendedAt` cleared.

### `DELETE /api/admin/instructors/:id`
**Soft** — archives the AppUser and **keeps** the profile, so reactivating
restores everything. Blocked while they still own content:

```jsonc
// 409
{ "success": false,
  "message": "This instructor still owns courses or live sessions. Reassign them before archiving.",
  "data": { "courses": 3, "liveSessions": 1 } }
```
Show those counts in the confirm dialog. `200` → `{ "id": "…" }` once free.

### Import / Export (task 104 header buttons) — no new endpoint

Instructors are AppUsers, so the Users module's CSV endpoints already cover both,
filtered by role. Verified working:

- **Export:** `GET /api/admin/users/export?role=INSTRUCTOR` (+ `status`,
  `search`, `department`, `branch`, `createdAfter`, `createdBefore`)
- **Import:** `POST /api/admin/users/import` — multipart CSV with a `role`
  column set to `INSTRUCTOR`; own limiter (5 imports / 10 min).

Do **not** ask for `/instructors/export` — a second exporter over the same rows
is exactly the fork this module was designed to avoid.

---

## Applications

### `GET /api/admin/instructor-applications`
Query: `page` · `limit` · `status` (`pending` | `changes_requested` | `approved` |
`rejected`) · `search`. Ordered **oldest first** (longest-waiting at the top).

```jsonc
{ "success": true, "data": {
  "applications": [ /* InstructorApplication[] */ ],
  "statusCounts": { "PENDING": 7, "CHANGES_REQUESTED": 1, "APPROVED": 12, "REJECTED": 3 },
  "pagination": { "total": 23, "page": 1, "limit": 10, "pages": 3 }
}}
```

### `GET /api/admin/instructor-applications/:id` → `InstructorApplication`

### `PATCH …/:id/approve`
Body: `{ "reviewNotes": "optional" }`. Creates the AppUser + profile + stamps the
application in **one transaction**.

```jsonc
{ "success": true, "message": "Application approved — instructor account created.",
  "data": { "application": { /* … status APPROVED, createdUserId set */ }, "userId": "…" } }
```
- Approving an already-decided application → **409** (a second click can never
  create a second account).
- Email already belongs to a user → **409**, not 500.
- The new account has **no password**: nothing temporary is generated or emailed.
  The applicant sets one through the reset-password flow — the approval email
  tells them so.

### `PATCH …/:id/reject`
`{ "rejectionReason": "…" }` **required** (≥3 chars) → 400 otherwise.

### `PATCH …/:id/request-changes`
`{ "changeRequest": "…" }` **required** (≥3 chars) → 400 otherwise. Status becomes
`CHANGES_REQUESTED`; when the applicant resubmits the public form, the **same row**
reopens as `PENDING` — no duplicate queue entries.

### `POST /api/public/instructor-applications` — **unauthenticated**
The public "Become Instructor" form. Only the second unauthenticated endpoint in
the system (after certificate verification) and the only one that writes.

Body: `fullName` (2–100, required) · `email` (required) · `bio` (≥30 chars,
required) · `specialization` (required) · `phone` · `headline` ·
`yearsExperience` · `skills[]` · `cvUrl` · `portfolioUrl` (http/https links only)
· `website` (**honeypot** — must stay empty, hide it with CSS).

Always answers `202` with a fixed, id-free body:
```jsonc
{ "success": true, "message": "Your application has been received. We'll email you once it has been reviewed." }
```
Same response for a new application, a resubmission, a duplicate, an
already-approved email and a honeypot hit — an anonymous caller learns nothing
about who has applied. Validation errors still return 400 so the real form can
show them. Sending `status`, `reviewNotes`, `createdUserId` (etc.) is a 400 —
a submission can never self-approve.

---

## Error codes

| Status | When |
|---|---|
| 400 | validation, foreign field, `?tab=pending`, missing suspend reason / rejection reason |
| 401 | missing or invalid admin token |
| 404 | unknown instructor / application id, or a non-instructor user id |
| 409 | duplicate email · approve an already-decided application · delete an instructor who owns content · verify a suspended instructor |
| 429 | rate limited |
| 503 | `prisma db push` not run yet |

No known error path returns 500.

---

## Mutation IDs to add to `invalidation.ts` + IMPACT_MAP §5.3

Already present: `instructorApplication.submit` · `.approve` · `.reject` ·
`instructor.suspend` · `review.moderate`.

| New mutation ID | Invalidate |
|---|---|
| `instructor.create` | `['instructors']`, `['users']`, `['dashboard','user-analytics']` |
| `instructor.update` | `['instructors']`, `['instructors', id]` |
| `instructor.verify` | `['instructors']`, `['instructors', id]`, `['users']` |
| `instructor.reactivate` | `['instructors']`, `['instructors', id]`, `['users']`, `['dashboard','user-analytics']` |
| `instructor.delete` | `['instructors']`, `['users']`, `['courses']`, `['dashboard','user-analytics']` |
| `instructorApplication.requestChanges` | `['instructor-applications']`, `['approvals']` |

Every one also gets the §2 defaults (`['activity']`, `['notifications']`,
`['dashboard','stats']`). `instructor.suspend` / `.reactivate` / `.verify` must
also invalidate `['users']`, because they write the same AppUser row the Users
table is showing.

---

## Known gaps — decisions for Hassan, not bugs

1. **Dashboard "Pending Approvals" KPI ignores instructor applications.** It
   counts `AppUser.verificationState = PENDING` only
   (`dashboard.service.js:16`). IMPACT_MAP §5.3 says `instructorApplication.submit`
   should touch `['approvals']`. Widening that KPI changes a number the Dashboard
   module owns, so it was **not** done here — it needs a deliberate call.
2. **Suspending an instructor does not unpublish their courses.** IMPACT_MAP
   §5.3 flags this as "confirm rule with Hassan". v1 leaves courses untouched.
3. **Blueprint 05 lists more mutations than exist**: payouts, reviews,
   certifications, documents, badges, restrictions, warnings. All of them need
   models that do not exist (Finance, Review, Document). They stay `[planned]`.
4. **Audit actions for verify/suspend/reactivate are the `USER_*` ones**
   (`USER_VERIFICATION_APPROVED`, `USER_SUSPENDED`, `USER_REACTIVATED`) because
   users.service performs the write. One action, one audit row — the activity
   feed would otherwise show every suspension twice.

*Backend built 2026-08-03 · smoke `src/scripts/instructorsSmokeTest.js` — 89/89 green.*
