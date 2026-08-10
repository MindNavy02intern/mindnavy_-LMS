// Validation for the Finance API. Same conventions as certificates.validator:
// each function returns { isValid, errors, data }; bounded strings/enums/ints
// are read field-by-field, nothing arbitrary reaches Prisma.

const MAX = {
  short:   120,
  reason:  1000,
  code:    40,
  limit:   200,
  page:    100000,
  items:   50,      // invoice line items cap
  courses: 500,     // coupon.applicableCourseIds cap
};

const PAYMENT_STATUSES      = ["PENDING", "SUCCESSFUL", "FAILED", "REFUNDED", "CANCELLED"];
const PAYMENT_METHODS       = ["STRIPE", "PAYPAL", "BANK_TRANSFER", "MANUAL"];
const SUBSCRIPTION_PLANS    = ["MONTHLY", "ANNUAL", "ENTERPRISE", "TEAM", "CUSTOM"];
const SUBSCRIPTION_STATUSES = ["ACTIVE", "CANCELLED", "EXPIRED", "PAUSED"];
const BILLING_CYCLES        = ["MONTHLY", "ANNUAL"];
const INVOICE_STATUSES      = ["DRAFT", "SENT", "PAID", "VOID", "OVERDUE"];
const TRANSACTION_TYPES     = ["PAYMENT", "REFUND", "PAYOUT", "TRANSFER", "TAX_DEDUCTION"];
const PAYOUT_STATUSES       = ["PENDING", "APPROVED", "PROCESSING", "COMPLETED", "FAILED", "HELD"];
const COUPON_TYPES          = ["PERCENTAGE", "FIXED_AMOUNT"];
const COUPON_STATUSES       = ["ACTIVE", "DISABLED", "EXPIRED"];
const TAX_RULE_TYPES        = ["VAT", "SALES_TAX", "DIGITAL_TAX"];
const TAX_RULE_STATUSES     = ["ACTIVE", "INACTIVE"];
const ANALYTICS_PERIODS     = ["daily", "weekly", "monthly", "quarterly"];

function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0) return `${label} is required.`;
  return null;
}

// ── Shared field readers (mirrors certificates.validator) ────────────────────

function readBoundedString(value, key, max, errors, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) errors.push(`${key} is required.`);
    return undefined;
  }
  const s = typeof value === "string" ? value.trim() : "";
  if (!s) { errors.push(required ? `${key} is required.` : `${key} cannot be empty.`); return undefined; }
  if (s.length > max) { errors.push(`${key} must be at most ${max} characters.`); return undefined; }
  return s;
}

function readEnum(value, key, allowed, errors, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) errors.push(`${key} is required.`);
    return undefined;
  }
  const s = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!allowed.includes(s)) { errors.push(`${key} must be one of: ${allowed.join(", ")}.`); return undefined; }
  return s;
}

function readFloat(value, key, errors, { required = false, min = 0 } = {}) {
  if (value === undefined || value === null) {
    if (required) errors.push(`${key} is required.`);
    return undefined;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || n < min) { errors.push(`${key} must be a number >= ${min}.`); return undefined; }
  return n;
}

function readInt(value, key, min, max, errors, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) errors.push(`${key} is required.`);
    return undefined;
  }
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) { errors.push(`${key} must be an integer between ${min} and ${max}.`); return undefined; }
  return n;
}

function readDate(value, key, errors, { required = false } = {}) {
  if (value === undefined || value === null) {
    if (required) errors.push(`${key} is required.`);
    return undefined;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) { errors.push(`${key} must be a valid date.`); return undefined; }
  return d;
}

function readBool(value, key, errors) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") { errors.push(`${key} must be a boolean.`); return undefined; }
  return value;
}

function readStringArray(value, key, maxLen, errors) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) { errors.push(`${key} must be an array of strings.`); return undefined; }
  if (value.length > maxLen) { errors.push(`${key} must have at most ${maxLen} items.`); return undefined; }
  const out = [];
  for (const v of value) {
    if (typeof v !== "string" || !v.trim()) { errors.push(`${key} must contain only non-empty strings.`); return undefined; }
    out.push(v.trim());
  }
  return out;
}

