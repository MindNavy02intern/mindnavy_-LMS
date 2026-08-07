// Instructors page — Invitations tab. Real backend: GET/POST /api/admin/invitations
// + resend/cancel/expiration (backend/src/routes/invitations.routes.js). Reuses the
// existing invitations API client + types (frontend/src/api/users.ts,
// frontend/src/types/users.ts) — same real endpoints the Users module's
// InvitationsTab already calls, so this is one API, not a second implementation.
//
// The endpoint has no role filter server-side, so this scopes to role==='instructor'
// client-side — this page is Instructors-only and the table below has no Role
// column, so showing a Learner/Manager invite here with nothing to explain it would
// be a wrong-page leak, not a feature. Fetches up to the server's max page size
// (100) per filter, then paginates the role-filtered result client-side — same
// bounded-candidate-set tradeoff as instructors.service's RANKING_CEILING.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Calendar, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { getInvitations, getUsers, resendInvitation, cancelInvitation, updateInvitationExpiry, sendInvitation } from '../../api/users';
import type { Invitation, InvitationStatus, User } from '../../types/users';
import type { ToastType } from '../users/Toast';

interface Props {
  showToast: (type: ToastType, message: string) => void;
}

const FETCH_LIMIT = 100; // server max page size — see file header for the tradeoff

