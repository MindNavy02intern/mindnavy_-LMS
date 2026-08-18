const prisma = require("../config/prisma");
const { fireAutomationTrigger } = require("./automationTriggers.service");
const { sendMail } = require("../utils/mailer");
const settingsService = require("./settings.service");

// ── Finance service — Payments, Subscriptions, Invoices, Transactions,
// Refunds, Instructor Payouts, Coupons, Tax Rules, Billing Settings,
// dashboard stats + analytics.
//
// FK strategy: userId/courseId/instructorId/approvedById/processedById/
// createdById are PLAIN STRINGS (see finance.prisma header) — no Prisma
// relation(), so every list/detail read resolves names via a manual
// AppUser/Course lookup (resolveUsers/resolveCourses below), same pattern
// reports.service uses for AuditLog.adminId.
//
// Ownership rule (blueprint 09 §1 note + IMPACT_MAP §4a): Total Revenue and
// Active Subscriptions are owned by dashboard.stats/dashboard.revenue.
// getTotalRevenueValue()/getActiveSubscriptionsCountValue() below are the ONE
// computation both dashboard.service and this module's own getStats() call —
// never two divergent queries for the same number (R4).

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[finance.service] query failed:", err.message);
    return fallback;
  }
}

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }
function domainError(code) { return Object.assign(new Error(code), { code }); }
function round2(n) { return Math.round((n ?? 0) * 100) / 100; }

function metric(value, changePercent = null) { return { value, changePercent, available: true }; }
function simpleMetric(value) { return { value, available: true }; }

function calcChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

async function financeAuditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: adminId ?? null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

// ── Cross-entity name resolution (no relation() — see header) ────────────────

async function resolveUsers(ids) {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const rows = await safe(
    () => prisma.appUser.findMany({ where: { id: { in: uniq } }, select: { id: true, fullName: true, email: true } }),
    [],
  );
  return new Map(rows.map((r) => [r.id, r]));
}

async function resolveCourses(ids) {
  const uniq = [...new Set(ids.filter(Boolean))];
  if (uniq.length === 0) return new Map();
  const rows = await safe(
    () => prisma.course.findMany({ where: { id: { in: uniq } }, select: { id: true, title: true, category: true, instructorId: true } }),
    [],
  );
  return new Map(rows.map((r) => [r.id, r]));
}

// ── §Shared: Total Revenue / Active Subscriptions (single owner — R4) ────────

async function getTotalRevenueValue() {
  const agg = await safe(() => prisma.payment.aggregate({ where: { status: "SUCCESSFUL" }, _sum: { amount: true } }), { _sum: { amount: 0 } });
  return round2(agg._sum.amount ?? 0);
}

async function getActiveSubscriptionsCountValue() {
  return safe(() => prisma.subscription.count({ where: { status: "ACTIVE" } }), 0);
}

// ── Dashboard KPI stats — GET /finance/stats ──────────────────────────────────

async function getStats() {
  const now = new Date();
  const startOfThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  const [
    totalRevenueAgg, thisMonthAgg, lastMonthAgg,
    activeSubscriptions, pendingPayments, failedTransactions,
    refundRequests, pendingPayoutsAgg,
  ] = await safe(() => Promise.all([
    prisma.payment.aggregate({ where: { status: "SUCCESSFUL" }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "SUCCESSFUL", createdAt: { gte: startOfThisMonth } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "SUCCESSFUL", createdAt: { gte: startOfLastMonth, lt: startOfThisMonth } }, _sum: { amount: true } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.payment.count({ where: { status: "PENDING" } }),
    prisma.payment.count({ where: { status: "FAILED" } }),
    prisma.refund.count({ where: { status: "PENDING" } }),
    prisma.instructorPayout.aggregate({ where: { status: { in: ["PENDING", "APPROVED"] } }, _sum: { amount: true } }),
  ]), [
    { _sum: { amount: 0 } }, { _sum: { amount: 0 } }, { _sum: { amount: 0 } },
    0, 0, 0, 0, { _sum: { amount: 0 } },
  ]);

  const totalRevenue = round2(totalRevenueAgg._sum.amount ?? 0);
  const thisMonth     = round2(thisMonthAgg._sum.amount ?? 0);
  const lastMonth      = round2(lastMonthAgg._sum.amount ?? 0);
  const change          = calcChange(thisMonth, lastMonth);

  return {
    totalRevenue:        metric(totalRevenue, change),
    monthlyRevenue:      metric(thisMonth, change),
    activeSubscriptions: simpleMetric(activeSubscriptions),
    pendingPayments:     simpleMetric(pendingPayments),
    failedTransactions:  simpleMetric(failedTransactions),
    refundRequests:      simpleMetric(refundRequests),
    instructorPayouts:   simpleMetric(round2(pendingPayoutsAgg._sum.amount ?? 0)),
    revenueGrowth:       simpleMetric(change),
  };
}

// ── Payments ──────────────────────────────────────────────────────────────────

const PAYMENT_SELECT = {
  id: true, userId: true, courseId: true, amount: true, currency: true,
  status: true, method: true, stripePaymentIntentId: true, metadata: true,
  createdAt: true, updatedAt: true,
};

function mapPayment(p, userMap, courseMap) {
  const user   = userMap.get(p.userId);
  const course = p.courseId ? courseMap.get(p.courseId) : null;
  return {
    id: p.id,
    userId: p.userId, userName: user?.fullName ?? null, userEmail: user?.email ?? null,
    courseId: p.courseId, courseTitle: course?.title ?? null,
    amount: p.amount, currency: p.currency, status: p.status, method: p.method,
    stripePaymentIntentId: p.stripePaymentIntentId ?? null,
    createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt),
  };
}

