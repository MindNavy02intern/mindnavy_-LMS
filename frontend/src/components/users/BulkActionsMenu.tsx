import { useEffect, useRef, useState } from 'react';
import { bulkAction } from '../../api/users';
import type { BulkActionType } from '../../types/users';
import type { User } from '../../types/users';

interface Props {
  selectedIds:      string[];
  users:            User[];
  onClearSelection: () => void;
  onSuccess:        () => void;
  showToast:        (type: 'success' | 'error', message: string) => void;
}

const ROLE_OPTIONS = [
  { value: 'LEARNER',         label: 'Learner'         },
  { value: 'INSTRUCTOR',      label: 'Instructor'      },
  { value: 'MANAGER',         label: 'Manager'         },
  { value: 'ADMIN_ASSISTANT', label: 'Admin Assistant' },
];

type ActionKey = BulkActionType;

const ACTION_LABELS: Record<ActionKey, string> = {
  suspend:     'suspended',
  reactivate:  'reactivated',
  archive:     'archived',
  assign_role: 'updated',
  notify:      'notified',
};

export default function BulkActionsMenu({ selectedIds, users: _users, onClearSelection, onSuccess, showToast }: Props) {
  const [open,          setOpen]          = useState(false);
  const [confirmAction, setConfirmAction] = useState<ActionKey | null>(null);
  const [assignRoleVal, setAssignRoleVal] = useState('LEARNER');
  const [notifyMsg,     setNotifyMsg]     = useState('');
  const [busy,          setBusy]          = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmAction(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const count = selectedIds.length;
  const disabled = count === 0 || busy;

  async function runBulk(action: ActionKey, params: Record<string, string> = {}) {
    setBusy(true);
    setOpen(false);
    setConfirmAction(null);
    try {
      const result = await bulkAction({ userIds: selectedIds, action, params });
      const label  = ACTION_LABELS[action];
      if (result.failed === 0) {
        showToast('success', `${result.succeeded} user${result.succeeded !== 1 ? 's' : ''} ${label}`);
      } else if (result.succeeded === 0) {
        showToast('error', `All ${result.failed} actions failed`);
      } else {
        showToast('error', `${result.succeeded} ${label}, ${result.failed} failed`);
      }
      window.dispatchEvent(new CustomEvent('userDataChanged'));
      window.dispatchEvent(new CustomEvent('analyticsUpdated'));
      onClearSelection();
      onSuccess();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Bulk action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {/* Selection badge — only when items are selected */}
      {count > 0 && (
        <>
          <span style={{
            fontSize: 12, fontWeight: 600, color: '#2563eb',
            background: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap',
          }}>
            {count} selected
          </span>
          <button
            onClick={onClearSelection}
            disabled={busy}
            title="Clear selection"
            style={{ fontSize: 12, color: '#9ca3af', background: 'none', border: 'none', cursor: busy ? 'not-allowed' : 'pointer', padding: '3px 5px', borderRadius: 4 }}
            onMouseEnter={e => { if (!busy) { e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = '#f3f4f6'; } }}
            onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'none'; }}
          >
            ✕
          </button>
        </>
      )}

      {/* Trigger */}
      <button
        onClick={() => { if (!disabled) { setOpen(o => !o); setConfirmAction(null); } }}
        disabled={disabled}
        title={count === 0 ? 'Select users to enable bulk actions' : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', fontSize: 13, fontWeight: 600,
          background: disabled ? '#f3f4f6' : (open ? '#1d4ed8' : '#2563eb'),
          color: disabled ? '#9ca3af' : '#fff',
          border: disabled ? '1px solid #e5e7eb' : 'none',
          borderRadius: 7, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        }}
      >
        {busy ? 'Processing…' : 'Bulk Actions'}
        {!busy && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
      </button>

      {/* Dropdown */}
      {open && !disabled && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 9,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 260, overflow: 'hidden',
        }}>
          <div style={{ padding: '6px 14px 4px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {count} user{count !== 1 ? 's' : ''} selected
          </div>
          <div style={{ height: 1, background: '#f3f4f6', margin: '2px 0' }} />

          {/* ── Confirm panel: suspend / reactivate / delete ── */}
          {confirmAction && confirmAction !== 'assign_role' && confirmAction !== 'notify' && (
            <div style={{
              padding: '12px 14px',
              background: confirmAction === 'archive' ? '#fff7ed' : '#fffbeb',
              borderBottom: '1px solid #e5e7eb',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: confirmAction === 'archive' ? '#92400e' : '#92400e', marginBottom: 8 }}>
                {confirmAction === 'suspend'    && `Suspend ${count} user${count !== 1 ? 's' : ''}?`}
                {confirmAction === 'reactivate' && `Reactivate ${count} user${count !== 1 ? 's' : ''}?`}
                {confirmAction === 'archive'    && `Archive ${count} user${count !== 1 ? 's' : ''}? They will lose access to the system.`}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => runBulk(confirmAction)}
                  style={{
                    flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600,
                    background: confirmAction === 'archive' ? '#c2410c' : '#2563eb',
                    color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Assign role panel ── */}
          {confirmAction === 'assign_role' && (
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                Assign role to {count} user{count !== 1 ? 's' : ''}
              </div>
              <select
                value={assignRoleVal}
                onChange={e => setAssignRoleVal(e.target.value)}
                style={{ width: '100%', padding: '7px 8px', fontSize: 13, borderRadius: 6, border: '1px solid #d1d5db', marginBottom: 8, fontFamily: 'inherit', color: '#374151', background: '#fff' }}
              >
                {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => runBulk('assign_role', { role: assignRoleVal })}
                  style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Apply
                </button>
                <button
                  onClick={() => setConfirmAction(null)}
                  style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Send notification panel ── */}
          {confirmAction === 'notify' && (
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                Send notification to {count} user{count !== 1 ? 's' : ''}
              </div>
              <textarea
                value={notifyMsg}
                onChange={e => setNotifyMsg(e.target.value)}
                placeholder="Enter notification message…"
                rows={3}
                style={{ width: '100%', padding: '7px 8px', fontSize: 13, borderRadius: 6, border: '1px solid #d1d5db', marginBottom: 8, fontFamily: 'inherit', color: '#374151', resize: 'vertical', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => notifyMsg.trim() && runBulk('notify', { message: notifyMsg.trim() })}
                  disabled={!notifyMsg.trim()}
                  style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600, background: notifyMsg.trim() ? '#2563eb' : '#9ca3af', color: '#fff', border: 'none', borderRadius: 6, cursor: notifyMsg.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}
                >
                  Send
                </button>
                <button
                  onClick={() => { setConfirmAction(null); setNotifyMsg(''); }}
                  style={{ flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600, background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* ── Action list ── */}
          {!confirmAction && (
            <>
              {([
                { key: 'suspend'     as ActionKey, label: 'Suspend All',          icon: '🚫', danger: false },
                { key: 'reactivate'  as ActionKey, label: 'Reactivate All',       icon: '✅', danger: false },
                { key: 'assign_role' as ActionKey, label: 'Assign Role',          icon: '🔑', danger: false },
                { key: 'notify'      as ActionKey, label: 'Send Notification',    icon: '📢', danger: false },
                { key: 'archive'     as ActionKey, label: 'Archive All',          icon: '🗂️', danger: true  },
              ] as { key: ActionKey; label: string; icon: string; danger: boolean }[]).map(a => (
                <button
                  key={a.key}
                  onClick={() => { if (a.key === 'notify') setNotifyMsg(''); setConfirmAction(a.key); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', fontSize: 13, fontFamily: 'inherit',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: a.danger ? '#dc2626' : '#374151', textAlign: 'left',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = a.danger ? '#fef2f2' : '#f8faff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                >
                  <span style={{ fontSize: 14 }}>{a.icon}</span>
                  {a.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
