import { useEffect, useState } from 'react';
import { getUsers } from '../../api/users';
import { getDepartments } from '../../api/organization';
import { getStoredToken } from '../../api/adminAuth';
import { createAnnouncement, updateAnnouncement, sendAnnouncementNow } from '../../services/notificationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { ANNOUNCEMENT_TYPES, PRIORITIES, type Announcement, type AnnouncementAudience } from '../../types/notifications';
import { INPUT, LABEL, ERR, BTN_PRIMARY, BTN_SECONDARY } from './shared';

interface Props {
  mode: 'create' | 'edit';
  announcement?: Announcement;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

interface Option { id: string; label: string }

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

async function fetchGroups(search: string): Promise<Option[]> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}/groups?search=${encodeURIComponent(search)}&limit=10`, {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  if (!res.ok) return [];
  const json = await res.json().catch(() => null);
  const rows = json?.data?.groups ?? json?.data ?? [];
  return Array.isArray(rows) ? rows.map((g: { id: string; name: string }) => ({ id: g.id, label: g.name })) : [];
}

export default function CreateEditAnnouncementModal({ mode, announcement, onClose, onSuccess, showToast }: Props) {
  const [title, setTitle] = useState(announcement?.title ?? '');
  const [body, setBody] = useState(announcement?.body ?? '');
  const [type, setType] = useState(announcement?.type ?? 'PLATFORM');
  const [audience, setAudience] = useState<AnnouncementAudience>(announcement?.audience ?? 'ALL');
  const [priority, setPriority] = useState(announcement?.priority ?? 'NORMAL');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>(announcement?.scheduledAt ? 'later' : 'now');
  const [scheduledAt, setScheduledAt] = useState(announcement?.scheduledAt ? announcement.scheduledAt.slice(0, 16) : '');

  const [targetSearch, setTargetSearch] = useState('');
  const [targetOptions, setTargetOptions] = useState<Option[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<Option[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    setSelectedTargets([]);
    setTargetOptions([]);
    setTargetSearch('');
  }, [audience]);

  useEffect(() => {
    if (audience !== 'CUSTOM' && audience !== 'DEPARTMENTS' && audience !== 'GROUPS') return;
    if (audience === 'DEPARTMENTS' && targetSearch.trim().length === 0) {
      getDepartments({ limit: 20 }).then(res => setTargetOptions(res.data.map(d => ({ id: d.id, label: d.name })))).catch(err => console.error(err));
      return;
    }
    if (targetSearch.trim().length < 2) { setTargetOptions([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      if (audience === 'CUSTOM') {
        getUsers({ search: targetSearch.trim(), limit: 8 }).then(res => {
          if (!cancelled) setTargetOptions(res.users.map(u => ({ id: u.id, label: `${u.fullName} (${u.email})` })));
        }).catch(err => console.error(err));
      } else if (audience === 'DEPARTMENTS') {
        getDepartments({ search: targetSearch.trim(), limit: 10 }).then(res => {
          if (!cancelled) setTargetOptions(res.data.map(d => ({ id: d.id, label: d.name })));
        }).catch(err => console.error(err));
      } else if (audience === 'GROUPS') {
        fetchGroups(targetSearch.trim()).then(opts => { if (!cancelled) setTargetOptions(opts); }).catch(err => console.error(err));
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [targetSearch, audience]);

  function addTarget(o: Option) {
    if (!selectedTargets.some(t => t.id === o.id)) setSelectedTargets(prev => [...prev, o]);
    setTargetOptions([]);
    setTargetSearch('');
  }
  function removeTarget(id: string) { setSelectedTargets(prev => prev.filter(t => t.id !== id)); }

  const needsTargets = audience === 'CUSTOM' || audience === 'DEPARTMENTS' || audience === 'GROUPS';

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = 'Title is required.';
    if (!body.trim()) next.body = 'Body is required.';
    if (needsTargets && selectedTargets.length === 0) next.targets = 'Select at least one target.';
    if (scheduleMode === 'later' && !scheduledAt) next.scheduledAt = 'Pick a date and time.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(), body: body.trim(), type, audience, priority,
        targetIds: needsTargets ? selectedTargets.map(t => t.id) : undefined,
        scheduledAt: scheduleMode === 'later' ? new Date(scheduledAt).toISOString() : null,
      };

      if (mode === 'edit' && announcement) {
        await updateAnnouncement(announcement.id, payload);
        invalidateFor(appQueryClient, 'campaign.schedule');
        showToast('success', 'Announcement updated.');
      } else {
        const created = await createAnnouncement(payload);
        if (scheduleMode === 'now') {
          await sendAnnouncementNow(created.id);
          invalidateFor(appQueryClient, 'announcement.send');
          showToast('success', 'Announcement sent.');
        } else {
          invalidateFor(appQueryClient, 'campaign.schedule');
          showToast('success', 'Announcement scheduled.');
        }
      }
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setServerError(msg);
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!submitting ? onClose : undefined} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>{mode === 'edit' ? 'Edit Announcement' : 'Create Announcement'}</h3>
          <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', color: '#6b7280' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {serverError && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#b91c1c' }}>{serverError}</div>}

          <div>
            <label style={LABEL} htmlFor="ann-title">Title *</label>
            <input id="ann-title" style={{ ...INPUT, width: '100%', boxSizing: 'border-box' }} value={title} onChange={e => setTitle(e.target.value)} />
            {errors.title && <div style={ERR}>{errors.title}</div>}
          </div>

          <div>
            <label style={LABEL} htmlFor="ann-body">Body *</label>
            <textarea id="ann-body" rows={4} style={{ ...INPUT, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} value={body} onChange={e => setBody(e.target.value)} />
            {errors.body && <div style={ERR}>{errors.body}</div>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL} htmlFor="ann-type">Type</label>
              <select id="ann-type" style={{ ...INPUT, width: '100%' }} value={type} onChange={e => setType(e.target.value as typeof type)}>
                {ANNOUNCEMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL} htmlFor="ann-audience">Audience</label>
              <select id="ann-audience" style={{ ...INPUT, width: '100%' }} value={audience} onChange={e => setAudience(e.target.value as AnnouncementAudience)}>
                <option value="ALL">All Users</option>
                <option value="LEARNERS">Learners</option>
                <option value="INSTRUCTORS">Instructors</option>
                <option value="DEPARTMENTS">Departments</option>
                <option value="GROUPS">Groups</option>
                <option value="CUSTOM">Custom (specific users)</option>
              </select>
            </div>
            <div>
              <label style={LABEL} htmlFor="ann-priority">Priority</label>
              <select id="ann-priority" style={{ ...INPUT, width: '100%' }} value={priority} onChange={e => setPriority(e.target.value as typeof priority)}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {needsTargets && (
            <div style={{ position: 'relative' }}>
              <label style={LABEL} htmlFor="ann-target-search">{audience === 'CUSTOM' ? 'Users *' : audience === 'DEPARTMENTS' ? 'Departments *' : 'Groups *'}</label>
              {selectedTargets.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  {selectedTargets.map(t => (
                    <span key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: 999 }}>
                      {t.label}
                      <button type="button" onClick={() => removeTarget(t.id)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>✕</button>
                    </span>
                  ))}
                </div>
              )}
              <input id="ann-target-search" style={{ ...INPUT, width: '100%', boxSizing: 'border-box' }} value={targetSearch} onChange={e => setTargetSearch(e.target.value)} placeholder={`Search ${audience.toLowerCase()}…`} />
              {targetOptions.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, marginTop: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 180, overflowY: 'auto' }}>
                  {targetOptions.map(o => (
                    <button key={o.id} type="button" onClick={() => addTarget(o)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#374151' }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
              {errors.targets && <div style={ERR}>{errors.targets}</div>}
            </div>
          )}

          <div>
            <label style={LABEL}>Schedule</label>
            <div style={{ display: 'flex', gap: 16, marginBottom: scheduleMode === 'later' ? 8 : 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                <input type="radio" checked={scheduleMode === 'now'} onChange={() => setScheduleMode('now')} /> Send Now
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                <input type="radio" checked={scheduleMode === 'later'} onChange={() => setScheduleMode('later')} /> Schedule for later
              </label>
            </div>
            {scheduleMode === 'later' && (
              <>
                <input type="datetime-local" style={INPUT} value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
                {errors.scheduledAt && <div style={ERR}>{errors.scheduledAt}</div>}
              </>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} disabled={submitting} style={BTN_SECONDARY}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ ...BTN_PRIMARY, opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Saving…' : mode === 'edit' ? 'Save Changes' : scheduleMode === 'now' ? 'Send Announcement' : 'Schedule Announcement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
