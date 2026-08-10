const svc = require("../services/finance.service");
const v = require("../validators/finance.validator");

// ── Helpers (mirrors certificates.controller) ─────────────────────────────────

function badRequest(res, msg) { return res.status(400).json({ success: false, message: msg }); }
function notFound(res, msg = "Not found.") { return res.status(404).json({ success: false, message: msg }); }

function handleDomainError(res, err) {
  switch (err.code) {
    case "PAYMENT_NOT_FOUND":                  return notFound(res, "Payment not found.");
    case "REFUND_NOT_FOUND":                   return notFound(res, "Refund not found.");
    case "SUBSCRIPTION_NOT_FOUND":             return notFound(res, "Subscription not found.");
    case "INVOICE_NOT_FOUND":                  return notFound(res, "Invoice not found.");
    case "PAYOUT_NOT_FOUND":                   return notFound(res, "Payout not found.");
    case "COUPON_NOT_FOUND":                   return notFound(res, "Coupon not found.");
    case "TAX_RULE_NOT_FOUND":                 return notFound(res, "Tax rule not found.");
    case "USER_NOT_FOUND":                     return badRequest(res, "Referenced user does not exist.");
    case "PAYMENT_NOT_REFUNDABLE":             return badRequest(res, "Only successful payments can be refunded.");
    case "REFUND_EXCEEDS_PAYMENT":             return badRequest(res, "Refund amount cannot exceed the payment amount.");
    case "REFUND_NOT_PENDING":                 return badRequest(res, "This refund has already been decided.");
    case "SUBSCRIPTION_ALREADY_CANCELLED":     return badRequest(res, "Subscription is already cancelled.");
    case "SUBSCRIPTION_CANCELLED_CANNOT_EXTEND": return badRequest(res, "Cannot extend a cancelled subscription.");
    case "INVOICE_ALREADY_VOID":               return badRequest(res, "Invoice is already void.");
    case "INVOICE_VOID_IMMUTABLE":             return badRequest(res, "A void invoice cannot be modified.");
    case "PAYOUT_INVALID_STATUS":              return badRequest(res, "Payout is not in a state that allows this action.");
    case "COUPON_CODE_EXISTS":                 return badRequest(res, "A coupon with this code already exists.");
    default:                                   return null;
  }
}

function serverError(res, err) {
  console.error("[FinanceController]", err);
  if (res.headersSent) return res.destroy(err);
  if (err.code === "P2025") return notFound(res, "Record not found.");
  if (err.code === "P2003") return badRequest(res, "Invalid reference: one or more IDs do not exist.");
  if (err.code === "P2021") return res.status(503).json({ success: false, message: "Database not migrated yet. Run `npx prisma db push`." });
  return res.status(500).json({ success: false, message: "Internal server error." });
}

function run(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      return handleDomainError(res, err) ?? serverError(res, err);
    }
  };
}

// ── Dashboard stats ────────────────────────────────────────────────────────────

const getStats = run(async (req, res) => {
  const stats = await svc.getStats();
  return res.json({ success: true, data: stats });
});

const getAnalytics = run(async (req, res) => {
  const q = v.validateAnalyticsQuery(req.query);
  if (!q.isValid) return badRequest(res, q.errors[0]);
  const data = await svc.getAnalytics(q.data);
  return res.json({ success: true, data });
});

// ── Payments ──────────────────────────────────────────────────────────────────

const listPayments = run(async (req, res) => {
  const q = v.validatePaymentListQuery(req.query);
  if (!q.isValid) return badRequest(res, q.errors[0]);
  const page = await svc.listPayments(q.data);
  return res.json({ success: true, data: page });
});

const getPayment = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "paymentId");
  if (idErr) return badRequest(res, idErr);
  const payment = await svc.getPayment(req.params.id);
  return res.json({ success: true, data: payment });
});

const refundPayment = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "paymentId");
  if (idErr) return badRequest(res, idErr);
  const b = v.validateRefundRequest(req.body);
  if (!b.isValid) return badRequest(res, b.errors[0]);
  const refund = await svc.requestRefund(req.params.id, b.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Refund requested.", data: refund });
});

const exportPayments = run(async (req, res) => {
  const q = v.validatePaymentListQuery(req.query);
  if (!q.isValid) return badRequest(res, q.errors[0]);
  const csv = await svc.exportPaymentsCsv(q.data);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="payments.csv"');
  return res.send(csv);
});

// ── Subscriptions ─────────────────────────────────────────────────────────────

