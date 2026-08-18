import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTabParam } from '../hooks/useTabParam';
import AdminLayout from '../layouts/AdminLayout';
import { useToast, ToastContainer } from '../components/users/Toast';
import type { ToastType } from '../components/users/Toast';
import CreateRoleModal from '../components/rolesPermissionsPage/CreateRoleModal';
import RoleDetailsDrawer from '../components/rolesPermissionsPage/RoleDetailsDrawer';
import PermissionMatrixTab from '../components/rolesPermissionsPage/PermissionMatrixTab';
import PermissionMatrixPreview from '../components/rolesPermissionsPage/PermissionMatrixPreview';
import AccessPoliciesTab from '../components/rolesPermissionsPage/AccessPoliciesTab';
import RoleTemplatesTab from '../components/rolesPermissionsPage/RoleTemplatesTab';
import UserRoleAssignmentsTab from '../components/rolesPermissionsPage/UserRoleAssignmentsTab';
import CompanyRolesTab from '../components/rolesPermissionsPage/CompanyRolesTab';
import DelegatedAdminsTab from '../components/rolesPermissionsPage/DelegatedAdminsTab';
import AuditTrackingTab from '../components/rolesPermissionsPage/AuditTrackingTab';
import RolesSettingsTab from '../components/rolesPermissionsPage/RolesSettingsTab';
import AccessPoliciesPreviewCard from '../components/rolesPermissionsPage/AccessPoliciesPreviewCard';
import RoleTemplatesPreviewCard from '../components/rolesPermissionsPage/RoleTemplatesPreviewCard';
import UserRoleAssignmentsPreviewCard from '../components/rolesPermissionsPage/UserRoleAssignmentsPreviewCard';
import RecentRoleActivityPreviewCard from '../components/rolesPermissionsPage/RecentRoleActivityPreviewCard';
import {
  getRolesPageStats,
  getRolesPageList,
  deleteRolePage,
  duplicateRolePage,
  RolesPageError,
} from '../api/rolesPage';
import type { RolePage, RolePageStats, RoleStatus } from '../types/rolesPage';
import { getAccessPolicyStats } from '../api/accessPoliciesPage';

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'roles',       label: 'LMS Roles'            },
  { key: 'company',     label: 'Company Roles'         },
  { key: 'matrix',      label: 'Permission Matrix'     },
  { key: 'policies',    label: 'Access Policies'       },
  { key: 'templates',   label: 'Role Templates'        },
  { key: 'assignments', label: 'User Role Assignments' },
  { key: 'delegated',   label: 'Delegated Admins'      },
  { key: 'audit',       label: 'Audit & Tracking'      },
  { key: 'settings',    label: 'Settings'              },
];

// ── Status options ────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '',         label: 'All Statuses' },
  { value: 'ACTIVE',   label: 'Active'       },
  { value: 'INACTIVE', label: 'Inactive'     },
];

const STATUS_BADGE: Record<RoleStatus, { bg: string; color: string }> = {
  ACTIVE:   { bg: '#f0fdf4', color: '#16a34a' },
  INACTIVE: { bg: '#f9fafb', color: '#6b7280' },
};

// ── Level derivation ─────────────────────────────────────────────────────────

interface LevelMeta { label: string; bg: string; color: string }

function getLevelMeta(role: RolePage): LevelMeta {
  if (role.isCustomRole)           return { label: 'Custom',     bg: '#f5f3ff', color: '#7c3aed' };
  if (role.permissionCount >= 200) return { label: 'System',     bg: '#eff6ff', color: '#2563eb' };
  if (role.permissionCount >= 80)  return { label: 'Department', bg: '#fff7ed', color: '#c2410c' };
  if (role.userCount > 5000)       return { label: 'Default',    bg: '#f9fafb', color: '#6b7280' };
  if (role.userCount > 100)        return { label: 'Branch',     bg: '#f0fdf4', color: '#16a34a' };
  return { label: 'Functional', bg: '#fdf4ff', color: '#9333ea' };
}

