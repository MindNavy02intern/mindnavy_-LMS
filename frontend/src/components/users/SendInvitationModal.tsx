import { useState } from 'react';
import { sendInvitation } from '../../api/users';
import type { ToastType } from './Toast';
import useOrgOptions from '../../hooks/useOrgOptions';

interface Props {
  onClose:   () => void;
  onSuccess: (email: string) => void;
  showToast: (type: ToastType, message: string) => void;
}

const ROLE_OPTIONS = [
  { value: 'LEARNER',         label: 'Learner'         },
  { value: 'INSTRUCTOR',      label: 'Instructor'      },
  { value: 'MANAGER',         label: 'Manager'         },
  { value: 'ADMIN_ASSISTANT', label: 'Admin Assistant' },
];

const EXPIRY_OPTIONS = [
  { value: 3,  label: '3 days'  },
  { value: 7,  label: '7 days (default)' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
];

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  border: '1px solid #d1d5db', borderRadius: 6, color: '#374151',
  background: '#ffffff', transition: 'border-color 0.15s, box-shadow 0.15s',
};

const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4,
};

function focusIn(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = '#3b82f6';
  e.currentTarget.style.boxShadow   = '0 0 0 2px rgba(59,130,246,0.15)';
}
function focusOut(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
  e.currentTarget.style.borderColor = '#d1d5db';
  e.currentTarget.style.boxShadow   = 'none';
}

export default function SendInvitationModal({ onClose, onSuccess, showToast }: Props) {
  const { depts } = useOrgOptions();

  const [email,           setEmail]           = useState('');
  const [role,            setRole]            = useState('');
  const [department,      setDepartment]      = useState('');
  const [expiresInDays,   setExpiresInDays]   = useState(7);
  const [personalMessage, setPersonalMessage] = useState('');
  const [submitting,      setSubmitting]      = useState(false);
  const [emailError,      setEmailError]      = useState<string | null>(null);
  const [roleError,       setRoleError]       = useState<string | null>(null);
  const [serverError,     setServerError]     = useState<string | null>(null);

  function validate(): boolean {
    let ok = true;
    const emailTrimmed = email.trim();
    if (!emailTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setEmailError('Enter a valid email address.');
      ok = false;
    } else {
      setEmailError(null);
    }
    if (!role) {
      setRoleError('Please select a role.');
      ok = false;
    } else {
      setRoleError(null);
    }
    return ok;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const res = await sendInvitation({
        email:           email.trim().toLowerCase(),
        role,
        department:      department || null,
        expiresInDays,
        personalMessage: personalMessage.trim() || null,
      });
      showToast('success', res.message || `Invitation sent to ${email.trim()}`);
      onSuccess(email.trim());
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send invitation.';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {/* Overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />

      {/* Modal */}
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 12,
        width: '100%', maxWidth: 480, padding: 24,
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Send Invitation</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>
              Invite someone to join as a learner, instructor, or manager.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', color: '#6b7280', padding: 0, flexShrink: 0 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {serverError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 12, color: '#b91c1c' }}>
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Email */}
            <div>
              <label style={LABEL}>Email Address <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailError(null); }}
                placeholder="user@example.com"
                autoComplete="off"
                style={{ ...INPUT, borderColor: emailError ? '#ef4444' : '#d1d5db' }}
                onFocus={focusIn} onBlur={focusOut}
              />
              {emailError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{emailError}</div>}
            </div>

            {/* Role */}
            <div>
              <label style={LABEL}>Role <span style={{ color: '#ef4444' }}>*</span></label>
              <select
                value={role}
                onChange={e => { setRole(e.target.value); setRoleError(null); }}
                style={{ ...INPUT, cursor: 'pointer', borderColor: roleError ? '#ef4444' : '#d1d5db' }}
                onFocus={focusIn} onBlur={focusOut}
              >
                <option value="">Select a role…</option>
                {ROLE_OPTIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              {roleError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{roleError}</div>}
            </div>

            {/* Department */}
            <div>
              <label style={LABEL}>Department <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
              <select
                value={department}
                onChange={e => setDepartment(e.target.value)}
                style={{ ...INPUT, cursor: 'pointer' }}
                onFocus={focusIn} onBlur={focusOut}
              >
                <option value="">No department</option>
                {depts.map(d => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
              </select>
            </div>

            {/* Expiry */}
            <div>
              <label style={LABEL}>Invitation Expires In</label>
              <select
                value={expiresInDays}
                onChange={e => setExpiresInDays(Number(e.target.value))}
                style={{ ...INPUT, cursor: 'pointer' }}
                onFocus={focusIn} onBlur={focusOut}
              >
                {EXPIRY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Personal Message */}
            <div>
              <label style={LABEL}>Personal Message <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
              <textarea
                value={personalMessage}
                onChange={e => setPersonalMessage(e.target.value)}
                placeholder="Add a personal note to the invitation email…"
                rows={3}
                style={{
                  ...INPUT, resize: 'vertical', minHeight: 72,
                  verticalAlign: 'top', lineHeight: 1.5,
                }}
                onFocus={focusIn} onBlur={focusOut}
              />
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              style={{
                padding: '8px 16px', fontSize: 13, fontFamily: 'inherit',
                background: '#f9fafb', border: '1px solid #e5e7eb',
                borderRadius: 7, cursor: 'pointer', color: '#374151',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '8px 18px', fontSize: 13, fontFamily: 'inherit',
                fontWeight: 600, background: submitting ? '#93c5fd' : '#2563eb',
                border: 'none', borderRadius: 7,
                cursor: submitting ? 'not-allowed' : 'pointer', color: '#fff',
              }}
            >
              {submitting ? 'Sending…' : '✉ Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