const listSubscriptions = run(async (req, res) => {
  const q = v.validateSubscriptionListQuery(req.query);
  if (!q.isValid) return badRequest(res, q.errors[0]);
  const page = await svc.listSubscriptions(q.data);
  return res.json({ success: true, data: page });
});

const createSubscription = run(async (req, res) => {
  const b = v.validateSubscriptionCreate(req.body);
  if (!b.isValid) return badRequest(res, b.errors[0]);
  const sub = await svc.createSubscription(b.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Subscription created.", data: sub });
});

const updateSubscription = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "subscriptionId");
  if (idErr) return badRequest(res, idErr);
  const b = v.validateSubscriptionUpdate(req.body);
  if (!b.isValid) return badRequest(res, b.errors[0]);
  const sub = await svc.updateSubscription(req.params.id, b.data, req.admin?.id);
  return res.json({ success: true, message: "Subscription updated.", data: sub });
});

const cancelSubscription = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "subscriptionId");
  if (idErr) return badRequest(res, idErr);
  const sub = await svc.cancelSubscription(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Subscription cancelled.", data: sub });
});

const extendSubscription = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "subscriptionId");
  if (idErr) return badRequest(res, idErr);
  const b = v.validateSubscriptionExtend(req.body);
  if (!b.isValid) return badRequest(res, b.errors[0]);
  const sub = await svc.extendSubscription(req.params.id, b.data, req.admin?.id);
  return res.json({ success: true, message: "Subscription extended.", data: sub });
});

// ── Invoices ──────────────────────────────────────────────────────────────────

const listInvoices = run(async (req, res) => {
  const q = v.validateInvoiceListQuery(req.query);
  if (!q.isValid) return badRequest(res, q.errors[0]);
  const page = await svc.listInvoices(q.data);
  return res.json({ success: true, data: page });
});

const getInvoice = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "invoiceId");
  if (idErr) return badRequest(res, idErr);
  const inv = await svc.getInvoice(req.params.id);
  return res.json({ success: true, data: inv });
});

const createInvoice = run(async (req, res) => {
  const b = v.validateInvoiceCreate(req.body);
  if (!b.isValid) return badRequest(res, b.errors[0]);
  const inv = await svc.createInvoice(b.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Invoice generated.", data: inv });
});

const updateInvoice = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "invoiceId");
  if (idErr) return badRequest(res, idErr);
  const b = v.validateInvoiceUpdate(req.body);
  if (!b.isValid) return badRequest(res, b.errors[0]);
  const inv = await svc.updateInvoice(req.params.id, b.data, req.admin?.id);
  return res.json({ success: true, message: "Invoice updated.", data: inv });
});

const voidInvoice = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "invoiceId");
  if (idErr) return badRequest(res, idErr);
  const inv = await svc.voidInvoice(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Invoice voided.", data: inv });
});

const sendInvoice = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "invoiceId");
  if (idErr) return badRequest(res, idErr);
  const inv = await svc.sendInvoice(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Invoice sent.", data: inv });
});

const downloadInvoice = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "invoiceId");
  if (idErr) return badRequest(res, idErr);
  const placeholder = await svc.getInvoiceDownloadPlaceholder(req.params.id);
  return res.json({ success: true, data: placeholder });
});

// ── Transactions ──────────────────────────────────────────────────────────────

const listTransactions = run(async (req, res) => {
  const q = v.validateTransactionListQuery(req.query);
  if (!q.isValid) return badRequest(res, q.errors[0]);
  const page = await svc.listTransactions(q.data);
  return res.json({ success: true, data: page });
});

// ── Refunds ───────────────────────────────────────────────────────────────────

const listRefunds = run(async (req, res) => {
  const q = v.validateRefundListQuery(req.query);
  if (!q.isValid) return badRequest(res, q.errors[0]);
  const page = await svc.listRefunds(q.data);
  return res.json({ success: true, data: page });
});

const approveRefund = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "refundId");
  if (idErr) return badRequest(res, idErr);
  const refund = await svc.approveRefund(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Refund approved and processed.", data: refund });
});

const rejectRefund = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "refundId");
  if (idErr) return badRequest(res, idErr);
  const b = v.validateRefundReject(req.body);
  if (!b.isValid) return badRequest(res, b.errors[0]);
  const refund = await svc.rejectRefund(req.params.id, b.data, req.admin?.id);
  return res.json({ success: true, message: "Refund rejected.", data: refund });
});

// ── Instructor Payouts ────────────────────────────────────────────────────────

