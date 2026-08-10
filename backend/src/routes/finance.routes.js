const express = require("express");

const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUserActionRateLimiter, coursesReadRateLimiter } = require("../middlewares/rateLimit.middleware");
const c = require("../controllers/finance.controller");

// Mounted at /api/admin/finance (see server.js).
const router = express.Router();

const read  = [requireAdminAuth, coursesReadRateLimiter];
const write = [requireAdminAuth, adminUserActionRateLimiter];

// ── Dashboard ──────────────────────────────────────────────────────────────────
router.get("/stats",     ...read, c.getStats);
router.get("/analytics", ...read, c.getAnalytics);

// ── Payments (static paths before /:id) ───────────────────────────────────────
router.get("/payments/export",       ...read, c.exportPayments);
router.get("/payments/:id",          ...read, c.getPayment);
router.get("/payments",              ...read, c.listPayments);
router.patch("/payments/:id/refund", ...write, c.refundPayment);

// ── Subscriptions ──────────────────────────────────────────────────────────────
router.get("/subscriptions",             ...read,  c.listSubscriptions);
router.post("/subscriptions",            ...write, c.createSubscription);
router.patch("/subscriptions/:id/cancel", ...write, c.cancelSubscription);
router.patch("/subscriptions/:id/extend", ...write, c.extendSubscription);
router.patch("/subscriptions/:id",        ...write, c.updateSubscription);

// ── Invoices ─────────────────────────────────────────────────────────────────
router.get("/invoices/:id/download",  ...read,  c.downloadInvoice);
router.get("/invoices/:id",           ...read,  c.getInvoice);
router.get("/invoices",               ...read,  c.listInvoices);
router.post("/invoices",              ...write, c.createInvoice);
router.patch("/invoices/:id/void",    ...write, c.voidInvoice);
router.patch("/invoices/:id/send",    ...write, c.sendInvoice);
router.patch("/invoices/:id",         ...write, c.updateInvoice);

// ── Transactions (read-only ledger) ───────────────────────────────────────────
router.get("/transactions", ...read, c.listTransactions);

// ── Refunds ──────────────────────────────────────────────────────────────────
router.get("/refunds",                ...read,  c.listRefunds);
router.patch("/refunds/:id/approve",  ...write, c.approveRefund);
router.patch("/refunds/:id/reject",   ...write, c.rejectRefund);

// ── Instructor Payouts ─────────────────────────────────────────────────────────
router.get("/payouts",                ...read,  c.listPayouts);
router.post("/payouts/calculate",     ...write, c.calculatePayouts);
router.patch("/payouts/:id/approve",  ...write, c.approvePayout);
router.patch("/payouts/:id/hold",     ...write, c.holdPayout);
router.patch("/payouts/:id/complete", ...write, c.completePayout);

// ── Coupons ──────────────────────────────────────────────────────────────────
router.get("/coupons",               ...read,  c.listCoupons);
router.post("/coupons",              ...write, c.createCoupon);
router.patch("/coupons/:id/disable", ...write, c.disableCoupon);
router.patch("/coupons/:id",         ...write, c.updateCoupon);
router.delete("/coupons/:id",        ...write, c.deleteCoupon);

// ── Tax Rules ────────────────────────────────────────────────────────────────
router.get("/tax-rules",       ...read,  c.listTaxRules);
router.post("/tax-rules",      ...write, c.createTaxRule);
router.patch("/tax-rules/:id", ...write, c.updateTaxRule);
router.delete("/tax-rules/:id", ...write, c.deleteTaxRule);

// ── Billing Settings ───────────────────────────────────────────────────────────
router.get("/settings",   ...read,  c.getSettings);
router.patch("/settings", ...write, c.updateSettings);

module.exports = router;
