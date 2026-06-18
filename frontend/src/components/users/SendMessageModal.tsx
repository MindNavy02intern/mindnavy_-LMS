import { useState } from 'react';
import { getStoredToken } from '../../api/adminAuth';
import type { ToastType } from './Toast';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

const MESSAGE_TYPE_OPTIONS = [
  { value: 'DIRECT',        label: 'Direct Message' },
  { value: 'WARNING',       label: 'Warning'        },
  { value: 'POLICY_UPDATE', label: 'Policy Update'  },
  { value: 'ANNOUNCEMENT',  label: 'Announcement'   },
  { value: 'FEEDBACK',      label: 'Feedback'       },
];

const PRIORITY_OPTIONS = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH',   label: 'High'   },
  { value: 'URGENT', label: 'Urgent' },
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

interface Props {
  userId:    string;
  userName:  string;
  onClose:   () => void;
  onSuccess: () => void;
  showToast: (type: ToastType, message: string) => void;
}

export default function SendMessageModal({ userId, userName, onClose, onSuccess, showToast }: Props) {
  const [subject,      setSubject]      = useState('');
  const [body,         setBody]         = useState('');
  const [type,         setType]         = useState('DIRECT');
  const [priority,     setPriority]     = useState('NORMAL');
  const [submitting,   setSubmitting]   = useState(false);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [bodyError,    setBodyError]    = useState<string | null>(null);
  const [serverError,  setServerError]  = useState<string | null>(null);

  function validate(): boolean {
    let ok = true;
    if (!subject.trim()) {
      setSubjectError('Subject is required.');
      ok = false;
    } else {
      setSubjectError(null);
    }
    if (!body.trim()) {
      setBodyError('Message body is required.');
      ok = false;
    } else if (body.trim().length < 10) {
      setBodyError('Message must be at least 10 characters.');
      ok = false;
    } else {
      setBodyError(null);
    }
    return ok;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const token = getStoredToken();
      const res = await fetch(`${BASE_URL}/messages`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          recipientId: userId,
          subject:     subject.trim(),
          body:        body.trim(),
          type,
          priority,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error((err as { message?: string })?.message ?? 'Failed to send');
      }

      showToast('success', 'Message sent successfully');
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      showToast('error', msg);
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {/* Overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />

      {/* Modal */}
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 12,
        width: '100%', maxWidth: 480, padding: 24,
        boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Send Message</h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>
              Sending to <strong>{userName}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', color: '#6b7280', padding: 0, flexShrink: 0 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {serverError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', marginBottom: 16, fontSize: 12, color: '#b91c1c' }}>
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Subject */}
            <div>
              <label style={LABEL}>Subject <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                value={subject}
                onChange={e => { setSubject(e.target.value); setSubjectError(null); }}
                placeholder="Enter message subject…"
                style={{ ...INPUT, borderColor: subjectError ? '#ef4444' : '#d1d5db' }}
                onFocus={focusIn} onBlur={focusOut}
              />
              {subjectError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{subjectError}</div>}
            </div>

            {/* Type + Priority row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={LABEL}>Message Type</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value)}
                  style={{ ...INPUT, cursor: 'pointer' }}
                  onFocus={focusIn} onBlur={focusOut}
                >
                  {MESSAGE_TYPE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={LABEL}>Priority</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value)}
                  style={{ ...INPUT, cursor: 'pointer' }}
                  onFocus={focusIn} onBlur={focusOut}
                >
                  {PRIORITY_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Message Body */}
            <div>
              <label style={LABEL}>Message Body <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea
                value={body}
                onChange={e => { setBody(e.target.value); setBodyError(null); }}
                placeholder="Write your message here (min. 10 characters)…"
                rows={5}
                style={{
                  ...INPUT, resize: 'vertical', minHeight: 100,
                  verticalAlign: 'top', lineHeight: 1.5,
                  borderColor: bodyError ? '#ef4444' : '#d1d5db',
                }}
                onFocus={focusIn} onBlur={focusOut}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                {bodyError
                  ? <div style={{ fontSize: 11, color: '#ef4444' }}>{bodyError}</div>
                  : <div />
                }
                <div style={{ fontSize: 11, color: body.trim().length < 10 ? '#9ca3af' : '#6b7280' }}>
                  {body.trim().length} chars
                </div>
              </div>
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
              {submitting ? 'Sending…' : '✉ Send Message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
