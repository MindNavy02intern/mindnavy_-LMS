// Refund Management tab (?tab=refunds) — blueprint 09 §6.

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { listRefunds, approveRefund, rejectRefund } from '../../services/financeApi';
import { FinanceApiError, REFUND_STATUSES } from '../../types/finance';
import type { Refund, RefundStatus } from '../../types/finance';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { INPUT, FULL_INPUT, LABEL, ERR, Badge, TableShell, PaginationBar, Modal, ModalFooter, ErrorBanner, money, fmtDate } from './_shared';

const STATUS_COLORS: Record<RefundStatus, { bg: string; fg: string }> = {
  PENDING:   { bg: '#fef3c7', fg: '#b45309' },
  APPROVED:  { bg: '#dcfce7', fg: '#15803d' },
  REJECTED:  { bg: '#fee2e2', fg: '#b91c1c' },
  PROCESSED: { bg: '#dbeafe', fg: '#1d4ed8' },
};

interface Props { showToast: (type: 'success' | 'error', message: string) => void; refreshSignal: number }

function RejectModal({ refund, onClose, onSuccess, showToast }: { refund: Refund; onClose: () => void; onSuccess: () => void; showToast: Props['showToast'] }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) { setError('Reason is required.'); return; }
    setSubmitting(true);
    try {
      await rejectRefund(refund.id, reason.trim());
      invalidateFor(appQueryClient, 'refund.reject');
      showToast('success', 'Refund rejected.');
      onSuccess();
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Failed to reject refund.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Reject Refund" onClose={onClose} submitting={submitting} maxWidth={420}>
      <form onSubmit={handleSubmit} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={LABEL}>Reason for rejection</label>
          <textarea style={{ ...FULL_INPUT, minHeight: 80, resize: 'vertical' }} value={reason} onChange={e => setReason(e.target.value)} />
          {error && <div style={ERR}>{error}</div>}
        </div>
        <ModalFooter onCancel={onClose} submitting={submitting} submitLabel="Reject" />
      </form>
    </Modal>
  );
}

export default function RefundsTab({ showToast, refreshSignal }: Props) {
  const [items, setItems] = useState<Refund[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<RefundStatus | ''>('');
  const [rejectTarget, setRejectTarget] = useState<Refund | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchList = useCallback(() => {
    setLoading(true);
    setError(null);
    listRefunds({ page, limit, status: status || undefined })
      .then(res => { setItems(res.items); setTotal(res.total); })
      .catch(err => setError(err instanceof FinanceApiError ? err.message : 'Failed to load refunds.'))
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => { fetchList(); }, [fetchList, refreshSignal]);
  useEffect(() => { setPage(1); }, [status]);
  useEffect(() => {
    window.addEventListener('analyticsUpdated', fetchList);
    return () => window.removeEventListener('analyticsUpdated', fetchList);
  }, [fetchList]);

  async function handleApprove(r: Refund) {
    setBusyId(r.id);
    try {
      await approveRefund(r.id);
      invalidateFor(appQueryClient, 'refund.approve', { studentId: r.userId });
      showToast('success', 'Refund approved and processed.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Failed to approve refund.');
    } finally {
      setBusyId(null);
    }
  }

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 16, borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
        <select style={INPUT} value={status} onChange={e => setStatus(e.target.value as RefundStatus | '')}>
          <option value="">All statuses</option>
          {REFUND_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && <div style={{ margin: 16 }}><ErrorBanner message={error} onRetry={fetchList} /></div>}

      <TableShell
        colSpan={7} loading={loading} empty={items.length === 0}
        headers={[{ label: 'User' }, { label: 'Course' }, { label: 'Amount', align: 'right' }, { label: 'Reason' }, { label: 'Requested At' }, { label: 'Status', align: 'center' }, { label: 'Actions', align: 'right' }]}
      >
        {items.map(r => {
          const busy = busyId === r.id;
          return (
            <tr key={r.id} style={{ borderBottom: '1px solid #f8fafc', opacity: busy ? 0.5 : 1 }}>
              <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{r.userName ?? r.userId}</td>
              <td style={{ padding: '10px 12px', color: '#64748b' }}>{r.courseTitle ?? '—'}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{money(r.amount)}</td>
              <td style={{ padding: '10px 12px', color: '#64748b', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.reason}>{r.reason}</td>
              <td style={{ padding: '10px 12px', color: '#64748b' }}>{fmtDate(r.requestedAt)}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}><Badge text={r.status} colors={STATUS_COLORS[r.status]} /></td>
              <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                {r.status === 'PENDING' ? (
                  <>
                    <button type="button" title="Approve" disabled={busy} onClick={() => handleApprove(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', padding: 4 }}><CheckCircle2 size={14} /></button>
                    <button type="button" title="Reject" disabled={busy} onClick={() => setRejectTarget(r)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}><XCircle size={14} /></button>
                  </>
                ) : <span style={{ color: '#cbd5e1', fontSize: 12 }}>Decided</span>}
              </td>
            </tr>
          );
        })}
      </TableShell>

      <PaginationBar page={page} pages={pages} onPage={setPage} />

      {rejectTarget && <RejectModal refund={rejectTarget} onClose={() => setRejectTarget(null)} showToast={showToast} onSuccess={() => { setRejectTarget(null); fetchList(); }} />}
    </div>
  );
}
