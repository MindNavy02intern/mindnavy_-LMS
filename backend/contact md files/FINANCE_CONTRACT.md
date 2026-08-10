# Finance — API Contract v1

For the frontend (Bilal). Backend is built and mounted. This is the source of
truth for the Finance module (`/finance`, blueprint 09). If anything here
conflicts with a task description, **this contract wins**.

- **Base URL:** `http://localhost:5001/api/admin/finance`
- **Auth:** `Authorization: Bearer <admin token>` on every request (401 if missing/invalid)
- **Envelope (success):** `{ "success": true, "data": <payload>, "message"?: string }`
- **Envelope (error):** `{ "success": false, "message": string }`
- **IDs:** uuid strings (cuid for `FinanceSettings`, matches `CompetencySettings`) · **Dates:** ISO 8601 strings
- **Rate limits:** reads 120/min (`coursesReadRateLimiter`), writes 60/10min prod / 600/10min dev (`adminUserActionRateLimiter`)
- **No real payment gateway yet.** Every model starts empty, every amount starts at 0. `available:false` never appears in this module's stats/analytics — every underlying model genuinely exists, so "no data" is `available:true` with `value:0` / `items:[]`, never a fabricated fallback.

> **FK strategy:** `userId`/`courseId`/`instructorId`/`processedById`/`approvedById`/`createdById` on every model are **plain strings**, not Prisma relations — same convention as `AuditLog.adminId`. `AppUser`/`Course` were NOT touched; every list/detail response resolves names server-side and returns them as extra fields (`userName`, `courseTitle`, etc.) — never fetch these separately.

> **Ownership (R4):** `totalRevenue` and `activeSubscriptions` are owned by `GET /api/admin/dashboard/core` (`kpis.totalRevenue`/`kpis.activeSubscriptions`) and `GET /api/admin/dashboard/analytics` (`revenueOverview.*`). This module's own `GET /finance/stats` computes the SAME numbers via the SAME shared function (`finance.service.getTotalRevenueValue()`/`getActiveSubscriptionsCountValue()`) — the two endpoints can never drift. Do not add a third computation anywhere.

---

## Known gaps / decisions (read before building UI against this)

1. **No `Plan` model.** The task spec's Prisma model list has no separate Plan
   entity — `Subscription.planType` is a plain enum on the row itself.
   Blueprint 09's `plan.create`/`plan.update` mutation IDs and the
   `['plans']` query key stay **dead** (documented-but-unbuilt, same status
   as `skillLevel.configure` in COMPETENCIES_CONTRACT.md) — Subscriptions
   tab's "Create Subscription" writes the Subscription row directly via new
   `subscription.create`/`subscription.update` mutations instead.
