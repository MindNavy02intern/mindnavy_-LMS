// Instructor "+ Compose" — fresh message TO admin. Deliberately NOT a reuse
// of admin's SendMessageModal.tsx: that component's recipient picker hits
// GET /api/admin/users (admin-only auth domain), and even with a picker
// disabled it would still assume "any recipient", which is exactly what this
// flow must NOT allow. Recipient is never a free choice here — the backend
// (POST /api/instructor/messages) always routes to one designated admin
// account server-side; the UI reflects that with a fixed "To" line instead
// of a search box.
import { useState } from 'react';
import { LABEL, INPUT, BTN_SECONDARY, ERROR_BANNER } from '../../pages/instructor/instructorUiKit';
import { startMyMessageThread, InstructorMessagesApiError } from '../../api/instructorMessagesApi';

interface Props {
  onClose:   () => void;
  onSuccess: () => void;
}

export default function InstructorComposeModal({ onClose, onSuccess }: Props) {
  const [subject,    setSubject]    = useState('');
  const [body,       setBody]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [bodyError,    setBodyError]    = useState<string | null>(null);
  const [serverError,  setServerError]  = useState<string | null>(null);

  function validate(): boolean {
    let ok = true;
    if (!subject.trim()) { setSubjectError('Subject is required.'); ok = false; } else setSubjectError(null);
    if (!body.trim()) { setBodyError('Message body is required.'); ok = false; }
    else if (body.trim().length < 10) { setBodyError('Message must be at least 10 characters.'); ok = false; }
    else setBodyError(null);
    return ok;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      await startMyMessageThread(subject.trim(), body.trim());
      onSuccess();
    } catch (err) {
      const msg = err instanceof InstructorMessagesApiError ? err.message : 'Failed to send message.';
      setServerError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!submitting ? onClose : undefined} />

      <div role="dialog" aria-label="Message Admin" style={{ position: 'relative', width: '100%', maxWidth: 460, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '18px 24px 0' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Message Admin</h3>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>To <strong>Admin Support Team</strong></p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {serverError && <div style={ERROR_BANNER}>{serverError}</div>}

            <div>
              <label style={LABEL}>Subject <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setSubjectError(null); }}
                placeholder="What's this about?"
                style={{ ...INPUT, borderColor: subjectError ? '#ef4444' : undefined }}
                maxLength={150}
                autoFocus
              />
              {subjectError && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>{subjectError}</div>}
            </div>

            <div>
              <label style={LABEL}>Message <span style={{ color: '#ef4444' }}>*</span></label>
              <textarea
                value={body}
                onChange={(e) => { setBody(e.target.value); setBodyError(null); }}
                placeholder="Write your message (min. 10 characters)…"
                rows={5}
                style={{ ...INPUT, resize: 'vertical', minHeight: 100, borderColor: bodyError ? '#ef4444' : undefined }}
                maxLength={2000}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                {bodyError ? <div style={{ fontSize: 11, color: '#ef4444' }}>{bodyError}</div> : <div />}
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{body.trim().length} chars</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 24px', borderTop: '1px solid #f1f5f9' }}>
            <button type="button" style={BTN_SECONDARY} onClick={onClose} disabled={submitting}>Cancel</button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '8px 18px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, borderRadius: 7, border: 'none',
                background: submitting ? '#93c5fd' : '#2563eb', color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Sending…' : 'Send Message'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
