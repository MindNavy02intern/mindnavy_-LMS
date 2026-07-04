# 09 · Finance — `/finance`
Doc: Finance §1–§13 · Entity: FINANCE (IMPACT §5.7 + §5.13 extension) · Status: `[planned]`

## Module sections
Financial Dashboard · Payments · Subscriptions · Invoices · Transactions · Refund Management · Instructor Payouts · Revenue Analytics · Coupons & Discounts · Tax Management · Billing Settings · Payment Gateways · Financial Reports

## Tab: Financial Dashboard (`?tab=dashboard`) — `['finance','dashboard']` (doc §1)
Widgets: total revenue, monthly revenue, daily revenue, active subscriptions, pending payments, failed transactions, refund requests, instructor payouts, tax summary, revenue growth.
**Ownership note:** "Total Revenue" and "Active Subscriptions" already have an owner (`['dashboard','stats']` / `['dashboard','revenue']`, IMPACT §4a). This dashboard consumes the same endpoint fields — Hassan must NOT create parallel computations (B2/R4).
Controls: date range, filter by course→`['courses']`/instructor→`['instructors']`, export, open reports (read).

## Tab: Payments (`?tab=payments`) — `['transactions', filters]` (doc §2)
**Columns:** Transaction ID · Student · Course/Subscription · Amount · Method · Status (Successful/Pending/Failed/Refunded/Cancelled) · Date · Billing country.
| Action | Kind | Mutation ID | Impact |
|---|---|---|---|
| View transaction | read | — | — |
| Retry payment | mut | `payment.retry` | local: `['transactions',…]` + `['finance','dashboard']` |
| Approve payment | mut | `payment.approve` | → IMPACT §5.7 purchase row |
| Refund payment | dlg→mut | `refund.approve` | → §5.7 |
| Download invoice / export records | read | — | — |

## Tab: Subscriptions (`?tab=subscriptions`) — `['subscriptions', filters]` + `['plans']` (doc §3)
Plans: Monthly, Annual, Enterprise, Team, Custom. Data: subscriber, plan type, billing cycle, start, renewal, payment status, subscription status.
| Action | Mutation ID | Impact |
|---|---|---|
| Create plan / Edit plan | `plan.create` / `plan.update` | → §5.13 (plan dropdowns everywhere, R2) |
| Cancel subscription | `subscription.cancel` | → §5.7 |
| Extend subscription | `subscription.extend` | → §5.7 |
| Upgrade plan | `subscription.upgrade` | → §5.7 |
| Apply discount | `subscription.applyDiscount` | local + `['dashboard','revenue']` |

## Tab: Invoices (`?tab=invoices`) — `['invoices', filters]` (doc §4)
Data: number, customer, items, tax info, total, payment status, date.
Actions: Generate→`invoice.generate` (→ §5.13) · Send→`invoice.send` (local + notification) · Edit→`invoice.update` (local) · Void→`invoice.void` (→ §5.13) · Download PDF / export (read).

## Tab: Transactions (`?tab=transactions`) — `['transactions', filters]` (doc §5)
Read-only ledger: payments, refunds, transfers, payouts, subscription charges, failed, tax deductions. Log detail: timestamp, user, gateway response, provider, status.

## Tab: Refund Management (`?tab=refunds`) — `['approvals',{type:'refund'}]` (doc §6)
Request data: student, course, purchase date, reason, amount, status.
Workflow: student requests→`refund.request` (student side → §5.7) → ticket → admin review → **Approve→`refund.approve` / Reject→`refund.reject`** (→ §5.7; gateway processes; student notified).

## Tab: Instructor Payouts (`?tab=payouts`) — `['payouts', filters]` (doc §7)
Data: instructor revenue, commission %, pending, completed, refund adjustments, tax deductions.
Actions: Approve→`payout.approve` (→ §5.7) · Hold→`payout.hold` (local) · Modify commission rules→`commission.update` (local + revenue) · Generate statement / export (read). Same IDs as file 05 earnings tab.

## Tab: Revenue Analytics (`?tab=analytics`) — `['dashboard','revenue']` (doc §8)
Read-only: growth, best sellers, subscription revenue, refund trends, instructor revenue, monthly profit, by category, forecasts `[phase-later]`. Views: daily→annual.

## Tab: Coupons & Discounts (`?tab=coupons`) — `['coupons']` (doc §9)
Types: percentage, fixed, course-specific→`['courses']`, subscription, referral. Settings: expiration, usage limit, user restrictions, min purchase, applicable courses.
Actions: Create→`coupon.create` (→ §5.13) · Edit→`coupon.update` · Disable→`coupon.disable` (both local) · Track usage / export (read).

## Tab: Tax Management (`?tab=tax`) — `['tax','config']` (doc §10)
Settings: VAT, regional taxes, country rules, exemptions, digital product taxes, business tax IDs.
Actions: Configure rules→`tax.configure` (→ §5.13; affects future invoices/checkout totals) · Reports/export/compliance (read).

## Tab: Billing Settings (`?tab=settings`) — `['finance','settings']` (doc §11)
Currency, billing cycles, payment retry rules, invoice templates, auto billing, renewal rules, refund policies → `billingSettings.update` (→ §5.13; currency change reflects across ALL money displays — flag wide refetch).

## Tab: Payment Gateways (`?tab=gateways`) — `['gateways']` (doc §12)
Supported: Stripe, PayPal, Razorpay, Apple Pay, Google Pay, bank transfer, enterprise APIs.
Actions: Connect→`gateway.connect` · Configure API keys→`gateway.configure` · Enable sandbox→`gateway.testMode` · Test transaction (read) · Monitor status (read). All local: `['gateways']` + `['integrations']` (file 11 shows same status — single source: this key).

## Tab: Financial Reports (`?tab=reports`) (doc §13)
Revenue, tax, subscription, refund, payout, sales, invoice reports. Export PDF/Excel/CSV + `reportSchedule.create` (file 08 ID). Read-only.

## `[phase-later]`: AI forecasting, fraud detection, multi-currency, churn analysis, billing automation.
