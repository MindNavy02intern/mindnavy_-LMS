// Finance API — per FINANCE_CONTRACT.md. Real backend only (no mock flag —
// same convention as competenciesApi.ts).

import { getStoredToken } from '../api/adminAuth';
import {
  FinanceApiError,
  type CalculatePayoutsResult,
  type Coupon,
  type CreateCouponRequest,
  type CreateInvoiceRequest,
  type CreateSubscriptionRequest,
  type CreateTaxRuleRequest,
  type FinanceAnalytics,
  type FinanceSettings,
  type FinanceStats,
  type Invoice,
  type InstructorPayout,
  type PageResult,
  type Payment,
  type Refund,
  type Subscription,
  type TaxRule,
  type Transaction,
  type UpdateCouponRequest,
  type UpdateFinanceSettingsRequest,
  type UpdateSubscriptionRequest,
  type UpdateTaxRuleRequest,
} from '../types/finance';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

async function financeFetch<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new FinanceApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body (e.g. CSV export) */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 429 ? 'Rate limited — slow down and retry.' :
      res.status === 503 ? 'Database not migrated yet. Run `npx prisma db push`.' :
      res.status === 500 ? 'Something went wrong on the server.' :
      json.message ?? (res.status === 404 ? 'Not found.' : `HTTP ${res.status}`);
    throw new FinanceApiError(res.status, msg, json.data as unknown as Record<string, unknown> | undefined);
  }

  return json.data as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export function getFinanceStats(): Promise<FinanceStats> {
  return financeFetch<FinanceStats>('/finance/stats');
}

export function getFinanceAnalytics(period?: string): Promise<FinanceAnalytics> {
  return financeFetch<FinanceAnalytics>(`/finance/analytics${qs({ period })}`);
}

// ── Payments ──────────────────────────────────────────────────────────────

export interface PaymentListParams {
  status?: string; method?: string; page?: number; limit?: number;
  search?: string; dateFrom?: string; dateTo?: string;
}

export function listPayments(params: PaymentListParams = {}): Promise<PageResult<Payment>> {
  return financeFetch<PageResult<Payment>>(`/finance/payments${qs(params)}`);
}

export function getPayment(id: string): Promise<Payment> {
  return financeFetch<Payment>(`/finance/payments/${encodeURIComponent(id)}`);
}

export function requestPaymentRefund(id: string, body: { amount: number; reason: string }): Promise<Refund> {
  return financeFetch<Refund>(`/finance/payments/${encodeURIComponent(id)}/refund`, 'PATCH', body);
}

export async function exportPaymentsCsv(params: PaymentListParams = {}): Promise<string> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}/finance/payments/export${qs(params)}`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new FinanceApiError(res.status, 'Failed to export payments.');
  return res.text();
}

// ── Subscriptions ─────────────────────────────────────────────────────────

export interface SubscriptionListParams { status?: string; planType?: string; page?: number; limit?: number }

export function listSubscriptions(params: SubscriptionListParams = {}): Promise<PageResult<Subscription>> {
  return financeFetch<PageResult<Subscription>>(`/finance/subscriptions${qs(params)}`);
}

export function createSubscription(body: CreateSubscriptionRequest): Promise<Subscription> {
  return financeFetch<Subscription>('/finance/subscriptions', 'POST', body);
}

export function updateSubscription(id: string, body: UpdateSubscriptionRequest): Promise<Subscription> {
  return financeFetch<Subscription>(`/finance/subscriptions/${encodeURIComponent(id)}`, 'PATCH', body);
}

export function cancelSubscription(id: string): Promise<Subscription> {
  return financeFetch<Subscription>(`/finance/subscriptions/${encodeURIComponent(id)}/cancel`, 'PATCH');
}

export function extendSubscription(id: string, renewalDate: string): Promise<Subscription> {
  return financeFetch<Subscription>(`/finance/subscriptions/${encodeURIComponent(id)}/extend`, 'PATCH', { renewalDate });
}

// ── Invoices ──────────────────────────────────────────────────────────────

export interface InvoiceListParams { status?: string; page?: number; limit?: number }

export function listInvoices(params: InvoiceListParams = {}): Promise<PageResult<Invoice>> {
  return financeFetch<PageResult<Invoice>>(`/finance/invoices${qs(params)}`);
}

export function getInvoice(id: string): Promise<Invoice> {
  return financeFetch<Invoice>(`/finance/invoices/${encodeURIComponent(id)}`);
}

export function createInvoice(body: CreateInvoiceRequest): Promise<Invoice> {
  return financeFetch<Invoice>('/finance/invoices', 'POST', body);
}

export function updateInvoice(id: string, body: Partial<CreateInvoiceRequest> & { status?: string }): Promise<Invoice> {
  return financeFetch<Invoice>(`/finance/invoices/${encodeURIComponent(id)}`, 'PATCH', body);
}

export function voidInvoice(id: string): Promise<Invoice> {
  return financeFetch<Invoice>(`/finance/invoices/${encodeURIComponent(id)}/void`, 'PATCH');
}

export function sendInvoice(id: string): Promise<Invoice> {
  return financeFetch<Invoice>(`/finance/invoices/${encodeURIComponent(id)}/send`, 'PATCH');
}

// Blob + Bearer fetch — a plain <a href> would never carry the auth token.
// Same pattern as certificatesApi.ts's downloadCertificatePdf.
export async function downloadInvoicePdf(id: string): Promise<Blob> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}/finance/invoices/${encodeURIComponent(id)}/download`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  const contentType = res.headers.get('content-type') ?? '';

  if (!res.ok || !contentType.includes('application/pdf')) {
    let message = res.status === 401 ? 'Unauthorized — please log in again.' : `HTTP ${res.status}`;
    if (contentType.includes('application/json')) {
      try {
        const json = await res.json() as { message?: string };
        if (json.message) message = json.message;
      } catch { /* non-JSON despite the header */ }
    }
    throw new FinanceApiError(res.status, message);
  }

  return res.blob();
}

