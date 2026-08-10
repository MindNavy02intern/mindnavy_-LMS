# Integrations — Registry / API Keys / Webhooks / Logs / Data Sync — API Contract v1

Source of truth for the Integrations module (blueprint 11), mirroring
`NOTIFICATIONS_CONTRACT.md`'s format. Both backend and frontend are built in
this task — this doc is the audit record + reference, not a spec waiting to
be implemented against. If anything here conflicts with a task description,
**this contract wins**.

- **Base URL:** `http://localhost:5001/api/admin/integrations`
- **Auth:** `Authorization: Bearer <admin token>` on every request (401 if missing/invalid)
- **Envelope (success):** `{ "success": true, "data": <payload>, "message"?: string }`
- **Envelope (action, may be a normal non-error outcome):** `{ "success": boolean, "message": string, "data"?: <payload> }`
- **Envelope (error):** `{ "success": false, "message": string }`
- **IDs:** uuid strings · **Dates:** ISO 8601 strings
- **Rate limits:** reads 120/min (`coursesReadRateLimiter`) · `/stats`, `/analytics` 30/min (300 dev) · writes 60/10min (600 dev, `adminUserActionRateLimiter`)

---

## ⚠️ Read before building against this

> **1. This module is a REGISTRY, not a reimplementation.** Step 0 audit
> confirmed real working adapters already exist: Zoom
> (`services/meetings/zoomProvider.js`, Server-to-Server OAuth, env-driven)
> and Supabase Storage (`services/storage/supabaseProvider.js`). SMTP already
> exists via `utils/mailer.js`. This module never re-implements auth for any
> of the three — it only reads their `isConfigured()` and calls a new
> `testConnection()` (added to each of the three files, minimal read-only
> extensions) for the "Test Connection" action. Every other catalog entry
> (Stripe, PayPal, Twilio, SendGrid, Google OAuth, Azure AD, Okta,
> Salesforce, HubSpot, SAP, BambooHR, AWS S3, Google Drive) has **no backing
> provider at all** and is `COMING_SOON` forever until one is built —
> connect/disconnect/test/sync-trigger on those return
> `{ success:false, message:"Configure API keys to activate." }` without
> ever calling a fake external API.