function buildPaymentWhere({ status, method, dateFrom, dateTo }) {
  return {
    ...(status ? { status } : {}),
    ...(method ? { method } : {}),
    ...((dateFrom || dateTo) ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
  };
}

async function listPayments({ status, method, search, page, limit, offset, dateFrom, dateTo }) {
  let where = buildPaymentWhere({ status, method, dateFrom, dateTo });

  if (search) {
    const [users, courses] = await safe(() => Promise.all([
      prisma.appUser.findMany({ where: { OR: [{ fullName: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] }, select: { id: true } }),
      prisma.course.findMany({ where: { title: { contains: search, mode: "insensitive" } }, select: { id: true } }),
    ]), [[], []]);
    const userIds = users.map((u) => u.id);
    const courseIds = courses.map((c) => c.id);
    if (userIds.length === 0 && courseIds.length === 0) return { items: [], total: 0, page, limit };
    where = { ...where, OR: [...(userIds.length ? [{ userId: { in: userIds } }] : []), ...(courseIds.length ? [{ courseId: { in: courseIds } }] : [])] };
  }

  const [rows, total] = await safe(() => Promise.all([
    prisma.payment.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: offset, select: PAYMENT_SELECT }),
    prisma.payment.count({ where }),
  ]), [[], 0]);

  const userMap   = await resolveUsers(rows.map((r) => r.userId));
  const courseMap = await resolveCourses(rows.map((r) => r.courseId));
  return { items: rows.map((r) => mapPayment(r, userMap, courseMap)), total, page, limit };
}

async function getPayment(id) {
  const p = await prisma.payment.findUnique({ where: { id }, select: PAYMENT_SELECT });
  if (!p) throw domainError("PAYMENT_NOT_FOUND");
  const userMap   = await resolveUsers([p.userId]);
  const courseMap = await resolveCourses([p.courseId]);
  return mapPayment(p, userMap, courseMap);
}

// Creates a PENDING Refund request against a SUCCESSFUL payment — reviewed on
// the Refunds tab via approveRefund/rejectRefund below. No student-facing app
// exists in this system (same precedent as InstructorReview), so this admin
// action stands in for "student requests a refund" (blueprint 09 §6 workflow).
async function requestRefund(id, { amount, reason }, adminId) {
  const payment = await prisma.payment.findUnique({ where: { id }, select: { id: true, userId: true, amount: true, status: true } });
  if (!payment) throw domainError("PAYMENT_NOT_FOUND");
  if (payment.status !== "SUCCESSFUL") throw domainError("PAYMENT_NOT_REFUNDABLE");
  if (amount > payment.amount) throw domainError("REFUND_EXCEEDS_PAYMENT");

  const refund = await prisma.refund.create({ data: { paymentId: id, userId: payment.userId, amount, reason, status: "PENDING" } });
  await financeAuditLog(adminId, "PAYMENT_REFUND_REQUESTED", { paymentId: id, refundId: refund.id, amount });
  return mapRefund(refund, await resolveUsers([payment.userId]));
}

async function exportPaymentsCsv(filters) {
  const { items } = await listPayments({ ...filters, page: 1, limit: 5000, offset: 0 });
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = ["Transaction ID", "User", "Course", "Amount", "Currency", "Method", "Status", "Date"].join(",");
  const rows = items.map((p) => [p.id, p.userName ?? p.userId, p.courseTitle ?? "", p.amount, p.currency, p.method, p.status, p.createdAt].map(esc).join(","));
  return [header, ...rows].join("\n");
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

const SUBSCRIPTION_SELECT = {
  id: true, userId: true, planType: true, status: true, billingCycle: true,
  amount: true, currency: true, startDate: true, endDate: true, renewalDate: true,
  stripeSubscriptionId: true, createdAt: true, updatedAt: true,
};

function mapSubscription(s, userMap) {
  const user = userMap.get(s.userId);
  return {
    id: s.id, userId: s.userId, userName: user?.fullName ?? null, userEmail: user?.email ?? null,
    planType: s.planType, status: s.status, billingCycle: s.billingCycle,
    amount: s.amount, currency: s.currency,
    startDate: iso(s.startDate), endDate: iso(s.endDate), renewalDate: iso(s.renewalDate),
    createdAt: iso(s.createdAt), updatedAt: iso(s.updatedAt),
  };
}

async function listSubscriptions({ status, planType, page, limit, offset }) {
  const where = { ...(status ? { status } : {}), ...(planType ? { planType } : {}) };
  const [rows, total] = await safe(() => Promise.all([
    prisma.subscription.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: offset, select: SUBSCRIPTION_SELECT }),
    prisma.subscription.count({ where }),
  ]), [[], 0]);
  const userMap = await resolveUsers(rows.map((r) => r.userId));
  return { items: rows.map((r) => mapSubscription(r, userMap)), total, page, limit };
}

