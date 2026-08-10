# System Settings — API Contract v1

For the frontend (Bilal). Backend is built and mounted. This is the source of
truth for the System Settings module (`/settings`, blueprint 12). If anything
here conflicts with a task description, **this contract wins**.

- **Base URL:** `http://localhost:5001/api/admin/system-settings`
- **Frontend route:** `/settings` (not `/system-settings` — that route already
  existed, wired into the sidebar, Quick Actions dropdown, and profile menu
  before this module was built; adding a second route would fork/break those
  links, so the API path and the frontend route deliberately differ).
- **Auth:** `Authorization: Bearer <admin token>` on every request (401 if missing/invalid)
- **Envelope (success):** `{ "success": true, "data": <payload>, "message"?: string }`
- **Envelope (error):** `{ "success": false, "message": string }`
- **IDs:** cuid strings (matches `CompetencySettings`/`FinanceSettings`) · **Dates:** ISO 8601 strings
- **Rate limits:** reads `coursesReadRateLimiter` (120/min), writes `adminUserActionRateLimiter` (60/10min prod / 600/10min dev)
- **Single-row singleton**, same lazy-create pattern as `CompetencySettings`/`FinanceSettings`/`HierarchySettings`: `findFirst({orderBy:{createdAt:'asc'}}) ?? create(defaults)`.

> **Never expose `.env` secret values.** SMTP host/port/user/pass and Supabase
> keys are never returned by any endpoint. `GET`/`PATCH` responses include two
> derived, env-only booleans instead — `smtpConfigured` and
> `storageConfigured` — computed live from `isMailerConfigured()` /
> `getProvider().isConfigured()`, never stored.

---

## Known gaps / decisions (read before building UI against this)

1. **Field list extends beyond the original spec.** `emailFromName`,
   `emailFromEmail`, `emailNotificationsEnabled`, `digestEmailsEnabled`,
   `autoCertificationEnabled`, `reminderNotificationsEnabled`, `metaTitle`,
   `metaDescription`, `logoUrl`, `faviconUrl`, `primaryColor`, `lastBackupAt`
   were added because their tabs (Branding, Email Config, Notifications,
   Automation, Domain & URL, Backup & Restore) give each of these a real
   editable/derived field, not a "Coming soon" stub — same "add what the UI
   genuinely needs" precedent as `FinanceSettings` being a net-new model.
2. **`defaultCourseVisibility` is a validated `String`, not the existing
   `CourseVisibility` enum.** That enum is `PUBLIC | PRIVATE | UNLISTED` (no
   `ENROLLED_ONLY`, which this field needs) and is a live FK-adjacent type on
   `Course.visibility` — this field is a default TEMPLATE value, never
   assigned to a real course. Allowed values enforced in
   `settings.validator.js`: `PUBLIC | PRIVATE | ENROLLED_ONLY`.
3. **SMTP configuration is NOT editable through this API**, despite the tab
   spec listing Host/Port/Username/Password fields. It lives in server env
   vars (`SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_SECURE`, see
   `mailer.js`) — the module's own global rule ("never expose `.env` values")
   overrides the tab's field list. The Email Config tab shows a
   configured/not-configured badge only. `emailFromName`/`emailFromEmail`
   aren't secrets, so those stay DB-editable.
4. **Mutation IDs reuse the pre-existing `invalidation.ts` scaffolding**
   instead of adding new `systemSettings.*` names. `queryKeys.settings(domain)`,
   `queryKeys.systemBackups()`, and the `settings.update` /
   `featureToggle.set` / `maintenance.enable` / `maintenance.disable` /
   `backup.run` / `backup.restore` mutation IDs already existed (IMPACT_MAP
   §5.16, predating this build) — adding parallel `systemSettings.*` IDs
   would have created two competing conventions for the same module. See
   IMPACT_MAP §5.16 for the updated row.
