// Config Logs tab (?tab=logs) — read-only per-field diff trail written by
// every settings.service.js update. No actions besides filter/export.

import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { getConfigLogs } from '../../services/settingsApi';
import { SettingsApiError, type SystemConfigLog } from '../../types/settings';
import { Card, FULL_INPUT, BTN_SECONDARY, ErrorBanner, Skeleton } from './_shared';

function toCsvValue(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

export default function ConfigLogsTab() {
  const [logs, setLogs] = useState<SystemConfigLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchLogs = useCallback(() => {
    setLoading(true);
    setError(null);
    getConfigLogs({ page, limit: 20, search: search || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined })
      .then(res => { setLogs(res.logs); setTotal(res.total); setTotalPages(res.totalPages); })
      .catch(err => setError(err instanceof SettingsApiError ? err.message : 'Failed to load config logs.'))
      .finally(() => setLoading(false));
  }, [page, search, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo]);

  function handleExportCsv() {
    const header = ['Setting', 'Old Value', 'New Value', 'Changed By', 'Date'];
    const rows = logs.map(l => [
      l.setting,
      l.oldValue ?? '',
      l.newValue ?? '',
      l.changedBy?.fullName ?? l.changedById,
      new Date(l.createdAt).toISOString(),
    ]);
    const csv = [header, ...rows].map(r => r.map(toCsvValue).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-config-logs-page${page}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <Card title="Filters">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <input style={FULL_INPUT} placeholder="Search setting name…" value={search} onChange={e => setSearch(e.target.value)} />
          <input style={FULL_INPUT} type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <input style={FULL_INPUT} type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </Card>

      <Card title={`Config Changes (${total})`} action={
        <button type="button" style={BTN_SECONDARY} onClick={handleExportCsv} disabled={logs.length === 0}>
          <Download size={14} strokeWidth={2} /> Export CSV
        </button>
      }>
        {loading ? <Skeleton /> : error ? <ErrorBanner message={error} onRetry={fetchLogs} /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {['Setting', 'Old Value', 'New Value', 'Changed By', 'Date'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontWeight: 600, fontSize: 11.5, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No config changes recorded yet.</td></tr>
                ) : logs.map(log => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a', fontFamily: 'monospace', fontSize: 12 }}>{log.setting}</td>
                    <td style={{ padding: '10px 12px', color: '#b91c1c', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.oldValue ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#15803d', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.newValue ?? '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{log.changedBy?.fullName ?? 'Unknown admin'}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 14, borderTop: '1px solid #f1f5f9' }}>
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>Prev</button>
            <span style={{ fontSize: 12, color: '#64748b' }}>Page {page} of {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? 0.5 : 1 }}>Next</button>
          </div>
        )}
      </Card>
    </div>
  );
}
