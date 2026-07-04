# Course Builder + Uploads — API Contract v1

For the frontend (Bilal). Backend is built and mounted. This is the source of
truth for the `USE_MOCK` service + types. If anything here conflicts with a task
description, **this contract wins** — build the frontend to match these shapes.

- **Base URL:** `http://localhost:5001/api/admin` (same base as the rest of the app)
- **Auth:** `Authorization: Bearer <admin token>` on every request (401 if missing/invalid)
- **Envelope (success):** `{ "success": true, "data": <payload>, "message"?: string }`
- **Envelope (error):** `{ "success": false, "message": string }` — read `message` for the UI
- **IDs:** uuid strings · **Dates:** ISO 8601 strings
- **Rate limits:** reads 120/min, writes 60/10min → on `429` show "slow down and retry"

> ⚠️ **Backend prerequisite:** the DB tables are created by `npx prisma db push`
> (adds `course_sections` + `lessons`). Until that runs, section reads return an
> empty list and section/lesson writes error. This is the admin's step, not yours.

---

## Part 1 — Course Builder (Sections & Lessons)

### Types (TypeScript)

```ts
export type LessonType = 'TEXT' | 'VIDEO_URL';

export interface Lesson {
  id: string;
  sectionId: string;
  title: string;
  type: LessonType;
  content: string | null;      // TEXT: body text · VIDEO_URL: the video URL
  durationMin: number | null;  // optional, mainly for video
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CourseSection {
  id: string;
  courseId: string;
  title: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  lessons: Lesson[];           // always present, ordered by `order`
}

export interface CreateSectionPayload { title: string; order?: number; }
export interface UpdateSectionPayload { title?: string; order?: number; }

export interface CreateLessonPayload {
  title: string;
  type: LessonType;
  content?: string;            // required (valid http/https URL) when type = VIDEO_URL
  durationMin?: number;
  order?: number;
}
export type UpdateLessonPayload = Partial<CreateLessonPayload>;

export interface ReorderPayload {
  sections: { id: string; order: number }[];
  lessons:  { id: string; sectionId: string; order: number }[];
}
```

### Endpoints

All ordered lists come back sorted by `order` (then `createdAt`) — render them
in the given order.

#### 1. List a course's sections (with lessons)
`GET /courses/:courseId/sections`

- **200** → `data: CourseSection[]` (each with its `lessons[]`)
- **404** course not found
- Empty course → `data: []`

#### 2. Create a section
`POST /courses/:courseId/sections`
Body: `CreateSectionPayload`

- `order` optional — defaults to the **end** of the list
- **201** → `data: CourseSection` (with empty `lessons: []`)
- **400** validation (e.g. missing title) · **404** course not found

#### 3. Update a section
`PATCH /sections/:id`
Body: `UpdateSectionPayload` (at least one field)

- **200** → `data: CourseSection`
- **400** nothing valid to update · **404** section not found

#### 4. Delete a section (cascade)
`DELETE /sections/:id`

- Deletes the section **and all its lessons** (DB-level cascade)
- **200** → `data: { id: string }` · **404** section not found

#### 5. Create a lesson
`POST /sections/:sectionId/lessons`
Body: `CreateLessonPayload`

- `TEXT` → `content` is the body text (optional, max 20000 chars)
- `VIDEO_URL` → `content` **required** and must be a valid `http(s)` URL
- `order` optional — defaults to the end of the section
- **201** → `data: Lesson`
- **400** validation (bad type, missing/invalid video URL) · **404** section not found

#### 6. Update a lesson
`PATCH /lessons/:id`
Body: `UpdateLessonPayload`

- If the lesson ends up `VIDEO_URL`, `content` must be a valid URL (checked
  against the merged result, so you can PATCH just `type` or just `content`)
- **200** → `data: Lesson`
- **400** validation · **404** lesson not found

#### 7. Delete a lesson
`DELETE /lessons/:id`

- **200** → `data: { id: string }` · **404** lesson not found

#### 8. Reorder (ONE bulk call after drag/drop or up/down arrows)
`PATCH /courses/:courseId/reorder`
Body: `ReorderPayload`

- Send **only what changed**; each entry needs an integer `order`
- A lesson may be **moved to another section** (set its new `sectionId`) — but only
  within the **same course**
- Applied in a single DB transaction (all-or-nothing)
- **200** → `data: CourseSection[]` — the **full updated tree**, so you can replace
  local state directly with the response
- **400** an id doesn't belong to this course, or bad shape · **404** course not found

> 💡 Reorder returns the whole rebuilt tree. Simplest frontend flow: optimistic
> update on drop, then replace state with `data` from the response.

