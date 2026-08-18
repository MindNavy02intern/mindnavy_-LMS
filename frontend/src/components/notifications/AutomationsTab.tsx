import { useEffect, useState } from 'react';
import { Pencil, Pause, Play, Trash2 } from 'lucide-react';
import { listAutomations, pauseAutomation, resumeAutomation, deleteAutomation } from '../../services/notificationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import ConfirmDialog from '../users/ConfirmDialog';
import CreateEditAutomationModal from './CreateEditAutomationModal';
import type { NotificationAutomation } from '../../types/notifications';
import { CARD, EMPTY, TH, TD, BTN_PRIMARY, AutomationStatusBadge, ChannelBadge } from './shared';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
  onBumpRefresh: () => void;
  onCreate: () => void;
}

export default function AutomationsTab({ showToast, refreshSignal, onBumpRefresh, onCreate }: Props) {
  const [items, setItems] = useState<NotificationAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<NotificationAutomation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NotificationAutomation | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    function load() {
      setLoading(true);
      listAutomations({ limit: 100 })
        .then(res => { if (!cancelled) setItems(res.items); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    load();
    // sentCount increments server-side from source services this tab has no
    // other signal for (a user registering, an enrollment completing, ...) —
    // without this, an already-open tab shows a stale count until remounted.
    window.addEventListener('analyticsUpdated', load);
    window.addEventListener('userDataChanged', load);
    return () => { cancelled = true; window.removeEventListener('analyticsUpdated', load); window.removeEventListener('userDataChanged', load); };
  }, [refreshSignal]);

  async function handleToggle(a: NotificationAutomation) {
    try {
      if (a.status === 'ACTIVE') {
        await pauseAutomation(a.id);
        invalidateFor(appQueryClient, 'notificationRule.toggle');
        showToast('success', `"${a.name}" paused.`);
      } else {
        await resumeAutomation(a.id);
        invalidateFor(appQueryClient, 'notificationRule.toggle');
        showToast('success', `"${a.name}" resumed.`);
      }
      onBumpRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Action failed.');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteAutomation(deleteTarget.id);
      invalidateFor(appQueryClient, 'notificationRule.delete');
      showToast('success', 'Automation deleted.');
      setDeleteTarget(null);
      onBumpRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete.');
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" style={BTN_PRIMARY} onClick={onCreate}>+ Create Automation</button>
      </div>

      <div style={{ ...CARD, overflow: 'hidden' }}>
        {loading ? <div style={EMPTY}>Loading…</div> : items.length === 0 ? (
          <div style={EMPTY}>No automations yet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={TH}>Name</th><th style={TH}>Trigger</th><th style={TH}>Channels</th>
                <th style={TH}>Status</th><th style={TH}>Sent Count</th><th style={TH}>Actions</th>
              </tr></thead>
              <tbody>
                {items.map(a => (
                  <tr key={a.id}>
                    <td style={{ ...TD, fontWeight: 600, color: '#0f172a' }}>{a.name}</td>
                    <td style={TD}>{a.trigger.replace(/_/g, ' ')}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {a.channels.map(c => <ChannelBadge key={c} channel={c} />)}
                      </div>
                    </td>
                    <td style={TD}><AutomationStatusBadge status={a.status} /></td>
                    <td style={TD}>{a.sentCount}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => setEditTarget(a)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }} aria-label="Edit"><Pencil size={14} /></button>
                        <button type="button" onClick={() => handleToggle(a)} style={{ background: 'none', border: 'none', color: a.status === 'ACTIVE' ? '#c2410c' : '#16a34a', cursor: 'pointer' }} aria-label={a.status === 'ACTIVE' ? 'Pause' : 'Resume'}>
                          {a.status === 'ACTIVE' ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(a)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }} aria-label="Delete"><Trash2 size={14} /></button>
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
        <CreateEditAutomationModal mode="edit" automation={editTarget} onClose={() => setEditTarget(null)} onSuccess={() => { setEditTarget(null); onBumpRefresh(); }} showToast={showToast} />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete automation?"
          body={`"${deleteTarget.name}" will be permanently deleted.`}
          confirmLabel="Delete"
          confirmColor="#dc2626"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
