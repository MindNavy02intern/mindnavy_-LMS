# Notifications — Templates / Announcements / Automations / Logs / Preferences / Emergency — API Contract v1

Source of truth for the Notifications module (blueprint 10), mirroring
`COMPETENCIES_CONTRACT.md`'s format. Both backend and frontend are built in
this task — this doc is the audit record + reference, not a spec waiting to
be implemented against. If anything here conflicts with a task description,
**this contract wins**.

- **Base URL:** `http://localhost:5001/api/admin/notifications`
- **Auth:** `Authorization: Bearer <admin token>` on every request (401 if missing/invalid)
- **Envelope (success):** `{ "success": true, "data": <payload>, "message"?: string }`
- **Envelope (error):** `{ "success": false, "message": string }`
- **IDs:** uuid strings · **Dates:** ISO 8601 strings
- **Rate limits:** reads 120/min (`coursesReadRateLimiter`) · `/stats`, `/analytics` 30/min (300 dev) · writes 60/10min (600 dev)

---

## ⚠️ Read before building against this

> **1. This is a SEPARATE surface from the existing bell / Dashboard Notifications
> widget.** Step 0 audit confirmed: the topbar bell and its "12" badge were
> synthetic — `NAV_ITEMS` had a hardcoded `badge: 12`, and the panel read
> `GET /api/admin/dashboard/core → recentActivities` (derived from `AuditLog`,
> not a real notification table). That surface is untouched except for two
> honest fixes: the badge now shows a real unread count (see #2), and
> "View all notifications →" now navigates to `/notifications?tab=inapp`
> instead of doing nothing. The panel's own item list still reads
> `recentActivities` — it is a different, pre-existing, intentionally-kept
> feature (system activity feed for admins), not this module's data.

> **2. Five new models, one of them deliberately doubles as two things.**
> `NotificationTemplate`, `Announcement`, `NotificationAutomation`,
> `NotificationLog`, `UserNotificationPreference` (notifications.prisma) —
> confirmed by Step 0 audit that nothing notification-shaped existed before
> this file. `NotificationLog` is the single sink for **every** channel,
> including `IN_APP` — a separate `Notification` model would just duplicate
> the same id/userId/subject/body/priority/read-state shape (IMPACT_MAP R4).
> "Read" = `status` flips to `OPENED` and `openedAt` is stamped; there is no
> separate boolean column. The sidebar bell's unread badge counts
> `NotificationLog{channel:IN_APP, status NOT IN [OPENED,CLICKED]}`.

> **3. `createdById` is a plain string (admin actor id), not a Prisma
> relation** — same convention as `Skill.createdById` / `Course.createdBy`.
> `NotificationLog.userId` and `UserNotificationPreference.userId` are also
> plain strings (recipient `AppUser.id`, existence verified in the service),
> same "no cross-schema FK" pattern as `finance.prisma`.

> **4. Bulk sends are capped at 50 real SMTP attempts per campaign
> (`EMAIL_BLAST_CAP`).** There is no job queue in this codebase — a
> synchronous admin action blasting thousands of real emails inline isn't
> safe. Every recipient still gets their `IN_APP` log row (the guaranteed
> channel); recipients beyond the cap get an `EMAIL` row logged `PENDING`
> with `metadata.reason: "BATCH_CAP"`. A production version would hand
> these to a background worker instead of dropping them — documented gap,
> not silently swallowed.

> **5. Automation triggers are CRUD-only — NOT wired to real events yet.**
> `NotificationAutomation` fully supports create/update/pause/resume/delete,
> but actually firing on `USER_REGISTRATION` / `COURSE_ENROLLMENT` / etc.
> would mean editing users/enrollments/quizzes/finance/live-sessions
> services to emit events — a cross-cutting change outside this task's
> scope. Same "documented gap, not built" precedent as
> `skillLevel.configure` (COMPETENCIES_CONTRACT.md) or `ticket.create`
> (§5.14 IMPACT_MAP). `sentCount` stays 0 until a later phase wires real
> triggers.

> **6. Scheduled announcements DO auto-send** — a 5-minute background sweep
> (`sendDueAnnouncements`, `server.js`, same `setInterval`+`.unref()`
> convention as `scheduledReports.service`'s hourly sweep) sends every
> `Announcement{status:SCHEDULED, scheduledAt <= now}`. `adminId` is `null`
> (system-authored), same precedent as `ScheduledReport`'s `RUN` audit rows.

> **7. Open/click tracking is `available:false` everywhere, always.** No
> tracking pixel, no click-redirect, no webhook receiver exists — `openedAt`/
> `clickedAt` only ever get set by the in-app "mark read" action and by
> `EMAIL` retry succeeding, never by an actual open/click event. Push/SMS
> have no provider (`FCM`/`Twilio`) — every push/SMS send is logged
> `PENDING`, never attempted.

> **8. Preferences enforcement is partial by design.** `emailEnabled` and
> `marketingEnabled` (for `PROMOTION`-type campaigns) are checked before an
> `EMAIL` send; `EMERGENCY` alerts bypass all preferences (mandatory, per
> blueprint 10 §13 — "critical event → multi-channel send → admins alerted").
> `quietHoursStart`/`quietHoursEnd` are stored and editable but **not**
> enforced against send time yet — no timezone field exists to make "is it
> quiet hours right now for this user" meaningful. Documented gap.

> **9. Existing `invalidation.ts` scaffold was incomplete — 5 rows added.**
> `emailCampaign.create`, `pushCampaign.send`, `smsCampaign.send`,
> `announcement.send`, `campaign.schedule/pause/cancel/duplicate`,
> `notificationTemplate.create/update/duplicate`,
> `notificationRule.create/update/delete/toggle`,
> `notification.markRead/archive/pin`, `emergencyAlert.send`,
> `delivery.retry` already existed (frontend team pre-scaffolded them).
> Missing and added in this task: `notificationTemplate.delete`,
> `announcement.delete`, `notification.send` (admin manually sending to
> specific `userIds` — distinct from the broad-audience campaign mutations),
> `notification.delete`, `notificationPrefs.update` (per-user, distinct from
> a possible future admin-global `notificationPrefs.updateGlobal`).

---

## Endpoints

**Stats / analytics**
```
GET  /stats                        → NotificationsStats (8 cards)
GET  /analytics                    → NotificationsAnalytics
```

**In-app (NotificationLog, channel=IN_APP — also the sidebar bell's data source)**
```
GET    /                           ?userId? &read? &page &limit
POST   /send                       { userIds[], title, body, type?, priority? }
PATCH  /:id/read
PATCH  /read-all                   { userId? }  — omit userId to mark ALL users' feeds read
DELETE /:id
```

**Announcements**
```
GET    /announcements              ?status? &type? &audience? &search? &page &limit
POST   /announcements              { title, body, type, audience, targetIds?, priority?, scheduledAt? }
GET    /announcements/:id
PATCH  /announcements/:id          (only while DRAFT/SCHEDULED)
POST   /announcements/:id/send
PATCH  /announcements/:id/cancel
DELETE /announcements/:id
```
`targetIds` required when `audience` is `CUSTOM` (user ids), `DEPARTMENTS`
(department ids), or `GROUPS` (group ids) — resolved server-side in
`resolveAudienceUserIds()`. `scheduledAt` present → created `SCHEDULED`,
absent → `DRAFT` until `/send` is called explicitly.

**Templates**
```
GET    /templates                  ?type? &category? &status? &search? &page &limit
POST   /templates                  { name, type, subject?, body, variables?, category?, status? }
GET    /templates/:id
PATCH  /templates/:id
DELETE /templates/:id
POST   /templates/:id/duplicate
POST   /templates/:id/preview      { variables: { key: value } } → { subject, body, variablesUsed }
```

**Automations**
```
GET    /automations                ?status? &trigger? &search? &page &limit
POST   /automations                { name, description?, trigger, templateId, channels[], status? }
PATCH  /automations/:id
PATCH  /automations/:id/pause
PATCH  /automations/:id/resume
DELETE /automations/:id
```

**Delivery logs (any channel)**
```
GET  /logs                         ?channel? &status? &userId? &dateFrom? &dateTo? &page &limit
POST /logs/:id/retry               (FAILED or PENDING only; EMAIL retries for real, PUSH/SMS no-op)
```

**User preferences**
```
GET   /preferences/:userId
PATCH /preferences/:userId         { emailEnabled?, pushEnabled?, smsEnabled?, marketingEnabled?,
                                      learningAlertsEnabled?, securityEnabled?,
                                      quietHoursStart?, quietHoursEnd? }
```

**Emergency**
```
GET  /emergency                    ?page &limit   — recent alerts (Announcement{type:EMERGENCY})
POST /emergency                    { title, message, channels[] } → sends to ALL users immediately
```

---

## Types

All request/response shapes are defined once, in
`frontend/src/types/notifications.ts` — mirrored 1:1 from
`notifications.service.js`'s map functions (`mapTemplate`, `mapAnnouncement`,
`mapAutomation`, `mapLog`, `mapPrefs`). Not re-duplicated here; that file is
the single source of truth for both sides.

**Stats card shape** (`Metric`, same envelope as every other module):
```ts
{ value: number | null; changePercent: number | null; available: boolean; reason?: string }
```
`openRate` / `clickRate` are always `{ available: false, reason: "No open/click tracking yet" }`
(decision #7 above). `deliverySuccessRate` is `available:false` only when zero
delivery attempts exist yet.

---

## Frontend

- Route: `/notifications` (`frontend/src/pages/Notifications/NotificationsPage.tsx`), 13 tabs, URL-driven `?tab=` using the slugs already fixed in `docs/blueprint/pages/10-notifications.md`: `dashboard · inapp · email · push · sms · announcements · templates · automation · scheduled · preferences · logs · analytics · emergency`.
- `frontend/src/services/notificationsApi.ts` — same fetch-wrapper convention as `competenciesApi.ts`.
- All list tabs (`In-App`, `Email`, `Push`, `Sms`, `Delivery Logs`) share filtering via `GET /logs`; search is client-side over the current page (`/logs` has no `search` query param — date range and channel/status filtering are server-side, free-text is not, documented tradeoff to avoid a backend change out of scope).
- Emergency Alerts tab: 2-step confirm (fill form → type `CONFIRM` to unlock the send button), Push/SMS checkboxes disabled with "(coming soon)" per decision #7.
