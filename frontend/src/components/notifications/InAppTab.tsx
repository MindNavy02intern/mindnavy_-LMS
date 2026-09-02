import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Trash2 } from 'lucide-react';
import { listLogs, markAllNotificationsRead, markNotificationRead, deleteNotification } from '../../services/notificationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { NotificationLogEntry } from '../../types/notifications';
import { CARD, EMPTY, TH, TD, INPUT, BTN_SECONDARY, PriorityBadge, fmtDate, Pager } from './shared';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
  onBumpRefresh: () => void;
  onSend: () => void;
}

export default function InAppTab({ showToast, refreshSignal, onBumpRefresh, onSend }: Props) {
  const [items, setItems] = useState<NotificationLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [readFilter, setReadFilter] = useState<'all' | 'read' | 'unread'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listLogs({ channel: 'IN_APP', dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page, limit })
      .then(res => { if (!cancelled) { setItems(res.items); setTotal(res.total); } })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, dateFrom, dateTo, refreshSignal]);

  const filtered = useMemo(() => {
    return items.filter(n => {
      if (readFilter === 'read' && !n.read) return false;
      if (readFilter === 'unread' && n.read) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!n.subject?.toLowerCase().includes(q) && !n.body.toLowerCase().includes(q) && !n.userName?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, readFilter, search]);

  async function handleMarkRead(id: string) {
    try {
      await markNotificationRead(id);
      invalidateFor(appQueryClient, 'notification.markRead');
      onBumpRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to mark as read.');
    }
  }

  async function handleMarkAllRead() {
    try {
      const res = await markAllNotificationsRead();
      invalidateFor(appQueryClient, 'notification.markRead');
      showToast('success', `Marked ${res.updated} notification(s) as read.`);
      onBumpRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to mark all as read.');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteNotification(id);
      invalidateFor(appQueryClient, 'notification.delete');
      showToast('success', 'Notification deleted.');
      onBumpRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete.');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input style={{ ...INPUT, flex: 1, minWidth: 200 }} placeholder="Search title, body, or user…" value={search} onChange={e => setSearch(e.target.value)} />
        <select style={INPUT} value={readFilter} onChange={e => setReadFilter(e.target.value as typeof readFilter)}>
          <option value="all">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
        <input style={INPUT} type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
        <input style={INPUT} type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
        <div style={{ flex: 1 }} />
        <button type="button" style={BTN_SECONDARY} onClick={handleMarkAllRead}>
          <CheckCheck size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          Mark all as read
        </button>
        <button type="button" style={{ ...BTN_SECONDARY, background: '#2563eb', color: '#fff', border: 'none' }} onClick={onSend}>
          + Send Notification
        </button>
      </div>

      <div style={{ ...CARD, overflow: 'hidden' }}>
        {loading ? <div style={EMPTY}>Loading…</div> : filtered.length === 0 ? (
          <div style={EMPTY}>No in-app notifications yet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={TH}>User</th><th style={TH}>Title</th><th style={TH}>Body</th>
                <th style={TH}>Priority</th><th style={TH}>Read</th><th style={TH}>Sent At</th><th style={TH}>Actions</th>
              </tr></thead>
              <tbody>
                {filtered.map(n => (
                  <tr key={n.id}>
                    <td style={TD}>{n.userName ?? '—'}</td>
                    <td style={{ ...TD, fontWeight: 600, color: '#0f172a' }}>{n.subject ?? '(no title)'}</td>
                    <td style={{ ...TD, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</td>
                    <td style={TD}><PriorityBadge priority={n.priority} /></td>
                    <td style={TD}>{n.read ? <span style={{ color: '#16a34a', fontWeight: 600 }}>Read</span> : <span style={{ color: '#c2410c', fontWeight: 600 }}>Unread</span>}</td>
                    <td style={TD}>{fmtDate(n.sentAt)}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {!n.read && <button type="button" onClick={() => handleMarkRead(n.id)} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Mark read</button>}
                        <button type="button" onClick={() => handleDelete(n.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center' }} aria-label="Delete">
                          <Trash2 size={14} />
                        </button>
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
    </div>
  );
}
