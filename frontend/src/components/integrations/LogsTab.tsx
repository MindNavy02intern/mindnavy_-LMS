import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { listLogs, listIntegrations } from '../../services/integrationsApi';
import type { Integration, IntegrationLogEntry, IntegrationLogStatus, IntegrationLogType } from '../../types/integrations';
import { CARD, EMPTY, TH, TD, INPUT, BTN_SECONDARY, LogStatusBadge, fmtDate, Pager } from './shared';

interface Props { refreshSignal: number }

const TYPES: IntegrationLogType[] = ['API_CALL', 'WEBHOOK', 'SYNC', 'AUTH', 'ERROR'];
const STATUSES: IntegrationLogStatus[] = ['SUCCESS', 'FAILED', 'PENDING'];

function toCsv(rows: IntegrationLogEntry[]): string {
  const header = ['Integration', 'Type', 'Status', 'Endpoint', 'Response', 'Duration (ms)', 'Date'];
  const lines = rows.map(r => [r.integrationName, r.type, r.status, r.endpoint ?? '', r.responseCode ?? '', r.durationMs ?? '', r.createdAt]
    .map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  return [header.join(','), ...lines].join('\n');
}

export default function LogsTab({ refreshSignal }: Props) {
  const [items, setItems] = useState<IntegrationLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [integrationId, setIntegrationId] = useState('');
  const [type, setType] = useState<IntegrationLogType | ''>('');
  const [status, setStatus] = useState<IntegrationLogStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    listIntegrations().then(setIntegrations).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listLogs({
      integrationId: integrationId || undefined,
      type: type || undefined,
      status: status || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      page, limit,
    })
      .then(res => { if (!cancelled) { setItems(res.items); setTotal(res.total); } })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [integrationId, type, status, dateFrom, dateTo, page, refreshSignal]);

  function handleExport() {
    const csv = toCsv(items);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `integration-logs-page-${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <select style={INPUT} value={integrationId} onChange={e => { setIntegrationId(e.target.value); setPage(1); }}>
          <option value="">All integrations</option>
          {integrations.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <select style={INPUT} value={type} onChange={e => { setType(e.target.value as IntegrationLogType | ''); setPage(1); }}>
          <option value="">All types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select style={INPUT} value={status} onChange={e => { setStatus(e.target.value as IntegrationLogStatus | ''); setPage(1); }}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input style={INPUT} type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
        <input style={INPUT} type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
        <button type="button" style={BTN_SECONDARY} onClick={handleExport}>
          <Download size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          Export CSV
        </button>
      </div>

      <div style={{ ...CARD, overflow: 'hidden' }}>
        {loading ? <div style={EMPTY}>Loading…</div> : items.length === 0 ? (
          <div style={EMPTY}>No logs yet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={TH}>Integration</th><th style={TH}>Type</th><th style={TH}>Status</th>
                <th style={TH}>Endpoint</th><th style={TH}>Response</th><th style={TH}>Duration</th><th style={TH}>Date</th>
              </tr></thead>
              <tbody>
                {items.map(l => (
                  <tr key={l.id}>
                    <td style={{ ...TD, fontWeight: 600, color: '#0f172a' }}>{l.integrationName}</td>
                    <td style={TD}>{l.type}</td>
                    <td style={TD}><LogStatusBadge status={l.status} /></td>
                    <td style={{ ...TD, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.endpoint ?? ''}>{l.endpoint ?? '—'}</td>
                    <td style={TD}>{l.responseCode ?? '—'}</td>
                    <td style={TD}>{l.durationMs !== null ? `${l.durationMs}ms` : '—'}</td>
                    <td style={TD}>{fmtDate(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} limit={limit} total={total} onPage={setPage} />
      </div>
    </div>
  );
}
