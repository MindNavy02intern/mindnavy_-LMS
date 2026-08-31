const prisma = require("../config/prisma");

// ── Instructor Earnings (Phase 5, blueprint 2.9) ────────────────────────────────
//
// Nearly 100% new: finance.service.js's listPayouts()/getPayoutSummary() have
// no instructorId filter anywhere (Step 0 audit — confirmed by reading both
// functions). InstructorPayout.instructorId already exists as a plain field
// (same shape finance.service.calculatePayouts() writes to), so this queries
// it directly rather than bending those admin-wide functions' signatures.
//
// Every amount here will genuinely be $0 until a real payment gateway is
// connected (Payment table is architecturally live but empty) — that's a
// documented truthful zero (IMPACT_MAP R3: never fabricate a non-zero
// number), not a bug.

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[instructorEarnings.service] query failed:", err.message);
    return fallback;
  }
}

function round2(n) { return Math.round((n ?? 0) * 100) / 100; }

function paginate(page, limit) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  return { skip: (p - 1) * l, take: l, page: p, limit: l };
}
function buildPagination(total, page, limit) {
  return { total, page, limit, pages: Math.max(1, Math.ceil(total / limit)) };
}

function mapPayout(p) {
  return {
    id:              p.id,
    amount:          round2(p.amount),
    currency:        p.currency,
    status:          p.status,
    revenueShareBps: p.revenueShareBps,
    periodStart:     iso(p.periodStart),
    periodEnd:       iso(p.periodEnd),
    approvedAt:      iso(p.approvedAt),
    completedAt:     iso(p.completedAt),
    createdAt:       iso(p.createdAt),
  };
}

// ── Summary (KPI cards) ──────────────────────────────────────────────────────────

async function getMySummary(instructorId) {
  const [lifetimeAgg, pendingAgg, lastCompleted, profile] = await Promise.all([
    safe(() => prisma.instructorPayout.aggregate({
      where: { instructorId, status: "COMPLETED" },
      _sum: { amount: true },
    }), { _sum: { amount: 0 } }),
    safe(() => prisma.instructorPayout.aggregate({
      where: { instructorId, status: { in: ["PENDING", "APPROVED"] } },
      _sum: { amount: true },
    }), { _sum: { amount: 0 } }),
    safe(() => prisma.instructorPayout.aggregate({
      where: { instructorId, status: "COMPLETED" },
      _max: { completedAt: true },
    }), { _max: { completedAt: null } }),
    safe(() => prisma.instructorProfile.findUnique({
      where: { userId: instructorId },
      select: { revenueShareBps: true },
    }), null),
  ]);

  return {
    lifetimeEarnings: round2(lifetimeAgg._sum.amount ?? 0),
    pendingPayout:    round2(pendingAgg._sum.amount ?? 0),
    lastPayoutDate:   iso(lastCompleted._max.completedAt),
    // % — same InstructorProfile.revenueShareBps/100 the blueprint routes
    // through GET /api/instructor/profile; returned here too since that
    // endpoint doesn't expose it yet and this is the one page that needs it.
    revenueSharePercent: profile?.revenueShareBps != null ? profile.revenueShareBps / 100 : null,
    currency: "USD",
  };
}

// ── Payout history (read-only) ────────────────────────────────────────────────────

const PAYOUT_STATUSES = new Set(["PENDING", "APPROVED", "PROCESSING", "COMPLETED", "FAILED", "HELD"]);

async function listMyPayouts(instructorId, { status, page, limit } = {}) {
  const where = { instructorId, ...(status ? { status } : {}) };
  const { skip, take, page: p, limit: l } = paginate(page, limit);

  const [total, rows] = await Promise.all([
    safe(() => prisma.instructorPayout.count({ where }), 0),
    safe(() => prisma.instructorPayout.findMany({
      where, orderBy: { createdAt: "desc" }, skip, take,
    }), []),
  ]);

  return {
    payouts: rows.map(mapPayout),
    pagination: buildPagination(total, p, l),
  };
}

module.exports = {
  PAYOUT_STATUSES,
  getMySummary,
  listMyPayouts,
};
