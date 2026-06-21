import { useCallback, useEffect, useRef, useState } from 'react';
import AdminLayout from '../layouts/AdminLayout';
import { useToast, ToastContainer } from '../components/users/Toast';
import type { ToastType } from '../components/users/Toast';
import CreateRoleModal from '../components/rolesPermissionsPage/CreateRoleModal';
import RoleDetailsDrawer from '../components/rolesPermissionsPage/RoleDetailsDrawer';
import {
  getRolesPageStats,
  getRolesPageList,
  deleteRolePage,
  duplicateRolePage,
  RolesPageError,
} from '../api/rolesPage';
import type { RolePage, RolePageStats, RoleStatus } from '../types/rolesPage';

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'lms',          label: 'LMS Roles'        },
  { key: 'departments',  label: 'Department Roles'  },
  { key: 'system',       label: 'System Roles'      },
  { key: 'custom',       label: 'Custom Roles'      },
  { key: 'api',          label: 'API Access'        },
  { key: 'templates',    label: 'Templates'         },
  { key: 'history',      label: 'Change History'    },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '',         label: 'All Statuses' },
  { value: 'ACTIVE',   label: 'Active'       },
  { value: 'INACTIVE', label: 'Inactive'     },
];

const STATUS_BADGE: Record<RoleStatus, { bg: string; color: string }> = {
  ACTIVE:   { bg: '#f0fdf4', color: '#16a34a' },
  INACTIVE: { bg: '#f9fafb', color: '#6b7280' },
};

// ── Small helpers ─────────────────────────────────────────────────────────────

