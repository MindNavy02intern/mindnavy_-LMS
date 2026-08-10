// New — no existing Users-module reset-password modal to mirror (checked;
// none exists). Same modal shell/shape as SuspendLearnerDialog for consistency
// within this module.

import { useState } from 'react';
import { resetLearnerPassword } from '../../services/learnersApi';
import { LearnerApiError } from '../../types/learners';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  learnerId: string;
  fullName:  string;
  onClose:   () => void;
  onSuccess: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  border: '1px solid #e5e7eb', borderRadius: 6,
  background: '#fff', color: '#374151',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};

export default function ResetLearnerPasswordDialog({ learnerId, fullName, onClose, onSuccess, showToast }: Props) {
  const [newPassword, setNewPassword] = useState('');
  const [confirm,      setConfirm]    = useState('');
  const [err,          setErr]        = useState('');
  const [submitting,   setSubmitting] = useState(false);

  async function handleSubmit() {
    if (submitting) return;
    if (newPassword.length < 12) { setErr('Password must be at least 12 characters (upper, lower, digit, symbol).'); return; }
    if (newPassword !== confirm) { setErr('Passwords do not match.'); return; }
    setErr('');
    setSubmitting(true);
    try {
      await resetLearnerPassword(learnerId, { newPassword });
      invalidateFor(appQueryClient, 'learner.resetPassword', { id: learnerId });
      showToast('success', `${fullName}'s password has been reset. All active sessions were revoked.`);
      onSuccess();
    } catch (e) {
      showToast('error', e instanceof LearnerApiError ? e.message : 'Something went wrong, please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={!submitting ? onClose : undefined} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 400, padding: 24, boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#111827' }}>Reset Password</h3>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#4b5563', lineHeight: 1.6 }}>
          Set a new password for <strong>{fullName}</strong>. This revokes all of their active sessions.
        </p>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>New Password</label>
          <input type="password" aria-label="New password" style={INPUT} value={newPassword} onChange={e => { setNewPassword(e.target.value); setErr(''); }} placeholder="≥12 chars, upper+lower+digit+symbol" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Confirm Password</label>
          <input type="password" aria-label="Confirm password" style={INPUT} value={confirm} onChange={e => { setConfirm(e.target.value); setErr(''); }} />
        </div>
        {err && <div style={{ fontSize: 11, color: '#dc2626', marginBottom: 12 }}>{err}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={submitting} style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, background: submitting ? '#9ca3af' : '#2563eb', border: 'none', borderRadius: 7, cursor: submitting ? 'not-allowed' : 'pointer', color: '#fff' }}
          >
            {submitting ? 'Resetting…' : 'Reset Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
