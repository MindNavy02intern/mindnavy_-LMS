# Content Library — API Contract v1

For the frontend (Bilal). Backend is built, mounted, smoke-tested (**34/34 green**,
including a real end-to-end upload). This is the source of truth for the Content
tab. If anything here conflicts with a task description, **this contract wins**.

- **Base URL:** `http://localhost:5001/api/admin/content`
- **Auth:** `Authorization: Bearer <admin token>` on every request (401 if missing/invalid)
- **Envelope (success):** `{ "success": true, "data": <payload>, "message"?: string }`
- **Envelope (error):** `{ "success": false, "message": string }`
- **IDs:** uuid strings · **Dates:** ISO 8601 strings
- **Rate limits:** reads 120/min, writes 60/10min → on `429` show "slow down and retry"

> **No new table:** this EXTENDS the existing `course_contents` model — the same
> table behind the LM Content stats tiles, so those tiles update automatically
> when library items are added/deleted (one table, one owner — B2). Legacy seed
> rows have `fileUrl: null` — render them without a download/preview action.

> **Upload flow = the same sign → direct PUT → confirm pattern as course
> thumbnails/videos** (§ the frontend never sends file bytes to OUR server):
> 1. `POST /sign` with `fileName` + `fileType` → get `{ uploadUrl, path }`
> 2. `PUT` the file bytes to `uploadUrl` with `Content-Type: <fileType>`
> 3. `POST /confirm` with `path` (+ title/tags/courseId) → the item row
> An unconfirmed upload is invisible — no row exists until confirm.

> **v1 scope — types:** uploadable: `VIDEO`, `DOCUMENT`, `PDF`, `AUDIO`, `IMAGE`
> (type is **derived server-side from the MIME**, never client-chosen).
> **SCORM upload is v2** (zip + player is its own feature) and **QUIZ rows are
> owned by the quiz flow** — both are valid *filter* values (legacy rows) but
> rejected for upload. `courseUsage[]` (reuse across courses) is v2 — no reuse
> mechanism exists yet.

> **Size cap: 50MB** (Supabase MVP — same story as course videos; bigger files
> come with the Cloudflare move). `maxBytes` is returned by `/sign` — read it
> from there, don't hardcode (R1).

> **Tags are normalized server-side:** trimmed, lowercased, deduped, ≤20 tags,
> ≤50 chars each. Expect `["Smoke","smoke"]` to come back as `["smoke"]`.

> **Existing infra:** `queryKeys.contentLibrary()` already exists in queryKeys.ts.
> Add `content.confirm/.update/.delete` to `invalidation.ts` per the IMPACT_MAP
> §5.4 row (invalidate `['content-library']` + `['courses', id]` when course-scoped).

> **Server prerequisite (done):** the `content-library` Supabase bucket exists
> (`node src/scripts/ensureLibraryBucket.js` creates it idempotently).

---

## Types

```ts
export type ContentType =
  | 'VIDEO' | 'DOCUMENT' | 'PDF' | 'AUDIO' | 'IMAGE'  // uploadable in v1
  | 'QUIZ' | 'SCORM';                                  // filter-only in v1

export interface ContentItem {
  id: string;
  title: string;                // 1–200 chars (defaults to the file name)
  type: ContentType;            // derived server-side from MIME
  courseId: string | null;      // null = library-wide item
  courseTitle: string | null;   // derived
  fileUrl: string | null;       // public URL · null on legacy seed rows
  sizeBytes: number | null;     // verified server-side at confirm
  mimeType: string | null;
  tags: string[];               // normalized (lowercase, deduped)
  uploadedBy: string | null;    // admin id
  createdAt: string;
  updatedAt: string;
}

export interface ContentListData {
  content: ContentItem[];
  pagination: { total: number; page: number; limit: number; pages: number };
  // Chips/tiles: counts share every active filter EXCEPT type
  typeCounts: { All: number } & Partial<Record<ContentType, number>>;
}
```

## Endpoints

### `GET /` — list (paginated, newest first)
Query params (all optional): `search` (title contains, ≤200) · `type=<ContentType>` ·
`tag` (single tag, lowercase) · `courseId` · `page` (default 1) · `limit` (default 20, max 100)
→ `200 { success, data: ContentListData }` · bad type → `400`

### `POST /sign` — step 1
```jsonc
{ "fileName": "Report.pdf", "fileType": "application/pdf" }
```
→ `200 { success, data: { uploadUrl, path, type, maxBytes, expiresIn } }`
Disallowed MIME (zip, exe, …) → `400` · storage unconfigured → `503`
Allowed MIME families: pdf · doc/docx/ppt/pptx/xls/xlsx/txt · mp4/webm/mov ·
mp3(mpeg)/m4a/wav/ogg · jpeg/png/webp/gif

### `POST /confirm` — step 3 (after the direct PUT)
```jsonc
{
  "path": "<path from /sign>",        // required
  "title": "Q3 Report",               // optional (default: file name)
  "tags": ["reports", "finance"],     // optional
  "courseId": "<uuid> | null"         // optional (null/omitted = library-wide)
}
```
Server re-verifies the object exists, its real size (≤50MB) and MIME, then creates the row.
→ `201 { success, message: "Content added to the library.", data: ContentItem }`
Errors (`400`): bad/traversal path · nothing uploaded at path · too large · unknown MIME · unknown course

### `PATCH /:id` — metadata only
Any subset of: `title`, `tags` (full replacement; `[]` clears), `courseId` (null detaches).
File fields (`fileUrl`, `type`, …) → `400` (server-managed). Empty patch → `400`.
→ `200 { success, message: "Content updated.", data: ContentItem }` · unknown id → `404`

### `DELETE /:id` — remove item + its stored file
→ `200 { success, message: "Content deleted.", data: { id } }` · unknown id → `404`

---

*Backend files: `routes/content.routes.js` · `controllers/content.controller.js` ·
`services/content.service.js` · `validators/content.validator.js` ·
`scripts/ensureLibraryBucket.js` · smoke: `scripts/contentSmokeTest.js`.*
