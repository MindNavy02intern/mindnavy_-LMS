import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToastType } from '../users/Toast';
import {
  listAccessPolicies,
  getAccessPolicyStats,
  deleteAccessPolicy,
  AccessPolicyError,
} from '../../api/accessPoliciesPage';
import type {
  AccessPolicy,
  AccessPolicyStats,
  PolicyResource,
  PolicyAction,
  PolicyStatus,
  PolicyEffect,
} from '../../api/accessPoliciesPage';
import CreatePolicyModal from './CreatePolicyModal';

// ── Static option lists ──────────────────────────────────────────────────────

const RESOURCE_OPTIONS: PolicyResource[] = ['USERS', 'REPORTS', 'SETTINGS', 'ORGANIZATION', 'LEARNERS', 'COURSES', 'ADMIN'];
const ACTION_OPTIONS:   PolicyAction[]   = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'MANAGE', 'EXPORT'];

const RESOURCE_BADGE: Record<PolicyResource, { bg: string; color: string }> = {
  USERS:        { bg: '#eff6ff', color: '#2563eb' },
  REPORTS:      { bg: '#faf5ff', color: '#7c3aed' },
  SETTINGS:     { bg: '#fff7ed', color: '#c2410c' },
  ORGANIZATION: { bg: '#f0fdf4', color: '#16a34a' },
  LEARNERS:     { bg: '#f0fdfa', color: '#0f766e' },
  COURSES:      { bg: '#eef2ff', color: '#4338ca' },
  ADMIN:        { bg: '#fef2f2', color: '#dc2626' },
};