2. **Refund flow is two-step, matches blueprint 09 §6 exactly:** there is no
   student-facing app in this system (same precedent as `InstructorReview`),
   so `PATCH /payments/:id/refund` stands in for "student requests a
   refund" — it creates a `PENDING` `Refund` row and does **not** touch the
   `Payment` row. `PATCH /refunds/:id/approve` is the actual money movement:
   flips `Payment.status → REFUNDED`, writes a `Transaction(type=REFUND)`,
   sets `Refund.status → PROCESSED`. `Refund.status` never rests at
   `APPROVED` in v1 — there's no gateway to wait on, so approve goes
   straight to the terminal `PROCESSED` state. `/reject` sets `REJECTED`;
   the rejection reason is written to the audit log only (`Refund` has no
   `rejectionReason` column — same "audit trail is the second writer of
   why" precedent as `Certificate.revoke`).
3. **No Payment ↔ Invoice link.** They're separate models with no FK between
   them (not in the task's schema spec). The Payments tab's row actions are
   **View / Refund only** — no "Download Invoice" button, since wiring one
   would fake a relationship that doesn't exist.
4. **"Upgrade" on Subscriptions reuses Edit** (`subscription.update`) — no
   separate upgrade endpoint exists; changing `planType`/`amount` via PATCH
   IS the upgrade.
5. **Tax Rule CRUD collapses to one mutation ID:** `tax.configure` covers
   create/update/delete of `TaxRule` rows — blueprint 09 §10 describes this
   as one conceptual action ("Configure rules") over the collective ruleset,
   same `['tax','config']` key for all three.
6. **`FinanceSettings` is a new singleton model**, not in the original
   Prisma model list — added because `GET/PATCH /finance/settings`
   (Billing Settings tab) needs somewhere to persist. Mirrors
   `CompetencySettings`: `findFirst() ?? create(defaults)`.
7. **New mutation IDs** added to `invalidation.ts` beyond what already
   existed: `subscription.create`, `subscription.update`,
   `subscription.extend`, `payout.approve`, `payout.complete`,
   `payout.calculate`, `coupon.delete`. Everything else (`refund.request`,
   `refund.approve`, `refund.reject`, `payout.hold`, `subscription.cancel`,
   `invoice.generate/update/void/send`, `coupon.create/update/disable`,
   `tax.configure`, `billingSettings.update`) was already scaffolded and is
   reused as-is.
8. **Invoice PDF is a placeholder.** `GET /invoices/:id/download` returns
   `{ invoiceId, invoiceNumber, message }`, not a binary — no PDF engine is
   wired in v1.
9. **Payout calculation is idempotent and skips zero-gross instructors.**
   `POST /payouts/calculate` only creates a row when an instructor has
   `InstructorProfile.revenueShareBps` set, owns at least one course, and
   that course has SUCCESSFUL payments inside the period — with an empty
   `Payment` table (no gateway yet) this genuinely creates 0 rows today,
   which is correct, not a bug.

---

## Types

```ts
export type Metric = { value: number | null; changePercent: number | null; available: boolean; reason?: string };
export type SimpleMetric = { value: number | null; available: boolean; reason?: string };

export interface FinanceStats {
  totalRevenue: Metric; monthlyRevenue: Metric;
  activeSubscriptions: SimpleMetric; pendingPayments: SimpleMetric;
  failedTransactions: SimpleMetric; refundRequests: SimpleMetric;
  instructorPayouts: SimpleMetric; revenueGrowth: SimpleMetric;
}

export type PaymentStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
export type PaymentMethod = 'STRIPE' | 'PAYPAL' | 'BANK_TRANSFER' | 'MANUAL';
export interface Payment {
  id: string; userId: string; userName: string | null; userEmail: string | null;
  courseId: string | null; courseTitle: string | null;
  amount: number; currency: string; status: PaymentStatus; method: PaymentMethod;
  stripePaymentIntentId: string | null; createdAt: string; updatedAt: string;
}

export type SubscriptionPlanType = 'MONTHLY' | 'ANNUAL' | 'ENTERPRISE' | 'TEAM' | 'CUSTOM';
export type SubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PAUSED';
export type BillingCycle = 'MONTHLY' | 'ANNUAL';
export interface Subscription {
  id: string; userId: string; userName: string | null; userEmail: string | null;
  planType: SubscriptionPlanType; status: SubscriptionStatus; billingCycle: BillingCycle;
  amount: number; currency: string;
  startDate: string; endDate: string | null; renewalDate: string | null;
  createdAt: string; updatedAt: string;
}

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'VOID' | 'OVERDUE';
export interface InvoiceItem { name: string; qty: number; unitPrice: number; total: number }
export interface Invoice {
  id: string; userId: string; userName: string | null; userEmail: string | null;
  invoiceNumber: string; items: InvoiceItem[];
  subtotal: number; taxAmount: number; total: number;
  status: InvoiceStatus; dueDate: string | null; paidAt: string | null;
  createdAt: string; updatedAt: string;
}

export type TransactionType = 'PAYMENT' | 'REFUND' | 'PAYOUT' | 'TRANSFER' | 'TAX_DEDUCTION';
export interface Transaction {
  id: string; paymentId: string; type: TransactionType; amount: number; currency: string;
  gatewayResponse: Record<string, unknown> | null; createdAt: string; relatedPaymentAmount: number | null;
}

export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSED';
export interface Refund {
  id: string; paymentId: string; userId: string; userName: string | null; courseTitle: string | null;
  amount: number; reason: string; status: RefundStatus;
  requestedAt: string; processedAt: string | null; processedById: string | null;
}

export type PayoutStatus = 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'HELD';
export interface InstructorPayout {
  id: string; instructorId: string; instructorName: string | null;
  amount: number; currency: string; status: PayoutStatus; revenueShareBps: number;
  periodStart: string; periodEnd: string;
  approvedById: string | null; approvedAt: string | null; completedAt: string | null;
  createdAt: string; updatedAt: string;
}

export type CouponType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type CouponStatus = 'ACTIVE' | 'DISABLED' | 'EXPIRED';
export interface Coupon {
  id: string; code: string; type: CouponType; value: number;
  maxUses: number | null; usedCount: number; minPurchaseAmount: number | null;
  applicableCourseIds: string[]; expiresAt: string | null; status: CouponStatus;
  createdById: string; createdAt: string; updatedAt: string;
}

export type TaxRuleType = 'VAT' | 'SALES_TAX' | 'DIGITAL_TAX';
export type TaxRuleStatus = 'ACTIVE' | 'INACTIVE';
export interface TaxRule {
  id: string; name: string; region: string; country: string; rate: number;
  type: TaxRuleType; status: TaxRuleStatus; createdAt: string; updatedAt: string;
}

export interface FinanceSettings {
  id: string; currency: string; paymentRetryRules: Record<string, unknown> | null;
  refundPolicy: string | null; autoBillingEnabled: boolean;
  updatedById: string | null; updatedAt: string;
}

export interface FinanceAnalytics {
  revenueTrend: { available: boolean; labels: string[]; values: number[] };
  revenueByCategory: { available: boolean; items: { name: string; value: number }[] };
  subscriptionBreakdown: { available: boolean; items: { name: string; value: number }[] };
  refundTrend: { available: boolean; labels: string[]; values: number[] };
  topCoursesByRevenue: { available: boolean; items: { courseId: string; title: string | null; value: number }[] };
  payoutSummary: { available: boolean; items: { status: PayoutStatus; count: number; amount: number }[] };
}
```

---

## Endpoints

All list endpoints return `{ items: T[], total: number, page: number, limit: number }`.

**Dashboard**
- `GET /stats` → `FinanceStats`
- `GET /analytics?period=daily|weekly|monthly|quarterly` (default `monthly`) → `FinanceAnalytics`

**Payments**
- `GET /payments?status&method&search&page&limit&dateFrom&dateTo`
- `GET /payments/:id`
- `PATCH /payments/:id/refund { amount, reason }` → creates a `PENDING` Refund (see decision #2)
- `GET /payments/export?...same filters` → `text/csv`

**Subscriptions**
- `GET /subscriptions?status&planType&page&limit`
- `POST /subscriptions { userId, planType, billingCycle, amount, currency?, startDate?, endDate?, renewalDate? }`
- `PATCH /subscriptions/:id { planType?, billingCycle?, amount?, currency?, endDate?, renewalDate? }`
- `PATCH /subscriptions/:id/cancel`
- `PATCH /subscriptions/:id/extend { renewalDate }`

**Invoices**
- `GET /invoices?status&page&limit`
- `GET /invoices/:id`
- `POST /invoices { userId, items: [{name,qty,unitPrice}], taxAmount?, dueDate? }` — `subtotal`/`total` are SERVER-computed, never accepted from the client
- `PATCH /invoices/:id { items?, taxAmount?, dueDate?, status? }` (status ∈ DRAFT/SENT/PAID/OVERDUE — VOID has its own endpoint)
- `PATCH /invoices/:id/void`
- `PATCH /invoices/:id/send`
- `GET /invoices/:id/download` → placeholder JSON (see decision #8)

**Transactions** (read-only)
- `GET /transactions?type&page&limit&dateFrom&dateTo`

**Refunds**
- `GET /refunds?status&page&limit`
- `PATCH /refunds/:id/approve`
- `PATCH /refunds/:id/reject { reason }`

**Instructor Payouts**
- `GET /payouts?status&page&limit`
- `POST /payouts/calculate { periodStart, periodEnd }` → `{ created: number, payouts: InstructorPayout[] }`
- `PATCH /payouts/:id/approve`
- `PATCH /payouts/:id/hold`
- `PATCH /payouts/:id/complete`

**Coupons**
- `GET /coupons?status&page&limit`
- `POST /coupons { code, type, value, maxUses?, minPurchaseAmount?, applicableCourseIds?, expiresAt? }`
- `PATCH /coupons/:id { type?, value?, maxUses?, minPurchaseAmount?, applicableCourseIds?, expiresAt? }`
- `PATCH /coupons/:id/disable`
- `DELETE /coupons/:id`

**Tax Rules**
- `GET /tax-rules` → `TaxRule[]` (no pagination — small collection by nature)
- `POST /tax-rules { name, region, country, rate, type }`
- `PATCH /tax-rules/:id { name?, region?, country?, rate?, type?, status? }`
- `DELETE /tax-rules/:id`

**Billing Settings**
- `GET /settings` → `FinanceSettings` (auto-creates the singleton row on first read)
- `PATCH /settings { currency?, paymentRetryRules?, refundPolicy?, autoBillingEnabled? }`

**Payment Gateways** — no endpoints in v1. Static UI only (Connect buttons disabled, "coming soon"). `gateway.connect/.configure/.testMode` stay dead, same status as `plan.create/.update`.

---

## Query keys / mutation map

Query keys (already in `queryKeys.ts`): `finance.dashboard`, `finance.settings`,
`plans` (dead), `subscriptions`, `invoices`, `payouts`, `coupons`, `taxConfig`,
`gateways` (dead).

Mutation IDs reused as-is + 7 new ones added this module — full list and
invalidation rows are in `IMPACT_MAP.md §5.7` / `§5.13` and
`src/lib/invalidation.ts`.
