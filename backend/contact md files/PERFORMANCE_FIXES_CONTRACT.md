# Performance & Stability — Backend Changes + Frontend Work Order

**Date:** 2026-08-26
**Trigger:** "the system becomes slow and some pages are not opening"
**Backend status:** DONE and verified (70/70 read endpoints 200 OK)
**Frontend status:** NOT STARTED — this document is the work order

---

## 0. What the investigation actually found

Everything measurable on the infrastructure side was healthy:

| Layer | Measurement | Verdict |
|---|---|---|
| Supabase Postgres latency | p50 73ms, p95 159ms, max 252ms over 60 queries | healthy |
| Connection pool | 40 parallel queries, no serialisation | healthy |
| Data volume | largest table `audit_logs` = 16,080 rows / 6MB | trivial |
| Dev machine | 15.7GB RAM (73% used), 328GB free | healthy |
| Vite dev server | 40–70 modules / ~300ms per page, warm | healthy |
| Backend endpoints | all 200, slowest 1.28s | see §1 |

So the slowness was **not** the database growing, a leaked process, or a missing index.
It was: a small number of genuinely wasteful backend queries (now fixed, §1)
plus a set of frontend architecture problems (§2, not fixed).

---

## 1. Backend — FIXED

No Prisma schema changes. No `db push` required. No API response shapes changed.

### 1.1 Rate limiting — keyed per admin, production ceilings corrected

`backend/src/middlewares/rateLimit.middleware.js`

**The bug:** `coursesReadRateLimiter` is wired into **99 GET routes across 21 route
files** — it is the combined read budget for the entire admin API, not just the
Courses tab. It was **120 requests/minute per IP** in production. A single page
load fires 10–20 GETs, so roughly 6–10 page loads per minute exhausted it, and
the frontend throws on 429 with no retry, which renders as *"the page doesn't
open"*. Dev was set to 1200, so this was **invisible locally and only broke in
production** — which is exactly the reported symptom.

Worse, IP keying meant two admins in the same office, or every user behind a
reverse proxy, drew from **one shared bucket**.

**The fix:**
- Post-auth limiters now key on a **SHA-256 of the session token** (per admin),
  not the IP. Verified: admin A's counter decrements 1199→1198→1197→1196 and is
  unaffected by a different token's requests in between.
- Token is hashed, not stored raw — the limiter store is an in-memory Map whose
  keys appear in heap dumps, and a raw session token there is a credential in
  the clear for no benefit.
- IPv6 handled via express-rate-limit's own `ipKeyGenerator` on the fallback
  path (a bare `req.ip` would be an IPv6 bypass).
- Production ceilings raised to match measured app behaviour:
  reads 120→600/min, analytics 30→300/min, writes 60→300/10min.

**Security note — nothing was weakened where it matters.** The pre-auth
limiters are **completely unchanged and still IP-keyed**: login (20/15min),
OTP (10/15min), public certificate verification (30/min), public instructor
applications (5/hr). Those are the surfaces an unauthenticated attacker can
reach. The raised limiters all sit *behind* `requireAdminAuth` on an API where
the caller already holds full admin read access — they are DoS protection, not
authorisation, and a runaway loop or scripted scrape still trips them.

### 1.2 `trust proxy` support

`backend/server.js`

Behind nginx / a load balancer / a PaaS router, `req.ip` is the proxy's address
for **every** request, so the IP-keyed limiters above would share one bucket
across the whole user base. Added opt-in `TRUST_PROXY` env var.

**Left OFF by default deliberately** — trusting `X-Forwarded-For` when *not*
behind a proxy lets any client forge the header and reset its own counter.
When you deploy, set `TRUST_PROXY=1` (the number of proxies in front), or a
specific address/CIDR. Never `true`.

### 1.3 Dashboard — stopped fetching 500 rows to count them

`backend/src/services/liveSessions.service.js`, `dashboard.service.js`

- `syncStatuses()` ran **three sequential raw UPDATEs** on every session read.
  Their WHERE clauses are provably disjoint (`end<=now` / `start<=now<end` /
  `start>now`), so they now run in **parallel** — 3 round trips → 1.
