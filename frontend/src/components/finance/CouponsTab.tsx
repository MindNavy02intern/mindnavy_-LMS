// Coupons & Discounts tab (?tab=coupons) — blueprint 09 §9.

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Ban, Trash2 } from 'lucide-react';
import { listCoupons, createCoupon, updateCoupon, disableCoupon, deleteCoupon } from '../../services/financeApi';
import { FinanceApiError, COUPON_TYPES, COUPON_STATUSES } from '../../types/finance';
import type { Coupon, CouponType, CouponStatus } from '../../types/finance';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { INPUT, FULL_INPUT, LABEL, ERR, BTN_PRIMARY, Badge, TableShell, PaginationBar, Modal, ModalFooter, ErrorBanner, money, fmtDate } from './_shared';

const STATUS_COLORS: Record<CouponStatus, { bg: string; fg: string }> = {
  ACTIVE:   { bg: '#dcfce7', fg: '#15803d' },
  DISABLED: { bg: '#f1f5f9', fg: '#64748b' },
  EXPIRED:  { bg: '#fee2e2', fg: '#b91c1c' },
};

interface Props { showToast: (type: 'success' | 'error', message: string) => void; refreshSignal: number; autoOpenCreate?: boolean; onAutoOpenHandled?: () => void }

function CouponModal({ coupon, onClose, onSuccess, showToast }: { coupon?: Coupon; onClose: () => void; onSuccess: () => void; showToast: Props['showToast'] }) {
  const mode = coupon ? 'edit' : 'create';
  const [code, setCode] = useState(coupon?.code ?? '');
  const [type, setType] = useState<CouponType>(coupon?.type ?? 'PERCENTAGE');
  const [value, setValue] = useState(String(coupon?.value ?? ''));
  const [maxUses, setMaxUses] = useState(coupon?.maxUses ? String(coupon.maxUses) : '');
  const [minPurchase, setMinPurchase] = useState(coupon?.minPurchaseAmount ? String(coupon.minPurchaseAmount) : '');
  const [expiresAt, setExpiresAt] = useState(coupon?.expiresAt ? coupon.expiresAt.slice(0, 10) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (mode === 'create' && code.trim().length < 3) next.code = 'Code must be at least 3 characters.';
    const val = Number(value);
    if (!Number.isFinite(val) || val <= 0) next.value = 'Enter a valid value.';
    else if (type === 'PERCENTAGE' && val > 100) next.value = 'Percentage cannot exceed 100.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      if (mode === 'create') {
        const created = await createCoupon({
          code: code.trim(), type, value: val,
          ...(maxUses ? { maxUses: Number(maxUses) } : {}),
          ...(minPurchase ? { minPurchaseAmount: Number(minPurchase) } : {}),
          ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
        });
        invalidateFor(appQueryClient, 'coupon.create', { id: created.id });
        showToast('success', `Coupon "${created.code}" created.`);
      } else if (coupon) {
        await updateCoupon(coupon.id, {
          type, value: val,
          maxUses: maxUses ? Number(maxUses) : null,
          minPurchaseAmount: minPurchase ? Number(minPurchase) : null,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        });
        invalidateFor(appQueryClient, 'coupon.update', { id: coupon.id });
        showToast('success', 'Coupon updated.');
      }
      onSuccess();
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Failed to save coupon.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={mode === 'create' ? 'Create Coupon' : `Edit ${coupon?.code}`} onClose={onClose} submitting={submitting}>
      <form onSubmit={handleSubmit} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {mode === 'create' && (
          <div>
            <label style={LABEL}>Code</label>
            <input style={FULL_INPUT} value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="SUMMER2026" />
            {errors.code && <div style={ERR}>{errors.code}</div>}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={LABEL}>Type</label>
            <select style={FULL_INPUT} value={type} onChange={e => setType(e.target.value as CouponType)}>
              {COUPON_TYPES.map(t => <option key={t} value={t}>{t === 'PERCENTAGE' ? 'Percentage' : 'Fixed Amount'}</option>)}
            </select>
          </div>
          <div>
            <label style={LABEL}>Value {type === 'PERCENTAGE' ? '(%)' : '($)'}</label>
            <input style={FULL_INPUT} type="number" min={0} step={0.01} value={value} onChange={e => setValue(e.target.value)} placeholder="e.g. 15" />
            {errors.value && <div style={ERR}>{errors.value}</div>}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={LABEL}>Max Uses (optional)</label><input style={FULL_INPUT} type="number" min={1} value={maxUses} onChange={e => setMaxUses(e.target.value)} /></div>
          <div><label style={LABEL}>Min Purchase (optional)</label><input style={FULL_INPUT} type="number" min={0} step={0.01} value={minPurchase} onChange={e => setMinPurchase(e.target.value)} /></div>
        </div>
        <div><label style={LABEL}>Expires (optional)</label><input style={FULL_INPUT} type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} /></div>
        <ModalFooter onCancel={onClose} submitting={submitting} submitLabel={mode === 'create' ? 'Create' : 'Save'} />
      </form>
    </Modal>
  );
}

