import { useCallback, useEffect, useState } from 'react';
import {
  getInvitations,
  resendInvitation,
  cancelInvitation,
  updateInvitationExpiry,
} from '../../api/users';
import type { Invitation, InvitationStatus } from '../../types/users';
import type { ToastType } from './Toast';
import SendInvitationModal from './SendInvitationModal';

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatRelative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs  = Math.abs(diff);
  const d = Math.floor(abs / 86_400_000);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor(abs / 60_000);
  if (diff < 0) return 'Expired';
  if (d > 0)    return `${d}d left`;
  if (h > 0)    return `${h}h left`;
  if (m > 0)    return `${m}m left`;
  return 'Expiring soon';
}

// Minimum date string for the expiry input (today + 1 day)
function minDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

// ── Style helpers ──────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<InvitationStatus, { bg: string; color: string; label: string }> = {
  pending:  { bg: '#fefce8', color: '#a16207', label: 'Pending'  },
  accepted: { bg: '#f0fdf4', color: '#16a34a', label: 'Accepted' },
  expired:  { bg: '#fef2f2', color: '#dc2626', label: 'Expired'  },
  revoked:  { bg: '#f9fafb', color: '#6b7280', label: 'Revoked'  },
};

const ROLE_DISPLAY: Record<string, string> = {
  learner:         'Learner',
  instructor:      'Instructor',
  manager:         'Manager',
  admin_assistant: 'Admin Assistant',
};

// ── Skeleton ───────────────────────────────────────────────────────────────────

function sk(w: number | string, h: number): React.CSSProperties {
  return {
    width: w, height: h, borderRadius: 4, display: 'inline-block',
    background: 'linear-gradient(90deg,#f0f3f7 25%,#e8ecf2 50%,#f0f3f7 75%)',
    backgroundSize: '600px 100%',
    animation: 'mn-shimmer 1.3s ease-in-out infinite',
  };
}

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
      <td style={{ padding: '10px 14px' }}><div style={sk(200, 11)} /></td>
      <td style={{ padding: '10px 14px' }}><div style={sk(80, 20)} /></td>
      <td style={{ padding: '10px 14px' }}><div style={sk(90, 11)} /></td>
      <td style={{ padding: '10px 14px' }}><div style={sk(100, 11)} /></td>
      <td style={{ padding: '10px 14px' }}><div style={sk(80, 11)} /></td>
      <td style={{ padding: '10px 14px' }}><div style={sk(70, 11)} /></td>
      <td style={{ padding: '10px 14px' }}><div style={sk(60, 20)} /></td>
      <td style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
          <div style={sk(60, 26)} /><div style={sk(60, 26)} />
        </div>
      </td>
    </tr>
  );
}

// ── Table header / cell styles ─────────────────────────────────────────────────

const TH: React.CSSProperties = {
  padding: '7px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px',
  textTransform: 'uppercase', color: '#9ca3af', background: '#FAFAFA',
  borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', textAlign: 'left',
};
const TD: React.CSSProperties = {
  padding: '10px 14px', borderBottom: '1px solid #f0f0f0',
  fontSize: 13, color: '#374151', verticalAlign: 'middle',
};

// ── Action button ──────────────────────────────────────────────────────────────

