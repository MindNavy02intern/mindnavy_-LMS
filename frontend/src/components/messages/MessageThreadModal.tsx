import { useEffect, useState } from 'react';
import { getStoredToken } from '../../api/adminAuth';
import SendMessageModal from '../users/SendMessageModal';
import type { ToastType } from '../users/Toast';
import { MessageTypeBadge, PriorityBadge } from '../notifications/shared';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

interface ThreadMessage {
  id:             string;
  receiverUserId: string;
  subject:        string | null;
  body:           string;
  messageType:    string;
  priority:       string;
  createdAt:      string;
  receiverName:   string | null;
}

interface ThreadReply {
  id:        string;
  body:      string;
  createdAt: string;
}

interface ThreadResponse {
  success: boolean;
  message: ThreadMessage;
  replies: ThreadReply[];
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

interface Props {
  messageId: string;
  onClose:   () => void;
  onChanged: () => void;
  showToast: (type: ToastType, message: string) => void;
}

export default function MessageThreadModal({ messageId, onClose, onChanged, showToast }: Props) {
  const [thread,     setThread]     = useState<ThreadResponse | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [replyOpen,  setReplyOpen]  = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const token = getStoredToken();
    fetch(`${BASE_URL}/messages/${messageId}/thread`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok || !data) throw new Error(data?.message ?? 'Failed to load thread');
        return data as ThreadResponse;
      })
      .then((data) => { if (!cancelled) { setThread(data); onChanged(); } })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load thread'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // onChanged intentionally excluded — it only needs to fire once per open
    // (clears the outbox unread badge), not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageId]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2400, display: replyOpen ? 'contents' : 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {/* While the Reply compose modal is open on top, hide this modal's own
          overlay+card instead of stacking two semi-transparent overlays —
          for a tall thread the card underneath could visibly peek out from
          behind the (shorter, fixed-height) compose card otherwise. */}
      {!replyOpen && (
        <>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />

          <div style={{
            position: 'relative', background: '#fff', borderRadius: 12,
            width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.22)',
          }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 14px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
                {thread?.message.subject ?? 'Message'}
              </h3>
              {thread && <MessageTypeBadge messageType={thread.message.messageType} />}
              {thread && thread.message.priority !== 'NORMAL' && <PriorityBadge priority={thread.message.priority} />}
            </div>
            {thread?.message.receiverName && (
              <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280' }}>
                With <strong>{thread.message.receiverName}</strong>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close thread"
            style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', color: '#6b7280', padding: 0, flexShrink: 0 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <div style={{ width: 20, height: 20, border: '2px solid #e2e8f0', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'mn-spin 0.65s linear infinite' }} />
            </div>
          ) : error ? (
            <div style={{ fontSize: 13, color: '#b91c1c', textAlign: 'center', padding: 16 }}>{error}</div>
          ) : thread && (
            <>
              {/* Original message — admin, right-aligned */}
              <div style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
                <div style={{ background: '#2563eb', color: '#fff', borderRadius: '12px 12px 4px 12px', padding: '10px 14px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {thread.message.body}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 3 }}>
                  You · {formatWhen(thread.message.createdAt)}
                </div>
              </div>

              {/* Replies — instructor, left-aligned */}
              {thread.replies.map((r) => (
                <div key={r.id} style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                  <div style={{ background: '#f1f5f9', color: '#0f172a', borderRadius: '12px 12px 12px 4px', padding: '10px 14px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {r.body}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                    {thread.message.receiverName ?? 'Instructor'} · {formatWhen(r.createdAt)}
                  </div>
                </div>
              ))}

              {thread.replies.length === 0 && (
                <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '12px 0' }}>No reply yet</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {thread && !error && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setReplyOpen(true)}
              style={{
                padding: '8px 18px', fontSize: 13, fontFamily: 'inherit',
                fontWeight: 600, background: '#2563eb',
                border: 'none', borderRadius: 7, cursor: 'pointer', color: '#fff',
              }}
            >
              Reply
            </button>
          </div>
        )}
          </div>
        </>
      )}

      {replyOpen && thread && (
        <SendMessageModal
          userId={thread.message.receiverUserId}
          userName={thread.message.receiverName ?? 'this instructor'}
          onClose={() => setReplyOpen(false)}
          onSuccess={() => { setReplyOpen(false); onChanged(); showToast('success', 'Reply sent'); onClose(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
