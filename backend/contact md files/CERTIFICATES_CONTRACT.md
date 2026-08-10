# Certificates — API Contract v1

For the frontend (Bilal). Backend is built, mounted, smoke-tested (**54/54 green**).
This is the source of truth for the Certificates tab. If anything here conflicts
with a task description, **this contract wins**.

- **Admin base URL:** `http://localhost:5001/api/admin` (`/certificate-templates` + `/certificates`)
- **Public base URL:** `http://localhost:5001/api/public/certificates` (verify only — **no auth**)
- **Auth:** `Authorization: Bearer <admin token>` on every ADMIN request (401 if missing/invalid)
- **Envelope (success):** `{ "success": true, "data": <payload>, "message"?: string }`
- **Envelope (error):** `{ "success": false, "message": string }`
- **IDs:** uuid strings · **Dates:** ISO 8601 strings
- **Rate limits:** admin reads 120/min, admin writes 60/10min, public verify **30/min per IP**

> **v1 scope — triggers:** issuance is **MANUAL only** (admin picks user + course).
> The four auto-triggers from the design doc (course completion, passing grade,
> path completion, session attendance) are deferred: their runtimes don't exist
> yet (no enrollment-completion writes, no quiz attempts, no path progress, no
> attendance model). The backend has a single `issueCertificate()` entry point
> that future triggers will call — **no trigger UI in v1.**

> **v1 scope — templates:** a template is a name + a small validated layout
> object (colors, texts, signature) — **not** a freeform designer and **no
> logoUrl** (embedding remote images means server-side fetching of arbitrary
> URLs = SSRF; logos come in v2 through the uploads sign→confirm flow).

> **Issue requires `Course.certificateEnabled`** (the wizard Step 4 flag).
> Issuing against a course with it off → `400` — surface that message and link
> the admin to course settings.

> **Existing infra:** the tab shell is `?tab=certificates` and
> `queryKeys.certificates(filters?)` already exists — use them.
> `['certificate-templates']` does **NOT** exist yet — add it to queryKeys.ts.
> invalidation.ts has `certificate.issue` / `certificate.revoke`; **add
> `certificate.reissue` and `certificateTemplate.create/update/delete`** in the
> same PR (IMPACT_MAP §5.8 has the rows). The **Certificates Issued KPI** now
> counts non-revoked certificates only.

---

## Types

```ts
export interface CertificateTemplateLayout {
  title: string;           // ≤120 — heading on the certificate
  body: string;            // ≤600 — supports {{studentName}} {{courseTitle}} {{date}}
  primaryColor: string;    // "#RRGGBB" — border + title
  accentColor: string;     // "#RRGGBB" — inner border + rule
  signatureName: string | null;   // ≤100 — omit both for no signature block
  signatureTitle: string | null;  // ≤100
}

export interface CertificateTemplate {
  id: string;
  name: string;                    // 1–120 chars
  layout: CertificateTemplateLayout; // ALWAYS complete — server fills defaults
  certificateCount: number;        // derived server-side
  createdAt: string;
  updatedAt: string;
}

export type CertificateStatus = 'active' | 'revoked';

export interface Certificate {
  id: string;
  userId: string;
  studentName: string | null;      // issue-time snapshot (survives renames)
  courseId: string;
  courseTitle: string | null;      // issue-time snapshot
  templateId: string | null;       // null = default layout
  templateName: string | null;
  verificationCode: string;        // 32 hex chars — the QR payload
  status: CertificateStatus;
  issuedAt: string;
  revokedAt: string | null;
}

export interface CertificateListPage {
  items: Certificate[];            // issuedAt desc
  total: number;                   // for the given filters
  limit: number;                   // default 100, max 500
  offset: number;
}

// Public verify — the ONLY unauthenticated endpoint:
export interface VerifyResult {
  status: 'valid' | 'revoked' | 'not_found';
  certificate?: {                  // present only when status === 'valid'
    studentName: string | null;
    courseTitle: string | null;
    issuedAt: string;
  };
}
```

---

## Endpoints — Templates (`/api/admin/certificate-templates`)

### 1 · List templates
`GET /` → `200 { data: CertificateTemplate[] }` — newest first, never 500s.

### 2 · Template detail
`GET /:id` → `200 { data: CertificateTemplate }` · unknown → `404`

### 3 · Create template
`POST /` → `201 { data: CertificateTemplate, message }`

```json
{ "name": "Gold Diploma", "layout": { "primaryColor": "#0F172A", "signatureName": "Jane Dean" } }
```
- `name` required ≤120 → else `400`. `layout` optional — any missing key gets the
  server default; response always carries the complete layout.
- Colors must be `#RRGGBB` → else `400`. Unknown layout keys are dropped.

