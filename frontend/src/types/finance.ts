// Finance — types per FINANCE_CONTRACT.md. Field names mirror the backend
// service response shapes 1:1 (finance.service.js / finance.controller.js),
// same convention as types/competencies.ts / types/instructors.ts.

export class FinanceApiError extends Error {
  status: number;
  data?: Record<string, unknown>;
  constructor(status: number, message: string, data?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'FinanceApiError';
  }
}

export type Metric = { value: number | null; changePercent: number | null; available: boolean; reason?: string };
export type SimpleMetric = { value: number | null; available: boolean; reason?: string };

export interface FinanceStats {
  totalRevenue:        Metric;
  monthlyRevenue:      Metric;
  activeSubscriptions: SimpleMetric;
  pendingPayments:     SimpleMetric;
  failedTransactions:  SimpleMetric;
  refundRequests:      SimpleMetric;
  instructorPayouts:   SimpleMetric;
  revenueGrowth:       SimpleMetric;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page:  number;
  limit: number;
}

// ── Payments ──────────────────────────────────────────────────────────────

export type PaymentStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
export type PaymentMethod = 'STRIPE' | 'PAYPAL' | 'BANK_TRANSFER' | 'MANUAL';

export const PAYMENT_STATUSES: PaymentStatus[] = ['PENDING', 'SUCCESSFUL', 'FAILED', 'REFUNDED', 'CANCELLED'];
export const PAYMENT_METHODS: PaymentMethod[] = ['STRIPE', 'PAYPAL', 'BANK_TRANSFER', 'MANUAL'];

export interface Payment {
  id: string;
  userId: string; userName: string | null; userEmail: string | null;
  courseId: string | null; courseTitle: string | null;
  amount: number; currency: string;
  status: PaymentStatus; method: PaymentMethod;
  stripePaymentIntentId: string | null;
  createdAt: string; updatedAt: string;
}

// ── Subscriptions ────────────────────────────────────────────────────────

export type SubscriptionPlanType = 'MONTHLY' | 'ANNUAL' | 'ENTERPRISE' | 'TEAM' | 'CUSTOM';
export type SubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PAUSED';
export type BillingCycle = 'MONTHLY' | 'ANNUAL';

export const SUBSCRIPTION_PLAN_TYPES: SubscriptionPlanType[] = ['MONTHLY', 'ANNUAL', 'ENTERPRISE', 'TEAM', 'CUSTOM'];
export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ['ACTIVE', 'CANCELLED', 'EXPIRED', 'PAUSED'];
export const BILLING_CYCLES: BillingCycle[] = ['MONTHLY', 'ANNUAL'];

export interface Subscription {
  id: string;
  userId: string; userName: string | null; userEmail: string | null;
  planType: SubscriptionPlanType; status: SubscriptionStatus; billingCycle: BillingCycle;
  amount: number; currency: string;
  startDate: string; endDate: string | null; renewalDate: string | null;
  createdAt: string; updatedAt: string;
}

export interface CreateSubscriptionRequest {
  userId: string; planType: SubscriptionPlanType; billingCycle: BillingCycle;
  amount: number; currency?: string; startDate?: string; endDate?: string; renewalDate?: string;
}
export type UpdateSubscriptionRequest = Partial<Omit<CreateSubscriptionRequest, 'userId'>>;

// ── Invoices ──────────────────────────────────────────────────────────────

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'VOID' | 'OVERDUE';
export const INVOICE_STATUSES: InvoiceStatus[] = ['DRAFT', 'SENT', 'PAID', 'VOID', 'OVERDUE'];

export interface InvoiceItem { name: string; qty: number; unitPrice: number; total: number }

export interface Invoice {
  id: string;
  userId: string; userName: string | null; userEmail: string | null;
  invoiceNumber: string; items: InvoiceItem[];
  subtotal: number; taxAmount: number; total: number;
  status: InvoiceStatus; dueDate: string | null; paidAt: string | null;
  createdAt: string; updatedAt: string;
}

export interface CreateInvoiceRequest {
  userId: string;
  items: { name: string; qty: number; unitPrice: number }[];
  taxAmount?: number; dueDate?: string;
}

// ── Transactions ──────────────────────────────────────────────────────────

export type TransactionType = 'PAYMENT' | 'REFUND' | 'PAYOUT' | 'TRANSFER' | 'TAX_DEDUCTION';
export const TRANSACTION_TYPES: TransactionType[] = ['PAYMENT', 'REFUND', 'PAYOUT', 'TRANSFER', 'TAX_DEDUCTION'];

