// Financial Reports tab (?tab=reports) — blueprint 09 §13. Reuses
// GET /finance/payments/export for every report type (only real export
// endpoint this module has — same underlying CSV, filtered by date range).

import { useState } from 'react';
import { FileText, RotateCcw, Users, Banknote, Receipt, TrendingUp } from 'lucide-react';
import { exportPaymentsCsv } from '../../services/financeApi';
import { FinanceApiError } from '../../types/finance';

interface Props { showToast: (type: 'success' | 'error', message: string) => void }

const REPORTS = [
  { key: 'revenue',      label: 'Revenue Report',      Icon: TrendingUp, filename: 'revenue-report.csv' },
  { key: 'sales',        label: 'Sales Report',        Icon: Banknote,   filename: 'sales-report.csv' },
  { key: 'refund',       label: 'Refund Report',       Icon: RotateCcw,  filename: 'refund-report.csv', status: 'REFUNDED' },
  { key: 'subscription', label: 'Subscription Report', Icon: Users,      filename: 'subscription-report.csv' },
  { key: 'invoice',      label: 'Invoice Report',      Icon: FileText,   filename: 'invoice-report.csv' },
  { key: 'payout',       label: 'Payout Report',       Icon: Receipt,    filename: 'payout-report.csv' },
] as const;

export default function FinancialReportsTab({ showToast }: Props) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  async function handleExport(key: string, filename: string, status?: string) {
    setBusy(key);
    try {
      const csv = await exportPaymentsCsv({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, status });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('error', err instanceof FinanceApiError ? err.message : 'Export failed.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Date range:</span>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit' }} />
        <span style={{ color: '#9ca3af', fontSize: 12 }}>to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit' }} />
        <span style={{ fontSize: 11.5, color: '#94a3b8' }}>Leave blank to export all-time data.</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {REPORTS.map(r => (
          <div key={r.key} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 9, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <r.Icon size={18} color="#2563eb" strokeWidth={2} />
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{r.label}</div>
            <button
              type="button" disabled={busy === r.key}
              onClick={() => handleExport(r.key, r.filename, 'status' in r ? r.status : undefined)}
              style={{ padding: '8px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: busy === r.key ? 'default' : 'pointer', opacity: busy === r.key ? 0.7 : 1 }}
            >
              {busy === r.key ? 'Exporting…' : 'Export CSV'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
