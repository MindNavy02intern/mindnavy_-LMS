// Instructor-side thread view — opened from InstructorLayout's topbar
// Messages dropdown. NOT a reuse of admin's MessageThreadModal.tsx: that
// component hardcodes the admin BASE_URL/token and admin's own
// senderAdminId-scoped /messages/:id/thread endpoint — wrong auth domain and
// wrong ownership direction for an instructor viewing a message they
// RECEIVED. Same visual language, opposite alignment (the admin's message is
// "them" here, the instructor's own replies are "You").
import { useEffect, useState } from 'react';
import { messageTypeBadgeStyle, priorityBadgeStyle, BTN_SECONDARY, ERROR_BANNER, INPUT } from '../../pages/instructor/instructorUiKit';
import { getMyMessageThread, replyToMessage, InstructorMessagesApiError } from '../../api/instructorMessagesApi';
import type { InstructorMessage, InstructorMessageReply } from '../../types/instructorMessages';

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

interface Props {
  messageId: string;
  onClose:   () => void;
  onChanged: () => void;
}

export default function InstructorMessageThreadModal({ messageId, onClose, onChanged }: Props) {
  const [message,  setMessage]  = useState<InstructorMessage | null>(null);
  const [replies,  setReplies]  = useState<InstructorMessageReply[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const [draft,    setDraft]    = useState('');
  const [sending,  setSending]  = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMyMessageThread(messageId)
      .then((t) => { if (!cancelled) { setMessage(t.message); setReplies(t.replies); setError(null); onChanged(); } })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof InstructorMessagesApiError ? err.message : 'Failed to load thread.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId]);

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const reply = await replyToMessage(messageId, draft.trim());
      setReplies((prev) => [...prev, reply]);
      setDraft('');
    } catch (err) {
      setSendError(err instanceof InstructorMessagesApiError ? err.message : 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />

      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid #f1f5f9', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>{message?.subject ?? 'Message'}</h3>
              {message && <span style={messageTypeBadgeStyle(message.messageType)}>{message.messageType.replace('_', ' ')}</span>}
              {message && message.priority !== 'NORMAL' && <span style={priorityBadgeStyle(message.priority)}>{message.priority}</span>}
            </div>
            {message?.senderName && (
              <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>
                From <strong>{message.senderName}</strong>{message.senderEmail ? ` · ${message.senderEmail}` : ''}
              </p>
            )}
          </div>
          <button onClick={onClose} aria-label="Close thread" style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', color: '#6b7280', padding: 0, flexShrink: 0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="mn-spinner" /></div>
          ) : error ? (
            <div style={ERROR_BANNER}>{error}</div>
          ) : message && (
            <>
              {/* Original message — from admin, left-aligned */}
              <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                <div style={{ background: '#f1f5f9', color: '#0f172a', borderRadius: '12px 12px 12px 4px', padding: '10px 14px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {message.body}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                  {message.senderName ?? 'Admin'} · {formatWhen(message.createdAt)}
                </div>
              </div>

              {/* Replies — from you, right-aligned */}
              {replies.map((r) => (
                <div key={r.id} style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
                  <div style={{ background: '#2563eb', color: '#fff', borderRadius: '12px 12px 4px 12px', padding: '10px 14px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {r.body}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 3 }}>
                    You · {formatWhen(r.createdAt)}
                  </div>
                </div>
              ))}

              {replies.length === 0 && (
                <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>No reply yet</div>
              )}
            </>
          )}
        </div>

        {message && !error && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sendError && <div style={{ ...ERROR_BANNER, padding: '6px 10px', fontSize: 11 }}>{sendError}</div>}
            <textarea
              style={{ ...INPUT, resize: 'vertical' }}
              rows={2}
              maxLength={2000}
              placeholder="Write a reply…"
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setSendError(null); }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" style={BTN_SECONDARY} onClick={onClose}>Close</button>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !draft.trim()}
                style={{
                  padding: '7px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', borderRadius: 7, border: 'none',
                  background: '#2563eb', color: '#fff', cursor: sending || !draft.trim() ? 'default' : 'pointer',
                  opacity: sending || !draft.trim() ? 0.6 : 1,
                }}
              >
                {sending ? 'Sending…' : 'Send Reply'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
