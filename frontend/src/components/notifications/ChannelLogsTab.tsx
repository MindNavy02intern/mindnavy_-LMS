// Shared list view for the Email / Push / SMS tabs — same NotificationLog
// table filtered to one channel, differing only in banner copy (no
// FCM/Twilio integration yet for Push/SMS — see NOTIFICATIONS_CONTRACT.md).

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { listLogs } from '../../services/notificationsApi';
import type { NotificationChannelType, NotificationLogEntry, NotificationLogStatus } from '../../types/notifications';
import { CARD, EMPTY, TH, TD, INPUT, LogStatusBadge, fmtDate, Pager } from './shared';

const STATUSES: NotificationLogStatus[] = ['SENT', 'FAILED', 'PENDING', 'BOUNCED', 'OPENED', 'CLICKED'];

interface Props {
  channel: NotificationChannelType;
  refreshSignal: number;
  banner?: string;
}

export default function ChannelLogsTab({ channel, refreshSignal, banner }: Props) {
  const [items, setItems] = useState<NotificationLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<NotificationLogStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listLogs({ channel, status: status || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page, limit })
      .then(res => { if (!cancelled) { setItems(res.items); setTotal(res.total); } })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [channel, status, dateFrom, dateTo, page, refreshSignal]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter(n => n.subject?.toLowerCase().includes(q) || n.body.toLowerCase().includes(q) || n.userName?.toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {banner && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#92400e' }}>
          <AlertCircle size={16} strokeWidth={2} />
          {banner}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input style={{ ...INPUT, flex: 1, minWidth: 200 }} placeholder="Search subject, body, or user…" value={search} onChange={e => setSearch(e.target.value)} />
        <select style={INPUT} value={status} onChange={e => { setStatus(e.target.value as NotificationLogStatus | ''); setPage(1); }}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input style={INPUT} type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
        <input style={INPUT} type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
      </div>

      <div style={{ ...CARD, overflow: 'hidden' }}>
        {loading ? <div style={EMPTY}>Loading…</div> : filtered.length === 0 ? (
          <div style={EMPTY}>No {channel === 'IN_APP' ? 'in-app' : channel.toLowerCase()} notifications logged yet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={TH}>User</th><th style={TH}>Subject</th><th style={TH}>Status</th><th style={TH}>Sent At</th>
              </tr></thead>
              <tbody>
                {filtered.map(n => (
                  <tr key={n.id}>
                    <td style={TD}>{n.userName ?? '—'}</td>
                    <td style={{ ...TD, fontWeight: 600, color: '#0f172a' }}>{n.subject ?? '(no subject)'}</td>
                    <td style={TD}><LogStatusBadge status={n.status} /></td>
                    <td style={TD}>{fmtDate(n.sentAt ?? n.createdAt)}</td>
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
