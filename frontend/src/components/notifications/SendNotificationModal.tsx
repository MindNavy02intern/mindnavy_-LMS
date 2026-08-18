import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { getUsers } from '../../api/users';
import { sendNotification } from '../../services/notificationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { PRIORITIES, type NotificationPriority } from '../../types/notifications';
import { INPUT, LABEL, ERR, BTN_PRIMARY, BTN_SECONDARY } from './shared';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

interface UserOption { id: string; fullName: string; email: string }

export default function SendNotificationModal({ onClose, onSuccess, showToast }: Props) {
  const [userSearch, setUserSearch] = useState('');
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<UserOption[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<NotificationPriority>('NORMAL');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (userSearch.trim().length < 2) { setUserOptions([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      getUsers({ search: userSearch.trim(), limit: 8 }).then(res => {
        if (!cancelled) setUserOptions(res.users.map(u => ({ id: u.id, fullName: u.fullName, email: u.email })));
      }).catch(() => {});
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [userSearch]);

  function addUser(u: UserOption) {
    if (!selectedUsers.some(s => s.id === u.id)) setSelectedUsers(prev => [...prev, u]);
    setUserOptions([]);
    setUserSearch('');
  }
  function removeUser(id: string) { setSelectedUsers(prev => prev.filter(u => u.id !== id)); }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (selectedUsers.length === 0) next.users = 'Select at least one user.';
    if (!title.trim()) next.title = 'Title is required.';
    if (!body.trim()) next.body = 'Body is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await sendNotification({ userIds: selectedUsers.map(u => u.id), title: title.trim(), body: body.trim(), priority });
      invalidateFor(appQueryClient, 'notification.send');
      showToast('success', `Notification sent to ${res.sentCount} user(s).`);
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
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Send Notification</h3>
          <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}><X size={14} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {serverError && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#b91c1c' }}>{serverError}</div>}

          <div style={{ position: 'relative' }}>
            <label style={LABEL} htmlFor="sn-recipients">Recipients *</label>
            {selectedUsers.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                {selectedUsers.map(u => (
                  <span key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: '#eff6ff', color: '#2563eb', padding: '3px 8px', borderRadius: 999 }}>
                    {u.fullName}
                    <button type="button" onClick={() => removeUser(u.id)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>✕</button>
                  </span>
                ))}
              </div>
            )}
            <input id="sn-recipients" style={{ ...INPUT, width: '100%', boxSizing: 'border-box' }} value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search by name or email…" />
            {userOptions.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, marginTop: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 180, overflowY: 'auto' }}>
                {userOptions.map(u => (
                  <button key={u.id} type="button" onClick={() => addUser(u)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#374151' }}>
                    {u.fullName} <span style={{ color: '#94a3b8' }}>({u.email})</span>
                  </button>
                ))}
              </div>
            )}
            {errors.users && <div style={ERR}>{errors.users}</div>}
          </div>

          <div>
            <label style={LABEL} htmlFor="sn-title">Title *</label>
            <input id="sn-title" style={{ ...INPUT, width: '100%', boxSizing: 'border-box' }} value={title} onChange={e => setTitle(e.target.value)} />
            {errors.title && <div style={ERR}>{errors.title}</div>}
          </div>

          <div>
            <label style={LABEL} htmlFor="sn-body">Body *</label>
            <textarea id="sn-body" rows={3} style={{ ...INPUT, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} value={body} onChange={e => setBody(e.target.value)} />
            {errors.body && <div style={ERR}>{errors.body}</div>}
          </div>

          <div>
            <label style={LABEL} htmlFor="sn-priority">Priority</label>
            <select id="sn-priority" style={{ ...INPUT, width: '100%' }} value={priority} onChange={e => setPriority(e.target.value as NotificationPriority)}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} disabled={submitting} style={BTN_SECONDARY}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ ...BTN_PRIMARY, opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Sending…' : 'Send Notification'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
