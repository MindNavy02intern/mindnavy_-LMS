// Subscriptions tab (?tab=subscriptions) — blueprint 09 §3. No separate Plan
// model exists (see FINANCE_CONTRACT.md) — Create/Edit write the Subscription
// row directly; "Upgrade" reuses the Edit modal (change planType/amount),
// same call as Edit rather than a separate unbuilt endpoint.

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, XCircle, CalendarClock, ArrowUpCircle } from 'lucide-react';
import {
  listSubscriptions, createSubscription, updateSubscription, cancelSubscription, extendSubscription,
} from '../../services/financeApi';
import {
  FinanceApiError, SUBSCRIPTION_PLAN_TYPES, SUBSCRIPTION_STATUSES, BILLING_CYCLES,
} from '../../types/finance';
import type { Subscription, SubscriptionStatus, SubscriptionPlanType, BillingCycle } from '../../types/finance';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import {
  INPUT, FULL_INPUT, LABEL, ERR, BTN_PRIMARY, Badge, TableShell, PaginationBar,
  Modal, ModalFooter, ErrorBanner, UserPicker, money, fmtDate,
} from './_shared';

const STATUS_COLORS: Record<SubscriptionStatus, { bg: string; fg: string }> = {
  ACTIVE:    { bg: '#dcfce7', fg: '#15803d' },
  CANCELLED: { bg: '#f1f5f9', fg: '#64748b' },
  EXPIRED:   { bg: '#fee2e2', fg: '#b91c1c' },
  PAUSED:    { bg: '#fef3c7', fg: '#b45309' },
};

interface Props { showToast: (type: 'success' | 'error', message: string) => void; refreshSignal: number }