5. **`retention.update` and `settings.restoreVersion` stay dead** (documented,
   unbuilt — same status as `skillLevel.configure` in
   COMPETENCIES_CONTRACT.md). No retention-policy UI exists in this module
   (Security tab's password/session/IP policy is a different field set);
   restore reuses `backup.restore` since backups are one full-row snapshot,
   not per-domain versions.
6. **Feature Toggles persist but don't gate anything yet.** `PATCH` writes
   `liveSessionsEnabled` etc. to the row and the Feature Toggles tab reflects
   it, but no consumer reads these flags — the sidebar, route guards, and
   other modules' widgets are unaffected by toggling them off. Wiring real
   gating (AdminLayout nav filter, `ProtectedRoute`-level checks) is a
   follow-up, not part of this build.
7. **`SystemConfigLog` is a new per-field diff table**, not the coarse
   `AuditLog` pattern every other settings model uses (one row per save with
   a `fields: [...]` list). Every `PATCH` that changes N fields writes N
   `SystemConfigLog` rows (`setting`, `oldValue`, `newValue`, `changedById`)
   *and* one `AuditLog(SYSTEM_SETTINGS_UPDATED)` row — the Config Logs tab
   needs the per-field table, `AuditLog` alone can't answer "what did
   `quizPassingScore` used to be". `allowedIPs` values are redacted
   (`"[redacted]"`) in the diff trail.
8. **Maintenance mode only gates the two existing public endpoints**
   (`/api/public/certificates`, `/api/public/instructor-applications`) via
   `maintenanceMode.middleware.js`. Every `/api/admin/*` route stays
   reachable — there is no learner/instructor-facing app in this repo to gate
   more broadly, and admins must always be able to log in and disable it.
9. **Storage usage is non-recursive.** `getBucketUsage()` lists each bucket's
   root only (Supabase's `list()` has no recursive mode); nested folders'
   files aren't counted. Good enough for a usage estimate, not an exact total.
10. **Branding logo/favicon upload doesn't reuse `uploads.service.js`** — that
    service is hard-scoped to a `courseId` prefix. New
    `signBrandingUpload`/`confirmBrandingUpload` talk to the storage
    provider adapter directly, own bucket (`system-branding` /
    `SUPABASE_BRANDING_BUCKET`), 2MB cap.
11a. **Restore never touches `maintenanceMode`/`scheduledMaintenanceAt`,
    even though a backup file contains them.** `validateSettingsUpdate` (used
    by both `PATCH` and `/restore`) deliberately has no case for those two
    fields — maintenance state can only change through
    `/maintenance/enable`/`/disable`, which write their own distinct audit
    action. This is intentional, not a missed field: restoring an old backup
    should never silently drop the live site into (or out of) maintenance
    mode as a side effect of an unrelated config rollback.
12. **"Save All Changes" (page header) only saves the currently active tab.**
    Only one tab's form is mounted at a time (same architecture as
    `FinancePage`), so the header button dispatches a
    `window.dispatchEvent(new CustomEvent('settings:saveAll'))` that the
    mounted tab's form listens for — same DOM-event-bridge convention
    `AdminLayout` already uses for `openNotificationsPanel`/
    `analyticsUpdated`. Tabs with nothing to save (read-only/Coming Soon)
    just don't attach a listener.

---

## Types

```ts
type RegistrationMode  = 'OPEN' | 'INVITE_ONLY' | 'APPROVAL_REQUIRED';
type DefaultUserRole   = 'LEARNER' | 'INSTRUCTOR';
type CourseVisibility  = 'PUBLIC' | 'PRIVATE' | 'ENROLLED_ONLY'; // validated String, see gap #2

interface SystemSettings {
  id: string;
  platformName: string; platformDescription: string | null;
  timezone: string; defaultLanguage: string; dateFormat: string; currency: string;
  contactEmail: string | null; contactPhone: string | null;

  registrationMode: RegistrationMode;
  emailVerificationRequired: boolean; phoneVerificationRequired: boolean; captchaEnabled: boolean;
  allowedEmailDomains: string[]; defaultUserRole: DefaultUserRole;

  defaultCourseVisibility: CourseVisibility;
  autoEnrollmentEnabled: boolean; certificatesEnabled: boolean;
  quizPassingScore: number; maxQuizAttempts: number;
  scormEnabled: boolean; progressTrackingEnabled: boolean;

  passwordMinLength: number; passwordRequireUppercase: boolean;
  passwordRequireNumbers: boolean; passwordRequireSymbols: boolean;
  sessionTimeoutMinutes: number; maxLoginAttempts: number;
  mfaEnabled: boolean; ipRestrictionEnabled: boolean; allowedIPs: string[];

  maxUploadSizeMb: number; allowedFileTypes: string[];
  videoProcessingEnabled: boolean; imageCompressionEnabled: boolean;

  logoUrl: string | null; faviconUrl: string | null; primaryColor: string | null;

  emailFromName: string | null; emailFromEmail: string | null;
  emailNotificationsEnabled: boolean; digestEmailsEnabled: boolean;
  autoCertificationEnabled: boolean; reminderNotificationsEnabled: boolean;
  metaTitle: string | null; metaDescription: string | null;

  maintenanceMode: boolean; maintenanceMessage: string | null; scheduledMaintenanceAt: string | null;

  liveSessionsEnabled: boolean; certificatesModuleEnabled: boolean; marketplaceEnabled: boolean;
  aiEnabled: boolean; gamificationEnabled: boolean; scormModuleEnabled: boolean; mobileAppEnabled: boolean;

  lastBackupAt: string | null;
  updatedAt: string; createdAt: string; updatedById: string | null;

  smtpConfigured?: boolean;    // derived, GET/mutation responses only
  storageConfigured?: boolean; // derived, GET/mutation responses only
}

interface SystemConfigLog {
  id: string; setting: string;
  oldValue: string | null; newValue: string | null;
  changedById: string; createdAt: string;
  changedBy: { id: string; fullName: string; email: string } | null; // resolved server-side
}
```

---

## Endpoints

### `GET /system-settings`
Returns the full `SystemSettings` row (lazy-created on first read).

### `PATCH /system-settings`
Partial update — any subset of fields above except `id`/`createdAt`/
`updatedAt`/`updatedById`/`lastBackupAt`/`smtpConfigured`/`storageConfigured`
(all read-only/derived). Writes one `SystemConfigLog` row per changed field
plus one `AuditLog(SYSTEM_SETTINGS_UPDATED, {fields:[...]})`.

### `GET /system-settings/logs?page&limit&search&dateFrom&dateTo`
`search` matches `setting` (case-insensitive contains). Returns
`{ logs: SystemConfigLog[], total, page, limit, totalPages }`.

### `POST /system-settings/maintenance/enable`
Body: `{ message?: string|null, scheduledAt?: ISO string|null }`. Sets
`maintenanceMode=true` + the two fields, audit-logs
`MAINTENANCE_MODE_ENABLED`, writes matching `SystemConfigLog` rows.

### `POST /system-settings/maintenance/disable`
No body. Sets `maintenanceMode=false`, audit-logs `MAINTENANCE_MODE_DISABLED`.

### `POST /system-settings/test-email`
Body: `{ to?: string }` (falls back to `contactEmail` if omitted; 400 if
neither is set). **Always responds 200** with `{ success: boolean, message: string }`
— a failed/not-configured send is an expected outcome, not an HTTP error.
Audit-logs `SYSTEM_SETTINGS_TEST_EMAIL_SENT`.

### `POST /system-settings/backup`
No body. Returns `{ exportedAt, platformName, settings: {...} }` (the row
minus `id`/timestamps/`updatedById`/`lastBackupAt`). Also stamps
`lastBackupAt = now()` on the real row and audit-logs `SYSTEM_BACKUP_CREATED`.
The frontend downloads this as a `.json` file client-side — no file is
written server-side.

### `POST /system-settings/restore`
Body: `{ settings: {...} }` — the `settings` key from a `/backup` payload.
Validated through the same `validateSettingsUpdate` as `PATCH`. Writes
`SystemConfigLog` rows for every changed field + `AuditLog(SYSTEM_SETTINGS_RESTORED)`.

### `GET /system-settings/storage-usage`
Returns `{ provider, buckets: [{bucket, public, fileCount, totalSizeBytes}], totalFiles, totalSizeBytes }`.
503 if the storage provider isn't configured. See gap #9 (non-recursive).

### `POST /system-settings/branding/sign`
Body: `{ kind: 'logo'|'favicon', fileName: string }`. Returns
`{ uploadUrl, path, kind, maxBytes }` (2MB cap) for a direct client → Supabase PUT.

### `POST /system-settings/branding/confirm`
Body: `{ kind: 'logo'|'favicon', path: string }`. Re-verifies the object
landed in storage, writes `logoUrl`/`faviconUrl` on the settings row, returns
`{ url }`.

---

## Frontend structure

- `src/types/settings.ts`, `src/services/settingsApi.ts` — types + fetch client.
- `src/pages/SystemSettingsPage.tsx` — owns the single `SystemSettings` fetch,
  tab switcher (`?tab=`), maintenance banner, header (Save All / Export
  Config / More Actions).
- `src/components/settings/*Tab.tsx` — one component per tab (20 total),
  `_shared.tsx` for style primitives + the `useSaveAllListener` hook.
- Mutation IDs used: `settings.update` (with `ctx.domain`),
  `featureToggle.set`, `maintenance.enable`, `maintenance.disable`,
  `backup.run`, `backup.restore` — all pre-existing in `invalidation.ts`.

## Tests

`frontend/tests/system-settings.full.spec.ts` — page load + all 20 tabs
render, General save → Config Logs shows the diff, Feature Toggle save →
verified via a direct API refetch, Send Test Email returns cleanly either way,
Maintenance enable/disable banner, Backup download. `afterAll` restores the
original row via `PATCH` + the maintenance enable/disable endpoints — zero
side effects on the shared singleton.

Run with: `npx playwright test system-settings.full --workers=1`