function ActionBtn({ label, onClick, disabled, danger, color }: {
  label:    string;
  onClick:  () => void;
  disabled?: boolean;
  danger?:  boolean;
  color?:   string;
}) {
  const bg  = danger ? '#fef2f2' : '#f9fafb';
  const bdr = danger ? '#fecaca' : '#e5e7eb';
  const clr = color ?? (danger ? '#dc2626' : '#374151');
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 5,
        border: `1px solid ${bdr}`, background: bg, cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', color: clr, opacity: disabled ? 0.5 : 1,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = danger ? '#fee2e2' : '#f0f9ff'; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = bg; }}
    >
      {label}
    </button>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  showToast:     (type: ToastType, message: string) => void;
  onUserUpdated?: () => void;
  onViewUsers?: () => void;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function InvitationsTab({ showToast, onUserUpdated, onViewUsers }: Props) {
  const [invitations,  setInvitations]  = useState<Invitation[]>([]);
  const [total,        setTotal]        = useState(0);
  const [page,         setPage]         = useState(1);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [sendOpen,     setSendOpen]     = useState(false);

  // Per-row busy/confirm/expiry-edit state
  const [busyId,      setBusyId]      = useState<string | null>(null);
  const [confirmId,   setConfirmId]   = useState<string | null>(null);
  const [expiryEditId, setExpiryEditId] = useState<string | null>(null);
  const [newExpiry,   setNewExpiry]   = useState('');

  const LIMIT = 10;

  function notify() {
    window.dispatchEvent(new CustomEvent('userDataChanged'));
    window.dispatchEvent(new CustomEvent('analyticsUpdated'));
    onUserUpdated?.();
  }

  const load = useCallback(() => {
    (() => { setLoading(true); setError(null); })();
    getInvitations({ page, limit: LIMIT, search: search || undefined, status: statusFilter || undefined })
      .then(res => { setInvitations(res.invitations); setTotal(res.pagination.total); })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load invitations.'))
      .finally(() => setLoading(false));
  }, [page, search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('userDataChanged', handler);
    return () => window.removeEventListener('userDataChanged', handler);
  }, [load]);

  // Debounced search
  useEffect(() => {
    const id = setTimeout(() => setPage(1), 400);
    return () => clearTimeout(id);
  }, [search]);

  async function handleResend(inv: Invitation) {
    setBusyId(inv.id);
    try {
      const res = await resendInvitation(inv.id);
      showToast('success', res.message || `Invitation resent to ${inv.email}`);
      notify();
      load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to resend.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(inv: Invitation) {
    setBusyId(inv.id);
    setConfirmId(null);
    try {
      const res = await cancelInvitation(inv.id);
      showToast('success', res.message || 'Invitation cancelled');
      notify();
      load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to cancel.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpdateExpiry(inv: Invitation) {
    if (!newExpiry) return;
    setBusyId(inv.id);
    setExpiryEditId(null);
    try {
      const isoExpiry = new Date(newExpiry).toISOString();
      const res = await updateInvitationExpiry(inv.id, isoExpiry);
      showToast('success', res.message || 'Expiration date updated');
      notify();
      load();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update expiry.');
    } finally {
      setBusyId(null);
      setNewExpiry('');
    }
  }

  const totalPages = Math.ceil(total / LIMIT) || 0;

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #f0f0f0', flexWrap: 'wrap' }}>
        {/* Search */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <svg style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search by email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              paddingLeft: 26, paddingRight: 8, paddingTop: 5, paddingBottom: 5,
              fontSize: 13, fontFamily: 'inherit', outline: 'none',
              background: '#fff', border: '1px solid #d1d5db', borderRadius: 6,
              color: '#374151', width: 200,
            }}
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          style={{
            padding: '5px 8px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
            background: '#fff', border: '1px solid #d1d5db', borderRadius: 6,
            color: '#374151', cursor: 'pointer',
          }}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </select>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Send invitation button */}
        <button
          onClick={() => setSendOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 12px', fontSize: 12, fontWeight: 600,
            background: '#2563eb', color: '#fff', border: '1px solid #1d4ed8',
            borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#1d4ed8'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#2563eb'; }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          Send Invitation
        </button>
      </div>

      {/* Error banner */}
      {error && !loading && (
        <div style={{ margin: '10px 14px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#b91c1c', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {error}
          <button onClick={load} style={{ fontSize: 12, fontWeight: 600, color: '#b91c1c', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Retry
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr>
              <th style={TH}>Email</th>
              <th style={TH}>Role</th>
              <th style={TH}>Department</th>
              <th style={TH}>Invited By</th>
              <th style={TH}>Invited</th>
              <th style={TH}>Expires</th>
              <th style={TH}>Status</th>
              <th style={{ ...TH, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              : invitations.length === 0
                ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '3rem', textAlign: 'center' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" style={{ display: 'block', margin: '0 auto 10px' }}>
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                        {statusFilter || search ? 'No invitations match your filters' : 'No invitations yet'}
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>
                        {statusFilter || search ? 'Try changing the status filter or search term.' : 'Send an invitation to get started.'}
                      </div>
                      {!statusFilter && !search && (
                        <button
                          onClick={() => setSendOpen(true)}
                          style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Send First Invitation
                        </button>
                      )}
                    </td>
                  </tr>
                )
                : invitations.map(inv => {
                    const st     = STATUS_STYLE[inv.status] ?? STATUS_STYLE.revoked;
                    const isBusy = busyId === inv.id;
                    const isConfirming  = confirmId   === inv.id;
                    const isEditingExpiry = expiryEditId === inv.id;

                    return (
                      <tr
                        key={inv.id}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f8faff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        {/* Email */}
                        <td style={{ ...TD, color: '#111827', fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {inv.email}
                        </td>

                        {/* Role */}
                        <td style={TD}>
                          <span style={{ background: '#f3f4f6', borderRadius: 12, fontSize: 11, fontWeight: 600, padding: '3px 8px', color: '#374151', whiteSpace: 'nowrap' }}>
                            {ROLE_DISPLAY[inv.role] ?? inv.role}
                          </span>
                        </td>

                        {/* Department */}
                        <td style={{ ...TD, color: '#6b7280' }}>
                          {inv.department ?? <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>

                        {/* Invited By */}
                        <td style={{ ...TD, color: '#374151', fontSize: 12 }}>
                          {inv.invitedByName ?? <span style={{ color: '#d1d5db' }}>—</span>}
                        </td>

                        {/* Invited date */}
                        <td style={{ ...TD, color: '#9ca3af', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {formatDate(inv.createdAt)}
                        </td>

                        {/* Expires */}
                        <td style={{ ...TD, fontSize: 12, whiteSpace: 'nowrap' }}>
                          {inv.status === 'pending' || inv.status === 'expired'
                            ? (
                              <span style={{ color: inv.status === 'expired' ? '#dc2626' : '#6b7280' }}>
                                {formatRelative(inv.expiresAt)}
                              </span>
                            )
                            : <span style={{ color: '#d1d5db' }}>—</span>
                          }
                        </td>

                        {/* Status badge */}
                        <td style={TD}>
                          <span style={{
                            background: st.bg, color: st.color,
                            borderRadius: 100, fontSize: 11, fontWeight: 600,
                            padding: '3px 9px', whiteSpace: 'nowrap',
                          }}>
                            {st.label}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ ...TD, textAlign: 'right' }}>
                          {isEditingExpiry ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                              <input
                                type="date"
                                value={newExpiry}
                                min={minDateStr()}
                                onChange={e => setNewExpiry(e.target.value)}
                                style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #d1d5db', borderRadius: 5, fontFamily: 'inherit', outline: 'none' }}
                              />
                              <ActionBtn
                                label="Save"
                                onClick={() => handleUpdateExpiry(inv)}
                                disabled={!newExpiry || isBusy}
                                color="#2563eb"
                              />
                              <ActionBtn
                                label="✕"
                                onClick={() => { setExpiryEditId(null); setNewExpiry(''); }}
                                disabled={isBusy}
                              />
                            </div>
                          ) : isConfirming ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                              <span style={{ fontSize: 12, color: '#374151' }}>Cancel this invitation?</span>
                              <ActionBtn label="Yes, cancel" onClick={() => handleCancel(inv)} disabled={isBusy} danger />
                              <ActionBtn label="Keep"       onClick={() => setConfirmId(null)} disabled={isBusy} />
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>

                              {/* PENDING actions */}
                              {inv.status === 'pending' && (
                                <>
                                  <ActionBtn label={isBusy ? '…' : '✉ Resend'}      onClick={() => handleResend(inv)}    disabled={isBusy} color="#2563eb" />
                                  <ActionBtn label="Change Expiry" onClick={() => { setExpiryEditId(inv.id); setNewExpiry(''); }} disabled={isBusy} />
                                  <ActionBtn label={isBusy ? '…' : 'Cancel'}         onClick={() => setConfirmId(inv.id)} disabled={isBusy} danger />
                                </>
                              )}

                              {/* EXPIRED actions */}
                              {inv.status === 'expired' && (
                                <ActionBtn label={isBusy ? '…' : '✉ Resend'} onClick={() => handleResend(inv)} disabled={isBusy} color="#2563eb" />
                              )}

                              {/* ACCEPTED — navigate to Users tab */}
                              {inv.status === 'accepted' && (
                                <button
                                  onClick={() => { window.dispatchEvent(new CustomEvent('userDataChanged')); onViewUsers?.(); }}
                                  style={{ fontSize: 11, fontWeight: 600, padding: '4px 9px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}
                                >
                                  View Users
                                </button>
                              )}

                              {/* REVOKED — no actions */}
                              {inv.status === 'revoked' && (
                                <span style={{ fontSize: 11, color: '#d1d5db' }}>No actions</span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
            }
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280' }}>
          <span>{total.toLocaleString()} invitation{total !== 1 ? 's' : ''}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setPage(p => p - 1)} disabled={page <= 1 || loading}
              style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1, fontFamily: 'inherit', fontSize: 12 }}>
              ‹ Prev
            </button>
            <span style={{ padding: '3px 8px' }}>Page {page} / {totalPages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages || loading}
              style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, fontFamily: 'inherit', fontSize: 12 }}>
              Next ›
            </button>
          </div>
        </div>
      )}

      {/* Send Invitation Modal */}
      {sendOpen && (
        <SendInvitationModal
          onClose={() => setSendOpen(false)}
          onSuccess={_email => { setSendOpen(false); notify(); load(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
