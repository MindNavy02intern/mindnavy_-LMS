import { useEffect, useState } from 'react';
import InstructorLayout from './InstructorLayout';
import { INPUT, ERROR_BANNER, TH, TD } from './instructorUiKit';
import { getMyEarningsSummary, listMyPayouts, InstructorEarningsApiError } from '../../api/instructorEarningsApi';
import type { MyEarningsSummary, MyPayoutRow, PayoutStatus } from '../../types/instructorEarnings';

// All read-only (blueprint 2.9) — approve/hold/complete a payout stay
// admin-only. Every amount is a real, live-computed $0 until a payment
// gateway is connected — an honest empty state, not a "coming soon" stub.

const STATUS_OPTIONS: { value: PayoutStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'HELD', label: 'Held' },
];

const STATUS_COLOR: Record<PayoutStatus, { bg: string; fg: string }> = {
  PENDING:    { bg: '#fef9c3', fg: '#a16207' },
  APPROVED:   { bg: '#dbeafe', fg: '#1d4ed8' },
  PROCESSING: { bg: '#e0e7ff', fg: '#4338ca' },
  COMPLETED:  { bg: '#dcfce7', fg: '#15803d' },
  FAILED:     { bg: '#fee2e2', fg: '#b91c1c' },
  HELD:       { bg: '#f1f5f9', fg: '#64748b' },
};

function formatMoney(n: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="mn-db-card">
      <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{value}</div>
    </div>
  );
}

export default function InstructorEarningsPage() {
  const [summary, setSummary] = useState<MyEarningsSummary | null>(null);
  const [status, setStatus] = useState<PayoutStatus | ''>('');
  const [payouts, setPayouts] = useState<MyPayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyEarningsSummary().then(setSummary).catch(err => console.error(err));
  }, []);

  useEffect(() => {
    setLoading(true);
    listMyPayouts({ status: status || undefined })
      .then((res) => { setPayouts(res.payouts); setError(null); })
      .catch((err: unknown) => setError(err instanceof InstructorEarningsApiError ? err.message : 'Failed to load payouts.'))
      .finally(() => setLoading(false));
  }, [status]);

  const currency = summary?.currency ?? 'USD';

  return (
    <InstructorLayout>
      <div className="mn-db-welcome">
        <div>
          <h1 className="mn-db-welcome-title">My Earnings</h1>
          <p className="mn-db-welcome-sub">Revenue share and payout history</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 14 }}>
        <SummaryCard label="Lifetime Earnings" value={summary ? formatMoney(summary.lifetimeEarnings, currency) : '—'} />
        <SummaryCard label="Pending Payout" value={summary ? formatMoney(summary.pendingPayout, currency) : '—'} />
        <SummaryCard label="Revenue Share" value={summary?.revenueSharePercent != null ? `${summary.revenueSharePercent}%` : '—'} />
        <SummaryCard label="Last Payout Date" value={summary?.lastPayoutDate ? new Date(summary.lastPayoutDate).toLocaleDateString() : 'None yet'} />
      </div>

      {error && <div style={{ ...ERROR_BANNER, marginBottom: 14 }}>{error}</div>}

      <div className="mn-db-card">
        <div className="mn-db-card-header"><div className="mn-db-card-title">Payout History</div></div>
        <div style={{ marginBottom: 10 }}>
          <select aria-label="Filter by status" style={{ ...INPUT, maxWidth: 200 }} value={status} onChange={(e) => setStatus(e.target.value as PayoutStatus | '')}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="mn-spinner" /></div>
        ) : payouts.length === 0 ? (
          <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>No payouts yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={TH}>Period</th>
                <th style={TH}>Revenue Share</th>
                <th style={TH}>Amount</th>
                <th style={TH}>Status</th>
                <th style={TH}>Completed</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td style={TD}>{new Date(p.periodStart).toLocaleDateString()} – {new Date(p.periodEnd).toLocaleDateString()}</td>
                  <td style={TD}>{(p.revenueShareBps / 100).toFixed(2)}%</td>
                  <td style={TD}>{formatMoney(p.amount, p.currency)}</td>
                  <td style={TD}>
                    <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: STATUS_COLOR[p.status].bg, color: STATUS_COLOR[p.status].fg }}>
                      {p.status}
                    </span>
                  </td>
                  <td style={TD}>{p.completedAt ? new Date(p.completedAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </InstructorLayout>
  );
}
