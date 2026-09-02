import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Eye, Download, X } from 'lucide-react';
import { listLogs, retryDelivery } from '../../services/notificationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { NotificationChannelType, NotificationLogEntry, NotificationLogStatus } from '../../types/notifications';
import { CARD, EMPTY, TH, TD, INPUT, BTN_SECONDARY, ChannelBadge, LogStatusBadge, fmtDate, Pager } from './shared';

const CHANNELS: NotificationChannelType[] = ['EMAIL', 'PUSH', 'SMS', 'IN_APP'];
const STATUSES: NotificationLogStatus[] = ['SENT', 'FAILED', 'PENDING', 'BOUNCED', 'OPENED', 'CLICKED'];

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
  onBumpRefresh: () => void;
}

function DetailModal({ log, onClose }: { log: NotificationLogEntry; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>Delivery Detail</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={16} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
          <Row label="Channel" value={<ChannelBadge channel={log.channel} />} />
          <Row label="Status" value={<LogStatusBadge status={log.status} />} />
          <Row label="Recipient" value={log.userName ?? '—'} />
          <Row label="Subject" value={log.subject ?? '—'} />
          <Row label="Body" value={<span style={{ whiteSpace: 'pre-wrap' }}>{log.body}</span>} />
          <Row label="Source" value={`${log.sourceType}${log.sourceId ? ` (${log.sourceId.slice(0, 8)}…)` : ''}`} />
          <Row label="Sent At" value={fmtDate(log.sentAt)} />
          <Row label="Opened At" value={fmtDate(log.openedAt)} />
          <Row label="Clicked At" value={fmtDate(log.clickedAt)} />
          {log.metadata && <Row label="Metadata" value={<code style={{ fontSize: 11 }}>{JSON.stringify(log.metadata)}</code>} />}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ width: 100, flexShrink: 0, color: '#94a3b8', fontWeight: 600 }}>{label}</div>
      <div style={{ flex: 1, color: '#374151' }}>{value}</div>
    </div>
  );
}

function toCsv(rows: NotificationLogEntry[]): string {
  const header = ['Channel', 'User', 'Subject', 'Status', 'Sent At'];
  const lines = rows.map(r => [r.channel, r.userName ?? '', r.subject ?? '', r.status, r.sentAt ?? ''].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  return [header.join(','), ...lines].join('\n');
}

export default function DeliveryLogsTab({ showToast, refreshSignal, onBumpRefresh }: Props) {
  const [items, setItems] = useState<NotificationLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [channel, setChannel] = useState<NotificationChannelType | ''>('');
  const [status, setStatus] = useState<NotificationLogStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<NotificationLogEntry | null>(null);
  const limit = 20;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listLogs({ channel: channel || undefined, status: status || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page, limit })
      .then(res => { if (!cancelled) { setItems(res.items); setTotal(res.total); } })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [channel, status, dateFrom, dateTo, page, refreshSignal]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter(n => n.subject?.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || n.userName?.toLowerCase().includes(q));
  }, [items, search]);

  async function handleRetry(id: string) {
    try {
      await retryDelivery(id);
      invalidateFor(appQueryClient, 'delivery.retry');
      showToast('success', 'Retry attempted.');
      onBumpRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Retry failed.');
    }
  }

  function handleExport() {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notification-logs-page-${page}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input style={{ ...INPUT, flex: 1, minWidth: 200 }} placeholder="Search subject, body, or user…" value={search} onChange={e => setSearch(e.target.value)} />
        <select style={INPUT} value={channel} onChange={e => { setChannel(e.target.value as NotificationChannelType | ''); setPage(1); }}>
          <option value="">All channels</option>
          {CHANNELS.map(c => <option key={c} value={c}>{c === 'IN_APP' ? 'IN-APP' : c}</option>)}
        </select>
        <select style={INPUT} value={status} onChange={e => { setStatus(e.target.value as NotificationLogStatus | ''); setPage(1); }}>
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
        {loading ? <div style={EMPTY}>Loading…</div> : filtered.length === 0 ? (
          <div style={EMPTY}>No delivery logs yet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={TH}>Channel</th><th style={TH}>User</th><th style={TH}>Subject</th>
                <th style={TH}>Status</th><th style={TH}>Sent At</th><th style={TH}>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(n => (
                  <tr key={n.id}>
                    <td style={TD}><ChannelBadge channel={n.channel} /></td>
                    <td style={TD}>{n.userName ?? '—'}</td>
                    <td style={{ ...TD, fontWeight: 600, color: '#0f172a' }}>{n.subject ?? '(no subject)'}</td>
                    <td style={TD}><LogStatusBadge status={n.status} /></td>
                    <td style={TD}>{fmtDate(n.sentAt ?? n.createdAt)}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button type="button" onClick={() => setDetail(n)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center' }} aria-label="View details">
                          <Eye size={14} />
                        </button>
                        {(n.status === 'FAILED' || n.status === 'PENDING') && (
                          <button type="button" onClick={() => handleRetry(n.id)} style={{ background: 'none', border: 'none', color: '#c2410c', cursor: 'pointer', display: 'flex', alignItems: 'center' }} aria-label="Retry">
                            <RotateCcw size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} limit={limit} total={total} onPage={setPage} />
      </div>

      {detail && <DetailModal log={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
