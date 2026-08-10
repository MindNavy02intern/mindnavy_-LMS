// Billing Settings tab (?tab=settings) — blueprint 09 §11.

import { useEffect, useState } from 'react';
import { getFinanceSettings, updateFinanceSettings } from '../../services/financeApi';
import { FinanceApiError } from '../../types/finance';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { FULL_INPUT, LABEL, BTN_PRIMARY, ErrorBanner, ChartSkeleton } from './_shared';

interface Props { showToast: (type: 'success' | 'error', message: string) => void; refreshSignal: number }

export default function BillingSettingsTab({ showToast, refreshSignal }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [currency, setCurrency] = useState('USD');
  const [autoBilling, setAutoBilling] = useState(true);
  const [refundPolicy, setRefundPolicy] = useState('');
  const [maxRetries, setMaxRetries] = useState('3');
  const [retryIntervalDays, setRetryIntervalDays] = useState('3');

  function fetchSettings() {
    setLoading(true);
    setError(null);
    getFinanceSettings()
      .then(s => {
        setCurrency(s.currency);
        setAutoBilling(s.autoBillingEnabled);
        setRefundPolicy(s.refundPolicy ?? '');
        const rules = (s.paymentRetryRules ?? {}) as { maxRetries?: number; retryIntervalDays?: number };
        setMaxRetries(String(rules.maxRetries ?? 3));
        setRetryIntervalDays(String(rules.retryIntervalDays ?? 3));
      })
      .catch(err => setError(err instanceof FinanceApiError ? err.message : 'Failed to load billing settings.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { fetchSettings(); }, [refreshSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateFinanceSettings({
        currency: currency.trim().toUpperCase(),
        autoBillingEnabled: autoBilling,
        refundPolicy: refundPolicy.trim() || null,
        paymentRetryRules: { maxRetries: Number(maxRetries) || 0, retryIntervalDays: Number(retryIntervalDays) || 0 },
      });
      invalidateFor(appQueryClient, 'billingSettings.update');
      showToast('success', 'Billing settings saved.');
      fetchSettings();
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Failed to save settings.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}><ChartSkeleton /></div>;

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 24, maxWidth: 640 }}>
      {error && <div style={{ marginBottom: 16 }}><ErrorBanner message={error} onRetry={fetchSettings} /></div>}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div>
          <label style={LABEL}>Default Currency</label>
          <input style={{ ...FULL_INPUT, maxWidth: 120 }} value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>Changing this affects how amounts are displayed across the app.</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: '#f8fafc', borderRadius: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Auto Billing</div>
            <div style={{ fontSize: 11.5, color: '#64748b' }}>Automatically charge subscriptions on renewal.</div>
          </div>
          <button type="button" onClick={() => setAutoBilling(v => !v)} style={{ width: 42, height: 24, borderRadius: 999, border: 'none', background: autoBilling ? '#2563eb' : '#cbd5e1', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 2, left: autoBilling ? 20 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
          </button>
        </div>

        <div>
          <label style={LABEL}>Payment Retry Rules</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 4 }}>Max retries</div>
              <input style={FULL_INPUT} type="number" min={0} max={10} value={maxRetries} onChange={e => setMaxRetries(e.target.value)} />
            </div>
            <div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginBottom: 4 }}>Days between retries</div>
              <input style={FULL_INPUT} type="number" min={1} max={30} value={retryIntervalDays} onChange={e => setRetryIntervalDays(e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <label style={LABEL}>Refund Policy</label>
          <textarea style={{ ...FULL_INPUT, minHeight: 100, resize: 'vertical' }} value={refundPolicy} onChange={e => setRefundPolicy(e.target.value)} placeholder="Describe your refund policy…" />
        </div>

        <div>
          <button type="submit" disabled={submitting} style={{ ...BTN_PRIMARY, opacity: submitting ? 0.7 : 1 }}>{submitting ? 'Saving…' : 'Save Settings'}</button>
        </div>
      </form>
    </div>
  );
}