const STATUS_BADGE: Record<PolicyStatus, { bg: string; color: string }> = {
  ACTIVE:   { bg: '#f0fdf4', color: '#16a34a' },
  INACTIVE: { bg: '#f9fafb', color: '#6b7280' },
};

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, iconBg, iconColor, icon, loading }: {
  label: string; value: number; iconBg: string; iconColor: string; icon: React.ReactNode; loading: boolean;
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '14px 16px',
      border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: iconBg, color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {loading ? (
          <>
            <div style={{ width: 70, height: 9, borderRadius: 3, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite', marginBottom: 7 }} />
            <div style={{ width: 40, height: 16, borderRadius: 3, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite' }} />
          </>
        ) : (
          <>
            <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#111827', lineHeight: 1 }}>{value.toLocaleString()}</div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr>
      {[170, 80, 70, 70, 50, 110, 70, 70].map((w, i) => (
        <td key={i} style={{ padding: '11px 14px' }}>
          <div style={{ width: w, height: 11, borderRadius: 4, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  showToast: (type: ToastType, message: string) => void;
}

export default function AccessPoliciesTab({ showToast }: Props) {
  // Stats
  const [stats, setStats] = useState<AccessPolicyStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchStats = useCallback(() => {
    (() => setStatsLoading(true))();
    getAccessPolicyStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  // List + filters
  const [policies, setPolicies] = useState<AccessPolicy[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [totalPolicies, setTotalPolicies] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<PolicyStatus | 'ALL'>('ALL');
  const [effectFilter, setEffectFilter] = useState<PolicyEffect | 'ALL'>('ALL');
  const [resourceFilter, setResourceFilter] = useState<PolicyResource | ''>('');
  const [actionFilter, setActionFilter] = useState<PolicyAction | ''>('');

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { setSearch(value); setPage(1); }, 400);
  };

  const PAGE_SIZE = 10;

  const fetchList = useCallback(() => {
    (() => setListLoading(true))();
    listAccessPolicies({
      page, limit: PAGE_SIZE, search,
      status: statusFilter, effect: effectFilter,
      resource: resourceFilter || undefined,
      action: actionFilter || undefined,
    })
      .then(res => {
        setPolicies(res.data);
        setTotalPolicies(res.pagination.total);
        setTotalPages(res.pagination.pages);
      })
      .catch(() => { setPolicies([]); showToast('error', 'Failed to load access policies'); })
      .finally(() => setListLoading(false));
  }, [page, search, statusFilter, effectFilter, resourceFilter, actionFilter, showToast]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchList();  }, [fetchList]);

  useEffect(() => {
    const refresh = () => { fetchStats(); fetchList(); };
    window.addEventListener('rolesUpdated', refresh);
    return () => window.removeEventListener('rolesUpdated', refresh);
  }, [fetchStats, fetchList]);

  // Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<AccessPolicy | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleCreateSuccess = () => { setCreateOpen(false); fetchStats(); fetchList(); };
  const handleEditSuccess   = () => { setEditPolicy(null);  fetchStats(); fetchList(); };

  const handleDelete = async (policy: AccessPolicy) => {
    if (!window.confirm(`Delete "${policy.name}"? This cannot be undone.`)) return;
    setDeletingId(policy.id);
    try {
      await deleteAccessPolicy(policy.id);
      showToast('success', 'Policy deleted');
      window.dispatchEvent(new CustomEvent('rolesUpdated'));
      window.dispatchEvent(new CustomEvent('analyticsUpdated'));
      fetchStats(); fetchList();
    } catch (err) {
      if (err instanceof AccessPolicyError && err.status === 404) {
        showToast('error', 'Policy not found');
      } else {
        showToast('error', err instanceof Error ? err.message : 'Failed to delete policy');
      }
    } finally { setDeletingId(null); }
  };

  const rowStart = (page - 1) * PAGE_SIZE + 1;
  const rowEnd   = Math.min(page * PAGE_SIZE, totalPolicies);

  return (
    <div>
      <style>{`@keyframes rp-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }`}</style>

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 18 }}>
        <StatCard label="Total Policies" value={stats?.totalPolicies ?? 0} loading={statsLoading}
          iconBg="#f3f4f6" iconColor="#374151"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>} />
        <StatCard label="Active Policies" value={stats?.activePolicies ?? 0} loading={statsLoading}
          iconBg="#f0fdf4" iconColor="#16a34a"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>} />
        <StatCard label="Inactive Policies" value={stats?.inactivePolicies ?? 0} loading={statsLoading}
          iconBg="#f9fafb" iconColor="#6b7280"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>} />
        <StatCard label="Allow Policies" value={stats?.allowPolicies ?? 0} loading={statsLoading}
          iconBg="#eff6ff" iconColor="#2563eb"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>} />
        <StatCard label="Deny Policies" value={stats?.denyPolicies ?? 0} loading={statsLoading}
          iconBg="#fef2f2" iconColor="#dc2626"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>} />
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

        {/* ── Toolbar ────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              placeholder="Search policies..."
              value={searchInput}
              onChange={e => handleSearchInput(e.target.value)}
              style={{ paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6, border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', color: '#374151', background: '#fff', width: 170, outline: 'none' }}
              onFocus={e => (e.target.style.borderColor = '#3b82f6')}
              onBlur={e  => (e.target.style.borderColor = '#e5e7eb')}
            />
          </div>

          <select className="rp-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value as PolicyStatus | 'ALL'); setPage(1); }}>
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <select className="rp-select" value={effectFilter} onChange={e => { setEffectFilter(e.target.value as PolicyEffect | 'ALL'); setPage(1); }}>
            <option value="ALL">All Effects</option>
            <option value="ALLOW">Allow</option>
            <option value="DENY">Deny</option>
          </select>

          <select className="rp-select" value={resourceFilter} onChange={e => { setResourceFilter(e.target.value as PolicyResource | ''); setPage(1); }}>
            <option value="">All Resources</option>
            {RESOURCE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <select className="rp-select" value={actionFilter} onChange={e => { setActionFilter(e.target.value as PolicyAction | ''); setPage(1); }}>
            <option value="">All Actions</option>
            {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          <button
            onClick={() => setCreateOpen(true)}
            style={{ marginLeft: 'auto', padding: '7px 14px', fontSize: 12.5, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 1px 3px rgba(37,99,235,0.3)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create Policy
          </button>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px', minWidth: 180 }}>POLICY NAME</th>
                <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px' }}>RESOURCE</th>
                <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px' }}>ACTION</th>
                <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px' }}>EFFECT</th>
                <th style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px' }}>PRIORITY</th>
                <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px' }}>ROLE</th>
                <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px' }}>STATUS</th>
                <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {listLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

              {!listLoading && policies.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>No access policies found.</span>
                      <button
                        onClick={() => setCreateOpen(true)}
                        style={{ padding: '6px 14px', fontSize: 12.5, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        + Create your first policy
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!listLoading && policies.map(policy => {
                const resourceBadge = RESOURCE_BADGE[policy.resource] ?? { bg: '#f3f4f6', color: '#374151' };
                const statusBadge   = STATUS_BADGE[policy.status] ?? { bg: '#f9fafb', color: '#6b7280' };
                const isDeleting    = deletingId === policy.id;
                return (
                  <tr key={policy.id} className="rp-table-row" style={{ borderBottom: '1px solid #f3f4f6', opacity: isDeleting ? 0.5 : 1 }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#111827', fontSize: 12.5, lineHeight: 1.3 }}>{policy.name}</div>
                      {policy.description && (
                        <div style={{ fontSize: 11, color: '#9ca3af', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                          {policy.description}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{ background: resourceBadge.bg, color: resourceBadge.color, borderRadius: 100, fontSize: 10.5, fontWeight: 600, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                        {policy.resource}
                      </span>
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{ background: '#f3f4f6', color: '#374151', borderRadius: 100, fontSize: 10.5, fontWeight: 600, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                        {policy.action}
                      </span>
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      {policy.effect === 'ALLOW' ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#f0fdf4', color: '#16a34a', borderRadius: 100, fontSize: 10.5, fontWeight: 600, padding: '2px 8px' }}>✓ Allow</span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#fef2f2', color: '#dc2626', borderRadius: 100, fontSize: 10.5, fontWeight: 600, padding: '2px 8px' }}>✗ Deny</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 500, color: '#374151' }}>
                      {policy.priority}
                    </td>
                    <td style={{ padding: '10px 10px', color: '#6b7280', fontSize: 12 }}>
                      {policy.role?.name ?? 'All Roles'}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{ background: statusBadge.bg, color: statusBadge.color, borderRadius: 100, fontSize: 10.5, fontWeight: 600, padding: '2px 8px' }}>
                        {policy.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <button className="rp-action-btn" title="Edit policy" onClick={() => setEditPolicy(policy)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="rp-action-btn danger" title="Delete policy" disabled={isDeleting} onClick={() => handleDelete(policy)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid #f3f4f6' }}>
          {!listLoading ? (
            <span style={{ color: '#6b7280', fontSize: 11.5 }}>
              Showing {totalPolicies === 0 ? 0 : rowStart} to {rowEnd} of {totalPolicies} policies
            </span>
          ) : (
            <div style={{ width: 160, height: 9, borderRadius: 3, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite' }} />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {totalPages > 1 && (
              <>
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ width: 28, height: 28, fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', color: page <= 1 ? '#d1d5db' : '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const p = i + 1;
                  return (
                    <button key={p} onClick={() => setPage(p)} style={{ width: 28, height: 28, fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: p === page ? '#2563eb' : '#fff', color: p === page ? '#fff' : '#374151', cursor: 'pointer', fontWeight: p === page ? 600 : 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{p}</button>
                  );
                })}
                {totalPages > 5 && <span style={{ color: '#9ca3af', fontSize: 12 }}>...</span>}
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ width: 28, height: 28, fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: page >= totalPages ? '#d1d5db' : '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Create modal ───────────────────────────────────────────────────── */}
      {createOpen && (
        <CreatePolicyModal
          onClose={() => setCreateOpen(false)}
          onSuccess={handleCreateSuccess}
          showToast={showToast}
        />
      )}

      {/* ── Edit modal ──────────────────────────────────────────────────────── */}
      {editPolicy && (
        <CreatePolicyModal
          onClose={() => setEditPolicy(null)}
          onSuccess={handleEditSuccess}
          showToast={showToast}
          editPolicy={editPolicy}
        />
      )}
    </div>
  );
}
