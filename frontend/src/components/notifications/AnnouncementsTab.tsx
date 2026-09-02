import { useEffect, useState } from 'react';
import { Eye, Pencil, Send, Ban, Trash2 } from 'lucide-react';
import {
  listAnnouncements, sendAnnouncementNow, cancelAnnouncement, deleteAnnouncement,
} from '../../services/notificationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import ConfirmDialog from '../users/ConfirmDialog';
import CreateEditAnnouncementModal from './CreateEditAnnouncementModal';
import type { Announcement, AnnouncementAudience, AnnouncementStatus, AnnouncementType } from '../../types/notifications';
import { CARD, EMPTY, TH, TD, INPUT, BTN_PRIMARY, AnnouncementStatusBadge, PriorityBadge, fmtDate, Pager } from './shared';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
  onBumpRefresh: () => void;
  onCreate: () => void;
}

const AUDIENCE_LABEL: Record<AnnouncementAudience, string> = {
  ALL: 'All Users', LEARNERS: 'Learners', INSTRUCTORS: 'Instructors',
  DEPARTMENTS: 'Departments', GROUPS: 'Groups', CUSTOM: 'Custom',
};

type Confirm = { kind: 'send' | 'cancel' | 'delete'; announcement: Announcement };

export default function AnnouncementsTab({ showToast, refreshSignal, onBumpRefresh, onCreate }: Props) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AnnouncementStatus | ''>('');
  const [type, setType] = useState<AnnouncementType | ''>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<Announcement | null>(null);
  const [viewTarget, setViewTarget] = useState<Announcement | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const limit = 20;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAnnouncements({ status: status || undefined, type: type || undefined, search: search || undefined, page, limit })
      .then(res => { if (!cancelled) { setItems(res.items); setTotal(res.total); } })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [status, type, search, page, refreshSignal]);

  async function handleConfirm() {
    if (!confirm) return;
    setConfirmLoading(true);
    try {
      if (confirm.kind === 'send') {
        await sendAnnouncementNow(confirm.announcement.id);
        invalidateFor(appQueryClient, 'announcement.send');
        showToast('success', 'Announcement sent.');
      } else if (confirm.kind === 'cancel') {
        await cancelAnnouncement(confirm.announcement.id);
        invalidateFor(appQueryClient, 'campaign.cancel');
        showToast('success', 'Announcement cancelled.');
      } else {
        await deleteAnnouncement(confirm.announcement.id);
        invalidateFor(appQueryClient, 'announcement.delete');
        showToast('success', 'Announcement deleted.');
      }
      setConfirm(null);
      onBumpRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input style={{ ...INPUT, flex: 1, minWidth: 200 }} placeholder="Search announcements…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select style={INPUT} value={type} onChange={e => { setType(e.target.value as AnnouncementType | ''); setPage(1); }}>
          <option value="">All types</option>
          {(['PLATFORM', 'MAINTENANCE', 'PROMOTION', 'COMPANY', 'EMERGENCY'] as AnnouncementType[]).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select style={INPUT} value={status} onChange={e => { setStatus(e.target.value as AnnouncementStatus | ''); setPage(1); }}>
          <option value="">All statuses</option>
          {(['DRAFT', 'SCHEDULED', 'SENT', 'CANCELLED'] as AnnouncementStatus[]).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button type="button" style={BTN_PRIMARY} onClick={onCreate}>+ Create Announcement</button>
      </div>

      <div style={{ ...CARD, overflow: 'hidden' }}>
        {loading ? <div style={EMPTY}>Loading…</div> : items.length === 0 ? (
          <div style={EMPTY}>No announcements yet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={TH}>Title</th><th style={TH}>Type</th><th style={TH}>Audience</th>
                <th style={TH}>Priority</th><th style={TH}>Status</th><th style={TH}>Sent At</th><th style={TH}>Actions</th>
              </tr></thead>
              <tbody>
                {items.map(a => (
                  <tr key={a.id}>
                    <td style={{ ...TD, fontWeight: 600, color: '#0f172a' }}>{a.title}</td>
                    <td style={TD}>{a.type}</td>
                    <td style={TD}>{AUDIENCE_LABEL[a.audience]}</td>
                    <td style={TD}><PriorityBadge priority={a.priority} /></td>
                    <td style={TD}><AnnouncementStatusBadge status={a.status} /></td>
                    <td style={TD}>{fmtDate(a.sentAt)}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => setViewTarget(a)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer' }} aria-label="View"><Eye size={14} /></button>
                        {(a.status === 'DRAFT' || a.status === 'SCHEDULED') && (
                          <button type="button" onClick={() => setEditTarget(a)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }} aria-label="Edit"><Pencil size={14} /></button>
                        )}
                        {(a.status === 'DRAFT' || a.status === 'SCHEDULED') && (
                          <button type="button" onClick={() => setConfirm({ kind: 'send', announcement: a })} style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer' }} aria-label="Send now"><Send size={14} /></button>
                        )}
                        {(a.status === 'DRAFT' || a.status === 'SCHEDULED') && (
                          <button type="button" onClick={() => setConfirm({ kind: 'cancel', announcement: a })} style={{ background: 'none', border: 'none', color: '#c2410c', cursor: 'pointer' }} aria-label="Cancel"><Ban size={14} /></button>
                        )}
                        <button type="button" onClick={() => setConfirm({ kind: 'delete', announcement: a })} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }} aria-label="Delete"><Trash2 size={14} /></button>
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

      {editTarget && (
        <CreateEditAnnouncementModal
          mode="edit"
          announcement={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => { setEditTarget(null); onBumpRefresh(); }}
          showToast={showToast}
        />
      )}

      {viewTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={() => setViewTarget(null)} />
          <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>{viewTarget.title}</h3>
              <button type="button" onClick={() => setViewTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>✕</button>
            </div>
            <div style={{ padding: 20, fontSize: 13, color: '#374151', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ whiteSpace: 'pre-wrap' }}>{viewTarget.body}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: '#64748b' }}>
                <span>{viewTarget.type}</span>·<span>{AUDIENCE_LABEL[viewTarget.audience]}</span>·<span>{viewTarget.sentCount} sent</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.kind === 'send' ? 'Send announcement now?' : confirm.kind === 'cancel' ? 'Cancel announcement?' : 'Delete announcement?'}
          body={confirm.kind === 'send'
            ? `"${confirm.announcement.title}" will be sent immediately to its target audience.`
            : confirm.kind === 'cancel'
            ? `"${confirm.announcement.title}" will be cancelled and won't be sent.`
            : `"${confirm.announcement.title}" will be permanently deleted.`}
          confirmLabel={confirm.kind === 'send' ? 'Send Now' : confirm.kind === 'cancel' ? 'Cancel Announcement' : 'Delete'}
          confirmColor={confirm.kind === 'delete' ? '#dc2626' : confirm.kind === 'cancel' ? '#c2410c' : '#16a34a'}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
          loading={confirmLoading}
        />
      )}
    </div>
  );
}