### 4 · Update template
`PATCH /:id` → `200 { data: CertificateTemplate, message }`
Any subset of `name` / `layout`. **`layout` REPLACES the whole layout object**
(missing keys reset to defaults) — send the full layout from your form state.
Empty body → `400`.

### 5 · Delete template
`DELETE /:id` → `200 { data: { id } }` — issued certificates are **kept**
(`templateId` becomes null; they render with the default layout + their snapshot).

---

## Endpoints — Certificates (`/api/admin/certificates`)

### 6 · List issued certificates
`GET /?courseId=&userId=&status=&limit=&offset=` → `200 { data: CertificateListPage }`
All filters optional. `status`: `active` | `revoked` (else `400`).
`limit` 1–500 (default 100) · `offset` ≥0 (default 0).

### 7 · Issue (manual, v1)
`POST /` → `201 { data: Certificate, message }`

```json
{ "userId": "<appUserId>", "courseId": "<courseId>", "templateId": "<optional>" }
```
- unknown user/course/template → `400` with a specific message
- course has `certificateEnabled: false` → `400` (link admin to course settings)
- pair already has a certificate → `400 "…already exists — reissue it instead."`
- One certificate per (course, user) — the list is the source of truth.

### 8 · Revoke
`POST /:id/revoke` → `200 { data: Certificate, message }` — soft revoke.
Already revoked → `400`. Revoked certs: PDF blocked, verify says `revoked`.

**Addendum (2026-08-08, Learners module Part 5):** body now optionally accepts
`{ "reason": "…" }`. Additive — this route's existing callers keep sending no
body at all. The reason is recorded in the `CERTIFICATE_REVOKED` audit log
entry's `details.reason`, not a new `Certificate` column (compliance trail,
not a UI-facing field on the certificate itself — same pattern as suspension
reasons living only in the audit log). Learners' `POST /learners/:id/
certificates/:cid/revoke` is a thin wrapper over this same endpoint/service,
not a fork — see `LEARNERS_CONTRACT.md`.

### 9 · Reissue
`POST /:id/reissue` → `200 { data: Certificate, message }`
Body optional: `{ "templateId": "<id>" | null }` (null = back to default layout).
Mints a **new verificationCode**, resets `issuedAt`, clears `revokedAt`.
**The old code (and old QR/PDF) stops verifying immediately** — warn the admin.

### 10 · Download PDF
`GET /:id/pdf` → `200` streamed `application/pdf` (landscape A4, QR bottom-right).
Not JSON — use a blob download / open in new tab, with the Bearer header.
Revoked certificate → `400` JSON. Unknown → `404` JSON.

---

## Endpoint — Public verify (`/api/public/certificates`)

### 11 · Verify by code — **no auth, no token header**
`GET /verify/:code` → **always `200`** `{ data: VerifyResult }`

- `status: "valid"` + certificate `{ studentName, courseTitle, issuedAt }` — nothing else, by design (no ids, no email)
- `status: "revoked"` — certificate exists but was revoked
- `status: "not_found"` — unknown/malformed code (malformed never hits the DB)

The QR on every PDF encodes `${PUBLIC_APP_URL}/verify/<code>` (env, default
`http://localhost:5173`). **Build the public page at `/verify/:code`** — it must
render without login and call this endpoint. Per-IP limit 30/min → on `429`
show "try again in a minute".

---

## Error summary

| Status | When |
|---|---|
| `400` | validation · unknown user/course/template ref · certificates disabled on course · duplicate pair · already revoked · PDF of revoked cert |
| `401` | missing/invalid token (admin routes only — verify never 401s) |
| `404` | unknown template id · unknown certificate id |
| `429` | rate limit — show "slow down and retry" |
| `503` | tables not migrated — should never happen now |

## Notes for the UI

1. **Issue dialog:** user picker + course picker (only courses make sense that
   have `certificateEnabled` — you can filter client-side or just surface the
   400 message) + optional template picker + a "default layout" option.
2. **Reissue** should confirm: "The current QR code and any downloaded PDFs
   will stop verifying." Revoke/reissue drive the status chip (`active` /
   `revoked`) — render from `status`, never compute from dates.
3. `certificateCount`, `total`, snapshots (`studentName`/`courseTitle`) are
   server-derived — render as received.
4. **PDF preview:** it's an authenticated GET — fetch as blob with the Bearer
   header, then `URL.createObjectURL` (a bare `<a href>` won't carry the token).
5. Template form: color inputs must emit `#RRGGBB`; body text supports exactly
   three placeholders — show them as insertable chips: `{{studentName}}`,
   `{{courseTitle}}`, `{{date}}`.
6. The public `/verify/:code` page is the QR landing — mobile-first, three
   states (valid ✅ with the three fields · revoked ⚠️ · not found ❌), no login,
   no other data shown.
