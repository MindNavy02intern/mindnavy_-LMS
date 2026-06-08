import { useState } from 'react';
import { assignRole, ApiError } from '../../api/users';
import type { AssignRoleRequest, RoleType } from '../../types/users';
import type { ToastType } from './Toast';

interface Props {
  userId:    string;
  onClose:   () => void;
  onSuccess: () => void;
  showToast: (type: ToastType, message: string) => void;
}

const ROLES: { id: string; label: string }[] = [
  { id: 'LEARNER',         label: 'Learner'        },
  { id: 'INSTRUCTOR',      label: 'Instructor'     },
  { id: 'MANAGER',         label: 'Manager'        },
  { id: 'ADMIN_ASSISTANT', label: 'Admin Assistant'},
];

const TYPES: { value: RoleType; label: string }[] = [
  { value: 'primary',   label: 'Primary'   },
  { value: 'secondary', label: 'Secondary' },
  { value: 'temporary', label: 'Temporary' },
];

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #e5e7eb', borderRadius: 6,
  background: '#fff', color: '#374151',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};

export default function AssignRoleModal({ userId, onClose, onSuccess, showToast }: Props) {
  const [roleId,     setRoleId]     = useState('');
  const [type,       setType]       = useState<RoleType>('primary');
  const [expiresAt,  setExpiresAt]  = useState('');
  const [errors,     setErrors]     = useState<{ roleId?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!roleId) { setErrors({ roleId: 'Please select a role' }); return; }
    setErrors({});
    setSubmitting(true);

    const body: AssignRoleRequest = {
      roleId,
      type,
      expiresAt: type === 'temporary' && expiresAt ? new Date(expiresAt).toISOString() : null,
    };

    try {
      const res = await assignRole(userId, body);
      showToast('success', res.message || 'Role assigned successfully');
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) showToast('error', 'Not authorized');
        else if (err.status === 404) showToast('error', 'User not found');
        else showToast('error', err.message);
      } else {
        showToast('error', 'Something went wrong, please try again');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 400, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Assign Role</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Role */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Role <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            style={errors.roleId ? { ...INPUT, borderColor: '#fca5a5', background: '#fef2f2', cursor: 'pointer' } : { ...INPUT, cursor: 'pointer' }}
            value={roleId}
            onChange={e => setRoleId(e.target.value)}
          >
            <option value="">Select a role…</option>
            {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          {errors.roleId && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{errors.roleId}</div>}
        </div>

        {/* Type */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
            Type <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => setType(t.value)}
                style={{
                  flex: 1, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600,
                  borderRadius: 7, cursor: 'pointer',
                  background: type === t.value ? '#eff6ff' : '#f9fafb',
                  border: type === t.value ? '2px solid #2563eb' : '1px solid #e5e7eb',
                  color: type === t.value ? '#1d4ed8' : '#6b7280',
                  transition: 'all 0.12s ease',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Expiry Date — only for Temporary */}
        {type === 'temporary' && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Expiry Date
            </label>
            <input
              type="date"
              style={{ ...INPUT, cursor: 'pointer' }}
              value={expiresAt}
              onChange={e => setExpiresAt(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, background: submitting ? '#9ca3af' : '#2563eb', border: 'none', borderRadius: 7, cursor: submitting ? 'not-allowed' : 'pointer', color: '#fff' }}
          >
            {submitting ? 'Assigning…' : 'Assign Role'}
          </button>
        </div>
      </div>
    </div>
  );
}
