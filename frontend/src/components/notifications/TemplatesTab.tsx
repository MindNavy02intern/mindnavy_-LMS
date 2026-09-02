import { useEffect, useState } from 'react';
import { Pencil, Eye, Copy, Trash2 } from 'lucide-react';
import { listTemplates, duplicateTemplate, deleteTemplate } from '../../services/notificationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import ConfirmDialog from '../users/ConfirmDialog';
import CreateEditTemplateModal from './CreateEditTemplateModal';
import TemplatePreviewModal from './TemplatePreviewModal';
import type { NotificationChannelType, NotificationTemplate } from '../../types/notifications';
import { CATEGORIES, CHANNEL_TYPES } from '../../types/notifications';
import { CARD, EMPTY, TH, TD, INPUT, BTN_PRIMARY, TemplateStatusBadge, ChannelBadge, fmtDate, Pager } from './shared';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
  onBumpRefresh: () => void;
  onCreate: () => void;
}

export default function TemplatesTab({ showToast, refreshSignal, onBumpRefresh, onCreate }: Props) {
  const [items, setItems] = useState<NotificationTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [type, setType] = useState<NotificationChannelType | ''>('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<NotificationTemplate | null>(null);
  const [previewTarget, setPreviewTarget] = useState<NotificationTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NotificationTemplate | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const limit = 20;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listTemplates({ type: type || undefined, category: category || undefined, search: search || undefined, page, limit })
      .then(res => { if (!cancelled) { setItems(res.items); setTotal(res.total); } })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [type, category, search, page, refreshSignal]);

  async function handleDuplicate(t: NotificationTemplate) {
    try {
      await duplicateTemplate(t.id);
      invalidateFor(appQueryClient, 'notificationTemplate.duplicate');
      showToast('success', 'Template duplicated.');
      onBumpRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to duplicate.');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteTemplate(deleteTarget.id);
      invalidateFor(appQueryClient, 'notificationTemplate.delete');
      showToast('success', 'Template deleted.');
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <input style={{ ...INPUT, flex: 1, minWidth: 200 }} placeholder="Search templates…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        <select style={INPUT} value={type} onChange={e => { setType(e.target.value as NotificationChannelType | ''); setPage(1); }}>
          <option value="">All types</option>
          {CHANNEL_TYPES.map(t => <option key={t} value={t}>{t === 'IN_APP' ? 'IN-APP' : t}</option>)}
        </select>
        <select style={INPUT} value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button type="button" style={BTN_PRIMARY} onClick={onCreate}>+ Create Template</button>
      </div>

      <div style={{ ...CARD, overflow: 'hidden' }}>
        {loading ? <div style={EMPTY}>Loading…</div> : items.length === 0 ? (
          <div style={EMPTY}>No templates yet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={TH}>Name</th><th style={TH}>Type</th><th style={TH}>Category</th>
                <th style={TH}>Status</th><th style={TH}>Last Updated</th><th style={TH}>Actions</th>
              </tr></thead>
              <tbody>
                {items.map(t => (
                  <tr key={t.id}>
                    <td style={{ ...TD, fontWeight: 600, color: '#0f172a' }}>{t.name}</td>
                    <td style={TD}><ChannelBadge channel={t.type} /></td>
                    <td style={TD}>{t.category}</td>
                    <td style={TD}><TemplateStatusBadge status={t.status} /></td>
                    <td style={TD}>{fmtDate(t.updatedAt)}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" onClick={() => setEditTarget(t)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }} aria-label="Edit"><Pencil size={14} /></button>
                        <button type="button" onClick={() => setPreviewTarget(t)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer' }} aria-label="Preview"><Eye size={14} /></button>
                        <button type="button" onClick={() => handleDuplicate(t)} style={{ background: 'none', border: 'none', color: '#16a34a', cursor: 'pointer' }} aria-label="Duplicate"><Copy size={14} /></button>
                        <button type="button" onClick={() => setDeleteTarget(t)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }} aria-label="Delete"><Trash2 size={14} /></button>
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
        <CreateEditTemplateModal mode="edit" template={editTarget} onClose={() => setEditTarget(null)} onSuccess={() => { setEditTarget(null); onBumpRefresh(); }} showToast={showToast} />
      )}
      {previewTarget && <TemplatePreviewModal template={previewTarget} onClose={() => setPreviewTarget(null)} />}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete template?"
          body={`"${deleteTarget.name}" will be permanently deleted. Automations using it will need a new template.`}
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