function readPageLimit(query, errors, defaultLimit = 20) {
  const page  = readInt(query.page,  "page",  1, MAX.page,  errors) ?? 1;
  const limit = readInt(query.limit, "limit", 1, MAX.limit, errors) ?? defaultLimit;
  return { page, limit, offset: (page - 1) * limit };
}

function readDateRange(query, errors) {
  const dateFrom = readDate(query.dateFrom, "dateFrom", errors);
  const dateTo   = readDate(query.dateTo,   "dateTo",   errors);
  return { dateFrom, dateTo };
}

// ── Payments ──────────────────────────────────────────────────────────────────

function validatePaymentListQuery(query = {}) {
  const errors = [];
  const status = query.status ? readEnum(query.status, "status", PAYMENT_STATUSES, errors) : undefined;
  const method = query.method ? readEnum(query.method, "method", PAYMENT_METHODS, errors) : undefined;
  const search = typeof query.search === "string" && query.search.trim() ? query.search.trim() : undefined;
  const { page, limit, offset } = readPageLimit(query, errors);
  const { dateFrom, dateTo } = readDateRange(query, errors);
  return { isValid: errors.length === 0, errors, data: { status, method, search, page, limit, offset, dateFrom, dateTo } };
}

function validateRefundRequest(body = {}) {
  const errors = [];
  const amount = readFloat(body.amount, "amount", errors, { required: true, min: 0.01 });
  const reason = readBoundedString(body.reason, "reason", MAX.reason, errors, { required: true });
  return { isValid: errors.length === 0, errors, data: { amount, reason } };
}

function validateRefundReject(body = {}) {
  const errors = [];
  const reason = readBoundedString(body.reason, "reason", MAX.reason, errors, { required: true });
  return { isValid: errors.length === 0, errors, data: { reason } };
}

