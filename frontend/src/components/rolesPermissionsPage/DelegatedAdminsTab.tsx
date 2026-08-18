import { useCallback, useEffect, useState } from 'react';
import type { ToastType } from '../users/Toast';
import {
  listDelegatedAdmins, getAdminDirectory, grantDelegatedAdmin, revokeDelegatedAdmin,
  listCompanyRoles, RolesPermissionsExtraError,
} from '../../api/rolesPermissionsExtra';
import type { DelegatedAdminGrant, DelegatedAdminStatus, AdminDirectoryEntry, CompanyRole } from '../../api/rolesPermissionsExtra';

const STATUS_BADGE: Record<DelegatedAdminStatus, { bg: string; color: string }> = {
  ACTIVE:  { bg: '#f0fdf4', color: '#16a34a' },
  REVOKED: { bg: '#f9fafb', color: '#6b7280' },
  EXPIRED: { bg: '#fff7ed', color: '#c2410c' },
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function SkeletonRow() {
  return (
    <tr>
      {[180, 140, 100, 100, 90].map((w, i) => (
        <td key={i} style={{ padding: '11px 14px' }}>
          <div style={{ width: w, height: 11, borderRadius: 4, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  );
}

// ── Grant modal ───────────────────────────────────────────────────────────────

function GrantModal({ admins, roles, onClose, onSuccess, showToast }: {
  admins: AdminDirectoryEntry[];
  roles: CompanyRole[];
  onClose: () => void;
  onSuccess: () => void;
  showToast: (type: ToastType, message: string) => void;
}) {
  const [adminId, setAdminId] = useState(admins[0]?.id ?? '');
  const [scopeRole, setScopeRole] = useState(roles[0]?.name ?? '');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleGrant() {
    if (!adminId || !scopeRole) { showToast('error', 'Select an admin and a company role.'); return; }
    setSaving(true);
    try {
      await grantDelegatedAdmin({ adminId, scopeRole, reason: reason.trim() || null, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null });
      showToast('success', 'Delegated admin access granted.');
      onSuccess();
    } catch (err) {
      showToast('error', err instanceof RolesPermissionsExtraError ? err.message : 'Failed to grant access.');
    } finally { setSaving(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, width: 440, padding: 22 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#111827' }}>Grant Delegated Admin Access</h3>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Admin</label>
        <select value={adminId} onChange={e => setAdminId(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 7, marginBottom: 12 }}>
          {admins.length === 0 && <option value="">No admins available</option>}
          {admins.map(a => <option key={a.id} value={a.id}>{a.fullName} ({a.email})</option>)}
        </select>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Delegated Role</label>
        <select value={scopeRole} onChange={e => setScopeRole(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 7, marginBottom: 12 }}>
          {roles.length === 0 && <option value="">No company roles available</option>}
          {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
        </select>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Reason (optional)</label>
        <input value={reason} onChange={e => setReason(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 7, marginBottom: 12, boxSizing: 'border-box' }} />

        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Expires (optional — leave blank for no expiry)</label>
        <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 7, marginBottom: 18, boxSizing: 'border-box' }} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', fontSize: 12.5, fontWeight: 500, background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button onClick={handleGrant} disabled={saving || admins.length === 0 || roles.length === 0} style={{ padding: '8px 16px', fontSize: 12.5, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Granting…' : 'Grant Access'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function DelegatedAdminsTab({ showToast }: { showToast: (type: ToastType, message: string) => void }) {
  const [grants, setGrants] = useState<DelegatedAdminGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState<AdminDirectoryEntry[]>([]);
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [grantOpen, setGrantOpen] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchList = useCallback(() => {
    setLoading(true);
    listDelegatedAdmins({ limit: 50 })
      .then(res => setGrants(res.data))
      .catch(() => { setGrants([]); showToast('error', 'Failed to load delegated admins'); })
      .finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => {
    getAdminDirectory().then(setAdmins).catch(() => {});
    listCompanyRoles({ limit: 50, status: 'ACTIVE' }).then(res => setRoles(res.data)).catch(() => {});
  }, []);

  const handleGrantSuccess = () => { setGrantOpen(false); fetchList(); };

  const handleRevoke = async (grant: DelegatedAdminGrant) => {
    if (!window.confirm(`Revoke delegated access for ${grant.admin?.fullName ?? 'this admin'}?`)) return;
    setRevokingId(grant.id);
    try {
      await revokeDelegatedAdmin(grant.id);
      showToast('success', 'Delegated admin access revoked.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to revoke access.');
    } finally { setRevokingId(null); }
  };

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Delegated Admins</div>
          <div style={{ fontSize: 11.5, color: '#6b7280' }}>Time-boxed console access grants — tracked and audited here</div>
        </div>
        <button onClick={() => setGrantOpen(true)} style={{ padding: '7px 14px', fontSize: 12.5, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Grant Access
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
              <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>ADMIN</th>
              <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>DELEGATED ROLE</th>
              <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>GRANTED BY</th>
              <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>EXPIRES</th>
              <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>STATUS</th>
              <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)}
            {!loading && grants.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No delegated admin grants yet.</td></tr>
            )}
            {!loading && grants.map(grant => {
              const badge = STATUS_BADGE[grant.effectiveStatus] ?? STATUS_BADGE.REVOKED;
              const isActive = grant.effectiveStatus === 'ACTIVE';
              return (
                <tr key={grant.id} className="rp-table-row" style={{ borderBottom: '1px solid #f3f4f6', opacity: revokingId === grant.id ? 0.5 : 1 }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, color: '#111827' }}>{grant.admin?.fullName ?? 'Unknown'}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af' }}>{grant.admin?.email ?? ''}</div>
                  </td>
                  <td style={{ padding: '10px 10px', color: '#374151' }}>{grant.scopeRole}</td>
                  <td style={{ padding: '10px 10px', color: '#6b7280', fontSize: 12 }}>{grant.grantedBy?.fullName ?? '—'}</td>
                  <td style={{ padding: '10px 10px', color: '#6b7280', fontSize: 12 }}>{fmtDate(grant.expiresAt)}</td>
                  <td style={{ padding: '10px 10px' }}>
                    <span style={{ background: badge.bg, color: badge.color, borderRadius: 100, fontSize: 10.5, fontWeight: 600, padding: '2px 8px' }}>
                      {grant.effectiveStatus.charAt(0) + grant.effectiveStatus.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    {isActive && (
                      <button className="rp-action-btn danger" title="Revoke access" disabled={revokingId === grant.id} onClick={() => handleRevoke(grant)}
                        style={{ fontSize: 11.5, fontWeight: 600, padding: '4px 10px' }}>
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {grantOpen && <GrantModal admins={admins} roles={roles} onClose={() => setGrantOpen(false)} onSuccess={handleGrantSuccess} showToast={showToast} />}
    </div>
  );
}
