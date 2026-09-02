import { useEffect, useState } from 'react';
import { Pencil, Ban } from 'lucide-react';
import { listAnnouncements, cancelAnnouncement } from '../../services/notificationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import ConfirmDialog from '../users/ConfirmDialog';
import CreateEditAnnouncementModal from './CreateEditAnnouncementModal';
import type { Announcement, AnnouncementAudience } from '../../types/notifications';
import { CARD, EMPTY, TH, TD, fmtDate } from './shared';

const AUDIENCE_LABEL: Record<AnnouncementAudience, string> = {
  ALL: 'All Users', LEARNERS: 'Learners', INSTRUCTORS: 'Instructors',
  DEPARTMENTS: 'Departments', GROUPS: 'Groups', CUSTOM: 'Custom',
};

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
  onBumpRefresh: () => void;
}

export default function ScheduledTab({ showToast, refreshSignal, onBumpRefresh }: Props) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<Announcement | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Announcement | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listAnnouncements({ status: 'SCHEDULED', limit: 100 })
      .then(res => { if (!cancelled) setItems(res.items); })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshSignal]);

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      await cancelAnnouncement(cancelTarget.id);
      invalidateFor(appQueryClient, 'campaign.cancel');
      showToast('success', 'Scheduled announcement cancelled.');
      setCancelTarget(null);
      onBumpRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to cancel.');
    } finally {
      setCancelLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ ...CARD, overflow: 'hidden' }}>
        {loading ? <div style={EMPTY}>Loading…</div> : items.length === 0 ? (
          <div style={EMPTY}>Nothing scheduled — create an announcement and pick "Schedule for later"</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={TH}>Title</th><th style={TH}>Audience</th><th style={TH}>Scheduled At</th><th style={TH}>Actions</th>
              </tr></thead>
              <tbody>
                {items.map(a => (
                  <tr key={a.id}>
                    <td style={{ ...TD, fontWeight: 600, color: '#0f172a' }}>{a.title}</td>
                    <td style={TD}>{AUDIENCE_LABEL[a.audience]}</td>
                    <td style={TD}>{fmtDate(a.scheduledAt)}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => setEditTarget(a)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }} aria-label="Edit schedule"><Pencil size={14} /></button>
                        <button type="button" onClick={() => setCancelTarget(a)} style={{ background: 'none', border: 'none', color: '#c2410c', cursor: 'pointer' }} aria-label="Cancel"><Ban size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editTarget && (
        <CreateEditAnnouncementModal mode="edit" announcement={editTarget} onClose={() => setEditTarget(null)} onSuccess={() => { setEditTarget(null); onBumpRefresh(); }} showToast={showToast} />
      )}
      {cancelTarget && (
        <ConfirmDialog
          title="Cancel scheduled announcement?"
          body={`"${cancelTarget.title}" won't be sent at its scheduled time.`}
          confirmLabel="Cancel Announcement"
          confirmColor="#c2410c"
          onConfirm={handleCancel}
          onCancel={() => setCancelTarget(null)}
          loading={cancelLoading}
        />
      )}
    </div>
  );
}