---

## Part 2 — Uploads (Thumbnails now · Video via Cloudflare later)

The backend **never receives the file bytes**. Flow: ask for a **signed URL** →
**PUT the file straight to storage** → **confirm** so the backend verifies it and
saves the URL.

### Phase 1 status (important)
- ✅ **Thumbnails (images)** are fully enabled.
- 🚧 **Video upload is intentionally deferred.** For now, video lessons use a
  **URL** (the `VIDEO_URL` lesson type above — paste an external link). Asking to
  sign a `video` upload returns **400 "Video upload is coming soon — use a video
  URL for now."** Real video (large files + transcoding) lands on **Cloudflare
  Stream** in Phase 2 — the sign→confirm flow and this contract **won't change**,
  so build the UI against it now.

### Types (TypeScript)

```ts
export type UploadKind = 'thumbnail' | 'video';

export interface UploadSignRequest {
  fileName: string;
  fileType: string;   // mime, e.g. "image/png"
  kind: UploadKind;   // use 'thumbnail' in Phase 1
  courseId: string;
}
export interface UploadSignResponse {
  uploadUrl: string;  // PUT the raw file bytes here
  path: string;       // opaque storage path — send it back on confirm/delete
  kind: UploadKind;
  maxBytes: number;   // client should also enforce this before uploading
  expiresIn: number;  // seconds
}

export interface UploadConfirmRequest {
  courseId: string;
  path: string;       // the `path` from sign
  kind: UploadKind;
  lessonId?: string;  // reserved for Phase 2 video; ignored for thumbnails
}
export interface UploadConfirmResponse { url: string; }  // final public URL
```

### Allowed types & sizes (also enforced server-side)
- **thumbnail:** `image/jpeg`, `image/png`, `image/webp` · max **5 MB**
- (video, Phase 2: `video/mp4`, `video/webm`, `video/quicktime` · max 2 GB)

### Endpoints

#### 1. Get a signed upload URL
`POST /uploads/sign`
Body: `UploadSignRequest`

- **200** → `data: UploadSignResponse`
- **400** disallowed mime / missing fields / `kind: "video"` (Phase 1)
- **404** course not found
- **503** file storage not configured yet (admin hasn't set up Supabase) — show a
  friendly "uploads not available yet" message

#### 2. Upload the file (direct to storage — not our API)
`PUT <uploadUrl>` with the raw file as the body and header `content-type: <fileType>`.

> ⚠️ **Use `XMLHttpRequest`, not `fetch`, for this PUT** — `fetch` can't report
> upload progress. Wire `xhr.upload.onprogress` for the progress bar (% and
> MB/total) and `xhr.abort()` for cancel.

#### 3. Confirm the upload
`POST /uploads/confirm`
Body: `UploadConfirmRequest`

- Backend **verifies the object really exists** in storage, then saves the URL
  (thumbnail → `Course.thumbnail`)
- **200** → `data: { url }` (use it as the preview/src)
- **400** object not found (the PUT never completed) → let the user retry
- **404** course not found · **503** storage not configured

#### 4. Delete an orphaned/replaced file
`DELETE /uploads?path=<path>`

- Use when the user picks a new thumbnail and you want to remove the old one
- **200** → `data: { deleted: true, path }`
- **400** malformed/out-of-scope path · **404** course prefix not a real course

### Thumbnail upload — recommended frontend sequence
1. User picks a file → **validate type + size client-side first** (block early).
2. `POST /uploads/sign` → get `{ uploadUrl, path }`.
3. `PUT` the file to `uploadUrl` via **XHR** with a progress bar.
4. On success → `POST /uploads/confirm` with `{ courseId, path, kind: 'thumbnail' }`.
5. Use the returned `url` as the thumbnail preview; save it with the course.
6. If replacing an existing thumbnail, `DELETE /uploads?path=<oldPath>` after.

---

## USE_MOCK guidance
Mirror the existing `lmApi.ts` pattern: build `coursesApi` / `courseBuilderApi` /
`uploadsApi` with a `USE_MOCK` flag returning these exact shapes. Flip to `false`
to hit the real endpoints above — no other frontend code should need to change.

## Quick error map (for toasts / inline messages)
| Status | Meaning | UI |
|---|---|---|
| 400 | validation / bad input | inline, near the field (`message`) |
| 401 | not authenticated | bounce to login |
| 404 | course/section/lesson not found | "not found" state |
| 429 | rate limited | "slow down and retry" toast |
| 503 | storage not configured (uploads) | "uploads not available yet" |
| 500/502 | server/storage error | generic error toast |