> **2. `status` is never trusted from the DB column — it's derived live.**
> `computeLiveStatus()` (integrations.service.js) returns `CONNECTED` only
> when: the slug has a real provider AND `provider.isConfigured()` is true
> AND the row's `isEnabled` is true AND there's no `lastError`. Any failed
> `isConfigured()` check → `DISCONNECTED`; a failed test → `ERROR` (cleared
> by the next successful test). This means the catalog seed's literal
> `status: "CONNECTED"` for zoom/supabase/smtp-email is only ever a *seed
> default* — the real answer is computed fresh on every read, so it can
> never drift from `.env` reality (rule: "CONNECTED integrations show real
> status").

> **3. `isEnabled` is this module's own on/off switch, separate from
> `provider.isConfigured()`.** `connect` sets it true (after verifying
> `isConfigured()`), `disconnect`/`toggle(false)` set it false. There is no
> way to programmatically clear `.env` credentials from the UI — disconnect
> only flips the local switch; if the env vars are still present, the
> integration can be reconnected instantly (no re-auth flow, since none is
> needed for Zoom's Server-to-Server OAuth or Supabase's service key).

> **4. Five new models, zero relations — same convention as
> `notifications.prisma`.** `Integration`, `ApiKey`, `Webhook`,
> `IntegrationLog`, `DataSync` (integrations.prisma). Confirmed by Step 0
> audit that nothing integration-shaped existed before this file.
> `IntegrationLog.integrationId` is a **plain string, loosely typed** (no
> `relation()`, same as `NotificationLog.sourceId`): for `API_CALL`/`AUTH`/
> `ERROR`/`SYNC` logs it's the `Integration` catalog row id; for `WEBHOOK`
> logs there is no catalog row to point at (webhooks are user-defined, not
> tied to a catalog provider) so it stores the `Webhook`'s own id instead.
> The Logs endpoint resolves a display name by checking both tables.

> **5. API keys: hash-only, shown once.** `POST /api-keys` generates
> `mk_live_<48 hex chars>`, stores only `sha256(key)` in `keyHash` and the
> first 12 characters in `keyPrefix` for display — the full key is returned
> **once**, in the create response, and never again (not even to the admin
> who created it). There is currently no consumer that actually
> authenticates against `keyHash` (no public API surface reads it yet) —
> this is credential issuance/management only, same "documented, not yet
> wired to a consumer" precedent as `NotificationAutomation` triggers in
> NOTIFICATIONS_CONTRACT.md #5.

> **6. Webhooks: HMAC-SHA256 signed, tested for real.** `PATCH
> /webhooks/:id/test` sends one real HTTPS POST to the stored `url` with an
> `X-MindNavy-Signature` header (`hmac_sha256(secret, body)`), a 10s hard
> timeout, and records `lastTriggeredAt`/`lastResponseCode`/`failureCount`
> for real — 5 consecutive failures flips `status` to `FAILED`. This is a
> genuine outbound network call (to whatever URL the admin configured), not
> a simulation.

> **7. Data Sync has no job queue — same `setTimeout`+`.unref()` shape as
> `server.js`'s existing sweeps**, just one-shot instead of recurring.
> `POST /syncs/:slug/trigger` creates a `RUNNING` row with a REAL
> `totalRecords` count (from `AppUser`/`Course`/`Department`, whichever
> `syncType` was requested), then a 1.5s timer flips it to `COMPLETED` with
> `processedRecords = totalRecords`. There is no per-record work happening —
> this is infrastructure plumbing (the endpoint, the model, the progress
> UI) ahead of any real HR/CRM sync target existing, same "documented gap,
> not built" precedent as `NotificationAutomation` triggers above.

> **8. Video/Storage/Email tab "settings" that have no backend field are
> explicitly local-only.** Zoom's "default meeting duration" / "recording
> enabled" controls (`VideoTab.tsx`) are component `useState`, not
> persisted — `Integration.config` only ever stores masked field **names**
> (see #9), never real non-secret preference values, so there is nowhere
> honest to persist them yet. This is a labeled, not hidden, gap.

> **9. `config` never stores real values, ever — server-enforced.**
> `sanitizeConfig()` (integrations.service.js) replaces every value in the
> submitted `config` object with the literal string `"***masked***"` before
> writing, regardless of what the client sent — defense in depth beyond
> trusting the frontend to have already masked it.

> **10. A handful of "Coming Soon" cards in the frontend have no backend
> catalog row at all** (MS Teams, Google Meet, Mailgun, Oracle HCM, Workday,
> Zoho CRM) — the Part 1 catalog seed (task spec, verbatim) only lists 16
> slugs and none of these are among them. They render via the same
> `ComingSoonCard` component with hardcoded name/description, and "Request
> Early Access" is a local toast with no backend call either way — so this
> is a safe, honest way to satisfy the Part 3 tab-content spec without
> fabricating fake `Integration` rows. Flagged per frontend `CLAUDE.md`
> ("blueprint vs reality disagree → report the gap, don't silently fix
> either side").

---

## Endpoints

### Stats / Analytics
- `GET /stats` → `{ activeIntegrations, failedConnections, apiUsageToday, webhookActivity, syncStatus, healthScore }` (each a `Metric`)
- `GET /analytics` → `{ apiUsageTrend, webhookActivityTrend, webhookSuccessRate, topIntegrations, errorBreakdown }`

### Registry (catalog, seeded on first read)
- `GET /` → `Integration[]`
- `GET /:slug`
- `PATCH /:slug/connect` `{ config? }` → `ActionResult<Integration>`
- `PATCH /:slug/disconnect` → `ActionResult<Integration>`
- `PATCH /:slug/test` → `ActionResult` (real call for zoom/supabase/smtp-email; informational for everything else)
- `PATCH /:slug/toggle` `{ isEnabled }` → `Integration`

### API Keys
- `GET /api-keys` `?status&page&limit`
- `POST /api-keys` `{ name, description?, permissions[], expiresAt? }` → includes `key` **once**
- `PATCH /api-keys/:id/revoke`
- `DELETE /api-keys/:id`

### Webhooks
- `GET /webhooks` `?page&limit`
- `POST /webhooks` `{ name, url (https), events[], secret? }`
- `PATCH /webhooks/:id` `{ name?, url?, events? }`
- `PATCH /webhooks/:id/pause` / `/resume`
- `PATCH /webhooks/:id/test` → real signed HTTPS POST, returns response code/duration/payload
- `DELETE /webhooks/:id`

### Logs
- `GET /logs` `?integrationId&type&status&dateFrom&dateTo&page&limit`

### Data Sync
- `GET /syncs` `?integrationId&status&page&limit`
- `GET /syncs/:id`
- `POST /syncs/:integrationSlug/trigger` `{ syncType: users|courses|departments }`

---

## Permissions catalog (API keys)

`read:users write:users read:courses write:courses read:enrollments write:enrollments read:certificates write:certificates read:finance write:finance read:reports read:notifications write:notifications admin:all`

## Events catalog (webhooks)

`user.registered user.suspended course.created course.published course.completed enrollment.created enrollment.cancelled certificate.issued certificate.revoked payment.succeeded payment.failed live_session.created live_session.completed`

## Seeded catalog (16 rows)

`zoom, supabase, smtp-email` → real providers, seeded `CONNECTED` (status is live-derived per #2). All others → `COMING_SOON`: `stripe, paypal, twilio, sendgrid, google-oauth, microsoft-azure, okta, salesforce, hubspot, sap, bamboohr, aws-s3, google-drive`.