async function getSubscriptionOrThrow(id) {
  const s = await prisma.subscription.findUnique({ where: { id }, select: SUBSCRIPTION_SELECT });
  if (!s) throw domainError("SUBSCRIPTION_NOT_FOUND");
  return s;
}

async function createSubscription(data, adminId) {
  const user = await prisma.appUser.findUnique({ where: { id: data.userId }, select: { id: true } });
  if (!user) throw domainError("USER_NOT_FOUND");

  const sub = await prisma.subscription.create({
    data: {
      userId: data.userId, planType: data.planType, billingCycle: data.billingCycle,
      amount: data.amount, currency: data.currency,
      startDate: data.startDate ?? new Date(), endDate: data.endDate ?? null, renewalDate: data.renewalDate ?? null,
    },
    select: SUBSCRIPTION_SELECT,
  });
  await financeAuditLog(adminId, "SUBSCRIPTION_CREATED", { subscriptionId: sub.id, userId: data.userId });
  return mapSubscription(sub, await resolveUsers([data.userId]));
}

async function updateSubscription(id, data, adminId) {
  const current = await getSubscriptionOrThrow(id);
  const sub = await prisma.subscription.update({ where: { id }, data, select: SUBSCRIPTION_SELECT });
  await financeAuditLog(adminId, "SUBSCRIPTION_UPDATED", { subscriptionId: id, fields: Object.keys(data) });
  return mapSubscription(sub, await resolveUsers([current.userId]));
}

async function cancelSubscription(id, adminId) {
  const current = await getSubscriptionOrThrow(id);
  if (current.status === "CANCELLED") throw domainError("SUBSCRIPTION_ALREADY_CANCELLED");
  const sub = await prisma.subscription.update({
    where: { id },
    data: { status: "CANCELLED", endDate: current.endDate ?? new Date() },
    select: SUBSCRIPTION_SELECT,
  });
  await financeAuditLog(adminId, "SUBSCRIPTION_CANCELLED", { subscriptionId: id });
  return mapSubscription(sub, await resolveUsers([current.userId]));
}

async function extendSubscription(id, { renewalDate }, adminId) {
  const current = await getSubscriptionOrThrow(id);
  if (current.status === "CANCELLED") throw domainError("SUBSCRIPTION_CANCELLED_CANNOT_EXTEND");
  const sub = await prisma.subscription.update({
    where: { id },
    data: {
      renewalDate,
      ...(current.endDate && current.endDate < renewalDate ? { endDate: renewalDate } : {}),
      ...(current.status === "EXPIRED" ? { status: "ACTIVE" } : {}),
    },
    select: SUBSCRIPTION_SELECT,
  });
  await financeAuditLog(adminId, "SUBSCRIPTION_EXTENDED", { subscriptionId: id, renewalDate: iso(renewalDate) });
  return mapSubscription(sub, await resolveUsers([current.userId]));
}

// Background sweep (server.js setInterval, same convention as
// sendDueAnnouncements/scheduledReports) — nothing else in this codebase ever
// flips a Subscription to EXPIRED (confirmed: extendSubscription only ever
// resurrects FROM it). Flips ACTIVE subscriptions whose endDate has passed,
// fires SUBSCRIPTION_EXPIRY per affected user. adminId null (system-authored),
// same precedent as ScheduledReport's RUN audit rows.
async function checkExpiringSubscriptions() {
  const expired = await safe(() => prisma.subscription.findMany({
    where: { status: "ACTIVE", endDate: { not: null, lte: new Date() } },
    select: { id: true, userId: true, planType: true },
  }), []);

  for (const sub of expired) {
    try {
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "EXPIRED" } });
      await financeAuditLog(null, "SUBSCRIPTION_EXPIRED", { subscriptionId: sub.id, userId: sub.userId });
      await fireAutomationTrigger("SUBSCRIPTION_EXPIRY", sub.userId, { planType: sub.planType });
    } catch (err) {
      console.error(`[finance.service] subscription expiry failed for ${sub.id}:`, err.message);
    }
  }
  return { expired: expired.length };
}

// ── Invoices ──────────────────────────────────────────────────────────────────

const INVOICE_SELECT = {
  id: true, userId: true, invoiceNumber: true, items: true, subtotal: true,
  taxAmount: true, total: true, status: true, dueDate: true, paidAt: true,
  createdAt: true, updatedAt: true,
};

function mapInvoice(inv, userMap) {
  const user = userMap.get(inv.userId);
  return {
    id: inv.id, userId: inv.userId, userName: user?.fullName ?? null, userEmail: user?.email ?? null,
    invoiceNumber: inv.invoiceNumber, items: inv.items,
    subtotal: inv.subtotal, taxAmount: inv.taxAmount, total: inv.total,
    status: inv.status, dueDate: iso(inv.dueDate), paidAt: iso(inv.paidAt),
    createdAt: iso(inv.createdAt), updatedAt: iso(inv.updatedAt),
  };
}

async function nextInvoiceNumber() {
  const count = await prisma.invoice.count();
  return `INV-${String(count + 1).padStart(4, "0")}`;
}

