# MindNavy LMS — Monorepo Root

## Structure

```
mindnavy LMS/
├── frontend/    React + Vite + TypeScript (Bilal)
├── backend/     Node / Express / Prisma (Hassan)
├── docs/        Blueprint (UI spec for all 13 modules)
└── IMPACT_MAP.md  Reflection / invalidation map
```

## Mandatory references (both people)

| File | Purpose |
|---|---|
| `docs/blueprint/INDEX.md` | Route every UI task here first — links to 13 page files |
| `IMPACT_MAP.md` | Every mutation → query keys → surfaces that must update |

Blueprint = what SHOULD exist. If blueprint and reality disagree, report the
gap — don't silently fix either side.

## Frontend work (Bilal)

**Follow `frontend/CLAUDE.md` in full** — it contains the complete protocol:
data reflection rules, test requirements, code-quality gates, review
checklist, and the graph-report workflow. No shortcuts.

## Backend work (Hassan)

The backend contract lives in `IMPACT_MAP.md §8`. Core principles:
- Every write endpoint returns `{ success, data, message }` (no 500 on known
  errors — return 400/401/404 with `message`).
- Auth: `requireAdminAuth` on every `/api/admin/*` route — no exceptions.
- New Prisma model → run `prisma generate` then `prisma db push` (tell Bilal
  so he can hard-reload and avoid 500 surprises).
- Rate limiters: `adminUsersAnalyticsRateLimiter` (30/min prod, 300/min dev),
  `adminUserActionRateLimiter` (60/10 min). Don't tighten in production
  without coordinating.
