// Audit Logs tab — searchable/filterable table + export shortcut.
// `search` matches the admin's name (AuditLog.action is a strict Prisma
// enum — free text can't `contains`/`equals` against it safely, see
// reports.service.getAuditReports); `action` filters by exact enum value.

import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { getAuditReports, downloadReportExport } from '../../services/reportsApi';
import { ReportsApiError } from '../../types/reports';
import type { AuditReports, DateRangeKey } from '../../types/reports';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

const DATE_RANGES: { key: DateRangeKey; label: string }[] = [
  { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' }, { key: 'custom', label: 'Custom' },
];

export default function AuditLogsTab({ showToast }: Props) {
  const [dateRange, setDateRange] = useState<DateRangeKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditReports | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const isCustomIncomplete = dateRange === 'custom' && (!customFrom || !customTo);

  const fetchData = useCallback(() => {
    if (isCustomIncomplete) return;
    setLoading(true);
    setError(null);
    getAuditReports({
      dateRange, dateFrom: dateRange === 'custom' ? customFrom : undefined, dateTo: dateRange === 'custom' ? customTo : undefined,
      search: search || undefined, action: action || undefined, userId: userId || undefined, page, limit: 25,
    })
      .then(setData)
      .catch(err => setError(err instanceof ReportsApiError ? err.message : 'Failed to load audit logs.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, customFrom, customTo, search, action, userId, page]);

  useEffect(() => {
    const t = setTimeout(fetchData, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData]);
  // Audit logs record admin actions across every module — genuinely needs
  // to know about ANY mutation, so it deliberately keeps the broad
  // 'analyticsUpdated' catch-all rather than narrowing to one domain (same
  // reasoning as ReportsOverviewTab.tsx).
  useEffect(() => {
    window.addEventListener('analyticsUpdated', fetchData);
    return () => window.removeEventListener('analyticsUpdated', fetchData);
  }, [fetchData]);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadReportExport({ type: 'audit', format: 'csv', dateRange, dateFrom: dateRange === 'custom' ? customFrom : undefined, dateTo: dateRange === 'custom' ? customTo : undefined });
      showToast('success', 'Audit log export downloaded.');
    } catch (err) {
      showToast('error', err instanceof ReportsApiError ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  }

  const INPUT: React.CSSProperties = { padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', color: '#374151' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
          {DATE_RANGES.map(r => (
            <button key={r.key} type="button" onClick={() => { setDateRange(r.key); setPage(1); }} style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', borderRadius: 6, border: 'none', cursor: 'pointer', background: dateRange === r.key ? '#fff' : 'transparent', color: dateRange === r.key ? '#2563eb' : '#64748b', boxShadow: dateRange === r.key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>{r.label}</button>
          ))}
        </div>
        {dateRange === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={INPUT} />
            <span style={{ color: '#9ca3af', fontSize: 12 }}>to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={INPUT} />
          </div>
        )}
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by admin name…" style={{ ...INPUT, width: 180 }} />
        <input value={action} onChange={e => { setAction(e.target.value.toUpperCase()); setPage(1); }} placeholder="Action (e.g. USER_CREATED)" style={{ ...INPUT, width: 200, textTransform: 'uppercase' }} />
        <input value={userId} onChange={e => { setUserId(e.target.value); setPage(1); }} placeholder="User ID" style={{ ...INPUT, width: 140 }} />
        <button
          type="button" onClick={handleExport} disabled={exporting}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 6, cursor: exporting ? 'default' : 'pointer', marginLeft: 'auto' }}
        >
          <Download size={13} /> {exporting ? 'Exporting…' : 'Export Logs'}
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#b91c1c' }}>
          <span>{error}</span>
          <button onClick={() => { showToast('error', error); fetchData(); }} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, color: '#b91c1c', fontSize: 12, fontWeight: 600, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
        {loading || !data ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1, 2, 3, 4].map(i => <div key={i} style={{ height: 14, borderRadius: 4, background: '#e5e7eb', width: `${55 + i * 8}%` }} />)}</div>
        ) : data.logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>No audit log entries match these filters</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {['Action', 'User', 'Target', 'Date', 'Details'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.logs.map(l => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '8px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap' }}>{l.action}</td>
                    <td style={{ padding: '8px', color: '#374151' }}>{l.userName ?? '—'}</td>
                    <td style={{ padding: '8px', color: '#6b7280' }}>{l.targetType ? `${l.targetType}: ${l.targetId?.slice(0, 8)}…` : '—'}</td>
                    <td style={{ padding: '8px', color: '#6b7280', whiteSpace: 'nowrap' }}>{new Date(l.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '8px', color: '#9ca3af', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: 10 }}>{l.metadata ? JSON.stringify(l.metadata) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.pagination.pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{data.pagination.total.toLocaleString()} total entries</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'default' : 'pointer' }}>Prev</button>
              <span style={{ fontSize: 12, color: '#6b7280', alignSelf: 'center' }}>{data.pagination.page} / {data.pagination.pages}</span>
              <button disabled={page >= data.pagination.pages} onClick={() => setPage(p => p + 1)} style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page >= data.pagination.pages ? 'default' : 'pointer' }}>Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