async function listInvoices({ status, page, limit, offset }) {
  const where = status ? { status } : {};
  const [rows, total] = await safe(() => Promise.all([
    prisma.invoice.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: offset, select: INVOICE_SELECT }),
    prisma.invoice.count({ where }),
  ]), [[], 0]);
  const userMap = await resolveUsers(rows.map((r) => r.userId));
  return { items: rows.map((r) => mapInvoice(r, userMap)), total, page, limit };
}

async function getInvoiceOrThrow(id) {
  const inv = await prisma.invoice.findUnique({ where: { id }, select: INVOICE_SELECT });
  if (!inv) throw domainError("INVOICE_NOT_FOUND");
  return inv;
}

async function getInvoice(id) {
  const inv = await getInvoiceOrThrow(id);
  return mapInvoice(inv, await resolveUsers([inv.userId]));
}

async function createInvoice({ userId, items, taxAmount, dueDate }, adminId) {
  const user = await prisma.appUser.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw domainError("USER_NOT_FOUND");

  const subtotal = round2(items.reduce((sum, i) => sum + i.total, 0));
  const total     = round2(subtotal + (taxAmount ?? 0));

  for (let attempt = 0; attempt < 3; attempt++) {
    const invoiceNumber = await nextInvoiceNumber();
    try {
      const inv = await prisma.invoice.create({
        data: { userId, invoiceNumber, items, subtotal, taxAmount: taxAmount ?? 0, total, dueDate: dueDate ?? null, status: "DRAFT" },
        select: INVOICE_SELECT,
      });
      await financeAuditLog(adminId, "INVOICE_GENERATED", { invoiceId: inv.id, invoiceNumber, total });
      return mapInvoice(inv, await resolveUsers([userId]));
    } catch (err) {
      if (err.code === "P2002" && attempt < 2) continue;
      throw err;
    }
  }
}

async function updateInvoice(id, data, adminId) {
  const current = await getInvoiceOrThrow(id);
  if (current.status === "VOID") throw domainError("INVOICE_VOID_IMMUTABLE");

  const patch = { ...data };
  if (patch.items) {
    patch.subtotal = round2(patch.items.reduce((sum, i) => sum + i.total, 0));
    patch.total     = round2(patch.subtotal + (patch.taxAmount ?? current.taxAmount));
  } else if (patch.taxAmount !== undefined) {
    patch.total = round2(current.subtotal + patch.taxAmount);
  }
  if (patch.status === "PAID" && !current.paidAt) patch.paidAt = new Date();

  const inv = await prisma.invoice.update({ where: { id }, data: patch, select: INVOICE_SELECT });
  await financeAuditLog(adminId, "INVOICE_UPDATED", { invoiceId: id, fields: Object.keys(data) });
  return mapInvoice(inv, await resolveUsers([current.userId]));
}

async function voidInvoice(id, adminId) {
  const current = await getInvoiceOrThrow(id);
  if (current.status === "VOID") throw domainError("INVOICE_ALREADY_VOID");
  const inv = await prisma.invoice.update({ where: { id }, data: { status: "VOID" }, select: INVOICE_SELECT });
  await financeAuditLog(adminId, "INVOICE_VOIDED", { invoiceId: id });
  return mapInvoice(inv, await resolveUsers([current.userId]));
}

function formatMoney(n) { return `$${round2(n ?? 0).toFixed(2)}`; }