export function triggerPdfDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Transactions ──────────────────────────────────────────────────────────

export interface TransactionListParams { type?: string; page?: number; limit?: number; dateFrom?: string; dateTo?: string }

export function listTransactions(params: TransactionListParams = {}): Promise<PageResult<Transaction>> {
  return financeFetch<PageResult<Transaction>>(`/finance/transactions${qs(params)}`);
}

// ── Refunds ───────────────────────────────────────────────────────────────

export interface RefundListParams { status?: string; page?: number; limit?: number }

export function listRefunds(params: RefundListParams = {}): Promise<PageResult<Refund>> {
  return financeFetch<PageResult<Refund>>(`/finance/refunds${qs(params)}`);
}

export function approveRefund(id: string): Promise<Refund> {
  return financeFetch<Refund>(`/finance/refunds/${encodeURIComponent(id)}/approve`, 'PATCH');
}

export function rejectRefund(id: string, reason: string): Promise<Refund> {
  return financeFetch<Refund>(`/finance/refunds/${encodeURIComponent(id)}/reject`, 'PATCH', { reason });
}

// ── Instructor Payouts ────────────────────────────────────────────────────

export interface PayoutListParams { status?: string; page?: number; limit?: number }

export function listPayouts(params: PayoutListParams = {}): Promise<PageResult<InstructorPayout>> {
  return financeFetch<PageResult<InstructorPayout>>(`/finance/payouts${qs(params)}`);
}

export function calculatePayouts(periodStart: string, periodEnd: string): Promise<CalculatePayoutsResult> {
  return financeFetch<CalculatePayoutsResult>('/finance/payouts/calculate', 'POST', { periodStart, periodEnd });
}

export function approvePayout(id: string): Promise<InstructorPayout> {
  return financeFetch<InstructorPayout>(`/finance/payouts/${encodeURIComponent(id)}/approve`, 'PATCH');
}

export function holdPayout(id: string): Promise<InstructorPayout> {
  return financeFetch<InstructorPayout>(`/finance/payouts/${encodeURIComponent(id)}/hold`, 'PATCH');
}

export function completePayout(id: string): Promise<InstructorPayout> {
  return financeFetch<InstructorPayout>(`/finance/payouts/${encodeURIComponent(id)}/complete`, 'PATCH');
}

// ── Coupons ───────────────────────────────────────────────────────────────

export interface CouponListParams { status?: string; page?: number; limit?: number }

export function listCoupons(params: CouponListParams = {}): Promise<PageResult<Coupon>> {
  return financeFetch<PageResult<Coupon>>(`/finance/coupons${qs(params)}`);
}

export function createCoupon(body: CreateCouponRequest): Promise<Coupon> {
  return financeFetch<Coupon>('/finance/coupons', 'POST', body);
}

export function updateCoupon(id: string, body: UpdateCouponRequest): Promise<Coupon> {
  return financeFetch<Coupon>(`/finance/coupons/${encodeURIComponent(id)}`, 'PATCH', body);
}

export function disableCoupon(id: string): Promise<Coupon> {
  return financeFetch<Coupon>(`/finance/coupons/${encodeURIComponent(id)}/disable`, 'PATCH');
}

export function deleteCoupon(id: string): Promise<{ id: string }> {
  return financeFetch<{ id: string }>(`/finance/coupons/${encodeURIComponent(id)}`, 'DELETE');
}

// ── Tax Rules ─────────────────────────────────────────────────────────────

export function listTaxRules(): Promise<TaxRule[]> {
  return financeFetch<TaxRule[]>('/finance/tax-rules');
}

export function createTaxRule(body: CreateTaxRuleRequest): Promise<TaxRule> {
  return financeFetch<TaxRule>('/finance/tax-rules', 'POST', body);
}

export function updateTaxRule(id: string, body: UpdateTaxRuleRequest): Promise<TaxRule> {
  return financeFetch<TaxRule>(`/finance/tax-rules/${encodeURIComponent(id)}`, 'PATCH', body);
}

export function deleteTaxRule(id: string): Promise<{ id: string }> {
  return financeFetch<{ id: string }>(`/finance/tax-rules/${encodeURIComponent(id)}`, 'DELETE');
}

// ── Billing Settings ──────────────────────────────────────────────────────

export function getFinanceSettings(): Promise<FinanceSettings> {
  return financeFetch<FinanceSettings>('/finance/settings');
}

export function updateFinanceSettings(body: UpdateFinanceSettingsRequest): Promise<FinanceSettings> {
  return financeFetch<FinanceSettings>('/finance/settings', 'PATCH', body);
}