function KpiCard({
  label, value, loading,
}: {
  label: string; value: number; loading: boolean;
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '16px 18px',
      border: '1px solid #e5e7eb', flex: 1, minWidth: 0,
    }}>
      {loading ? (
        <>
          <style>{`@keyframes rp-pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
          <div style={{ width: 80, height: 12, borderRadius: 4, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite', marginBottom: 8 }} />
          <div style={{ width: 50, height: 22, borderRadius: 4, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite' }} />
        </>
      ) : (
        <>
          <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{value.toLocaleString()}</span>
          </div>
        </>
      )}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[44, 160, 60, 70, 70, 80].map((w, i) => (
        <td key={i} style={{ padding: '12px 14px' }}>
          <div style={{ width: w, height: 12, borderRadius: 4, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 10, minHeight: 220,
      color: '#9ca3af',
    }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{label} — Coming Soon</div>
      <div style={{ fontSize: 12 }}>This section is under construction</div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RolesPermissionsStandalonePage() {
  const { toasts, showToast, dismiss } = useToast();

  // ── Stats ──────────────────────────────────────────────────────────────────
  const [stats, setStats]               = useState<RolePageStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchStats = useCallback(() => {
    setStatsLoading(true);
    getRolesPageStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  // ── List ───────────────────────────────────────────────────────────────────
  const [roles, setRoles]               = useState<RolePage[]>([]);
  const [listLoading, setListLoading]   = useState(true);
  const [totalPages, setTotalPages]     = useState(1);
  const [totalRoles, setTotalRoles]     = useState(0);

  const [page,         setPage]         = useState(1);
  const [search,       setSearch]       = useState('');
  const [searchInput,  setSearchInput]  = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSearch(value);
      setPage(1);
    }, 350);
  };

  const fetchList = useCallback(() => {
    setListLoading(true);
    getRolesPageList({ page, limit: 15, search, status: statusFilter })
      .then(res => {
        setRoles(res.data);
        setTotalPages(res.pagination.pages);
        setTotalRoles(res.pagination.total);
      })
      .catch(() => {
        setRoles([]);
        showToast('error', 'Failed to load roles');
      })
      .finally(() => setListLoading(false));
  }, [page, search, statusFilter, showToast]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchList(); }, [fetchList]);

  useEffect(() => {
    const handler = () => { fetchStats(); fetchList(); };
    window.addEventListener('rolesUpdated', handler);
    return () => window.removeEventListener('rolesUpdated', handler);
  }, [fetchStats, fetchList]);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('lms');

  // Selected roles checkboxes
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleAll = () => {
    if (selectedIds.size === roles.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(roles.map(r => r.id)));
  };

  // ── Modal / drawer ─────────────────────────────────────────────────────────
  const [createOpen,  setCreateOpen]  = useState(false);
  const [editRole,    setEditRole]    = useState<RolePage | null>(null);
  const [viewRoleId,  setViewRoleId]  = useState<string | null>(null);

  const handleCreateSuccess = () => {
    setCreateOpen(false);
    fetchStats();
    fetchList();
  };

  const handleEditSuccess = () => {
    setEditRole(null);
    fetchStats();
    fetchList();
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (roleId: string, roleName: string) => {
    const confirmed = window.confirm(`Delete role "${roleName}"? This action cannot be undone.`);
    if (!confirmed) return;
    setDeletingId(roleId);
    try {
      await deleteRolePage(roleId);
      showToast('success', `Role "${roleName}" deleted successfully`);
      window.dispatchEvent(new CustomEvent('rolesUpdated'));
      window.dispatchEvent(new CustomEvent('analyticsUpdated'));
      fetchStats();
      fetchList();
    } catch (err) {
      if (err instanceof RolesPageError && err.code === 'ROLE_HAS_USERS') {
        showToast('error', `Cannot delete: ${err.roleName ?? roleName} has ${err.count ?? 0} users assigned.`);
      } else {
        showToast('error', err instanceof Error ? err.message : 'Failed to delete role');
      }
    } finally {
      setDeletingId(null);
    }
  };

  // ── Duplicate ──────────────────────────────────────────────────────────────
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const handleDuplicateRow = async (roleId: string, roleName: string) => {
    setDuplicatingId(roleId);
    try {
      const dup = await duplicateRolePage(roleId);
      showToast('success', `Role duplicated as "${dup.name}"`);
      window.dispatchEvent(new CustomEvent('rolesUpdated'));
      window.dispatchEvent(new CustomEvent('analyticsUpdated'));
      fetchStats();
      fetchList();
    } catch (err) {
      if (err instanceof RolesPageError && err.status === 404) {
        showToast('error', 'Role not found');
      } else {
        showToast('error', err instanceof Error ? err.message : `Failed to duplicate "${roleName}"`);
      }
    } finally {
      setDuplicatingId(null);
    }
  };

  // ── KPI data ───────────────────────────────────────────────────────────────
  const kpis = [
    { label: 'Total Roles',       value: stats?.totalRoles       ?? 0 },
    { label: 'Active Roles',      value: stats?.activeRoles      ?? 0 },
    { label: 'Inactive Roles',    value: stats?.inactiveRoles    ?? 0 },
    { label: 'Total Permissions', value: stats?.totalPermissions ?? 0 },
    { label: 'Users with Roles',  value: stats?.usersWithRoles   ?? 0 },
  ];

  return (
    <AdminLayout pageTitle="Roles & Permissions">
      <style>{`
        @keyframes rp-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
        .rp-action-btn { background:none; border:none; cursor:pointer; padding:4px 6px; border-radius:5px; color:#6b7280; font-size:14px; transition:background 0.15s,color 0.15s; }
        .rp-action-btn:hover { background:#f0f0f0; color:#111827; }
        .rp-action-btn.danger:hover { background:#fef2f2; color:#dc2626; }
        .rp-filter-select { padding:7px 10px; border:1px solid #e5e7eb; border-radius:7px; font-size:13px; font-family:inherit; color:#374151; background:#fff; cursor:pointer; }
        .rp-filter-select:focus { outline:none; border-color:#3b82f6; }
      `}</style>

      <div style={{ padding: '24px 24px 40px', maxWidth: 1400, margin: '0 auto' }}>

        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Roles & Permissions</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            Manage access control, define permissions, and assign roles to users across the platform.
          </p>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          {kpis.map(k => (
            <KpiCard key={k.label} label={k.label} value={k.value} loading={statsLoading} />
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, marginBottom: 0, borderBottom: '2px solid #f0f0f0', overflowX: 'auto' }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '10px 16px', fontSize: 13, fontWeight: 500,
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : '2px solid transparent',
                color: activeTab === tab.key ? '#3b82f6' : '#6b7280',
                marginBottom: -2, whiteSpace: 'nowrap',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ marginTop: 20 }}>

          {/* LMS Roles tab */}
          {activeTab === 'lms' && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>

              {/* Toolbar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
                borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap',
              }}>
                {/* Search */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"
                    style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                  >
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    type="text"
                    placeholder="Search roles…"
                    value={searchInput}
                    onChange={e => handleSearchInput(e.target.value)}
                    style={{
                      paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7,
                      border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13,
                      fontFamily: 'inherit', color: '#374151', background: '#fff', width: 200,
                    }}
                    onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                    onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
                  />
                </div>

                {/* Status filter */}
                <select
                  className="rp-filter-select"
                  value={statusFilter}
                  onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                >
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>

                <div style={{ flex: 1 }} />

                {/* Result count */}
                {!listLoading && (
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>
                    {totalRoles} role{totalRoles !== 1 ? 's' : ''}
                  </span>
                )}

                {/* Create Role button */}
                <button
                  onClick={() => setCreateOpen(true)}
                  style={{
                    padding: '7px 14px', fontSize: 13, fontWeight: 600,
                    background: '#3b82f6', color: '#fff',
                    border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Create Role
                </button>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 12, width: 40 }}>
                        <input
                          type="checkbox"
                          checked={roles.length > 0 && selectedIds.size === roles.length}
                          onChange={toggleAll}
                          style={{ cursor: 'pointer' }}
                        />
                      </th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 12, minWidth: 200 }}>ROLE NAME</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 12 }}>USERS</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 12 }}>PERMISSIONS</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 12 }}>STATUS</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: '#6b7280', fontSize: 12 }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

                    {!listLoading && roles.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>No roles found</span>
                            <span style={{ fontSize: 12 }}>Try adjusting your filters or create a new role</span>
                          </div>
                        </td>
                      </tr>
                    )}

                    {!listLoading && roles.map(role => {
                      const statusBadge = STATUS_BADGE[role.status] ?? { bg: '#f9fafb', color: '#6b7280' };
                      const isDeleting  = deletingId === role.id;
                      const isDuplicating = duplicatingId === role.id;
                      return (
                        <tr
                          key={role.id}
                          style={{
                            borderBottom: '1px solid #f9fafb',
                            background: selectedIds.has(role.id) ? '#f0f9ff' : '#fff',
                            opacity: isDeleting || isDuplicating ? 0.5 : 1,
                            transition: 'background 0.1s',
                          }}
                        >
                          <td style={{ padding: '12px 14px' }}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(role.id)}
                              onChange={() => toggleSelect(role.id)}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ fontWeight: 600, color: '#111827', marginBottom: 2 }}>{role.name}</div>
                            {role.description && (
                              <div style={{ fontSize: 12, color: '#9ca3af', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {role.description}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 500, color: '#374151' }}>
                            {role.userCount}
                          </td>
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 500, color: '#374151' }}>
                            {role.permissionCount}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ background: statusBadge.bg, color: statusBadge.color, borderRadius: 100, fontSize: 11, fontWeight: 600, padding: '3px 9px' }}>
                              {role.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                              {/* View */}
                              <button
                                className="rp-action-btn"
                                title="View details"
                                onClick={() => setViewRoleId(role.id)}
                              >
                                👁️
                              </button>
                              {/* Edit */}
                              <button
                                className="rp-action-btn"
                                title="Edit role"
                                onClick={() => setEditRole(role)}
                              >
                                ✏️
                              </button>
                              {/* Duplicate */}
                              <button
                                className="rp-action-btn"
                                title="Duplicate role"
                                disabled={isDuplicating}
                                onClick={() => handleDuplicateRow(role.id, role.name)}
                              >
                                📋
                              </button>
                              {/* Delete */}
                              <button
                                className="rp-action-btn danger"
                                title="Delete role"
                                disabled={isDeleting}
                                onClick={() => handleDelete(role.id, role.name)}
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!listLoading && totalPages > 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderTop: '1px solid #f0f0f0', fontSize: 13,
                }}>
                  <span style={{ color: '#6b7280', fontSize: 12 }}>
                    Page {page} of {totalPages}
                  </span>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(p => p - 1)}
                      style={{
                        padding: '5px 12px', fontSize: 13, fontFamily: 'inherit',
                        border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff',
                        cursor: page <= 1 ? 'not-allowed' : 'pointer',
                        color: page <= 1 ? '#d1d5db' : '#374151',
                      }}
                    >
                      ← Prev
                    </button>
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const p = i + 1;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          style={{
                            padding: '5px 10px', fontSize: 13, fontFamily: 'inherit',
                            border: '1px solid #e5e7eb', borderRadius: 6,
                            background: p === page ? '#3b82f6' : '#fff',
                            color: p === page ? '#fff' : '#374151',
                            cursor: 'pointer', fontWeight: p === page ? 600 : 400,
                          }}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => p + 1)}
                      style={{
                        padding: '5px 12px', fontSize: 13, fontFamily: 'inherit',
                        border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff',
                        cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                        color: page >= totalPages ? '#d1d5db' : '#374151',
                      }}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* All other tabs */}
          {activeTab !== 'lms' && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
              <ComingSoon label={TABS.find(t => t.key === activeTab)?.label ?? activeTab} />
            </div>
          )}
        </div>
      </div>

      {/* Create Role modal */}
      {createOpen && (
        <CreateRoleModal
          onClose={() => setCreateOpen(false)}
          onSuccess={handleCreateSuccess}
          showToast={showToast as (type: ToastType, message: string) => void}
        />
      )}

      {/* Edit Role modal */}
      {editRole && (
        <CreateRoleModal
          onClose={() => setEditRole(null)}
          onSuccess={handleEditSuccess}
          showToast={showToast as (type: ToastType, message: string) => void}
          editRole={editRole}
        />
      )}

      {/* Role Details Drawer */}
      {viewRoleId && (
        <RoleDetailsDrawer
          roleId={viewRoleId}
          onClose={() => setViewRoleId(null)}
          onEdit={role => { setViewRoleId(null); setEditRole(role); }}
          onDelete={(id, name) => { setViewRoleId(null); handleDelete(id, name); }}
          showToast={showToast as (type: ToastType, message: string) => void}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </AdminLayout>
  );
}
