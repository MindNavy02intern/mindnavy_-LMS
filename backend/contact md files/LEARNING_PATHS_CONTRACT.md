# Learning Paths — API Contract v1

For the frontend (Bilal). Backend is built, mounted, smoke-tested (**37/37 green**).
This is the source of truth for the Learning Paths tab. If anything here conflicts
with a task description, **this contract wins**.

- **Base URL:** `http://localhost:5001/api/admin/learning-paths`
- **Auth:** `Authorization: Bearer <admin token>` on every request (401 if missing/invalid)
- **Envelope (success):** `{ "success": true, "data": <payload>, "message"?: string }`
- **Envelope (error):** `{ "success": false, "message": string }`
- **IDs:** uuid strings · **Dates:** ISO 8601 strings
- **Rate limits:** reads 120/min, writes 60/10min → on `429` show "slow down and retry"

> **Scope (updated 2026-08-17):** items are **`COURSE`, `LIVE_SESSION` and
> `QUIZ`** — quizzes were added once the Quizzes system shipped, per this
> contract's original "when that system ships" note. Assignments and
> certificate-templates still have no item type — don't render pickers for
> them. Completion rules v1 = one path-level `sequential` flag (free order vs.
> must-follow-order). Prerequisites, deadlines, skill mapping and learner
> progress are **deferred to v2**.

> **Existing infra:** the tab shell (`?tab=paths`), the `['learning-paths']`
> query key (queryKeys.ts) and its invalidation wiring already exist — build
> against them, don't recreate keys.

---

## Types

```ts
export type LearningPathItemType = 'COURSE' | 'LIVE_SESSION' | 'QUIZ';

export interface LearningPath {
  id: string;
  title: string;              // 1–200 chars
  description: string | null; // ≤ 2000 chars
  sequential: boolean;        // false = free order, true = must follow order
  itemCount: number;          // derived server-side, never compute client-side
  createdAt: string;
  updatedAt: string;
}

export interface LearningPathItem {
  id: string;                 // the path-item id (use THIS for remove/reorder)
  itemType: LearningPathItemType;
  itemId: string;             // id of the referenced course / live session / quiz
  order: number;
  createdAt: string;
  // Resolved view of the referenced entity (server-side join):
  title: string | null;       // null only when missing === true
  status: string | null;      // COURSE: 'Draft'|'Pending'|'Published'|'Archived'
                              // LIVE_SESSION: 'upcoming'|'live'|'ended'
                              // QUIZ: always null — no status concept
  startTime: string | null;   // LIVE_SESSION only, else null
  missing: boolean;           // true = referenced row no longer exists.
                              // Render flagged (e.g. "unavailable"), NEVER hide.
}

export interface LearningPathDetail extends LearningPath {
  items: LearningPathItem[];  // already sorted by order asc
}
```

---

## Endpoints

### 1 · List paths
`GET /` → `200 { data: LearningPath[] }` — newest first. Empty array before any
paths exist (never 500s).

### 2 · Path detail (with ordered items)
`GET /:id` → `200 { data: LearningPathDetail }` · unknown id → `404`

### 3 · Create path
`POST /` → `201 { data: LearningPath, message }`

```json
{ "title": "Onboarding Journey", "description": "optional", "sequential": false }
```
- `title` required, ≤ 200 chars → else `400`
- `description` optional, ≤ 2000 · `sequential` optional boolean (default `false`)

### 4 · Update path
`PATCH /:id` → `200 { data: LearningPath, message }`
Any subset of `title` / `description` / `sequential`. `description: null` clears
it. Empty body → `400 "No valid fields provided to update."`

### 5 · Delete path
`DELETE /:id` → `200 { data: { id } }` — **hard delete**; items are removed by DB
cascade. Confirm in the UI before calling.

### 6 · Add item
`POST /:id/items` → `201 { data: LearningPathItem, message }`

```json
{ "itemType": "COURSE", "itemId": "<courseId>" }
```
- `itemType`: `COURSE` | `LIVE_SESSION` | `QUIZ` (anything else → `400`)
- `itemId` must exist in its table → else `400 "Referenced course, live session, or quiz does not exist."`
- Same item twice in one path → `400 "This item is already in the learning path."`
- `order` optional — defaults to end of list. The returned item is already resolved
  (title/status filled in) → append it to local state, no refetch needed.

### 7 · Remove item
`DELETE /:id/items/:itemId` → `200 { data: { id } }`
`:itemId` = the **path-item id** (`item.id`), NOT the course/session id.
Unknown or belongs to another path → `404`.

### 8 · Reorder (bulk — the drag-and-drop endpoint)
`PATCH /:id/reorder` → `200 { data: LearningPathDetail, message }`

```json
{ "items": [ { "id": "<pathItemId1>", "order": 0 }, { "id": "<pathItemId2>", "order": 1 } ] }
```
Same pattern as Course Builder reorder: **one bulk call after drop, then replace
local state from the response** (it's the full re-read path detail, items sorted).
All updates apply in one transaction — all or nothing. An item id that doesn't
belong to this path → `400`, nothing is changed. Max 500 entries.

---

## Error summary

| Status | When |
|---|---|
| `400` | validation failure · unknown/duplicate item ref · foreign item in reorder |
| `401` | missing/invalid token |
| `404` | unknown path id · unknown path-item id |
| `429` | rate limit — show "slow down and retry" |
| `503` | tables not migrated (`prisma db push` not run) — should never happen now |

## Notes for the UI

1. **Stale refs:** an **archived** course stays in the path with
   `status: "Archived"`, `missing: false` — show it greyed/badged. A row that was
   hard-deleted from the DB comes back `missing: true, title: null` — show
   "unavailable item", let the admin remove it. Never crash, never hide.
2. **`TeamsTab.tsx` is NOT connected** to this system — its per-team
   `learningPaths` display is stub data from the organization endpoint. Don't
   expect it to update when paths change here.
3. Item counts (`itemCount`) and item ordering are server-derived — render them
   as received (IMPACT_MAP rule: no client-side computation of derived facts).
4. Invalidate `['learning-paths']` after every mutation here (create/update/
   delete/add/remove/reorder) — the key + invalidation helpers already exist.