const listPayouts = run(async (req, res) => {
  const q = v.validatePayoutListQuery(req.query);
  if (!q.isValid) return badRequest(res, q.errors[0]);
  const page = await svc.listPayouts(q.data);
  return res.json({ success: true, data: page });
});

const calculatePayouts = run(async (req, res) => {
  const b = v.validatePayoutCalculate(req.body);
  if (!b.isValid) return badRequest(res, b.errors[0]);
  const result = await svc.calculatePayouts(b.data, req.admin?.id);
  return res.json({ success: true, message: `${result.created} payout(s) calculated.`, data: result });
});

const approvePayout = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "payoutId");
  if (idErr) return badRequest(res, idErr);
  const payout = await svc.approvePayout(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Payout approved.", data: payout });
});

const holdPayout = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "payoutId");
  if (idErr) return badRequest(res, idErr);
  const payout = await svc.holdPayout(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Payout held.", data: payout });
});

const completePayout = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "payoutId");
  if (idErr) return badRequest(res, idErr);
  const payout = await svc.completePayout(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Payout completed.", data: payout });
});

// ── Coupons ───────────────────────────────────────────────────────────────────

const listCoupons = run(async (req, res) => {
  const q = v.validateCouponListQuery(req.query);
  if (!q.isValid) return badRequest(res, q.errors[0]);
  const page = await svc.listCoupons(q.data);
  return res.json({ success: true, data: page });
});

const createCoupon = run(async (req, res) => {
  const b = v.validateCouponCreate(req.body);
  if (!b.isValid) return badRequest(res, b.errors[0]);
  const coupon = await svc.createCoupon(b.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Coupon created.", data: coupon });
});

const updateCoupon = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "couponId");
  if (idErr) return badRequest(res, idErr);
  const b = v.validateCouponUpdate(req.body);
  if (!b.isValid) return badRequest(res, b.errors[0]);
  const coupon = await svc.updateCoupon(req.params.id, b.data, req.admin?.id);
  return res.json({ success: true, message: "Coupon updated.", data: coupon });
});

const disableCoupon = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "couponId");
  if (idErr) return badRequest(res, idErr);
  const coupon = await svc.disableCoupon(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Coupon disabled.", data: coupon });
});

const deleteCoupon = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "couponId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteCoupon(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Coupon deleted.", data: result });
});

// ── Tax Rules ─────────────────────────────────────────────────────────────────

const listTaxRules = run(async (req, res) => {
  const rules = await svc.listTaxRules();
  return res.json({ success: true, data: rules });
});

const createTaxRule = run(async (req, res) => {
  const b = v.validateTaxRuleCreate(req.body);
  if (!b.isValid) return badRequest(res, b.errors[0]);
  const rule = await svc.createTaxRule(b.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Tax rule created.", data: rule });
});

const updateTaxRule = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "taxRuleId");
  if (idErr) return badRequest(res, idErr);
  const b = v.validateTaxRuleUpdate(req.body);
  if (!b.isValid) return badRequest(res, b.errors[0]);
  const rule = await svc.updateTaxRule(req.params.id, b.data, req.admin?.id);
  return res.json({ success: true, message: "Tax rule updated.", data: rule });
});

const deleteTaxRule = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "taxRuleId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deleteTaxRule(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Tax rule deleted.", data: result });
});

// ── Billing Settings ──────────────────────────────────────────────────────────

const getSettings = run(async (req, res) => {
  const settings = await svc.getSettings();
  return res.json({ success: true, data: settings });
});

const updateSettings = run(async (req, res) => {
  const b = v.validateSettingsUpdate(req.body);
  if (!b.isValid) return badRequest(res, b.errors[0]);
  const settings = await svc.updateSettings(b.data, req.admin?.id);
  return res.json({ success: true, message: "Billing settings updated.", data: settings });
});

module.exports = {
  getStats, getAnalytics,
  listPayments, getPayment, refundPayment, exportPayments,
  listSubscriptions, createSubscription, updateSubscription, cancelSubscription, extendSubscription,
  listInvoices, getInvoice, createInvoice, updateInvoice, voidInvoice, sendInvoice, downloadInvoice,
  listTransactions,
  listRefunds, approveRefund, rejectRefund,
  listPayouts, calculatePayouts, approvePayout, holdPayout, completePayout,
  listCoupons, createCoupon, updateCoupon, disableCoupon, deleteCoupon,
  listTaxRules, createTaxRule, updateTaxRule, deleteTaxRule,
  getSettings, updateSettings,
};
