// Instructor Payouts tab (?tab=payouts) — blueprint 09 §7.

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, PauseCircle, Banknote, Calculator } from 'lucide-react';
import { listPayouts, calculatePayouts, approvePayout, holdPayout, completePayout } from '../../services/financeApi';
import { FinanceApiError, PAYOUT_STATUSES } from '../../types/finance';
import type { InstructorPayout, PayoutStatus } from '../../types/finance';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { INPUT, FULL_INPUT, LABEL, ERR, BTN_PRIMARY, Badge, TableShell, PaginationBar, Modal, ModalFooter, ErrorBanner, money, fmtDate } from './_shared';

const STATUS_COLORS: Record<PayoutStatus, { bg: string; fg: string }> = {
  PENDING:    { bg: '#fef3c7', fg: '#b45309' },
  APPROVED:   { bg: '#dbeafe', fg: '#1d4ed8' },
  PROCESSING: { bg: '#eef2ff', fg: '#4338ca' },
  COMPLETED:  { bg: '#dcfce7', fg: '#15803d' },
  FAILED:     { bg: '#fee2e2', fg: '#b91c1c' },
  HELD:       { bg: '#f1f5f9', fg: '#64748b' },
};

interface Props { showToast: (type: 'success' | 'error', message: string) => void; refreshSignal: number; autoOpenCalculate?: boolean; onAutoOpenHandled?: () => void }

function CalculateModal({ onClose, onSuccess, showToast }: { onClose: () => void; onSuccess: () => void; showToast: Props['showToast'] }) {
  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 10);
  const defaultEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0)).toISOString().slice(0, 10);
  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!periodStart || !periodEnd || periodStart >= periodEnd) { setError('Pick a valid start/end range.'); return; }
    setSubmitting(true);
    try {
      const res = await calculatePayouts(new Date(periodStart).toISOString(), new Date(periodEnd).toISOString());
      invalidateFor(appQueryClient, 'payout.calculate');
      showToast('success', `${res.created} payout(s) calculated.`);
      onSuccess();
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Failed to calculate payouts.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Calculate Payouts" onClose={onClose} submitting={submitting} maxWidth={420}>
      <form onSubmit={handleSubmit} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12.5, color: '#64748b' }}>Computes each instructor's pending payout from successful payments on their courses in this period, using their revenue share.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={LABEL}>Period Start</label><input style={FULL_INPUT} type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} /></div>
          <div><label style={LABEL}>Period End</label><input style={FULL_INPUT} type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} /></div>
        </div>
        {error && <div style={ERR}>{error}</div>}
        <ModalFooter onCancel={onClose} submitting={submitting} submitLabel="Calculate" />
      </form>
    </Modal>
  );
}

export default function PayoutsTab({ showToast, refreshSignal, autoOpenCalculate, onAutoOpenHandled }: Props) {
  const [items, setItems] = useState<InstructorPayout[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<PayoutStatus | ''>('');
  const [calcOpen, setCalcOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (autoOpenCalculate) { setCalcOpen(true); onAutoOpenHandled?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenCalculate]);

  const fetchList = useCallback(() => {
    setLoading(true);
    setError(null);
    listPayouts({ page, limit, status: status || undefined })
      .then(res => { setItems(res.items); setTotal(res.total); })
      .catch(err => setError(err instanceof FinanceApiError ? err.message : 'Failed to load payouts.'))
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => { fetchList(); }, [fetchList, refreshSignal]);
  useEffect(() => { setPage(1); }, [status]);
  useEffect(() => {
    window.addEventListener('analyticsUpdated', fetchList);
    return () => window.removeEventListener('analyticsUpdated', fetchList);
  }, [fetchList]);

  async function runAction(action: (id: string) => Promise<unknown>, p: InstructorPayout, mutation: 'payout.approve' | 'payout.hold' | 'payout.complete', successMsg: string) {
    setBusyId(p.id);
    try {
      await action(p.id);
      invalidateFor(appQueryClient, mutation, { id: p.instructorId });
      showToast('success', successMsg);
      fetchList();
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  }

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 16, borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
        <select style={INPUT} value={status} onChange={e => setStatus(e.target.value as PayoutStatus | '')}>
          <option value="">All statuses</option>
          {PAYOUT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="button" onClick={() => setCalcOpen(true)} style={{ ...BTN_PRIMARY, marginLeft: 'auto' }}>
          <Calculator size={15} strokeWidth={2} /> Calculate Payouts
        </button>
      </div>

      {error && <div style={{ margin: 16 }}><ErrorBanner message={error} onRetry={fetchList} /></div>}

      <TableShell
        colSpan={6} loading={loading} empty={items.length === 0}
        headers={[{ label: 'Instructor' }, { label: 'Amount', align: 'right' }, { label: 'Period' }, { label: 'Revenue Share', align: 'center' }, { label: 'Status', align: 'center' }, { label: 'Actions', align: 'right' }]}
      >
        {items.map(p => {
          const busy = busyId === p.id;
          return (
            <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc', opacity: busy ? 0.5 : 1 }}>
              <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{p.instructorName ?? p.instructorId}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{money(p.amount, p.currency)}</td>
              <td style={{ padding: '10px 12px', color: '#64748b' }}>{fmtDate(p.periodStart)} – {fmtDate(p.periodEnd)}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{(p.revenueShareBps / 100).toFixed(2)}%</td>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}><Badge text={p.status} colors={STATUS_COLORS[p.status]} /></td>
              <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button type="button" title="Approve" disabled={busy || p.status !== 'PENDING'} onClick={() => runAction(approvePayout, p, 'payout.approve', 'Payout approved.')} style={{ background: 'none', border: 'none', cursor: p.status !== 'PENDING' ? 'default' : 'pointer', color: p.status !== 'PENDING' ? '#cbd5e1' : '#16a34a', padding: 4 }}><CheckCircle2 size={14} /></button>
                <button type="button" title="Hold" disabled={busy || p.status === 'COMPLETED'} onClick={() => runAction(holdPayout, p, 'payout.hold', 'Payout held.')} style={{ background: 'none', border: 'none', cursor: p.status === 'COMPLETED' ? 'default' : 'pointer', color: p.status === 'COMPLETED' ? '#cbd5e1' : '#b45309', padding: 4 }}><PauseCircle size={14} /></button>
                <button type="button" title="Complete" disabled={busy || p.status !== 'APPROVED'} onClick={() => runAction(completePayout, p, 'payout.complete', 'Payout completed.')} style={{ background: 'none', border: 'none', cursor: p.status !== 'APPROVED' ? 'default' : 'pointer', color: p.status !== 'APPROVED' ? '#cbd5e1' : '#2563eb', padding: 4 }}><Banknote size={14} /></button>
              </td>
            </tr>
          );
        })}
      </TableShell>

      <PaginationBar page={page} pages={pages} onPage={setPage} />

      {calcOpen && <CalculateModal onClose={() => setCalcOpen(false)} showToast={showToast} onSuccess={() => { setCalcOpen(false); fetchList(); }} />}
    </div>
  );
}