- `/dashboard/core` called `listSessions({})` — up to 500 rows with two joins —
  purely to compute `.filter(s => s.status === 'LIVE').length`. Added
  `countSessionsByStatus()` and wired the KPI to it.

### 1.4 Dashboard — the worst-scaling query in the app

`backend/src/services/dashboard.service.js`

`/dashboard/analytics` ran `courseEnrollment.findMany()` with **no `where` and
no `take`**, pulling *every enrollment row ever created* with a course join, on
every request. Replaced with `groupBy(['courseId','status'])` + one bounded
course lookup. Result set is now bounded by course count, not enrollment volume.

**Verified byte-identical** against the old algorithm on live data:
`averageCompletionRate` 53.8, `mostPopularCourse` "Complete React Developer",
and all 5 completion categories in the same order with the same rates.

### 1.5 Finance — N+1 eliminated in `calculatePayouts`

`backend/src/services/finance.service.js`

Ran **3 sequential queries per instructor** (courses → payment aggregate →
existing-payout check) plus a `create` — ~4 network round trips each. 50
instructors meant ~200 sequential round trips. Rewritten to 3 batched reads +
one `createManyAndReturn`.

**Verified equivalent** with 7 synthetic cases covering: normal mix, already-paid
skip (idempotency), out-of-period and FAILED payments excluded, zero gross
skipped, rounding, shared course ids, empty input. 7/7 identical.

### 1.6 Finance — two unbounded full-table scans

`getRevenueByCategory()` and `getTopCoursesByRevenue()` each loaded **every
SUCCESSFUL payment row ever** into Node and aggregated in a JS loop. Both now
`groupBy` in Postgres; the top-courses one also sorts and `take`s 5 in the DB.

> Payments table is currently empty, so these two are verified only for
> correct empty-state behaviour and valid query shape — not against volume data.

### 1.7 Integrations — serial awaits collapsed

`getStats()` awaited `listIntegrations()` on its own line before a `Promise.all`
that never depended on it. `getAnalytics()` had **three** sequential await
stages. Both collapsed into single batches.

### 1.8 Notifications — quiet-hours rows batched

An email blast landing inside quiet hours created one PENDING row per recipient
**inside the send loop** — up to `EMAIL_BLAST_CAP` sequential INSERTs. Now one
`createMany`.

> Self-review caught a bug introduced while doing this: partitioning with two
> `.filter()` passes called `isWithinQuietHours()` twice per recipient, each
> defaulting `now` to a fresh `Date`. A recipient evaluated either side of a
> quiet-hours boundary would land in neither list and be **silently dropped**.
> Fixed — single pass, one fixed timestamp.

### 1.9 Measured result

| Endpoint | Before | After |
|---|---|---|
| `/dashboard/core` | 1.017s | **0.236s** |
| `/dashboard/admin-widgets` | 0.491s | **0.303s** |
| `/integrations/stats` | 1.282s | **0.083s** |
| `/integrations/analytics` | ~0.44s | **0.285s** |
| all 70 read endpoints | — | **70/70 → 200** |

---

## 2. Frontend — NOT FIXED, needs Bilal

These are the causes of *"pages are not opening"* that do **not** live in the
backend. Ordered by impact.

### FE-1 — There is no ErrorBoundary anywhere in the app (CRITICAL)

Zero matches for `ErrorBoundary` / `componentDidCatch` /
`getDerivedStateFromError` across all 346 source files.

`src/App.tsx:56` wraps every route in `<Suspense>` with **no error boundary**.
Consequence: any render error, or any lazy chunk that fails to load, unmounts
the whole tree — the user gets a permanently blank page or a spinner that never
resolves, **with no error message anywhere**. This is the single most likely
explanation for the reported symptom, and it is also *why the problem has been
so hard to diagnose*: the app is actively hiding its own errors.

**Required:** an `ErrorBoundary` component wrapping `<Suspense>` in `App.tsx`
(and ideally per-route), rendering the error message + a Retry button. A
`window.onerror` / `onunhandledrejection` hook that surfaces the message would
also help enormously.

### FE-2 — Every mutation triggers a refetch storm (HIGH)

`src/lib/invalidation.ts:1236–1272` — **every branch** of `dispatchBridgeEvents`
adds `'analyticsUpdated'`, and the `DEFAULT_KEYS` appended to *every* mutation
fall into the catch-all branch too. **44 components listen to that one event.**

