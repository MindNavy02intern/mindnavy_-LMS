// Certificate Reports tab — summary cards, issued trend, recent certificates.
// Verification-requests stays an honest em-dash (no verification-page-hit
// tracking exists). Expired/Expiring Soon are real counts (Certificate.expiresAt).

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getCertificateReports } from '../../services/reportsApi';
import { ReportsApiError } from '../../types/reports';
import type { CertificateReports, DateRangeKey } from '../../types/reports';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

const DATE_RANGES: { key: DateRangeKey; label: string }[] = [
  { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' }, { key: 'custom', label: 'Custom' },
];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 14 }}>{title}</div>
      {children}
    </div>
  );
}
function EmptyChart({ label }: { label: string }) {
  return <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>{label}</div>;
}
function Skeleton() {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1, 2, 3].map(i => <div key={i} style={{ height: 14, borderRadius: 4, background: '#e5e7eb', width: `${55 + i * 10}%` }} />)}</div>;
}
function StatTile({ label, value, reason }: { label: string; value: string | null; reason?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: value === null ? '#cbd5e1' : '#0f172a' }}>{value ?? '—'}</div>
      {value === null && reason && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{reason}</div>}
    </div>
  );
}

export default function CertificateReportsTab({ showToast }: Props) {
  const [dateRange, setDateRange] = useState<DateRangeKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CertificateReports | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isCustomIncomplete = dateRange === 'custom' && (!customFrom || !customTo);

  const fetchData = useCallback(() => {
    if (isCustomIncomplete) return;
    setLoading(true);
    setError(null);
    getCertificateReports({ dateRange, dateFrom: dateRange === 'custom' ? customFrom : undefined, dateTo: dateRange === 'custom' ? customTo : undefined, page, limit: 20 })
      .then(setData)
      .catch(err => setError(err instanceof ReportsApiError ? err.message : 'Failed to load certificate reports.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, customFrom, customTo, page]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    window.addEventListener('analyticsUpdated', fetchData);
    return () => window.removeEventListener('analyticsUpdated', fetchData);
  }, [fetchData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 3, width: 'fit-content' }}>
        {DATE_RANGES.map(r => (
          <button key={r.key} type="button" onClick={() => { setDateRange(r.key); setPage(1); }} style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', borderRadius: 6, border: 'none', cursor: 'pointer', background: dateRange === r.key ? '#fff' : 'transparent', color: dateRange === r.key ? '#2563eb' : '#64748b', boxShadow: dateRange === r.key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>{r.label}</button>
        ))}
      </div>
      {dateRange === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={{ padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit' }} />
          <span style={{ color: '#9ca3af', fontSize: 12 }}>to</span>
          <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={{ padding: '6px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit' }} />
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#b91c1c' }}>
          <span>{error}</span>
          <button onClick={() => { showToast('error', error); fetchData(); }} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, color: '#b91c1c', fontSize: 12, fontWeight: 600, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      {loading || !data ? <Skeleton /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          <StatTile label="Issued" value={String(data.totalIssued.value)} />
          <StatTile label="Expiring Soon" value={data.expiringSoon.available ? String(data.expiringSoon.value) : null} reason={data.expiringSoon.reason} />
          <StatTile label="Expired" value={data.expired.available ? String(data.expired.value) : null} reason={data.expired.reason} />
          <StatTile label="Revoked" value={String(data.revoked.value)} />
          <StatTile label="Verification Requests" value={data.verificationRequests.available ? String(data.verificationRequests.value) : null} reason={data.verificationRequests.reason} />
        </div>
      )}

      <ChartCard title="Issued Trend">
        {loading || !data ? <Skeleton /> : data.issuedTrend.values.some(v => v > 0) ? (
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.issuedTrend.labels.map((label, i) => ({ label, value: data.issuedTrend.values[i] }))} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#d97706" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : <EmptyChart label="No certificates issued in this window" />}
      </ChartCard>

      <ChartCard title="Recent Certificates">
        {loading || !data ? <Skeleton /> : data.recentCertificates.length === 0 ? <EmptyChart label="No certificates in this window" /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {['Course', 'Learner', 'Issued', 'Status', 'Code'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Code' || h === 'Status' || h === 'Issued' ? 'right' : 'left', padding: '6px 8px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.recentCertificates.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '8px', fontWeight: 600, color: '#0f172a' }}>{c.courseTitle ?? '—'}</td>
                    <td style={{ padding: '8px', color: '#374151' }}>{c.userName ?? '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#6b7280' }}>{new Date(c.issuedAt).toLocaleDateString()}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                        background: c.revoked ? '#fee2e2' : c.expired ? '#fef3c7' : '#dcfce7',
                        color: c.revoked ? '#b91c1c' : c.expired ? '#92400e' : '#15803d',
                      }}>
                        {c.revoked ? 'Revoked' : c.expired ? 'Expired' : 'Active'}
                      </span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', color: '#9ca3af', fontFamily: 'monospace', fontSize: 11 }}>{c.verificationCode?.slice(0, 8) ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.pagination.pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'default' : 'pointer' }}>Prev</button>
            <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center' }}>{data.pagination.page} / {data.pagination.pages}</span>
            <button disabled={page >= data.pagination.pages} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page >= data.pagination.pages ? 'default' : 'pointer' }}>Next</button>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