function EditCreateModal({ mode, subscription, onClose, onSuccess, showToast }: {
  mode: 'create' | 'edit'; subscription?: Subscription; onClose: () => void; onSuccess: () => void; showToast: Props['showToast'];
}) {
  const [user, setUser] = useState<{ id: string; label: string } | null>(subscription ? { id: subscription.userId, label: `${subscription.userName ?? subscription.userId}` } : null);
  const [planType, setPlanType] = useState<SubscriptionPlanType>(subscription?.planType ?? 'MONTHLY');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(subscription?.billingCycle ?? 'MONTHLY');
  const [amount, setAmount] = useState(String(subscription?.amount ?? ''));
  const [currency, setCurrency] = useState(subscription?.currency ?? 'USD');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (mode === 'create' && !user) next.user = 'Select a user.';
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt < 0) next.amount = 'Enter a valid amount.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      if (mode === 'create' && user) {
        const created = await createSubscription({ userId: user.id, planType, billingCycle, amount: amt, currency });
        invalidateFor(appQueryClient, 'subscription.create', { id: created.id, studentId: user.id });
        showToast('success', 'Subscription created.');
      } else if (subscription) {
        await updateSubscription(subscription.id, { planType, billingCycle, amount: amt, currency });
        invalidateFor(appQueryClient, 'subscription.update', { id: subscription.id, studentId: subscription.userId });
        showToast('success', 'Subscription updated.');
      }
      onSuccess();
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Failed to save subscription.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={mode === 'create' ? 'Create Subscription' : `Edit Subscription`} onClose={onClose} submitting={submitting}>
      <form onSubmit={handleSubmit} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {mode === 'create' ? (
          <div>
            <UserPicker value={user} onChange={setUser} />
            {errors.user && <div style={ERR}>{errors.user}</div>}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#64748b' }}>Subscriber: <strong style={{ color: '#0f172a' }}>{subscription?.userName ?? subscription?.userId}</strong></div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={LABEL}>Plan Type</label>
            <select style={FULL_INPUT} value={planType} onChange={e => setPlanType(e.target.value as SubscriptionPlanType)}>
              {SUBSCRIPTION_PLAN_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={LABEL}>Billing Cycle</label>
            <select style={FULL_INPUT} value={billingCycle} onChange={e => setBillingCycle(e.target.value as BillingCycle)}>
              {BILLING_CYCLES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
          <div>
            <label style={LABEL}>Amount</label>
            <input style={FULL_INPUT} type="number" min={0} step={0.01} value={amount} onChange={e => setAmount(e.target.value)} />
            {errors.amount && <div style={ERR}>{errors.amount}</div>}
          </div>
          <div>
            <label style={LABEL}>Currency</label>
            <input style={FULL_INPUT} value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
          </div>
        </div>
        <ModalFooter onCancel={onClose} submitting={submitting} submitLabel={mode === 'create' ? 'Create' : 'Save'} />
      </form>
    </Modal>
  );
}

function ExtendModal({ subscription, onClose, onSuccess, showToast }: { subscription: Subscription; onClose: () => void; onSuccess: () => void; showToast: Props['showToast'] }) {
  const [renewalDate, setRenewalDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!renewalDate) { setError('Pick a new renewal date.'); return; }
    setSubmitting(true);
    try {
      await extendSubscription(subscription.id, new Date(renewalDate).toISOString());
      invalidateFor(appQueryClient, 'subscription.extend', { id: subscription.id, studentId: subscription.userId });
      showToast('success', 'Subscription extended.');
      onSuccess();
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Failed to extend subscription.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Extend Subscription" onClose={onClose} submitting={submitting} maxWidth={380}>
      <form onSubmit={handleSubmit} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={LABEL}>New renewal date</label>
          <input style={FULL_INPUT} type="date" value={renewalDate} onChange={e => setRenewalDate(e.target.value)} />
          {error && <div style={ERR}>{error}</div>}
        </div>
        <ModalFooter onCancel={onClose} submitting={submitting} submitLabel="Extend" />
      </form>
    </Modal>
  );
}

export default function SubscriptionsTab({ showToast, refreshSignal }: Props) {
  const [items, setItems] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 10;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus | ''>('');
  const [planType, setPlanType] = useState<SubscriptionPlanType | ''>('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Subscription | null>(null);
  const [extendTarget, setExtendTarget] = useState<Subscription | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchList = useCallback(() => {
    setLoading(true);
    setError(null);
    listSubscriptions({ page, limit, status: status || undefined, planType: planType || undefined })
      .then(res => { setItems(res.items); setTotal(res.total); })
      .catch(err => setError(err instanceof FinanceApiError ? err.message : 'Failed to load subscriptions.'))
      .finally(() => setLoading(false));
  }, [page, status, planType]);

  useEffect(() => { fetchList(); }, [fetchList, refreshSignal]);
  useEffect(() => { setPage(1); }, [status, planType]);
  useEffect(() => {
    window.addEventListener('financeUpdated', fetchList);
    return () => window.removeEventListener('financeUpdated', fetchList);
  }, [fetchList]);

  async function handleCancel(s: Subscription) {
    if (!window.confirm(`Cancel ${s.userName ?? 'this'} subscription?`)) return;
    setBusyId(s.id);
    try {
      await cancelSubscription(s.id);
      invalidateFor(appQueryClient, 'subscription.cancel', { studentId: s.userId });
      showToast('success', 'Subscription cancelled.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Failed to cancel.');
    } finally {
      setBusyId(null);
    }
  }

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 16, borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
        <select style={INPUT} value={status} onChange={e => setStatus(e.target.value as SubscriptionStatus | '')}>
          <option value="">All statuses</option>
          {SUBSCRIPTION_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={INPUT} value={planType} onChange={e => setPlanType(e.target.value as SubscriptionPlanType | '')}>
          <option value="">All plans</option>
          {SUBSCRIPTION_PLAN_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button type="button" onClick={() => setCreateOpen(true)} style={{ ...BTN_PRIMARY, marginLeft: 'auto' }}>
          <Plus size={15} strokeWidth={2.5} /> Create Subscription
        </button>
      </div>

      {error && <div style={{ margin: 16 }}><ErrorBanner message={error} onRetry={fetchList} /></div>}

      <TableShell
        colSpan={7} loading={loading} empty={items.length === 0}
        headers={[{ label: 'Subscriber' }, { label: 'Plan' }, { label: 'Billing Cycle', align: 'center' }, { label: 'Start' }, { label: 'Renewal' }, { label: 'Status', align: 'center' }, { label: 'Actions', align: 'right' }]}
      >
        {items.map(s => {
          const busy = busyId === s.id;
          return (
            <tr key={s.id} style={{ borderBottom: '1px solid #f8fafc', opacity: busy ? 0.5 : 1 }}>
              <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{s.userName ?? s.userId}</td>
              <td style={{ padding: '10px 12px', color: '#64748b' }}>{s.planType} · {money(s.amount, s.currency)}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{s.billingCycle}</td>
              <td style={{ padding: '10px 12px', color: '#64748b' }}>{fmtDate(s.startDate)}</td>
              <td style={{ padding: '10px 12px', color: '#64748b' }}>{fmtDate(s.renewalDate)}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center' }}><Badge text={s.status} colors={STATUS_COLORS[s.status]} /></td>
              <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button type="button" title="Edit" disabled={busy} onClick={() => setEditTarget(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}><Pencil size={14} /></button>
                <button type="button" title="Upgrade" disabled={busy} onClick={() => setEditTarget(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}><ArrowUpCircle size={14} /></button>
                <button type="button" title="Extend" disabled={busy || s.status === 'CANCELLED'} onClick={() => setExtendTarget(s)} style={{ background: 'none', border: 'none', cursor: s.status === 'CANCELLED' ? 'default' : 'pointer', color: s.status === 'CANCELLED' ? '#cbd5e1' : '#64748b', padding: 4 }}><CalendarClock size={14} /></button>
                <button type="button" title="Cancel" disabled={busy || s.status === 'CANCELLED'} onClick={() => handleCancel(s)} style={{ background: 'none', border: 'none', cursor: s.status === 'CANCELLED' ? 'default' : 'pointer', color: s.status === 'CANCELLED' ? '#cbd5e1' : '#dc2626', padding: 4 }}><XCircle size={14} /></button>
              </td>
            </tr>
          );
        })}
      </TableShell>

      <PaginationBar page={page} pages={pages} onPage={setPage} />

      {createOpen && <EditCreateModal mode="create" onClose={() => setCreateOpen(false)} showToast={showToast} onSuccess={() => { setCreateOpen(false); fetchList(); }} />}
      {editTarget && <EditCreateModal mode="edit" subscription={editTarget} onClose={() => setEditTarget(null)} showToast={showToast} onSuccess={() => { setEditTarget(null); fetchList(); }} />}
      {extendTarget && <ExtendModal subscription={extendTarget} onClose={() => setExtendTarget(null)} showToast={showToast} onSuccess={() => { setExtendTarget(null); fetchList(); }} />}
    </div>
  );
}