function getScopeLabel(levelLabel: string): string {
  if (levelLabel === 'System')     return 'Global';
  if (levelLabel === 'Department') return 'Dept. Level';
  if (levelLabel === 'Branch')     return 'Branch Level';
  if (levelLabel === 'Default')    return 'Own Content';
  if (levelLabel === 'Custom')     return 'Custom';
  return 'Course Level';
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiDef {
  label: string;
  value: number;
  iconBg: string;
  icon: React.ReactNode;
  trendUp: boolean;
  trendPct: string;
}

function KpiCard({ label, value, iconBg, icon, trendUp, trendPct, loading }: KpiDef & { loading: boolean }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '14px 16px',
      border: '1px solid #e5e7eb', display: 'flex', alignItems: 'flex-start', gap: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10, background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {loading ? (
          <>
            <div style={{ width: 80, height: 9, borderRadius: 3, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite', marginBottom: 7 }} />
            <div style={{ width: 50, height: 18, borderRadius: 3, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite', marginBottom: 6 }} />
            <div style={{ width: 100, height: 8, borderRadius: 3, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite' }} />
          </>
        ) : (
          <>
            <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', lineHeight: 1, marginBottom: 5 }}>{value.toLocaleString()}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10 }}>
              <span style={{ color: trendUp ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                {trendUp ? '↑' : '↓'} {trendPct}
              </span>
              <span style={{ color: '#9ca3af' }}>vs last month</span>
            </div>
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
      {[36, 180, 70, 60, 70, 70, 70, 80].map((w, i) => (
        <td key={i} style={{ padding: '11px 14px' }}>
          <div style={{ width: w, height: 11, borderRadius: 4, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RolesPermissionsStandalonePage() {
  const { toasts, showToast, dismiss } = useToast();

  // ── Stats ──────────────────────────────────────────────────────────────────
  const [stats, setStats]               = useState<RolePageStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchStats = useCallback(() => {
    (() => setStatsLoading(true))();
    getRolesPageStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  const [accessPolicyCount, setAccessPolicyCount] = useState(0);

  const fetchAccessPolicyCount = useCallback(() => {
    getAccessPolicyStats()
      .then(s => setAccessPolicyCount(s.totalPolicies))
      .catch(() => setAccessPolicyCount(0));
  }, []);

  // ── List ───────────────────────────────────────────────────────────────────
  const [roles, setRoles]             = useState<RolePage[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [totalPages, setTotalPages]   = useState(1);
  const [totalRoles, setTotalRoles]   = useState(0);

  // Deep link from a user's role chip (UserDetailsDrawer) — ?role=<name>
  // pre-fills the search box so "view this role" actually lands filtered,
  // not just on the tab. Read once on mount; the search box stays a normal
  // uncontrolled-from-URL input after that (matches the rest of this page's
  // filters, none of which are otherwise URL-persisted).
  const [searchParams] = useSearchParams();
  const roleDeepLink = searchParams.get('role') ?? '';

  const [page,         setPage]         = useState(1);
  const [search,       setSearch]       = useState(roleDeepLink);
  const [searchInput,  setSearchInput]  = useState(roleDeepLink);
  const [statusFilter, setStatusFilter] = useState('');
  const [levelFilter,  setLevelFilter]  = useState('');

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { setSearch(value); setPage(1); }, 350);
  };

  const PAGE_SIZE = 10;

  const fetchList = useCallback(() => {
    (() => setListLoading(true))();
    getRolesPageList({ page, limit: PAGE_SIZE, search, status: statusFilter })
      .then(res => {
        setRoles(res.data);
        setTotalPages(res.pagination.pages);
        setTotalRoles(res.pagination.total);
      })
      .catch(() => { setRoles([]); showToast('error', 'Failed to load roles'); })
      .finally(() => setListLoading(false));
  }, [page, search, statusFilter, showToast]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchList();  }, [fetchList]);
  useEffect(() => { fetchAccessPolicyCount(); }, [fetchAccessPolicyCount]);

  useEffect(() => {
    const handler = () => { fetchStats(); fetchList(); fetchAccessPolicyCount(); };
    window.addEventListener('rolesUpdated', handler);
    return () => window.removeEventListener('rolesUpdated', handler);
  }, [fetchStats, fetchList, fetchAccessPolicyCount]);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [activeTab,       setActiveTab]       = useTabParam('roles');
  const [fullMatrixView,  setFullMatrixView]  = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const displayedRoles = levelFilter ? roles.filter(r => getLevelMeta(r).label === levelFilter) : roles;
  const toggleSelect = (id: string) =>
    setSelectedIds(prev => { const s = new Set(prev); if (s.has(id)) s.delete(id); else s.add(id); return s; });
  const toggleAll = () => {
    if (selectedIds.size === displayedRoles.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(displayedRoles.map(r => r.id)));
  };

  // ── Modal / drawer ─────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole,   setEditRole]   = useState<RolePage | null>(null);
  const [viewRoleId, setViewRoleId] = useState<string | null>(null);

  const handleCreateSuccess = () => { setCreateOpen(false); fetchStats(); fetchList(); };
  const handleEditSuccess   = () => { setEditRole(null);    fetchStats(); fetchList(); };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (roleId: string, roleName: string) => {
    if (!window.confirm(`Delete role "${roleName}"? This action cannot be undone.`)) return;
    setDeletingId(roleId);
    try {
      await deleteRolePage(roleId);
      showToast('success', `Role "${roleName}" deleted successfully`);
      window.dispatchEvent(new CustomEvent('rolesUpdated'));
      window.dispatchEvent(new CustomEvent('analyticsUpdated'));
      fetchStats(); fetchList();
    } catch (err) {
      if (err instanceof RolesPageError && err.code === 'ROLE_HAS_USERS') {
        showToast('error', `Cannot delete: ${err.roleName ?? roleName} has ${err.count ?? 0} users assigned.`);
      } else {
        showToast('error', err instanceof Error ? err.message : 'Failed to delete role');
      }
    } finally { setDeletingId(null); }
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
      fetchStats(); fetchList();
    } catch (err) {
      if (err instanceof RolesPageError && err.status === 404) {
        showToast('error', 'Role not found');
      } else {
        showToast('error', err instanceof Error ? err.message : `Failed to duplicate "${roleName}"`);
      }
    } finally { setDuplicatingId(null); }
  };

  // ── KPI definitions ────────────────────────────────────────────────────────
  const kpis: KpiDef[] = [
    {
      label: 'Total Roles', value: stats?.totalRoles ?? 0,
      iconBg: '#eff6ff', trendUp: true, trendPct: '8.5%',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    },
    {
      label: 'Active Roles', value: stats?.activeRoles ?? 0,
      iconBg: '#f0fdf4', trendUp: true, trendPct: '7.2%',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
    },
    {
      label: 'Users with Roles', value: stats?.usersWithRoles ?? 0,
      iconBg: '#faf5ff', trendUp: true, trendPct: '12.5%',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    },
    {
      label: 'Permission Sets', value: stats?.totalPermissions ?? 0,
      iconBg: '#fff7ed', trendUp: true, trendPct: '5.4%',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c2410c" strokeWidth="2" strokeLinecap="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
    },
    {
      label: 'Access Policies', value: accessPolicyCount,
      iconBg: '#f0fdfa', trendUp: true, trendPct: '14.3%',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f766e" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    },
    {
      label: 'Inactive Roles', value: stats?.inactiveRoles ?? 0,
      iconBg: '#fef2f2', trendUp: false, trendPct: '12.3%',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    },
  ];

  // ── Pagination helpers ─────────────────────────────────────────────────────
  const rowStart = (page - 1) * PAGE_SIZE + 1;
  const rowEnd   = Math.min(page * PAGE_SIZE, totalRoles);

  // ── Render ─────────────────────────────────────────────────────────────────

  // ── Full-page matrix view ──────────────────────────────────────────────────
  if (fullMatrixView) {
    return (
      <AdminLayout pageTitle="Permission Matrix">
        <style>{`@keyframes rp-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }`}</style>
        <div style={{ padding: '24px', height: '100%' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827', letterSpacing: '-0.2px' }}>Permission Matrix</h2>
              <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#6b7280' }}>View and manage role permissions across all roles</p>
            </div>
            <button
              onClick={() => setFullMatrixView(false)}
              style={{ padding: '7px 14px', fontSize: 12.5, fontWeight: 500, background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
              Back to Roles &amp; Permissions
            </button>
          </div>
          {/* Full-width matrix */}
          <PermissionMatrixTab
            showToast={showToast as (type: ToastType, message: string) => void}
            fullPage={true}
          />
        </div>
        <ToastContainer toasts={toasts} onDismiss={dismiss} />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout pageTitle="Roles & Permissions">
      <style>{`
        @keyframes rp-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
        .rp-action-btn { background:none; border:none; cursor:pointer; padding:4px 7px; border-radius:6px; color:#6b7280; font-size:13px; line-height:1; transition:background 0.12s,color 0.12s; }
        .rp-action-btn:hover { background:#f3f4f6; color:#111827; }
        .rp-action-btn.danger:hover { background:#fef2f2; color:#dc2626; }
        .rp-table-row:hover td { background:#f9fafb !important; }
        .rp-tab-btn { padding:10px 14px; font-size:13px; font-weight:500; background:none; border:none; cursor:pointer; font-family:inherit; white-space:nowrap; transition:color 0.12s; }
        .rp-select { padding:6px 10px; border:1px solid #e5e7eb; border-radius:7px; font-size:12px; font-family:inherit; color:#374151; background:#fff; cursor:pointer; outline:none; }
        .rp-select:focus { border-color:#3b82f6; }
      `}</style>

      <div style={{ padding: '22px 24px 48px', maxWidth: 1440, margin: '0 auto' }}>

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, color: '#111827', letterSpacing: '-0.2px' }}>Roles & Permissions</h1>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#6b7280' }}>
              Manage roles, permissions, access policies and control system access
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, paddingTop: 2 }}>
            <button
              onClick={() => setFullMatrixView(true)}
              style={{ padding: '7px 14px', fontSize: 12.5, fontWeight: 500, background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              Permission Matrix View
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              style={{ padding: '7px 14px', fontSize: 12.5, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 1px 3px rgba(37,99,235,0.3)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Create Role
            </button>
          </div>
        </div>

        {/* ── KPI cards ───────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14, marginBottom: 22 }}>
          {kpis.map(k => (
            <KpiCard key={k.label} {...k} loading={statsLoading} />
          ))}
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #e5e7eb', overflowX: 'auto', marginBottom: 0 }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              className="rp-tab-btn"
              onClick={() => setActiveTab(tab.key)}
              style={{
                borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent',
                color: activeTab === tab.key ? '#2563eb' : '#6b7280',
                marginBottom: -1,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ─────────────────────────────────────────────────── */}
        <div style={{ marginTop: 20 }}>

          {/* ── LMS Roles tab ──────────────────────────────────────────────── */}
          {activeTab === 'roles' && (
            <>
              {/* Two-column section */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 20, alignItems: 'start' }}>

                {/* LEFT: Roles table */}
                <div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>LMS Roles</div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Manage system roles and their permissions</div>
                  </div>

                  <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>

                    {/* Toolbar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap' }}>
                      {/* Search */}
                      <div style={{ position: 'relative' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input
                          type="text"
                          placeholder="Search roles..."
                          value={searchInput}
                          onChange={e => handleSearchInput(e.target.value)}
                          style={{ paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6, border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', color: '#374151', background: '#fff', width: 160, outline: 'none' }}
                          onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                          onBlur={e  => (e.target.style.borderColor = '#e5e7eb')}
                        />
                      </div>
                      {/* Status filter */}
                      <select className="rp-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
                        {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                      {/* Levels filter */}
                      <select className="rp-select" value={levelFilter} onChange={e => { setLevelFilter(e.target.value); setPage(1); }}>
                        <option value="">All Levels</option>
                        <option value="System">System</option>
                        <option value="Department">Department</option>
                        <option value="Branch">Branch</option>
                        <option value="Functional">Functional</option>
                        <option value="Default">Default</option>
                        <option value="Custom">Custom</option>
                      </select>
                      {/* Filters button */}
                      <button style={{ padding: '6px 10px', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 7, background: '#fff', cursor: 'pointer', fontFamily: 'inherit', color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
                        Filters
                      </button>
                    </div>

                    {/* Table */}
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                            <th style={{ padding: '9px 12px', width: 36 }}>
                              <input type="checkbox" checked={roles.length > 0 && selectedIds.size === roles.length} onChange={toggleAll} style={{ cursor: 'pointer', accentColor: '#2563eb' }} />
                            </th>
                            <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px', minWidth: 160 }}>ROLE NAME</th>
                            <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px' }}>LEVEL</th>
                            <th style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px' }}>USERS</th>
                            <th style={{ padding: '9px 10px', textAlign: 'right', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px' }}>PERMS</th>
                            <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px' }}>SCOPE</th>
                            <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px' }}>STATUS</th>
                            <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px' }}>ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {listLoading && Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}

                          {!listLoading && displayedRoles.length === 0 && (
                            <tr>
                              <td colSpan={8} style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                  </svg>
                                  <span style={{ fontSize: 13, fontWeight: 600 }}>No roles found</span>
                                  <span style={{ fontSize: 12 }}>Try adjusting your filters or create a new role</span>
                                </div>
                              </td>
                            </tr>
                          )}

                          {!listLoading && displayedRoles.map(role => {
                            const statusBadge   = STATUS_BADGE[role.status] ?? { bg: '#f9fafb', color: '#6b7280' };
                            const levelMeta     = getLevelMeta(role);
                            const scope         = getScopeLabel(levelMeta.label);
                            const isDeleting    = deletingId    === role.id;
                            const isDuplicating = duplicatingId === role.id;
                            return (
                              <tr
                                key={role.id}
                                className="rp-table-row"
                                style={{
                                  borderBottom: '1px solid #f3f4f6',
                                  background: selectedIds.has(role.id) ? '#eff6ff' : '#fff',
                                  opacity: isDeleting || isDuplicating ? 0.5 : 1,
                                  transition: 'background 0.1s',
                                }}
                              >
                                <td style={{ padding: '10px 12px' }}>
                                  <input type="checkbox" checked={selectedIds.has(role.id)} onChange={() => toggleSelect(role.id)} style={{ cursor: 'pointer', accentColor: '#2563eb' }} />
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <div style={{ fontWeight: 600, color: '#111827', fontSize: 12.5, lineHeight: 1.3 }}>{role.name}</div>
                                  {role.description && (
                                    <div style={{ fontSize: 11, color: '#9ca3af', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                                      {role.description}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '10px 10px' }}>
                                  <span style={{ background: levelMeta.bg, color: levelMeta.color, borderRadius: 100, fontSize: 10.5, fontWeight: 600, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                                    {levelMeta.label}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 500, color: '#374151' }}>
                                  {role.userCount.toLocaleString()}
                                </td>
                                <td style={{ padding: '10px 10px', textAlign: 'right', fontWeight: 500, color: '#374151' }}>
                                  {role.permissionCount}
                                </td>
                                <td style={{ padding: '10px 10px', color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>
                                  {scope}
                                </td>
                                <td style={{ padding: '10px 10px' }}>
                                  <span style={{ background: statusBadge.bg, color: statusBadge.color, borderRadius: 100, fontSize: 10.5, fontWeight: 600, padding: '2px 8px' }}>
                                    {role.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                                    <button className="rp-action-btn" title="View details"  onClick={() => setViewRoleId(role.id)}>
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                    </button>
                                    <button className="rp-action-btn" title="Edit role"     onClick={() => setEditRole(role)}>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    </button>
                                    <button className="rp-action-btn" title="Duplicate"     disabled={isDuplicating} onClick={() => handleDuplicateRow(role.id, role.name)}>
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                    </button>
                                    <button className="rp-action-btn danger" title="Delete" disabled={isDeleting}    onClick={() => handleDelete(role.id, role.name)}>
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

                    {/* Pagination */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid #f3f4f6' }}>
                      {!listLoading ? (
                        <span style={{ color: '#6b7280', fontSize: 11.5 }}>
                          Showing {totalRoles === 0 ? 0 : rowStart} to {rowEnd} of {totalRoles} roles
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
                        <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>{PAGE_SIZE} / page</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* RIGHT: Permission Matrix preview */}
                <div>
                  <PermissionMatrixPreview onViewFullMatrix={() => setFullMatrixView(true)} />
                </div>
              </div>

              {/* ── Bottom 4 info cards ─────────────────────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 20 }}>
                <AccessPoliciesPreviewCard onViewAll={() => setActiveTab('policies')} />
                <RoleTemplatesPreviewCard
                  onViewAll={() => setActiveTab('templates')}
                  showToast={showToast as (type: ToastType, message: string) => void}
                />
                <UserRoleAssignmentsPreviewCard
                  stats={stats}
                  loading={statsLoading}
                  onViewAll={() => setActiveTab('assignments')}
                />
                <RecentRoleActivityPreviewCard onViewAll={() => setActiveTab('audit')} />
              </div>
            </>
          )}

          {/* ── Permission Matrix tab ───────────────────────────────────────── */}
          {activeTab === 'matrix' && (
            <PermissionMatrixTab showToast={showToast as (type: ToastType, message: string) => void} />
          )}

          {/* ── Access Policies tab ─────────────────────────────────────────── */}
          {activeTab === 'policies' && (
            <AccessPoliciesTab showToast={showToast as (type: ToastType, message: string) => void} />
          )}

          {/* ── Role Templates tab ──────────────────────────────────────────── */}
          {activeTab === 'templates' && (
            <RoleTemplatesTab showToast={showToast as (type: ToastType, message: string) => void} />
          )}

          {/* ── User Role Assignments tab ───────────────────────────────────── */}
          {activeTab === 'assignments' && (
            <UserRoleAssignmentsTab showToast={showToast as (type: ToastType, message: string) => void} />
          )}

          {/* ── Company Roles tab ───────────────────────────────────────────── */}
          {activeTab === 'company' && (
            <CompanyRolesTab showToast={showToast as (type: ToastType, message: string) => void} />
          )}

          {/* ── Delegated Admins tab ────────────────────────────────────────── */}
          {activeTab === 'delegated' && (
            <DelegatedAdminsTab showToast={showToast as (type: ToastType, message: string) => void} />
          )}

          {/* ── Audit & Tracking tab ────────────────────────────────────────── */}
          {activeTab === 'audit' && <AuditTrackingTab />}

          {/* ── Settings tab ─────────────────────────────────────────────────── */}
          {activeTab === 'settings' && (
            <RolesSettingsTab showToast={showToast as (type: ToastType, message: string) => void} />
          )}
        </div>
      </div>

      {/* ── Create Role modal ─────────────────────────────────────────────── */}
      {createOpen && (
        <CreateRoleModal
          onClose={() => setCreateOpen(false)}
          onSuccess={handleCreateSuccess}
          showToast={showToast as (type: ToastType, message: string) => void}
        />
      )}

      {/* ── Edit Role modal ───────────────────────────────────────────────── */}
      {editRole && (
        <CreateRoleModal
          onClose={() => setEditRole(null)}
          onSuccess={handleEditSuccess}
          showToast={showToast as (type: ToastType, message: string) => void}
          editRole={editRole}
        />
      )}

      {/* ── Role Details Drawer ───────────────────────────────────────────── */}
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
