// Payments tab (?tab=payments) — blueprint 09 §2.

import { useCallback, useEffect, useState } from 'react';
import { Search, Download, Eye, RotateCcw } from 'lucide-react';
import { listPayments, exportPaymentsCsv, requestPaymentRefund } from '../../services/financeApi';
import { FinanceApiError, PAYMENT_STATUSES, PAYMENT_METHODS } from '../../types/finance';
import type { Payment, PaymentStatus } from '../../types/finance';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { INPUT, FULL_INPUT, LABEL, ERR, BTN_PRIMARY, Badge, TableShell, PaginationBar, Modal, ModalFooter, ErrorBanner, money, fmtDate } from './_shared';

const STATUS_COLORS: Record<PaymentStatus, { bg: string; fg: string }> = {
  SUCCESSFUL: { bg: '#dcfce7', fg: '#15803d' },
  PENDING:    { bg: '#fef3c7', fg: '#b45309' },
  FAILED:     { bg: '#fee2e2', fg: '#b91c1c' },
  REFUNDED:   { bg: '#dbeafe', fg: '#1d4ed8' },
  CANCELLED:  { bg: '#f1f5f9', fg: '#64748b' },
};

interface Props { showToast: (type: 'success' | 'error', message: string) => void; refreshSignal: number }

function RefundModal({ payment, onClose, onSuccess, showToast }: { payment: Payment; onClose: () => void; onSuccess: () => void; showToast: Props['showToast'] }) {
  const [amount, setAmount] = useState(String(payment.amount));
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) next.amount = 'Enter a valid amount.';
    else if (amt > payment.amount) next.amount = 'Cannot exceed the payment amount.';
    if (reason.trim().length < 3) next.reason = 'Reason is required.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await requestPaymentRefund(payment.id, { amount: amt, reason: reason.trim() });
      invalidateFor(appQueryClient, 'refund.request');
      showToast('success', 'Refund requested — review it on the Refunds tab.');
      onSuccess();
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Failed to request refund.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={`Refund payment — ${money(payment.amount, payment.currency)}`} onClose={onClose} submitting={submitting}>
      <form onSubmit={handleSubmit} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={LABEL}>Refund amount</label>
          <input style={FULL_INPUT} type="number" min={0.01} step={0.01} value={amount} onChange={e => setAmount(e.target.value)} />
          {errors.amount && <div style={ERR}>{errors.amount}</div>}
        </div>
        <div>
          <label style={LABEL}>Reason</label>
          <textarea style={{ ...FULL_INPUT, minHeight: 80, resize: 'vertical' }} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this being refunded?" />
          {errors.reason && <div style={ERR}>{errors.reason}</div>}
        </div>
        <ModalFooter onCancel={onClose} submitting={submitting} submitLabel="Request Refund" />
      </form>
    </Modal>
  );
}

function ViewModal({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const rows: [string, string][] = [
    ['Transaction ID', payment.id],
    ['User', payment.userName ?? payment.userId],
    ['Course', payment.courseTitle ?? '—'],
    ['Amount', money(payment.amount, payment.currency)],
    ['Method', payment.method],
    ['Status', payment.status],
    ['Date', new Date(payment.createdAt).toLocaleString()],
  ];
  return (
    <Modal title="Payment Details" onClose={onClose}>
      <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderBottom: '1px solid #f1f5f9', paddingBottom: 8 }}>
            <span style={{ color: '#64748b' }}>{k}</span>
            <span style={{ color: '#0f172a', fontWeight: 600, textAlign: 'right' }}>{v}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export default function PaymentsTab({ showToast, refreshSignal }: Props) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PaymentStatus | ''>('');
  const [method, setMethod] = useState<string>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);
  const [viewTarget, setViewTarget] = useState<Payment | null>(null);

  const fetchList = useCallback(() => {
    setLoading(true);
    setError(null);
    listPayments({ page, limit, search: search.trim() || undefined, status: status || undefined, method: method || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined })
      .then(res => { setPayments(res.items); setTotal(res.total); })
      .catch(err => setError(err instanceof FinanceApiError ? err.message : 'Failed to load payments.'))
      .finally(() => setLoading(false));
  }, [page, search, status, method, dateFrom, dateTo]);

  useEffect(() => { fetchList(); }, [fetchList, refreshSignal]);
  useEffect(() => { setPage(1); }, [search, status, method, dateFrom, dateTo]);
  useEffect(() => {
    window.addEventListener('analyticsUpdated', fetchList);
    return () => window.removeEventListener('analyticsUpdated', fetchList);
  }, [fetchList]);

  async function handleExport() {
    try {
      const csv = await exportPaymentsCsv({ search: search.trim() || undefined, status: status || undefined, method: method || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'payments.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Export failed.');
    }
  }

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 16, borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input style={{ ...INPUT, width: '100%', paddingLeft: 30, boxSizing: 'border-box' }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search user, course…" />
        </div>
        <select style={INPUT} value={status} onChange={e => setStatus(e.target.value as PaymentStatus | '')}>
          <option value="">All statuses</option>
          {PAYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={INPUT} value={method} onChange={e => setMethod(e.target.value)}>
          <option value="">All methods</option>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <input type="date" style={INPUT} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        <span style={{ color: '#9ca3af', fontSize: 12 }}>to</span>
        <input type="date" style={INPUT} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        <button type="button" onClick={handleExport} style={{ ...BTN_PRIMARY, marginLeft: 'auto' }}>
          <Download size={15} strokeWidth={2} /> Export CSV
        </button>
      </div>

      {error && <div style={{ margin: 16 }}><ErrorBanner message={error} onRetry={fetchList} /></div>}

      <TableShell
        colSpan={8} loading={loading} empty={payments.length === 0}
        headers={[
          { label: 'Transaction ID' }, { label: 'User' }, { label: 'Course' },
          { label: 'Amount', align: 'right' }, { label: 'Method', align: 'center' },
          { label: 'Status', align: 'center' }, { label: 'Date' }, { label: 'Actions', align: 'right' },
        ]}
      >
        {payments.map(p => (
          <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc' }}>
            <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 11.5, color: '#64748b' }}>{p.id.slice(0, 8)}…</td>
            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{p.userName ?? p.userId}</td>
            <td style={{ padding: '10px 12px', color: '#64748b' }}>{p.courseTitle ?? '—'}</td>
            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>{money(p.amount, p.currency)}</td>
            <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{p.method}</td>
            <td style={{ padding: '10px 12px', textAlign: 'center' }}><Badge text={p.status} colors={STATUS_COLORS[p.status]} /></td>
            <td style={{ padding: '10px 12px', color: '#64748b' }}>{fmtDate(p.createdAt)}</td>
            <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
              <button type="button" title="View" onClick={() => setViewTarget(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}><Eye size={14} /></button>
              {p.status === 'SUCCESSFUL' && (
                <button type="button" title="Refund" onClick={() => setRefundTarget(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}><RotateCcw size={14} /></button>
              )}
            </td>
          </tr>
        ))}
      </TableShell>

      <PaginationBar page={page} pages={pages} onPage={setPage} />

      {viewTarget && <ViewModal payment={viewTarget} onClose={() => setViewTarget(null)} />}
      {refundTarget && (
        <RefundModal payment={refundTarget} onClose={() => setRefundTarget(null)} showToast={showToast}
          onSuccess={() => { setRefundTarget(null); fetchList(); }} />
      )}
    </div>
  );
}