export default function CouponsTab({ showToast, refreshSignal, autoOpenCreate, onAutoOpenHandled }: Props) {
  const [items, setItems] = useState<Coupon[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<CouponStatus | ''>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Coupon | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (autoOpenCreate) { setCreateOpen(true); onAutoOpenHandled?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenCreate]);

  const fetchList = useCallback(() => {
    setLoading(true);
    setError(null);
    listCoupons({ page, limit, status: status || undefined })
      .then(res => { setItems(res.items); setTotal(res.total); })
      .catch(err => setError(err instanceof FinanceApiError ? err.message : 'Failed to load coupons.'))
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => { fetchList(); }, [fetchList, refreshSignal]);
  useEffect(() => { setPage(1); }, [status]);
  useEffect(() => {
    window.addEventListener('analyticsUpdated', fetchList);
    return () => window.removeEventListener('analyticsUpdated', fetchList);
  }, [fetchList]);

  async function handleDisable(c: Coupon) {
    setBusyId(c.id);
    try {
      await disableCoupon(c.id);
      invalidateFor(appQueryClient, 'coupon.disable', { id: c.id });
      showToast('success', 'Coupon disabled.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Failed to disable coupon.');
    } finally { setBusyId(null); }
  }

  async function handleDelete(c: Coupon) {
    if (!window.confirm(`Delete coupon "${c.code}"?`)) return;
    setBusyId(c.id);
    try {
      await deleteCoupon(c.id);
      invalidateFor(appQueryClient, 'coupon.delete', { id: c.id });
      showToast('success', 'Coupon deleted.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Failed to delete coupon.');
    } finally { setBusyId(null); }
  }

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 16, borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
        <select style={INPUT} value={status} onChange={e => setStatus(e.target.value as CouponStatus | '')}>
          <option value="">All statuses</option>
          {COUPON_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="button" onClick={() => setCreateOpen(true)} style={{ ...BTN_PRIMARY, marginLeft: 'auto' }}>
          <Plus size={15} strokeWidth={2.5} /> Create Coupon
        </button>
      </div>

      {error && <div style={{ margin: 16 }}><ErrorBanner message={error} onRetry={fetchList} /></div>}

      <TableShell
        colSpan={6} loading={loading} empty={items.length === 0}
        headers={[{ label: 'Code' }, { label: 'Type', align: 'center' }, { label: 'Value', align: 'right' }, { label: 'Uses', align: 'center' }, { label: 'Expires' }, { label: 'Status / Actions', align: 'right' }]}
      >
        {items.map(c => {
          const busy = busyId === c.id;
          return (
            <tr key={c.id} style={{ borderBottom: '1px solid #f8fafc', opacity: busy ? 0.5 : 1 }}>
              <td style={{ padding: '10px 12px', fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{c.code}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{c.type === 'PERCENTAGE' ? 'Percentage' : 'Fixed'}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}>{c.type === 'PERCENTAGE' ? `${c.value}%` : money(c.value)}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{c.usedCount}{c.maxUses ? ` / ${c.maxUses}` : ''}</td>
              <td style={{ padding: '10px 12px', color: '#64748b' }}>{c.expiresAt ? fmtDate(c.expiresAt) : 'Never'}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <Badge text={c.status} colors={STATUS_COLORS[c.status]} />
                <button type="button" title="Edit" disabled={busy} onClick={() => setEditTarget(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4, marginLeft: 6 }}><Pencil size={14} /></button>
                <button type="button" title="Disable" disabled={busy || c.status === 'DISABLED'} onClick={() => handleDisable(c)} style={{ background: 'none', border: 'none', cursor: c.status === 'DISABLED' ? 'default' : 'pointer', color: c.status === 'DISABLED' ? '#cbd5e1' : '#b45309', padding: 4 }}><Ban size={14} /></button>
                <button type="button" title="Delete" disabled={busy} onClick={() => handleDelete(c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}><Trash2 size={14} /></button>
              </td>
            </tr>
          );
        })}
      </TableShell>

      <PaginationBar page={page} pages={pages} onPage={setPage} />

      {createOpen && <CouponModal onClose={() => setCreateOpen(false)} showToast={showToast} onSuccess={() => { setCreateOpen(false); fetchList(); }} />}
      {editTarget && <CouponModal coupon={editTarget} onClose={() => setEditTarget(null)} showToast={showToast} onSuccess={() => { setEditTarget(null); fetchList(); }} />}
    </div>
  );
}
