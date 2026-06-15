// "Delete" soft-archives the user — the backend sets status to ARCHIVED, data is retained.
import { useState } from 'react';
import { deleteUser as archiveUser, ApiError } from '../../api/users';
import type { ToastType } from './Toast';

interface Props {
  userId:    string;
  email:     string;
  fullName:  string;
  onClose:   () => void;
  onSuccess: () => void;
  showToast: (type: ToastType, message: string) => void;
}

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #e5e7eb', borderRadius: 6,
  background: '#fff', color: '#374151',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};

export default function DeleteUserDialog({ userId, email, fullName, onClose, onSuccess, showToast }: Props) {
  const [typed,      setTyped]      = useState('');
  const [submitting, setSubmitting] = useState(false);

  const confirmed = typed === email;

  const handleArchive = async () => {
    if (!confirmed) return;
    setSubmitting(true);
    try {
      const res = await archiveUser(userId);
      showToast('success', res.message || `${fullName} has been archived`);
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) showToast('error', 'Not authorized');
        else if (err.status === 404) showToast('error', 'User not found');
        else showToast('error', err.message);
      } else {
        showToast('error', 'Something went wrong, please try again');
      }
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>

        {/* Icon + title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c2410c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="4" rx="1"/><path d="M4 7v12a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7"/><path d="M10 11h4"/>
            </svg>
          </div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Archive User</h3>
        </div>

        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 12px', marginBottom: 16 }}>
          <p style={{ margin: 0, fontSize: 13, color: '#92400e', lineHeight: 1.6 }}>
            Archive this user? <strong>{fullName}</strong> will lose access to the system. Their records will remain available for audit and reporting.
          </p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Type <code style={{ background: '#f3f4f6', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>{email}</code> to confirm:
          </label>
          <input
            style={typed && !confirmed ? { ...INPUT, borderColor: '#fca5a5', background: '#fef2f2' } : INPUT}
            value={typed}
            onChange={e => setTyped(e.target.value)}
            placeholder={email}
            autoComplete="off"
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={submitting} style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
            Cancel
          </button>
          <button
            onClick={handleArchive}
            disabled={!confirmed || submitting}
            style={{
              padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
              background: !confirmed || submitting ? '#fed7aa' : '#c2410c',
              border: 'none', borderRadius: 7,
              cursor: !confirmed || submitting ? 'not-allowed' : 'pointer', color: '#fff',
            }}
          >
            {submitting ? 'Archiving…' : 'Archive User'}
          </button>
        </div>
      </div>
    </div>
  );
}