export interface Transaction {
  id: string; paymentId: string; type: TransactionType;
  amount: number; currency: string;
  gatewayResponse: Record<string, unknown> | null;
  createdAt: string;
  relatedPaymentAmount: number | null;
}

// ── Refunds ───────────────────────────────────────────────────────────────

export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSED';
export const REFUND_STATUSES: RefundStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'PROCESSED'];

export interface Refund {
  id: string; paymentId: string; userId: string; userName: string | null;
  courseTitle: string | null;
  amount: number; reason: string; status: RefundStatus;
  requestedAt: string; processedAt: string | null; processedById: string | null;
}

// ── Instructor Payouts ───────────────────────────────────────────────────

export type PayoutStatus = 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'HELD';
export const PAYOUT_STATUSES: PayoutStatus[] = ['PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'FAILED', 'HELD'];

export interface InstructorPayout {
  id: string; instructorId: string; instructorName: string | null;
  amount: number; currency: string; status: PayoutStatus; revenueShareBps: number;
  periodStart: string; periodEnd: string;
  approvedById: string | null; approvedAt: string | null; completedAt: string | null;
  createdAt: string; updatedAt: string;
}

export interface CalculatePayoutsResult { created: number; payouts: InstructorPayout[] }

// ── Coupons ───────────────────────────────────────────────────────────────

export type CouponType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type CouponStatus = 'ACTIVE' | 'DISABLED' | 'EXPIRED';
export const COUPON_TYPES: CouponType[] = ['PERCENTAGE', 'FIXED_AMOUNT'];
export const COUPON_STATUSES: CouponStatus[] = ['ACTIVE', 'DISABLED', 'EXPIRED'];

export interface Coupon {
  id: string; code: string; type: CouponType; value: number;
  maxUses: number | null; usedCount: number; minPurchaseAmount: number | null;
  applicableCourseIds: string[]; expiresAt: string | null; status: CouponStatus;
  createdById: string; createdAt: string; updatedAt: string;
}

export interface CreateCouponRequest {
  code: string; type: CouponType; value: number;
  maxUses?: number; minPurchaseAmount?: number; applicableCourseIds?: string[]; expiresAt?: string;
}
// maxUses/minPurchaseAmount/expiresAt: omitted = leave unchanged, null =
// clear the field — matches backend finance.validator.js's tri-state
// handling (body.field === null ? null : parsed), not a plain Partial.
export type UpdateCouponRequest = Partial<Omit<CreateCouponRequest, 'code' | 'maxUses' | 'minPurchaseAmount' | 'expiresAt'>> & {
  maxUses?: number | null;
  minPurchaseAmount?: number | null;
  expiresAt?: string | null;
};

// ── Tax Rules ─────────────────────────────────────────────────────────────

export type TaxRuleType = 'VAT' | 'SALES_TAX' | 'DIGITAL_TAX';
export type TaxRuleStatus = 'ACTIVE' | 'INACTIVE';
export const TAX_RULE_TYPES: TaxRuleType[] = ['VAT', 'SALES_TAX', 'DIGITAL_TAX'];

export interface TaxRule {
  id: string; name: string; region: string; country: string; rate: number;
  type: TaxRuleType; status: TaxRuleStatus; createdAt: string; updatedAt: string;
}

export interface CreateTaxRuleRequest { name: string; region: string; country: string; rate: number; type: TaxRuleType }
export type UpdateTaxRuleRequest = Partial<CreateTaxRuleRequest> & { status?: TaxRuleStatus };

// ── Billing Settings ──────────────────────────────────────────────────────

export interface FinanceSettings {
  id: string; currency: string;
  paymentRetryRules: Record<string, unknown> | null;
  refundPolicy: string | null; autoBillingEnabled: boolean;
  updatedById: string | null; updatedAt: string;
}
export type UpdateFinanceSettingsRequest = Partial<Omit<FinanceSettings, 'id' | 'updatedById' | 'updatedAt'>>;

// ── Analytics ─────────────────────────────────────────────────────────────

export interface TrendSeries { available: boolean; labels: string[]; values: number[] }
export interface NamedValueList { available: boolean; items: { name: string; value: number }[] }
export interface TopCourseRevenue { available: boolean; items: { courseId: string; title: string | null; value: number }[] }
export interface PayoutSummary { available: boolean; items: { status: PayoutStatus; count: number; amount: number }[] }

export interface FinanceAnalytics {
  revenueTrend:          TrendSeries;
  revenueByCategory:     NamedValueList;
  subscriptionBreakdown: NamedValueList;
  refundTrend:           TrendSeries;
  topCoursesByRevenue:   TopCourseRevenue;
  payoutSummary:         PayoutSummary;
}

export type AnalyticsPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';