Typically 3–5 listeners are mounted at once (FeatureFlagsProvider + stats cards
+ analytics section + active tab), so **one button click costs ~5–12 extra API
calls**. React StrictMode (`src/main.tsx:11`) doubles all of it in dev. This is
the mechanism behind *"it gets slower the more I use it"*.

**Required:** make the bridge events granular so a mutation only wakes the
components whose data actually changed — `analyticsUpdated` should be the
exception, not the default for all 17 query-key domains. The file's own header
already names the real fix: install `@tanstack/react-query` and migrate off the
DOM CustomEvent bus.

### FE-3 — `npm run build` is broken (HIGH)

`build` is `tsc -b && vite build`, and `tsc -b` fails with **24 errors**. There
is currently **no way to produce a production build.** Full list via
`npx tsc -b --pretty false`. Clusters:
- `src/services/financeApi.ts` ×8 — param types need an index signature
- `src/components/finance/CouponsTab.tsx` ×3 — `null` vs `undefined`
- `src/api/uploadsApi.ts:81` — `UploadKind` not imported
- `src/types/uploads.ts:35` — syntax not allowed under `erasableSyntaxOnly`
- the three in FE-4 below

### FE-4 — Confirmed live bug: Reports department filters are always empty

Three tabs read `res.departments`, but `GET /organization/departments` returns
`{ data, pagination }` (`src/types/organization.ts:172`). `res.departments` is
`undefined`, so `.map()` throws — and it is **swallowed by `.catch(() => {})`**,
so the dropdowns are silently, permanently empty with no error shown.

- `src/components/reports/ReportsOverviewTab.tsx:130`
- `src/components/reports/LearnerAnalyticsTab.tsx:74`
- `src/components/reports/ComplianceReportsTab.tsx:43`

**Fix:** `res.data.map(...)`. **The backend is correct — do not change it.**
Per CLAUDE.md §6, backend contract > blueprint.

While fixing: those bare `.catch(() => {})` blocks are what hid this for weeks.
Every one should at minimum `console.error`.

### FE-5 — No 429 handling

Every `*Api.ts` maps 429 to a message string and throws. No retry, no backoff,
no `Retry-After` respect. Combined with FE-2, a burst of refetches turns into a
page-wide error state. Now that the backend ceilings are per-admin and much
higher this is far less likely, but a bounded retry-with-backoff on 429 for GETs
would make it a non-issue.

### FE-6 — Playwright browsers are not installed

`~/AppData/Local/ms-playwright` does not exist. The test suite cannot run at
all. `npx playwright install` (~150MB).

---

## 3. Known-remaining backend items (deliberately NOT changed)

Flagged rather than fixed, because each is a judgement call that belongs to you:

1. **`GET /reports/learners` ≈ 0.97s.** `countByBuckets()` issues **one COUNT
   per bucket**, and `buildTrendBuckets` only switches to a weekly step above 62
   days — so the common 30-day range is 30 buckets, and `getLearnerAnalytics`
   calls it three times: **~90 COUNT queries per request**. They run in
   parallel so latency is far below 90 round trips, but it is still ~100
   statements to draw one chart. Fixing it means either raw SQL
   (`date_trunc` + `GROUP BY`, which Prisma can't express for an arbitrary
   `where`) or capping bucket count and accepting coarser charts. The
   misleading "~13 buckets" comment has been corrected in place.

2. **`audit_logs` has no retention policy.** 16,080 rows / 6MB and growing on
   every admin action. Not a problem yet, and **I did not add an auto-delete
   sweep on purpose** — audit logs are security records and silently pruning
   them is a policy decision, not a performance one. Decide on a retention
   window (or archive-to-cold-storage) explicitly.

3. **~137 `findMany` calls without `take`.** Most are safely bounded in practice
   (`id: { in: [...] }` from an already-paginated page, or a `paginate()`
   spread). The genuinely unbounded ones on growing tables are the four fixed
   above. Worth a pass before real production volume.

4. **`CourseEnrollment` has no index on `status`** — the new `groupBy` would
   benefit. Requires a schema change + `npx prisma db push`, which per
   CLAUDE.md §4 is yours to run, not mine.