function validateRefundListQuery(query = {}) {
  const errors = [];
  const status = query.status ? readEnum(query.status, "status", ["PENDING", "APPROVED", "REJECTED", "PROCESSED"], errors) : undefined;
  const { page, limit, offset } = readPageLimit(query, errors);
  return { isValid: errors.length === 0, errors, data: { status, page, limit, offset } };
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

function validateSubscriptionListQuery(query = {}) {
  const errors = [];
  const status   = query.status   ? readEnum(query.status,   "status",   SUBSCRIPTION_STATUSES, errors) : undefined;
  const planType = query.planType ? readEnum(query.planType, "planType", SUBSCRIPTION_PLANS,    errors) : undefined;
  const { page, limit, offset } = readPageLimit(query, errors);
  return { isValid: errors.length === 0, errors, data: { status, planType, page, limit, offset } };
}

function validateSubscriptionCreate(body = {}) {
  const errors = [];
  const userId       = readBoundedString(body.userId, "userId", MAX.short, errors, { required: true });
  const planType      = readEnum(body.planType, "planType", SUBSCRIPTION_PLANS, errors, { required: true });
  const billingCycle  = readEnum(body.billingCycle, "billingCycle", BILLING_CYCLES, errors, { required: true });
  const amount        = readFloat(body.amount, "amount", errors, { required: true, min: 0 });
  const currency       = readBoundedString(body.currency, "currency", 10, errors) ?? "USD";
  const startDate      = readDate(body.startDate, "startDate", errors);
  const endDate        = body.endDate      !== undefined ? readDate(body.endDate,      "endDate",      errors) : undefined;
  const renewalDate    = body.renewalDate  !== undefined ? readDate(body.renewalDate,  "renewalDate",  errors) : undefined;
  return {
    isValid: errors.length === 0,
    errors,
    data: { userId, planType, billingCycle, amount, currency, startDate, endDate, renewalDate },
  };
}

function validateSubscriptionUpdate(body = {}) {
  const errors = [];
  const data = {};
  if (body.planType     !== undefined) data.planType     = readEnum(body.planType, "planType", SUBSCRIPTION_PLANS, errors, { required: true });
  if (body.billingCycle !== undefined) data.billingCycle = readEnum(body.billingCycle, "billingCycle", BILLING_CYCLES, errors, { required: true });
  if (body.amount       !== undefined) data.amount       = readFloat(body.amount, "amount", errors, { required: true, min: 0 });
  if (body.currency     !== undefined) data.currency     = readBoundedString(body.currency, "currency", 10, errors, { required: true });
  if (body.endDate      !== undefined) data.endDate      = body.endDate === null ? null : readDate(body.endDate, "endDate", errors);
  if (body.renewalDate  !== undefined) data.renewalDate  = body.renewalDate === null ? null : readDate(body.renewalDate, "renewalDate", errors);
  if (errors.length === 0 && Object.keys(data).length === 0) errors.push("No valid fields provided to update.");
  return { isValid: errors.length === 0, errors, data };
}

function validateSubscriptionExtend(body = {}) {
  const errors = [];
  const renewalDate = readDate(body.renewalDate, "renewalDate", errors, { required: true });
  return { isValid: errors.length === 0, errors, data: { renewalDate } };
}

// ── Invoices ──────────────────────────────────────────────────────────────────

function readInvoiceItems(raw, errors) {
  if (!Array.isArray(raw) || raw.length === 0) { errors.push("items must be a non-empty array."); return undefined; }
  if (raw.length > MAX.items) { errors.push(`items must have at most ${MAX.items} rows.`); return undefined; }
  const items = [];
  for (const [i, row] of raw.entries()) {
    const name = readBoundedString(row?.name, `items[${i}].name`, MAX.short, errors, { required: true });
    const qty  = readInt(row?.qty, `items[${i}].qty`, 1, 100000, errors, { required: true });
    const unitPrice = readFloat(row?.unitPrice, `items[${i}].unitPrice`, errors, { required: true, min: 0 });
    if (name === undefined || qty === undefined || unitPrice === undefined) continue;
    items.push({ name, qty, unitPrice, total: Math.round(qty * unitPrice * 100) / 100 });
  }
  return errors.length === 0 ? items : undefined;
}

function validateInvoiceCreate(body = {}) {
  const errors = [];
  const userId    = readBoundedString(body.userId, "userId", MAX.short, errors, { required: true });
  const items     = readInvoiceItems(body.items, errors);
  const taxAmount = body.taxAmount !== undefined ? readFloat(body.taxAmount, "taxAmount", errors, { min: 0 }) : 0;
  const dueDate   = body.dueDate !== undefined ? readDate(body.dueDate, "dueDate", errors) : undefined;
  return { isValid: errors.length === 0, errors, data: { userId, items, taxAmount: taxAmount ?? 0, dueDate } };
}

function validateInvoiceUpdate(body = {}) {
  const errors = [];
  const data = {};
  if (body.items     !== undefined) { const items = readInvoiceItems(body.items, errors); if (items) data.items = items; }
  if (body.taxAmount !== undefined) data.taxAmount = readFloat(body.taxAmount, "taxAmount", errors, { required: true, min: 0 });
  if (body.dueDate   !== undefined) data.dueDate   = body.dueDate === null ? null : readDate(body.dueDate, "dueDate", errors);
  if (body.status    !== undefined) data.status    = readEnum(body.status, "status", ["DRAFT", "SENT", "PAID", "OVERDUE"], errors, { required: true });
  if (errors.length === 0 && Object.keys(data).length === 0) errors.push("No valid fields provided to update.");
  return { isValid: errors.length === 0, errors, data };
}

function validateInvoiceListQuery(query = {}) {
  const errors = [];
  const status = query.status ? readEnum(query.status, "status", INVOICE_STATUSES, errors) : undefined;
  const { page, limit, offset } = readPageLimit(query, errors);
  return { isValid: errors.length === 0, errors, data: { status, page, limit, offset } };
}

// ── Transactions ──────────────────────────────────────────────────────────────

function validateTransactionListQuery(query = {}) {
  const errors = [];
  const type = query.type ? readEnum(query.type, "type", TRANSACTION_TYPES, errors) : undefined;
  const { page, limit, offset } = readPageLimit(query, errors);
  const { dateFrom, dateTo } = readDateRange(query, errors);
  return { isValid: errors.length === 0, errors, data: { type, page, limit, offset, dateFrom, dateTo } };
}

// ── Payouts ───────────────────────────────────────────────────────────────────

function validatePayoutListQuery(query = {}) {
  const errors = [];
  const status = query.status ? readEnum(query.status, "status", PAYOUT_STATUSES, errors) : undefined;
  const { page, limit, offset } = readPageLimit(query, errors);
  return { isValid: errors.length === 0, errors, data: { status, page, limit, offset } };
}

function validatePayoutCalculate(body = {}) {
  const errors = [];
  const periodStart = readDate(body.periodStart, "periodStart", errors, { required: true });
  const periodEnd   = readDate(body.periodEnd,   "periodEnd",   errors, { required: true });
  if (periodStart && periodEnd && periodStart >= periodEnd) errors.push("periodStart must be before periodEnd.");
  return { isValid: errors.length === 0, errors, data: { periodStart, periodEnd } };
}

// ── Coupons ───────────────────────────────────────────────────────────────────

function validateCouponCreate(body = {}) {
  const errors = [];
  const code  = readBoundedString(body.code, "code", MAX.code, errors, { required: true })?.toUpperCase();
  const type  = readEnum(body.type, "type", COUPON_TYPES, errors, { required: true });
  const value = readFloat(body.value, "value", errors, { required: true, min: 0.01 });
  if (type === "PERCENTAGE" && value !== undefined && value > 100) errors.push("value must be at most 100 for a PERCENTAGE coupon.");
  const maxUses = body.maxUses !== undefined && body.maxUses !== null ? readInt(body.maxUses, "maxUses", 1, 1000000, errors) : undefined;
  const minPurchaseAmount = body.minPurchaseAmount !== undefined && body.minPurchaseAmount !== null
    ? readFloat(body.minPurchaseAmount, "minPurchaseAmount", errors, { min: 0 }) : undefined;
  const applicableCourseIds = readStringArray(body.applicableCourseIds, "applicableCourseIds", MAX.courses, errors) ?? [];
  const expiresAt = body.expiresAt !== undefined && body.expiresAt !== null ? readDate(body.expiresAt, "expiresAt", errors) : undefined;
  return {
    isValid: errors.length === 0,
    errors,
    data: { code, type, value, maxUses, minPurchaseAmount, applicableCourseIds, expiresAt },
  };
}

function validateCouponUpdate(body = {}) {
  const errors = [];
  const data = {};
  if (body.type  !== undefined) data.type  = readEnum(body.type, "type", COUPON_TYPES, errors, { required: true });
  if (body.value !== undefined) {
    data.value = readFloat(body.value, "value", errors, { required: true, min: 0.01 });
    if (data.value !== undefined && (data.type === "PERCENTAGE" || body.type === "PERCENTAGE") && data.value > 100) {
      errors.push("value must be at most 100 for a PERCENTAGE coupon.");
    }
  }
  if (body.maxUses           !== undefined) data.maxUses           = body.maxUses === null ? null : readInt(body.maxUses, "maxUses", 1, 1000000, errors);
  if (body.minPurchaseAmount !== undefined) data.minPurchaseAmount = body.minPurchaseAmount === null ? null : readFloat(body.minPurchaseAmount, "minPurchaseAmount", errors, { min: 0 });
  if (body.applicableCourseIds !== undefined) {
    const ids = readStringArray(body.applicableCourseIds, "applicableCourseIds", MAX.courses, errors);
    if (ids) data.applicableCourseIds = ids;
  }
  if (body.expiresAt !== undefined) data.expiresAt = body.expiresAt === null ? null : readDate(body.expiresAt, "expiresAt", errors);
  if (errors.length === 0 && Object.keys(data).length === 0) errors.push("No valid fields provided to update.");
  return { isValid: errors.length === 0, errors, data };
}

function validateCouponListQuery(query = {}) {
  const errors = [];
  const status = query.status ? readEnum(query.status, "status", COUPON_STATUSES, errors) : undefined;
  const { page, limit, offset } = readPageLimit(query, errors);
  return { isValid: errors.length === 0, errors, data: { status, page, limit, offset } };
}

// ── Tax Rules ─────────────────────────────────────────────────────────────────

function validateTaxRuleCreate(body = {}) {
  const errors = [];
  const name    = readBoundedString(body.name, "name", MAX.short, errors, { required: true });
  const region  = readBoundedString(body.region, "region", MAX.short, errors, { required: true });
  const country = readBoundedString(body.country, "country", MAX.short, errors, { required: true });
  const rate    = readFloat(body.rate, "rate", errors, { required: true, min: 0 });
  if (rate !== undefined && rate > 100) errors.push("rate must be at most 100.");
  const type    = readEnum(body.type, "type", TAX_RULE_TYPES, errors, { required: true });
  return { isValid: errors.length === 0, errors, data: { name, region, country, rate, type } };
}

function validateTaxRuleUpdate(body = {}) {
  const errors = [];
  const data = {};
  if (body.name    !== undefined) data.name    = readBoundedString(body.name, "name", MAX.short, errors, { required: true });
  if (body.region  !== undefined) data.region  = readBoundedString(body.region, "region", MAX.short, errors, { required: true });
  if (body.country !== undefined) data.country = readBoundedString(body.country, "country", MAX.short, errors, { required: true });
  if (body.rate    !== undefined) {
    data.rate = readFloat(body.rate, "rate", errors, { required: true, min: 0 });
    if (data.rate !== undefined && data.rate > 100) errors.push("rate must be at most 100.");
  }
  if (body.type    !== undefined) data.type    = readEnum(body.type, "type", TAX_RULE_TYPES, errors, { required: true });
  if (body.status  !== undefined) data.status  = readEnum(body.status, "status", TAX_RULE_STATUSES, errors, { required: true });
  if (errors.length === 0 && Object.keys(data).length === 0) errors.push("No valid fields provided to update.");
  return { isValid: errors.length === 0, errors, data };
}

// ── Billing Settings ──────────────────────────────────────────────────────────

function validateSettingsUpdate(body = {}) {
  const errors = [];
  const data = {};
  if (body.currency           !== undefined) data.currency           = readBoundedString(body.currency, "currency", 10, errors, { required: true });
  if (body.refundPolicy       !== undefined) data.refundPolicy       = body.refundPolicy === null ? null : readBoundedString(body.refundPolicy, "refundPolicy", 2000, errors);
  if (body.autoBillingEnabled !== undefined) data.autoBillingEnabled = readBool(body.autoBillingEnabled, "autoBillingEnabled", errors);
  if (body.paymentRetryRules  !== undefined) {
    if (body.paymentRetryRules !== null && (typeof body.paymentRetryRules !== "object" || Array.isArray(body.paymentRetryRules))) {
      errors.push("paymentRetryRules must be an object.");
    } else {
      data.paymentRetryRules = body.paymentRetryRules;
    }
  }
  if (errors.length === 0 && Object.keys(data).length === 0) errors.push("No valid fields provided to update.");
  return { isValid: errors.length === 0, errors, data };
}

// ── Analytics ─────────────────────────────────────────────────────────────────

function validateAnalyticsQuery(query = {}) {
  const errors = [];
  const period = query.period ? readEnum(query.period, "period", ANALYTICS_PERIODS.map(p => p.toUpperCase()), errors) : "MONTHLY";
  return { isValid: errors.length === 0, errors, data: { period: (period ?? "MONTHLY").toLowerCase() } };
}

module.exports = {
  validateId,
  validatePaymentListQuery,
  validateRefundRequest,
  validateRefundReject,
  validateRefundListQuery,
  validateSubscriptionListQuery,
  validateSubscriptionCreate,
  validateSubscriptionUpdate,
  validateSubscriptionExtend,
  validateInvoiceCreate,
  validateInvoiceUpdate,
  validateInvoiceListQuery,
  validateTransactionListQuery,
  validatePayoutListQuery,
  validatePayoutCalculate,
  validateCouponCreate,
  validateCouponUpdate,
  validateCouponListQuery,
  validateTaxRuleCreate,
  validateTaxRuleUpdate,
  validateSettingsUpdate,
  validateAnalyticsQuery,
};
