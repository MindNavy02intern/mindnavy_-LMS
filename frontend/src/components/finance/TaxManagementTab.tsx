// Tax Management tab (?tab=tax) — blueprint 09 §10. No pagination — tax
// rules are few by nature (GET /finance/tax-rules returns the full list).

import { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { listTaxRules, createTaxRule, updateTaxRule, deleteTaxRule } from '../../services/financeApi';
import { FinanceApiError, TAX_RULE_TYPES } from '../../types/finance';
import type { TaxRule, TaxRuleType, TaxRuleStatus } from '../../types/finance';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { FULL_INPUT, LABEL, ERR, BTN_PRIMARY, Badge, TableShell, Modal, ModalFooter, ErrorBanner } from './_shared';

const STATUS_COLORS: Record<TaxRuleStatus, { bg: string; fg: string }> = {
  ACTIVE:   { bg: '#dcfce7', fg: '#15803d' },
  INACTIVE: { bg: '#f1f5f9', fg: '#64748b' },
};

interface Props { showToast: (type: 'success' | 'error', message: string) => void; refreshSignal: number; autoOpenCreate?: boolean; onAutoOpenHandled?: () => void }

function TaxRuleModal({ rule, onClose, onSuccess, showToast }: { rule?: TaxRule; onClose: () => void; onSuccess: () => void; showToast: Props['showToast'] }) {
  const mode = rule ? 'edit' : 'create';
  const [name, setName] = useState(rule?.name ?? '');
  const [region, setRegion] = useState(rule?.region ?? '');
  const [country, setCountry] = useState(rule?.country ?? '');
  const [rate, setRate] = useState(String(rule?.rate ?? ''));
  const [type, setType] = useState<TaxRuleType>(rule?.type ?? 'VAT');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Name is required.';
    if (region.trim().length < 2) next.region = 'Region is required.';
    if (country.trim().length < 2) next.country = 'Country is required.';
    const r = Number(rate);
    if (!Number.isFinite(r) || r < 0 || r > 100) next.rate = 'Rate must be between 0 and 100.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      if (mode === 'create') {
        const created = await createTaxRule({ name: name.trim(), region: region.trim(), country: country.trim(), rate: r, type });
        invalidateFor(appQueryClient, 'tax.configure');
        showToast('success', `Tax rule "${created.name}" created.`);
      } else if (rule) {
        await updateTaxRule(rule.id, { name: name.trim(), region: region.trim(), country: country.trim(), rate: r, type });
        invalidateFor(appQueryClient, 'tax.configure');
        showToast('success', 'Tax rule updated.');
      }
      onSuccess();
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Failed to save tax rule.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title={mode === 'create' ? 'Add Tax Rule' : `Edit ${rule?.name}`} onClose={onClose} submitting={submitting}>
      <form onSubmit={handleSubmit} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><label style={LABEL}>Name</label><input style={FULL_INPUT} value={name} onChange={e => setName(e.target.value)} placeholder="EU VAT" />{errors.name && <div style={ERR}>{errors.name}</div>}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={LABEL}>Region</label><input style={FULL_INPUT} value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. European Union" />{errors.region && <div style={ERR}>{errors.region}</div>}</div>
          <div><label style={LABEL}>Country</label><input style={FULL_INPUT} value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. Germany" />{errors.country && <div style={ERR}>{errors.country}</div>}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={LABEL}>Rate (%)</label><input style={FULL_INPUT} type="number" min={0} max={100} step={0.01} value={rate} onChange={e => setRate(e.target.value)} placeholder="e.g. 19" />{errors.rate && <div style={ERR}>{errors.rate}</div>}</div>
          <div>
            <label style={LABEL}>Type</label>
            <select style={FULL_INPUT} value={type} onChange={e => setType(e.target.value as TaxRuleType)}>
              {TAX_RULE_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>
        <ModalFooter onCancel={onClose} submitting={submitting} submitLabel={mode === 'create' ? 'Create' : 'Save'} />
      </form>
    </Modal>
  );
}

export default function TaxManagementTab({ showToast, refreshSignal, autoOpenCreate, onAutoOpenHandled }: Props) {
  const [items, setItems] = useState<TaxRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TaxRule | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (autoOpenCreate) { setCreateOpen(true); onAutoOpenHandled?.(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenCreate]);

  const fetchList = useCallback(() => {
    setLoading(true);
    setError(null);
    listTaxRules()
      .then(setItems)
      .catch(err => setError(err instanceof FinanceApiError ? err.message : 'Failed to load tax rules.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchList(); }, [fetchList, refreshSignal]);
  useEffect(() => {
    window.addEventListener('financeUpdated', fetchList);
    return () => window.removeEventListener('financeUpdated', fetchList);
  }, [fetchList]);

  async function handleDelete(rule: TaxRule) {
    if (!window.confirm(`Delete tax rule "${rule.name}"?`)) return;
    setBusyId(rule.id);
    try {
      await deleteTaxRule(rule.id);
      invalidateFor(appQueryClient, 'tax.configure');
      showToast('success', 'Tax rule deleted.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Failed to delete tax rule.');
    } finally { setBusyId(null); }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: 16, borderBottom: '1px solid #f1f5f9' }}>
        <button type="button" onClick={() => setCreateOpen(true)} style={BTN_PRIMARY}>
          <Plus size={15} strokeWidth={2.5} /> Add Tax Rule
        </button>
      </div>

      {error && <div style={{ margin: 16 }}><ErrorBanner message={error} onRetry={fetchList} /></div>}

      <TableShell
        colSpan={6} loading={loading} empty={items.length === 0}
        headers={[{ label: 'Name' }, { label: 'Region' }, { label: 'Country' }, { label: 'Rate', align: 'center' }, { label: 'Type', align: 'center' }, { label: 'Status / Actions', align: 'right' }]}
      >
        {items.map(t => {
          const busy = busyId === t.id;
          return (
            <tr key={t.id} style={{ borderBottom: '1px solid #f8fafc', opacity: busy ? 0.5 : 1 }}>
              <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{t.name}</td>
              <td style={{ padding: '10px 12px', color: '#64748b' }}>{t.region}</td>
              <td style={{ padding: '10px 12px', color: '#64748b' }}>{t.country}</td>
              <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600 }}>{t.rate}%</td>
              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{t.type.replace('_', ' ')}</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                <Badge text={t.status} colors={STATUS_COLORS[t.status]} />
                <button type="button" title="Edit" disabled={busy} onClick={() => setEditTarget(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4, marginLeft: 6 }}><Pencil size={14} /></button>
                <button type="button" title="Delete" disabled={busy} onClick={() => handleDelete(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}><Trash2 size={14} /></button>
              </td>
            </tr>
          );
        })}
      </TableShell>

      {createOpen && <TaxRuleModal onClose={() => setCreateOpen(false)} showToast={showToast} onSuccess={() => { setCreateOpen(false); fetchList(); }} />}
      {editTarget && <TaxRuleModal rule={editTarget} onClose={() => setEditTarget(null)} showToast={showToast} onSuccess={() => { setEditTarget(null); fetchList(); }} />}
    </div>
  );
}
