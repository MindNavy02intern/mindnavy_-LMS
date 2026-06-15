import { useCallback, useEffect, useState } from 'react';
import { getUsers, approveVerification, deleteUser } from '../../api/users';
import type { User } from '../../types/users';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase();
}

const PALETTES = [
  { bg: '#E8F0FE', color: '#1A73E8' }, { bg: '#F3E8FF', color: '#7C3AED' },
  { bg: '#E8F8E8', color: '#16A34A' }, { bg: '#FFF3E0', color: '#E65100' },
  { bg: '#FFE8E8', color: '#DC2626' }, { bg: '#E0F7FA', color: '#0097A7' },
];
function palette(id: string) {
  const n = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return PALETTES[n % PALETTES.length];
}

function sk(w: number | string, h: number): React.CSSProperties {
  return {
    width: w, height: h, borderRadius: 4, display: 'block',
    background: 'linear-gradient(90deg,#f0f3f7 25%,#e8ecf2 50%,#f0f3f7 75%)',
    backgroundSize: '600px 100%',
    animation: 'mn-shimmer 1.3s ease-in-out infinite',
  };
}

function SkeletonRow() {
  return (
    <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
      <td style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ ...sk(30, 30), borderRadius: 15, flexShrink: 0 }} />
          <div><div style={sk(110, 11)} /><div style={{ ...sk(70, 9), marginTop: 4 }} /></div>
        </div>
      </td>
      {[140, 80, 60, 80].map((w, i) => (
        <td key={i} style={{ padding: '10px 14px' }}><div style={sk(w, 11)} /></td>
      ))}
      <td style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <div style={sk(60, 26)} /><div style={sk(56, 26)} />
        </div>
      </td>
    </tr>
  );
}

const TH: React.CSSProperties = {
  padding: '7px 14px', fontSize: 11, fontWeight: 600, letterSpacing: '0.5px',
  textTransform: 'uppercase', color: '#9ca3af', background: '#FAFAFA',
  borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap', textAlign: 'left',
};
const TD: React.CSSProperties = {
  padding: '10px 14px', borderBottom: '1px solid #f0f0f0',
  fontSize: 13, color: '#374151', verticalAlign: 'middle',
};

export default function PendingVerificationTab() {
  const [users,       setUsers]       = useState<User[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [confirmId,   setConfirmId]   = useState<string | null>(null);
  const [confirmType, setConfirmType] = useState<'approve' | 'reject' | null>(null);
  const [actionBusy,  setActionBusy]  = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const LIMIT = 10;

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getUsers({ verificationState: 'pending', page, limit: LIMIT })
      .then(res => { setUsers(res.users); setTotal(res.pagination.total); })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener('userDataChanged', handler);
    return () => window.removeEventListener('userDataChanged', handler);
  }, [load]);

  function notify() {
    window.dispatchEvent(new CustomEvent('userDataChanged'));
    window.dispatchEvent(new CustomEvent('analyticsUpdated'));
  }

  async function handleApprove(userId: string) {
    setActionBusy(userId);
    setActionError(null);
    setConfirmId(null);
    try {
      await approveVerification(userId);
      notify();
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActionBusy(null);
    }
  }

  async function handleReject(userId: string) {
    setActionBusy(userId);
    setActionError(null);
    setConfirmId(null);
    try {
      await deleteUser(userId);
      notify();
      load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActionBusy(null);
    }
  }

  const totalPages = Math.ceil(total / LIMIT) || 0;

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>

      {actionError && (
        <div style={{ margin: '10px 14px 0', padding: '8px 12px', fontSize: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#b91c1c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {actionError}
          <button onClick={() => setActionError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', fontSize: 14 }}>×</button>
        </div>
      )}

      {error && !loading && (
        <div style={{ margin: '10px 14px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#b91c1c', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {error}
          <button onClick={load} style={{ fontSize: 12, fontWeight: 600, color: '#b91c1c', background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
        <thead>
          <tr>
            <th style={TH}>User</th>
            <th style={TH}>Email</th>
            <th style={TH}>Role</th>
            <th style={TH}>Verification</th>
            <th style={TH}>Joined</th>
            <th style={{ ...TH, textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            : users.length === 0
              ? (
                <tr>
                  <td colSpan={6} style={{ padding: '3rem', textAlign: 'center' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" style={{ display: 'block', margin: '0 auto 8px' }}>
                      <circle cx="12" cy="12" r="10"/><polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>No pending verifications</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>All users have completed verification.</div>
                  </td>
                </tr>
              )
              : users.map(user => {
                  const av = palette(user.id);
                  const isBusy = actionBusy === user.id;
                  const isConfirming = confirmId === user.id;
                  return (
                    <tr key={user.id}
                      onMouseEnter={e => { e.currentTarget.style.background = '#f8faff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={TD}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 30, height: 30, borderRadius: '50%', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                            {initials(user.fullName)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>{user.fullName}</div>
                            <div style={{ fontSize: 11, color: '#9ca3af' }}>ID: {user.id.slice(0, 8)}…</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...TD, color: '#6b7280', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</td>
                      <td style={TD}>
                        <span style={{ background: '#f3f4f6', borderRadius: 12, fontSize: 11, fontWeight: 600, padding: '3px 8px', color: '#374151' }}>{user.role}</span>
                      </td>
                      <td style={TD}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 500, color: '#a16207' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EAB308', flexShrink: 0 }} />
                          {user.verificationState}
                        </span>
                      </td>
                      <td style={{ ...TD, color: '#9ca3af', fontSize: 12 }}>{formatDate(user.createdAt)}</td>
                      <td style={{ ...TD, textAlign: 'right' }}>
                        {isConfirming ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                            <span style={{ fontSize: 12, color: '#374151' }}>{confirmType === 'approve' ? 'Approve?' : 'Reject?'}</span>
                            <button
                              onClick={() => confirmType === 'approve' ? handleApprove(user.id) : handleReject(user.id)}
                              disabled={isBusy}
                              style={{ fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: '#fff', background: confirmType === 'approve' ? '#16a34a' : '#dc2626' }}
                            >
                              Confirm
                            </button>
                            <button onClick={() => { setConfirmId(null); setConfirmType(null); }}
                              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', fontFamily: 'inherit', color: '#6b7280' }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                            <button
                              onClick={() => { setConfirmId(user.id); setConfirmType('approve'); }}
                              disabled={isBusy}
                              style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 5, border: '1px solid #bbf7d0', background: '#f0fdf4', cursor: 'pointer', fontFamily: 'inherit', color: '#16a34a' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#dcfce7'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#f0fdf4'; }}
                            >
                              {isBusy ? '…' : '✓ Approve'}
                            </button>
                            <button
                              onClick={() => { setConfirmId(user.id); setConfirmType('reject'); }}
                              disabled={isBusy}
                              style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 5, border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer', fontFamily: 'inherit', color: '#dc2626' }}
                              onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = '#fef2f2'; }}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
          }
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', borderTop: '1px solid #e5e7eb', fontSize: 12, color: '#6b7280' }}>
          <span>{total.toLocaleString()} pending user{total !== 1 ? 's' : ''}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setPage(p => p - 1)} disabled={page <= 1 || loading}
              style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1, fontFamily: 'inherit', fontSize: 12 }}>
              ‹ Prev
            </button>
            <span style={{ padding: '3px 8px', fontSize: 12 }}>Page {page} / {totalPages}</span>
            <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages || loading}
              style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid #e5e7eb', background: '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, fontFamily: 'inherit', fontSize: 12 }}>
              Next ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
