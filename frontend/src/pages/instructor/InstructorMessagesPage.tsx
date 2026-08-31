import { useEffect, useState } from 'react';
import InstructorLayout from './InstructorLayout';
import { INPUT, ERROR_BANNER, messageTypeBadgeStyle, priorityBadgeStyle } from './instructorUiKit';
import { listMyMessages, markMyMessageRead, replyToMessage, InstructorMessagesApiError } from '../../api/instructorMessagesApi';
import { listMyNotifications, markMyNotificationRead, markAllMyNotificationsRead, InstructorNotificationsApiError } from '../../api/instructorNotificationsApi';
import type { InstructorMessage } from '../../types/instructorMessages';
import type { InstructorNotification } from '../../types/instructorNotifications';

// Two tabs over two different real backend models (blueprint 2.10):
// one-way admin->instructor messages (AdminMessage) and the platform-wide
// in-app notification feed (NotificationLog, channel=IN_APP). Messages can
// now be replied to — the reply is stored in a separate AdminMessageReply
// row (AdminMessage itself stays strictly admin->user), shown as a small
// thread under the original message. Notifications stay read/mark-read only.

type Tab = 'messages' | 'notifications';

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function InstructorMessagesPage() {
  const [tab, setTab] = useState<Tab>('messages');
  const [messages, setMessages] = useState<InstructorMessage[]>([]);
  const [notifications, setNotifications] = useState<InstructorNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = () => {
    setLoading(true);
    listMyMessages()
      .then((res) => { setMessages(res.data); setError(null); })
      .catch((err: unknown) => setError(err instanceof InstructorMessagesApiError ? err.message : 'Failed to load messages.'))
      .finally(() => setLoading(false));
  };

  const loadNotifications = () => {
    setLoading(true);
    listMyNotifications()
      .then((res) => { setNotifications(res.items); setError(null); })
      .catch((err: unknown) => setError(err instanceof InstructorNotificationsApiError ? err.message : 'Failed to load notifications.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (tab === 'messages') loadMessages();
    else loadNotifications();
  }, [tab]);

  const unreadMessages = messages.filter((m) => m.status !== 'read').length;
  const unreadNotifications = notifications.filter((n) => !n.read).length;

  async function handleOpenMessage(m: InstructorMessage) {
    if (m.status === 'read') return;
    try {
      const updated = await markMyMessageRead(m.id);
      // markMyMessageRead's response doesn't carry `replies` (it's a plain
      // AdminMessage row) — keep whatever replies were already loaded rather
      // than clobbering them with an empty array.
      setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...updated, replies: x.replies } : x)));
    } catch (err) {
      setError(err instanceof InstructorMessagesApiError ? err.message : 'Failed to mark as read.');
    }
  }

  async function handleReply(messageId: string, body: string) {
    const reply = await replyToMessage(messageId, body);
    setMessages((prev) => prev.map((x) => (x.id === messageId ? { ...x, replies: [...x.replies, reply] } : x)));
  }

  async function handleOpenNotification(n: InstructorNotification) {
    if (n.read) return;
    try {
      const updated = await markMyNotificationRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? updated : x)));
    } catch (err) {
      setError(err instanceof InstructorNotificationsApiError ? err.message : 'Failed to mark as read.');
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllMyNotificationsRead();
      loadNotifications();
    } catch (err) {
      setError(err instanceof InstructorNotificationsApiError ? err.message : 'Failed to mark all as read.');
    }
  }

  return (
    <InstructorLayout>
      <div className="mn-db-welcome">
        <div>
          <h1 className="mn-db-welcome-title">Messages</h1>
          <p className="mn-db-welcome-sub">Messages from admin and your notification feed</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid #e2e8f0' }}>
        {([
          { key: 'messages' as Tab, label: 'Admin Messages', badge: unreadMessages },
          { key: 'notifications' as Tab, label: 'Notifications', badge: unreadNotifications },
        ]).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: '7px 14px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              color: tab === t.key ? '#2563eb' : '#64748b',
              borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {t.label}
            {t.badge > 0 && (
              <span style={{ background: '#dc2626', color: '#fff', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 6px' }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {error && <div style={{ ...ERROR_BANNER, marginBottom: 14 }}>{error}</div>}

      <div className="mn-db-card">
        {tab === 'notifications' && unreadNotifications > 0 && (
          <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" onClick={handleMarkAllRead} style={{ fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
              Mark all read
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="mn-spinner" /></div>
        ) : tab === 'messages' ? (
          messages.length === 0 ? (
            <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '30px 0' }}>No messages yet.</p>
          ) : (
            <div>
              {messages.map((m, idx) => (
                <MessageRow
                  key={m.id}
                  message={m}
                  isLast={idx === messages.length - 1}
                  onOpen={() => handleOpenMessage(m)}
                  onReply={(body) => handleReply(m.id, body)}
                />
              ))}
            </div>
          )
        ) : notifications.length === 0 ? (
          <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '30px 0' }}>You're all caught up.</p>
        ) : (
          <div>
            {notifications.map((n, idx) => (
              <div
                key={n.id}
                onClick={() => handleOpenNotification(n)}
                style={{
                  display: 'flex', gap: 10, padding: '12px 4px', cursor: n.read ? 'default' : 'pointer',
                  borderBottom: idx < notifications.length - 1 ? '1px solid #f1f5f9' : undefined,
                  background: n.read ? 'transparent' : '#eff6ff',
                }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.read ? 'transparent' : '#2563eb', marginTop: 5, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: n.read ? 500 : 700, color: '#0f172a' }}>{n.subject ?? '(No subject)'}</span>
                    <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{timeAgo(n.createdAt)}</span>
                  </div>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>{n.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </InstructorLayout>
  );
}

// ── One admin message + its reply thread + reply box ────────────────────────────

function MessageRow({ message, isLast, onOpen, onReply }: {
  message: InstructorMessage;
  isLast: boolean;
  onOpen: () => void;
  onReply: (body: string) => Promise<void>;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      await onReply(draft.trim());
      setDraft('');
      setReplyOpen(false);
    } catch (err) {
      setError(err instanceof InstructorMessagesApiError ? err.message : 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ padding: '12px 4px', borderBottom: isLast ? undefined : '1px solid #f1f5f9' }}>
      <div
        onClick={onOpen}
        style={{
          display: 'flex', gap: 10, cursor: message.status === 'read' ? 'default' : 'pointer',
          background: message.status === 'read' ? 'transparent' : '#eff6ff', padding: '4px', borderRadius: 6,
        }}
      >
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: message.status === 'read' ? 'transparent' : '#2563eb', marginTop: 5, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: message.status === 'read' ? 500 : 700, color: '#0f172a' }}>{message.subject ?? '(No subject)'}</span>
            <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{timeAgo(message.createdAt)}</span>
          </div>
          {(message.messageType !== 'DIRECT' || message.priority !== 'NORMAL') && (
            <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
              {message.messageType !== 'DIRECT' && <span style={messageTypeBadgeStyle(message.messageType)}>{message.messageType.replace('_', ' ')}</span>}
              {message.priority !== 'NORMAL' && <span style={priorityBadgeStyle(message.priority)}>{message.priority}</span>}
            </div>
          )}
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>{message.body}</p>
        </div>
      </div>

      {message.replies.length > 0 && (
        <div style={{ marginLeft: 18, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {message.replies.map((r) => (
            <div key={r.id} style={{ background: '#f8fafc', borderRadius: 6, padding: '8px 10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>Your reply</span>
                <span style={{ fontSize: 10, color: '#94a3b8' }}>{timeAgo(r.createdAt)}</span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: '#475569' }}>{r.body}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginLeft: 18, marginTop: 8 }}>
        {!replyOpen ? (
          <button
            type="button"
            onClick={() => setReplyOpen(true)}
            style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            Reply
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 420 }}>
            {error && <div style={{ ...ERROR_BANNER, padding: '6px 10px', fontSize: 11 }}>{error}</div>}
            <textarea
              style={{ ...INPUT, resize: 'vertical' }}
              rows={2}
              maxLength={2000}
              placeholder="Write a reply…"
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setError(null); }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleSend}
                disabled={sending || !draft.trim()}
                style={{
                  padding: '5px 12px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', borderRadius: 6, border: 'none',
                  background: '#2563eb', color: '#fff', cursor: sending || !draft.trim() ? 'default' : 'pointer',
                  opacity: sending || !draft.trim() ? 0.6 : 1,
                }}
              >
                {sending ? 'Sending…' : 'Send Reply'}
              </button>
              <button
                type="button"
                onClick={() => { setReplyOpen(false); setDraft(''); setError(null); }}
                disabled={sending}
                style={{ padding: '5px 12px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#374151', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