// Best-effort — never blocks the DRAFT→SENT status flip on a mail failure.
async function sendInvoiceEmail(inv, userId) {
  try {
    const user = await prisma.appUser.findUnique({ where: { id: userId }, select: { email: true, fullName: true } });
    if (!user?.email) return;

    const dueText = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "on receipt";
    const items = Array.isArray(inv.items) ? inv.items : [];
    const itemsText = items.map((i) => `- ${i.name} x${i.qty} — ${formatMoney(i.total)}`).join("\n");
    const itemsHtml = items.map((i) => `<tr><td style="padding:4px 8px;">${i.name}</td><td style="padding:4px 8px;text-align:center;">${i.qty}</td><td style="padding:4px 8px;text-align:right;">${formatMoney(i.total)}</td></tr>`).join("");

    const text = `Invoice ${inv.invoiceNumber}\n\nBill to: ${user.fullName}\nTotal: ${formatMoney(inv.total)}\nDue: ${dueText}\n\nItems:\n${itemsText}\n\nSubtotal: ${formatMoney(inv.subtotal)}\nTax: ${formatMoney(inv.taxAmount)}\nTotal: ${formatMoney(inv.total)}`;
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <h2 style="color:#1e3a5f;margin:0 0 4px;">Invoice ${inv.invoiceNumber}</h2>
        <p style="color:#666;font-size:13px;margin:0 0 16px;">Due ${dueText}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="border-bottom:1px solid #ddd;"><th style="text-align:left;padding:4px 8px;">Item</th><th style="padding:4px 8px;">Qty</th><th style="text-align:right;padding:4px 8px;">Total</th></tr></thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <p style="text-align:right;font-size:14px;margin-top:12px;">Subtotal: ${formatMoney(inv.subtotal)}<br/>Tax: ${formatMoney(inv.taxAmount)}<br/><strong>Total: ${formatMoney(inv.total)}</strong></p>
      </div>`;

    await sendMail({ to: user.email, subject: `Invoice ${inv.invoiceNumber}`, text, html });
  } catch (err) {
    console.error("[finance.service] sendInvoiceEmail failed:", err.message);
  }
}

async function sendInvoice(id, adminId) {
  const current = await getInvoiceOrThrow(id);
  if (current.status === "VOID") throw domainError("INVOICE_VOID_IMMUTABLE");
  const wasDraft = current.status === "DRAFT";
  const inv = await prisma.invoice.update({
    where: { id },
    data: { status: wasDraft ? "SENT" : current.status },
    select: INVOICE_SELECT,
  });
  await financeAuditLog(adminId, "INVOICE_SENT", { invoiceId: id });

  if (wasDraft) await sendInvoiceEmail(current, current.userId);

  return mapInvoice(inv, await resolveUsers([current.userId]));
}

// Real invoice data for PDF rendering — same mapInvoice() shape every other
// invoice read uses (userName/userEmail already resolved), plus the
// company name the controller pulls from SystemSettings.
async function getInvoiceForPdf(id) {
  const inv = await getInvoiceOrThrow(id);
  return mapInvoice(inv, await resolveUsers([inv.userId]));
}

// ── Transactions (read-only ledger) ───────────────────────────────────────────

async function listTransactions({ type, page, limit, offset, dateFrom, dateTo }) {
  const where = {
    ...(type ? { type } : {}),
    ...((dateFrom || dateTo) ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
  };
  const [rows, total] = await safe(() => Promise.all([
    prisma.transaction.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: offset }),
    prisma.transaction.count({ where }),
  ]), [[], 0]);

  const paymentMap = await safe(async () => {
    const ids = [...new Set(rows.map((r) => r.paymentId).filter(Boolean))];
    if (ids.length === 0) return new Map();
    const payments = await prisma.payment.findMany({ where: { id: { in: ids } }, select: { id: true, userId: true, amount: true, currency: true } });
    return new Map(payments.map((p) => [p.id, p]));
  }, new Map());

  const items = rows.map((t) => ({
    id: t.id, paymentId: t.paymentId, type: t.type, amount: t.amount, currency: t.currency,
    gatewayResponse: t.gatewayResponse, createdAt: iso(t.createdAt),
    relatedPaymentAmount: paymentMap.get(t.paymentId)?.amount ?? null,
  }));
  return { items, total, page, limit };
}

// ── Refunds ───────────────────────────────────────────────────────────────────

function mapRefund(r, userMap) {
  const user = userMap.get(r.userId);
  return {
    id: r.id, paymentId: r.paymentId, userId: r.userId, userName: user?.fullName ?? null,
    amount: r.amount, reason: r.reason, status: r.status,
    requestedAt: iso(r.requestedAt), processedAt: iso(r.processedAt), processedById: r.processedById ?? null,
  };
}

async function listRefunds({ status, page, limit, offset }) {
  const where = status ? { status } : {};
  const [rows, total] = await safe(() => Promise.all([
    prisma.refund.findMany({ where, orderBy: { requestedAt: "desc" }, take: limit, skip: offset }),
    prisma.refund.count({ where }),
  ]), [[], 0]);
  const userMap = await resolveUsers(rows.map((r) => r.userId));
  const paymentMap = await safe(async () => {
    const ids = [...new Set(rows.map((r) => r.paymentId))];
    if (ids.length === 0) return new Map();
    const payments = await prisma.payment.findMany({ where: { id: { in: ids } }, select: { id: true, courseId: true } });
    return new Map(payments.map((p) => [p.id, p]));
  }, new Map());
  const courseMap = await resolveCourses(rows.map((r) => paymentMap.get(r.paymentId)?.courseId));

  const items = rows.map((r) => ({ ...mapRefund(r, userMap), courseTitle: courseMap.get(paymentMap.get(r.paymentId)?.courseId)?.title ?? null }));
  return { items, total, page, limit };
}

async function approveRefund(id, adminId) {
  const refund = await prisma.refund.findUnique({ where: { id } });
  if (!refund) throw domainError("REFUND_NOT_FOUND");
  if (refund.status !== "PENDING") throw domainError("REFUND_NOT_PENDING");

  const payment = await prisma.payment.findUnique({ where: { id: refund.paymentId } });
  if (!payment) throw domainError("PAYMENT_NOT_FOUND");

  const [updatedRefund] = await prisma.$transaction([
    prisma.refund.update({ where: { id }, data: { status: "PROCESSED", processedAt: new Date(), processedById: adminId ?? null } }),
    prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } }),
    prisma.transaction.create({ data: { paymentId: payment.id, type: "REFUND", amount: refund.amount, currency: payment.currency } }),
  ]);

  await financeAuditLog(adminId, "REFUND_APPROVED", { refundId: id, paymentId: payment.id, amount: refund.amount });
  return mapRefund(updatedRefund, await resolveUsers([refund.userId]));
}

async function rejectRefund(id, { reason }, adminId) {
  const refund = await prisma.refund.findUnique({ where: { id } });
  if (!refund) throw domainError("REFUND_NOT_FOUND");
  if (refund.status !== "PENDING") throw domainError("REFUND_NOT_PENDING");

  // No rejectionReason column (Refund model, finance.prisma) — same "the audit
  // trail is the second writer of why" precedent as Certificate.revoke.
  const updated = await prisma.refund.update({ where: { id }, data: { status: "REJECTED", processedAt: new Date(), processedById: adminId ?? null } });
  await financeAuditLog(adminId, "REFUND_REJECTED", { refundId: id, reason });
  return mapRefund(updated, await resolveUsers([refund.userId]));
}

// ── Instructor Payouts ────────────────────────────────────────────────────────

function mapPayout(p, userMap) {
  const user = userMap.get(p.instructorId);
  return {
    id: p.id, instructorId: p.instructorId, instructorName: user?.fullName ?? null,
    amount: p.amount, currency: p.currency, status: p.status, revenueShareBps: p.revenueShareBps,
    periodStart: iso(p.periodStart), periodEnd: iso(p.periodEnd),
    approvedById: p.approvedById ?? null, approvedAt: iso(p.approvedAt), completedAt: iso(p.completedAt),
    createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt),
  };
}

async function listPayouts({ status, page, limit, offset }) {
  const where = status ? { status } : {};
  const [rows, total] = await safe(() => Promise.all([
    prisma.instructorPayout.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: offset }),
    prisma.instructorPayout.count({ where }),
  ]), [[], 0]);
  const userMap = await resolveUsers(rows.map((r) => r.instructorId));
  return { items: rows.map((r) => mapPayout(r, userMap)), total, page, limit };
}

// Gross revenue per instructor (sum of SUCCESSFUL payments on courses they
// teach, within the period) × their InstructorProfile.revenueShareBps
// (snapshotted onto the row). Skips instructors with zero gross or an
// existing payout for the exact period — idempotent, no duplicate rows.
async function calculatePayouts({ periodStart, periodEnd }, adminId) {
  const instructors = await safe(
    () => prisma.instructorProfile.findMany({ where: { revenueShareBps: { not: null } }, select: { userId: true, revenueShareBps: true } }),
    [],
  );

  const created = [];
  for (const inst of instructors) {
    const courses = await prisma.course.findMany({ where: { instructorId: inst.userId }, select: { id: true } });
    const courseIds = courses.map((c) => c.id);
    if (courseIds.length === 0) continue;

    const agg = await prisma.payment.aggregate({
      where: { courseId: { in: courseIds }, status: "SUCCESSFUL", createdAt: { gte: periodStart, lte: periodEnd } },
      _sum: { amount: true },
    });
    const gross = agg._sum.amount ?? 0;
    if (gross <= 0) continue;

    const amount = round2(gross * (inst.revenueShareBps / 10000));
    if (amount <= 0) continue;

    const existing = await prisma.instructorPayout.findFirst({ where: { instructorId: inst.userId, periodStart, periodEnd } });
    if (existing) continue;

    const payout = await prisma.instructorPayout.create({
      data: { instructorId: inst.userId, amount, currency: "USD", status: "PENDING", revenueShareBps: inst.revenueShareBps, periodStart, periodEnd },
    });
    created.push(payout);
  }

  await financeAuditLog(adminId, "PAYOUT_CALCULATED", { count: created.length, periodStart: iso(periodStart), periodEnd: iso(periodEnd) });
  const userMap = await resolveUsers(created.map((p) => p.instructorId));
  return { created: created.length, payouts: created.map((p) => mapPayout(p, userMap)) };
}

async function getPayoutOrThrow(id) {
  const p = await prisma.instructorPayout.findUnique({ where: { id } });
  if (!p) throw domainError("PAYOUT_NOT_FOUND");
  return p;
}

async function approvePayout(id, adminId) {
  const current = await getPayoutOrThrow(id);
  if (current.status !== "PENDING") throw domainError("PAYOUT_INVALID_STATUS");
  const p = await prisma.instructorPayout.update({ where: { id }, data: { status: "APPROVED", approvedById: adminId ?? null, approvedAt: new Date() } });
  await financeAuditLog(adminId, "PAYOUT_APPROVED", { payoutId: id, instructorId: current.instructorId, amount: current.amount });
  return mapPayout(p, await resolveUsers([current.instructorId]));
}

async function holdPayout(id, adminId) {
  const current = await getPayoutOrThrow(id);
  if (current.status === "COMPLETED") throw domainError("PAYOUT_INVALID_STATUS");
  const p = await prisma.instructorPayout.update({ where: { id }, data: { status: "HELD" } });
  await financeAuditLog(adminId, "PAYOUT_HELD", { payoutId: id, instructorId: current.instructorId });
  return mapPayout(p, await resolveUsers([current.instructorId]));
}

async function completePayout(id, adminId) {
  const current = await getPayoutOrThrow(id);
  if (current.status !== "APPROVED") throw domainError("PAYOUT_INVALID_STATUS");
  const [p] = await prisma.$transaction([
    prisma.instructorPayout.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date() } }),
    prisma.transaction.create({ data: { paymentId: id, type: "PAYOUT", amount: current.amount, currency: current.currency } }),
  ]);
  await financeAuditLog(adminId, "PAYOUT_COMPLETED", { payoutId: id, instructorId: current.instructorId, amount: current.amount });
  return mapPayout(p, await resolveUsers([current.instructorId]));
}

// ── Coupons ───────────────────────────────────────────────────────────────────

function mapCoupon(c) {
  return {
    id: c.id, code: c.code, type: c.type, value: c.value,
    maxUses: c.maxUses, usedCount: c.usedCount, minPurchaseAmount: c.minPurchaseAmount,
    applicableCourseIds: c.applicableCourseIds, expiresAt: iso(c.expiresAt), status: c.status,
    createdById: c.createdById, createdAt: iso(c.createdAt), updatedAt: iso(c.updatedAt),
  };
}

async function listCoupons({ status, page, limit, offset }) {
  const where = status ? { status } : {};
  const [rows, total] = await safe(() => Promise.all([
    prisma.coupon.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: offset }),
    prisma.coupon.count({ where }),
  ]), [[], 0]);
  return { items: rows.map(mapCoupon), total, page, limit };
}

async function createCoupon(data, adminId) {
  try {
    const c = await prisma.coupon.create({ data: { ...data, createdById: adminId ?? "" } });
    await financeAuditLog(adminId, "COUPON_CREATED", { couponId: c.id, code: c.code });
    return mapCoupon(c);
  } catch (err) {
    if (err.code === "P2002") throw domainError("COUPON_CODE_EXISTS");
    throw err;
  }
}

async function getCouponOrThrow(id) {
  const c = await prisma.coupon.findUnique({ where: { id } });
  if (!c) throw domainError("COUPON_NOT_FOUND");
  return c;
}

async function updateCoupon(id, data, adminId) {
  await getCouponOrThrow(id);
  const c = await prisma.coupon.update({ where: { id }, data });
  await financeAuditLog(adminId, "COUPON_UPDATED", { couponId: id, fields: Object.keys(data) });
  return mapCoupon(c);
}

async function disableCoupon(id, adminId) {
  await getCouponOrThrow(id);
  const c = await prisma.coupon.update({ where: { id }, data: { status: "DISABLED" } });
  await financeAuditLog(adminId, "COUPON_DISABLED", { couponId: id });
  return mapCoupon(c);
}

async function deleteCoupon(id, adminId) {
  await getCouponOrThrow(id);
  await prisma.coupon.delete({ where: { id } });
  await financeAuditLog(adminId, "COUPON_DELETED", { couponId: id });
  return { id };
}

// ── Tax Rules ─────────────────────────────────────────────────────────────────

function mapTaxRule(t) {
  return { id: t.id, name: t.name, region: t.region, country: t.country, rate: t.rate, type: t.type, status: t.status, createdAt: iso(t.createdAt), updatedAt: iso(t.updatedAt) };
}

async function listTaxRules() {
  const rows = await safe(() => prisma.taxRule.findMany({ orderBy: { createdAt: "desc" } }), []);
  return rows.map(mapTaxRule);
}

async function createTaxRule(data, adminId) {
  const t = await prisma.taxRule.create({ data });
  await financeAuditLog(adminId, "TAX_RULE_CREATED", { taxRuleId: t.id, name: t.name });
  return mapTaxRule(t);
}

async function getTaxRuleOrThrow(id) {
  const t = await prisma.taxRule.findUnique({ where: { id } });
  if (!t) throw domainError("TAX_RULE_NOT_FOUND");
  return t;
}

async function updateTaxRule(id, data, adminId) {
  await getTaxRuleOrThrow(id);
  const t = await prisma.taxRule.update({ where: { id }, data });
  await financeAuditLog(adminId, "TAX_RULE_UPDATED", { taxRuleId: id, fields: Object.keys(data) });
  return mapTaxRule(t);
}

async function deleteTaxRule(id, adminId) {
  await getTaxRuleOrThrow(id);
  await prisma.taxRule.delete({ where: { id } });
  await financeAuditLog(adminId, "TAX_RULE_DELETED", { taxRuleId: id });
  return { id };
}

// ── Billing Settings (singleton — same pattern as CompetencySettings) ────────

function mapSettings(s) {
  return {
    id: s.id, currency: s.currency, paymentRetryRules: s.paymentRetryRules,
    refundPolicy: s.refundPolicy, autoBillingEnabled: s.autoBillingEnabled,
    updatedById: s.updatedById ?? null, updatedAt: iso(s.updatedAt),
  };
}

async function getOrCreateSettings() {
  const existing = await safe(() => prisma.financeSettings.findFirst(), null);
  if (existing) return existing;
  return prisma.financeSettings.create({ data: {} });
}

async function getSettings() {
  return mapSettings(await getOrCreateSettings());
}

async function updateSettings(data, adminId) {
  const current = await getOrCreateSettings();
  const s = await prisma.financeSettings.update({ where: { id: current.id }, data: { ...data, updatedById: adminId ?? null } });
  await financeAuditLog(adminId, "FINANCE_SETTINGS_UPDATED", { fields: Object.keys(data) });
  return mapSettings(s);
}

// ── Analytics ─────────────────────────────────────────────────────────────────

function periodConfig(period) {
  switch (period) {
    case "daily":     return { spanDays: 30,      bucket: "day" };
    case "weekly":    return { spanDays: 12 * 7,  bucket: "week" };
    case "quarterly": return { spanDays: 8 * 91,  bucket: "quarter" };
    case "monthly":
    default:          return { spanDays: 12 * 30, bucket: "month" };
  }
}

function bucketKey(date, bucket) {
  const d = new Date(date);
  if (bucket === "day") return d.toISOString().slice(0, 10);
  if (bucket === "quarter") return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
  if (bucket === "week") {
    const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d - jan1) / 86400000 + jan1.getUTCDay() + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function getTrend(model, whereExtra, amountField, period) {
  const { spanDays, bucket } = periodConfig(period);
  const start = new Date(Date.now() - spanDays * 86400000);
  const rows = await safe(
    () => prisma[model].findMany({ where: { ...whereExtra, createdAt: { gte: start } }, select: { [amountField]: true, createdAt: true } }),
    [],
  );

  // Seed every bucket in range at 0 so empty periods render a flat truthful
  // line instead of gaps (v1 payments table is empty — this is the norm).
  const buckets = new Map();
  const step = bucket === "day" ? 1 : bucket === "week" ? 7 : bucket === "quarter" ? 91 : 30;
  for (let t = start.getTime(); t <= Date.now(); t += step * 86400000) buckets.set(bucketKey(new Date(t), bucket), 0);

  for (const r of rows) {
    const key = bucketKey(r.createdAt, bucket);
    if (!buckets.has(key)) buckets.set(key, 0);
    buckets.set(key, buckets.get(key) + r[amountField]);
  }

  const labels = [...buckets.keys()];
  const values = [...buckets.values()].map(round2);
  return { available: true, labels, values };
}

async function getRevenueByCategory() {
  const rows = await safe(
    () => prisma.payment.findMany({ where: { status: "SUCCESSFUL", courseId: { not: null } }, select: { amount: true, courseId: true } }),
    [],
  );
  if (rows.length === 0) return { available: true, items: [] };
  const courseMap = await resolveCourses(rows.map((r) => r.courseId));
  const byCat = new Map();
  for (const r of rows) {
    const cat = courseMap.get(r.courseId)?.category ?? "Uncategorized";
    byCat.set(cat, (byCat.get(cat) ?? 0) + r.amount);
  }
  return { available: true, items: [...byCat.entries()].map(([name, value]) => ({ name, value: round2(value) })) };
}

async function getSubscriptionBreakdown() {
  const rows = await safe(
    () => prisma.subscription.groupBy({ by: ["planType"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    [],
  );
  return { available: true, items: rows.map((r) => ({ name: r.planType, value: r._count._all })) };
}

async function getTopCoursesByRevenue() {
  const rows = await safe(
    () => prisma.payment.findMany({ where: { status: "SUCCESSFUL", courseId: { not: null } }, select: { amount: true, courseId: true } }),
    [],
  );
  if (rows.length === 0) return { available: true, items: [] };
  const courseMap = await resolveCourses(rows.map((r) => r.courseId));
  const byCourse = new Map();
  for (const r of rows) byCourse.set(r.courseId, (byCourse.get(r.courseId) ?? 0) + r.amount);
  const items = [...byCourse.entries()]
    .map(([courseId, value]) => ({ courseId, title: courseMap.get(courseId)?.title ?? null, value: round2(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  return { available: true, items };
}

async function getPayoutSummary() {
  const rows = await safe(
    () => prisma.instructorPayout.groupBy({ by: ["status"], _sum: { amount: true }, _count: { _all: true } }),
    [],
  );
  return { available: true, items: rows.map((r) => ({ status: r.status, count: r._count._all, amount: round2(r._sum.amount ?? 0) })) };
}

async function getAnalytics({ period }) {
  const [revenueTrend, revenueByCategory, subscriptionBreakdown, refundTrend, topCoursesByRevenue, payoutSummary] = await Promise.all([
    getTrend("payment", { status: "SUCCESSFUL" }, "amount", period),
    getRevenueByCategory(),
    getSubscriptionBreakdown(),
    getTrend("refund", { status: "PROCESSED" }, "amount", period),
    getTopCoursesByRevenue(),
    getPayoutSummary(),
  ]);
  return { revenueTrend, revenueByCategory, subscriptionBreakdown, refundTrend, topCoursesByRevenue, payoutSummary };
}

module.exports = {
  getTotalRevenueValue,
  getActiveSubscriptionsCountValue,
  getStats,
  listPayments, getPayment, requestRefund, exportPaymentsCsv,
  listSubscriptions, createSubscription, updateSubscription, cancelSubscription, extendSubscription, checkExpiringSubscriptions,
  listInvoices, getInvoice, createInvoice, updateInvoice, voidInvoice, sendInvoice, getInvoiceForPdf,
  listTransactions,
  listRefunds, approveRefund, rejectRefund,
  listPayouts, calculatePayouts, approvePayout, holdPayout, completePayout,
  listCoupons, createCoupon, updateCoupon, disableCoupon, deleteCoupon,
  listTaxRules, createTaxRule, updateTaxRule, deleteTaxRule,
  getSettings, updateSettings,
  getAnalytics,
};
