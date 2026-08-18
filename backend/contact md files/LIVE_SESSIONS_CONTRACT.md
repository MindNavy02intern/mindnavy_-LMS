# Live Sessions — API Contract v1

For the frontend (Bilal). Backend is built, mounted, smoke-tested (**14/14 green**;
the Zoom CRUD leg runs once the owner's Zoom credentials land in `.env`). This is
the source of truth for the Live Sessions tab. If anything here conflicts with a
task description, **this contract wins**.

- **Base URL:** `http://localhost:5001/api/admin/live-sessions`
- **Auth:** `Authorization: Bearer <admin token>` on every request (401 if missing/invalid)
- **Envelope (success):** `{ "success": true, "data": <payload>, "message"?: string }`
- **Envelope (error):** `{ "success": false, "message": string }`
- **IDs:** uuid strings · **Dates:** ISO 8601 strings
- **Rate limits:** reads 120/min, writes 60/10min → on `429` show "slow down and retry"

> **v1 scope — REAL Zoom integration (system-owner requirement):** creating a
> session creates a **real Zoom meeting** server-side and returns `joinUrl` +
> `startUrl`. The **"Join" button simply opens `joinUrl`** (Zoom links natively
> launch the Zoom app) — no SDK, no embed. `provider` is `ZOOM` only; `MEET` /
> `TEAMS` / `OTHER` are rejected with 400 until v2.

> **⚠️ startUrl is the HOST link** (starts the meeting with host powers). Show
> it only as a "Start (host)" action in the ADMIN UI. It must never be exposed
> to learners or copied into learner-facing surfaces.

> **503 state:** until Zoom credentials are configured on the server, `POST`
> and schedule-changing `PATCH` return
> `503 { message: "Zoom is not configured…" }`. Render that message verbatim
> with a disabled state — it's expected until the owner delivers credentials.
> Reads and validation-only errors work regardless.

> **Status is server-owned and schedule-derived** (`UPCOMING → LIVE → ENDED`
> from `startTime` + `durationMin`; it self-corrects on every read). There is
> **no** "set status" action — sending `status` in a PATCH is a 400. "Cancel
> session" = DELETE (also deletes the Zoom meeting).

> **v1 scope — scheduling only:** no chat/screen-share/whiteboard, no
> notifications, no calendar sync. The LM Overview widget at
> `GET /api/admin/lm/live-sessions` is unchanged and now benefits from
> auto-synced statuses.
>
> **Attendance (added 2026-08-18):** `PATCH /:id/attendance` — manual admin
> marking only (no join/leave webhook from Zoom). See the Endpoints section
> below. This also feeds certificate Trigger 4 (attendance threshold) via
> `certificateTriggers.service.js`'s `onAttendanceMarked`.

> **Existing infra:** `queryKeys.liveSessions(filters?)` already exists in
> queryKeys.ts — build against it. Add `liveSession.create/.update/.delete`
> to `invalidation.ts` per the IMPACT_MAP §5.4 row (invalidate
> `['live-sessions']`, `['calendar']`, `['dashboard','live-overview']`, and
> `['learning-paths']` — deleted sessions leave `missing: true` path items).

---

## Types

```ts
export type LiveSessionStatus = 'UPCOMING' | 'LIVE' | 'ENDED';
export type MeetingProvider = 'ZOOM' | 'MEET' | 'TEAMS' | 'OTHER'; // v1 accepts ZOOM only

export interface LiveSession {
  id: string;
  title: string;                   // 1–200 chars
  description: string | null;      // ≤ 2000 chars
  courseId: string | null;         // null = standalone session
  courseTitle: string | null;      // derived from the relation
  instructorId: string | null;     // required on create; must be a real INSTRUCTOR
  instructorName: string | null;   // derived from the relation
  startTime: string;               // ISO — must be in the future on create
  durationMin: number;             // 5–1440 (default 60)
  timezone: string;                // IANA id, e.g. "Asia/Beirut" (default "UTC")
  maxParticipants: number | null;  // 1–10000 · null = no cap (default)
  provider: MeetingProvider;       // always 'ZOOM' in v1
  zoomMeetingId: string | null;    // server-written
  joinUrl: string | null;          // participants — the "Join" button opens this
  startUrl: string | null;         // HOST link — admin-only "Start (host)" action
  status: LiveSessionStatus;       // server-derived, read-only
  createdAt: string;
  updatedAt: string;
}
```

## Endpoints

### `GET /` — list (max 500, newest `startTime` first)
Query params (all optional): `status=upcoming|live|ended` · `courseId` · `instructorId`
→ `200 { success, data: LiveSession[] }` · bad filter → `400`

### `GET /:id` — detail
→ `200 { success, data: LiveSession }` · unknown id → `404`

### `POST /` — schedule (creates the real Zoom meeting)
```jsonc
{
  "title": "Intro Webinar",          // required
  "instructorId": "<uuid>",          // required — real, non-archived INSTRUCTOR
  "startTime": "2026-08-01T15:00:00Z", // required, future
  "durationMin": 60,                  // optional (default 60)
  "timezone": "Asia/Beirut",          // optional (default "UTC")
  "courseId": "<uuid> | null",        // optional
  "description": "…",                 // optional
  "maxParticipants": 100,             // optional
  "provider": "ZOOM"                  // optional (default; only ZOOM accepted)
}
```
→ `201 { success, message: "Live session scheduled.", data: LiveSession }` (with real `joinUrl`/`startUrl`)
Errors: validation → `400` · unknown course/instructor → `400` · Zoom unconfigured → `503` · Zoom API failure → `502` (show `message`)

### `PATCH /:id` — edit
Any subset of: `title, description, courseId, instructorId, startTime, durationMin, timezone, maxParticipants`.
`courseId: null` detaches. Schedule changes are pushed to Zoom **before** the DB
write (a Zoom failure = `502`, nothing saved). `status` / `joinUrl` / `startUrl` /
`zoomMeetingId` / `provider` in the body → `400` (server-managed). Empty patch → `400`.
→ `200 { success, message: "Live session updated.", data: LiveSession }`

### `DELETE /:id` — cancel
Deletes our row, then the Zoom meeting (best-effort — always succeeds for the admin).
→ `200 { success, message: "Live session canceled.", data: { id } }` · unknown id → `404`

### `PATCH /:id/attendance` — mark attendance (added 2026-08-18)
Bulk upsert, one call per save. Roster comes from `GET /api/admin/enrollments?courseId=<session.courseId>`
on the frontend — sessions with no `courseId` (standalone) have no roster to mark.
```jsonc
{
  "records": [
    { "userId": "<uuid>", "status": "PRESENT", "durationMin": 55, "participationScore": 90 },
    { "userId": "<uuid>", "status": "ABSENT" }
  ]
}
```
`status` ∈ `PRESENT | LATE | ABSENT | EXCUSED` (required per record). `durationMin`/`participationScore`
optional. Max 300 records per call. Any `userId` that isn't a real AppUser → `400` with the offending ids,
nothing is written (all-or-nothing).
→ `200 { success, message, data: AttendanceRecordResult[] }` · unknown session → `404`

---

*Backend files: `routes/liveSessions.routes.js` · `controllers/liveSessions.controller.js` ·
`services/liveSessions.service.js` · `services/meetings/` (Zoom adapter) ·
`validators/liveSessions.validator.js` · smoke: `scripts/liveSessionsSmokeTest.js`.*