const STATUS_BADGE: Record<InvitationStatus, { bg: string; fg: string }> = {
  pending:  { bg: '#fef9c3', fg: '#a16207' },
  accepted: { bg: '#dcfce7', fg: '#15803d' },
  revoked:  { bg: '#fee2e2', fg: '#b91c1c' },
  expired:  { bg: '#f1f5f9', fg: '#64748b' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Local date-time input needs "YYYY-MM-DDTHH:mm" with no timezone suffix.
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TH: React.CSSProperties = { padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left', whiteSpace: 'nowrap' };
const TD: React.CSSProperties = { padding: '8px 10px', fontSize: 12, color: '#374151', borderTop: '1px solid #f1f5f9', verticalAlign: 'middle' };
const ICON_BTN: React.CSSProperties = { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' };
const INPUT: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151', fontFamily: 'inherit', outline: 'none' };

// Combo email input for the Send Invitation modal — type to search existing
// users (min 2 chars, GET /api/admin/users?search=&limit=10) or keep typing
// any email that isn't an existing user. Selecting a suggestion just fills the
// text field; the value the parent modal sends is always whatever text is in
// the box, existing user or not.
function EmailCombo({ value, onChange, disabled }: {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const [results, setResults] = useState<User[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function runSearch(query: string) {
    getUsers({ search: query, limit: 10 })
      .then(res => setResults(res.users))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }

  function handleChange(val: string) {
    onChange(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const query = val.trim();
    if (query.length < 2) {
      setLoading(false);
      setResults(null);
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    searchTimer.current = setTimeout(() => runSearch(query), 300);
  }

  function selectUser(user: User) {
    onChange(user.email);
    setOpen(false);
  }

  // Close on outside click or Escape — only listens while the dropdown is open.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="email"
        aria-label="Invitation email"
        value={value}
        disabled={disabled}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => { if (value.trim().length >= 2) setOpen(true); }}
        placeholder="Search users or type an email…"
        style={INPUT}
        autoComplete="off"
        autoFocus
      />
      {loading && (
        <Loader2 size={14} color="#94a3b8" style={{ position: 'absolute', right: 9, top: 9, animation: 'mn-spin 0.65s linear infinite' }} />
      )}
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto', zIndex: 10 }}>
          {loading && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: '#94a3b8' }}>Searching…</div>
          )}
          {!loading && results !== null && results.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: '#94a3b8' }}>No users found — invite by email anyway</div>
          )}
          {!loading && results && results.map(user => (
            <button
              key={user.id}
              type="button"
              onClick={() => selectUser(user)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              {user.avatar
                ? <img src={user.avatar} alt="" style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#e2e8f0', color: '#64748b', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {(user.fullName || '?')[0]?.toUpperCase()}
                  </div>
              }
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.fullName}</div>
                <div style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InstructorInvitationsTab({ showToast }: Props) {
  const [rows, setRows] = useState<Invitation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvitationStatus | ''>('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sendOpen, setSendOpen] = useState(false);
  const [sendEmail, setSendEmail] = useState('');
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [expiryTarget, setExpiryTarget] = useState<Invitation | null>(null);
  const [expiryValue, setExpiryValue] = useState('');
  const [expiryErr, setExpiryErr] = useState<string | null>(null);
  const [expiryBusy, setExpiryBusy] = useState(false);

  const fetchList = useCallback(() => {
    setLoading(true);
    setListError(null);
    getInvitations({ page: 1, limit: FETCH_LIMIT, search: search || undefined, status: statusFilter || undefined })
      .then(res => setRows(res.invitations.filter(inv => inv.role === 'instructor')))
      .catch(err => setListError(err instanceof Error ? err.message : 'Failed to load invitations.'))
      .finally(() => setLoading(false));
  }, [search, statusFilter]);

  useEffect(() => { fetchList(); }, [fetchList]);

  function handleSearchChange(val: string) {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearch(val); setPage(1); }, 400);
  }

  async function handleResend(inv: Invitation) {
    setBusyId(inv.id);
    try {
      const res = await resendInvitation(inv.id);
      showToast('success', res.message || `Invitation resent to ${inv.email}`);
      fetchList();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Resend failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(inv: Invitation) {
    if (!window.confirm(`Cancel the invitation to ${inv.email}?`)) return;
    setBusyId(inv.id);
    try {
      const res = await cancelInvitation(inv.id);
      showToast('success', res.message || 'Invitation cancelled.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Cancel failed.');
    } finally {
      setBusyId(null);
    }
  }

  function openExpiryModal(inv: Invitation) {
    setExpiryTarget(inv);
    setExpiryValue(toLocalInputValue(inv.expiresAt));
    setExpiryErr(null);
  }

  async function submitExpiry() {
    if (!expiryTarget || !expiryValue) return;
    const iso = new Date(expiryValue).toISOString();
    if (new Date(iso) <= new Date()) { setExpiryErr('Must be in the future.'); return; }
    setExpiryBusy(true);
    try {
      const res = await updateInvitationExpiry(expiryTarget.id, iso);
      showToast('success', res.message || 'Expiration date updated.');
      setExpiryTarget(null);
      fetchList();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setExpiryBusy(false);
    }
  }

  function openSend() {
    setSendEmail('');
    setSendErr(null);
    setSendOpen(true);
  }

  async function submitSend() {
    const email = sendEmail.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setSendErr('Enter a valid email address.'); return; }
    setSending(true);
    try {
      const res = await sendInvitation({ email, role: 'INSTRUCTOR', department: null, expiresInDays: 7, personalMessage: null });
      showToast('success', res.message || `Invitation sent to ${email}`);
      setSendOpen(false);
      fetchList();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Send failed.');
    } finally {
      setSending(false);
    }
  }

  const total = rows?.length ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageRows = (rows ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={searchInput}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="Search by email…"
          style={{ ...INPUT, width: 220 }}
        />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value as InvitationStatus | ''); setPage(1); }}
          style={{ ...INPUT, width: 160, cursor: 'pointer' }}
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="revoked">Revoked</option>
          <option value="expired">Expired</option>
        </select>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={openSend}
          style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer' }}
        >
          Send Invitation
        </button>
      </div>

      {listError && (
        <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#b91c1c' }}>
          {listError}
        </div>
      )}

      {loading && <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>Loading…</div>}

      {!loading && !listError && total === 0 && (
        <div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, background: '#f8fafc', padding: '32px 16px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          No invitations sent yet
        </div>
      )}

      {!loading && total > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={TH}>Email</th>
                  <th style={TH}>Status</th>
                  <th style={TH}>Sent At</th>
                  <th style={TH}>Expires At</th>
                  <th style={TH}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(inv => {
                  const busy = busyId === inv.id;
                  const badge = STATUS_BADGE[inv.status];
                  return (
                    <tr key={inv.id} style={busy ? { opacity: 0.5 } : undefined}>
                      <td style={{ ...TD, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inv.email}>{inv.email}</td>
                      <td style={TD}>
                        <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.fg }}>
                          {inv.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={TD}>{formatDate(inv.createdAt)}</td>
                      <td style={TD}>{formatDate(inv.expiresAt)}</td>
                      <td style={TD}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {(inv.status === 'pending' || inv.status === 'expired') && (
                            <button type="button" title="Resend" aria-label={`Resend invitation to ${inv.email}`} disabled={busy} onClick={() => handleResend(inv)} style={ICON_BTN}>
                              <RefreshCw size={13} color="#2563eb" strokeWidth={2} />
                            </button>
                          )}
                          {inv.status === 'pending' && (
                            <button type="button" title="Update Expiry" aria-label={`Update expiry for ${inv.email}`} disabled={busy} onClick={() => openExpiryModal(inv)} style={ICON_BTN}>
                              <Calendar size={13} color="#64748b" strokeWidth={2} />
                            </button>
                          )}
                          {(inv.status === 'pending' || inv.status === 'expired') && (
                            <button type="button" title="Cancel" aria-label={`Cancel invitation to ${inv.email}`} disabled={busy} onClick={() => handleCancel(inv)} style={ICON_BTN}>
                              <XCircle size={13} color="#dc2626" strokeWidth={2} />
                            </button>
                          )}
                          {inv.status === 'accepted' || inv.status === 'revoked' ? <span style={{ fontSize: 11, color: '#cbd5e1' }}>—</span> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>{total} invitation{total === 1 ? '' : 's'}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ ...ICON_BTN, width: 'auto', padding: '4px 10px' }}>Prev</button>
              <span style={{ fontSize: 12, color: '#64748b', padding: '4px 6px' }}>Page {page} / {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={{ ...ICON_BTN, width: 'auto', padding: '4px 10px' }}>Next</button>
            </div>
          </div>
        </div>
      )}

      {/* Send Invitation modal — email + a fixed role hint (this tab only ever
          invites instructors; a role picker belongs to the Users module's
          generic SendInvitationModal, not here). */}
      {sendOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!sending ? () => setSendOpen(false) : undefined} />
          <div role="dialog" aria-label="Send Invitation" style={{ position: 'relative', width: '100%', maxWidth: 380, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Send Invitation</h3>
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Email <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <EmailCombo
                  value={sendEmail}
                  onChange={val => { setSendEmail(val); setSendErr(null); }}
                  disabled={sending}
                />
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                Role: <span style={{ fontWeight: 600, color: '#374151' }}>Instructor</span>
              </div>
              {sendErr && <div style={{ fontSize: 11, color: '#dc2626' }}>{sendErr}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #f1f5f9' }}>
              <button type="button" onClick={() => setSendOpen(false)} disabled={sending} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
                Cancel
              </button>
              <button type="button" onClick={submitSend} disabled={sending} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, background: sending ? '#9ca3af' : '#2563eb', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#fff' }}>
                {sending ? 'Sending…' : 'Send Invitation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update Expiry modal */}
      {expiryTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!expiryBusy ? () => setExpiryTarget(null) : undefined} />
          <div role="dialog" aria-label="Update Expiry" style={{ position: 'relative', width: '100%', maxWidth: 360, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Update Expiry</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>For <strong>{expiryTarget.email}</strong></p>
            </div>
            <div style={{ padding: '14px 18px' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                New Expiration
              </label>
              <input
                type="datetime-local"
                aria-label="New expiration date"
                value={expiryValue}
                onChange={e => { setExpiryValue(e.target.value); setExpiryErr(null); }}
                style={INPUT}
              />
              {expiryErr && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{expiryErr}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #f1f5f9' }}>
              <button type="button" onClick={() => setExpiryTarget(null)} disabled={expiryBusy} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
                Cancel
              </button>
              <button type="button" onClick={submitExpiry} disabled={expiryBusy} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, background: expiryBusy ? '#9ca3af' : '#2563eb', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#fff' }}>
                {expiryBusy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
