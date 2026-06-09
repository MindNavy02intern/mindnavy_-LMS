import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout';
import { getUsers } from '../api/users';
import type { UsersResponse } from '../types/users';
import UserKpiCards from '../components/users/UserKpiCards';
import UserTable, { COLUMNS, COL_LS_KEY, loadVisibleCols } from '../components/users/UserTable';
import type { ColKey } from '../components/users/UserTable';
import UserDetailsDrawer from '../components/users/UserDetailsDrawer';
import AddUserModal from '../components/users/AddUserModal';
import EditUserModal from '../components/users/EditUserModal';
import DeleteUserDialog from '../components/users/DeleteUserDialog';
import { useToast, ToastContainer } from '../components/users/Toast';
import UserAnalytics from '../components/users/UserAnalytics';
import ImportUsersModal from '../components/users/ImportUsersModal';
import ExportUsersModal from '../components/users/ExportUsersModal';
import BulkActionsMenu from '../components/users/BulkActionsMenu';
import SuspendedTab from '../components/users/SuspendedTab';
import PendingVerificationTab from '../components/users/PendingVerificationTab';
import ArchivedTab from '../components/users/ArchivedTab';
import InvitationsTab from '../components/users/InvitationsTab';
import type { User } from '../types/users';
import { DEPARTMENT_OPTIONS } from '../constants/userOptions';

// ── Tab config ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'users',                label: 'Users',               icon: '👥' },
  { key: 'analytics',            label: 'Analytics',           icon: '📊' },
  { key: 'organization',         label: 'Organization',        icon: '🏢' },
  { key: 'roles-permissions',    label: 'Roles & Permissions', icon: '🔑' },
  { key: 'groups',               label: 'Groups',              icon: '👥' },
  { key: 'invitations',          label: 'Invitations',         icon: '✉️' },
  { key: 'suspended',            label: 'Suspended',           icon: '🚫' },
  { key: 'pending-verification', label: 'Pending Verification',icon: '⏳' },
  { key: 'archived',             label: 'Archived',            icon: '🗂️' },
] as const;

type TabKey = typeof TABS[number]['key'];

const LIMIT_OPTIONS = [10, 25, 50, 100];

// ── Helpers ────────────────────────────────────────────────────────────────────

function pageRange(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '…')[] = [];
  pages.push(1);
  if (current > 3)         pages.push('…');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p);
  if (current < total - 2) pages.push('…');
  pages.push(total);
  return pages;
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '3rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
      </svg>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</div>
      <div style={{ fontSize: 12, color: '#9ca3af' }}>This section is coming soon.</div>
    </div>
  );
}

// ── Shared input styles ────────────────────────────────────────────────────────

const INPUT_BASE: React.CSSProperties = {
  fontSize: 13, fontFamily: 'inherit', outline: 'none',
  background: '#ffffff', border: '1px solid #d1d5db', borderRadius: 6, color: '#374151',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

function focusIn(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#3b82f6';
  e.currentTarget.style.boxShadow   = '0 0 0 2px rgba(59,130,246,0.15)';
}
function focusOut(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = '#d1d5db';
  e.currentTarget.style.boxShadow   = 'none';
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function UserManagementPage() {
  const [data,    setData]    = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [selectedUserId,   setSelectedUserId]   = useState<string | null>(null);
  const [activeTab,        setActiveTab]         = useState<TabKey>('users');
  const [search,           setSearch]            = useState('');
  const [role,             setRole]              = useState('');
  const [department,       setDepartment]        = useState('');
  const [status,           setStatus]            = useState('');
  const [dateFrom,         setDateFrom]          = useState('');
  const [dateTo,           setDateTo]            = useState('');
  const [page,             setPage]              = useState(1);
  const [limit,            setLimit]             = useState(10);
  const [debouncedSearch,  setDebouncedSearch]   = useState('');
  const [selectedUserIds,  setSelectedUserIds]   = useState<string[]>([]);
  const [addUserOpen,      setAddUserOpen]        = useState(false);
  const [editUser,         setEditUser]           = useState<User | null>(null);
  const [deleteUser,       setDeleteUser]         = useState<User | null>(null);
  const [importOpen,       setImportOpen]         = useState(false);
  const [exportOpen,       setExportOpen]         = useState(false);
  const [filtersOpen,      setFiltersOpen]        = useState(false);
  const [colsOpen,         setColsOpen]           = useState(false);
  const [visibleCols,      setVisibleCols]        = useState<Set<ColKey>>(loadVisibleCols);

  const { toasts, showToast, dismiss } = useToast();
  const filtersRef = useRef<HTMLDivElement>(null);
  const colsRef    = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('modal') === 'addUser') {
      setAddUserOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) setFiltersOpen(false);
      if (colsRef.current    && !colsRef.current.contains(e.target as Node))    setColsOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleSearch(q: string) {
    setSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setDebouncedSearch(q); setPage(1); }, 400);
  }

  function toggleCol(key: ColKey) {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size === 1) return prev; next.delete(key); }
      else next.add(key);
      try { localStorage.setItem(COL_LS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  function resetCols() {
    const defaults = new Set(COLUMNS.filter(c => c.defaultVisible).map(c => c.key));
    setVisibleCols(defaults);
    try { localStorage.removeItem(COL_LS_KEY); } catch { /* ignore */ }
  }

  const hasDateFilter = Boolean(dateFrom || dateTo);
  const activeFilterCount = [role, department, status, hasDateFilter ? '1' : ''].filter(Boolean).length;

  const notifyDashboard = () => {
    window.dispatchEvent(new CustomEvent('userDataChanged'));
    window.dispatchEvent(new CustomEvent('analyticsUpdated'));
  };

  const load = useCallback(async () => {
    if (activeTab !== 'users') return;
    setLoading(true);
    setError(null);
    try {
      const result = await getUsers({
        page, limit,
        search:        debouncedSearch || undefined,
        role:          role            || undefined,
        department:    department      || undefined,
        status:        status          || undefined,
        createdAfter:  dateFrom        || undefined,
        createdBefore: dateTo          || undefined,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, limit, debouncedSearch, role, department, status, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const handleTabChange = (key: TabKey) => {
    setActiveTab(key);
    if (key === 'users') setPage(1);
    setSelectedUserIds([]);
  };

  const pagination  = data?.pagination;
  const showingFrom = pagination ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const showingTo   = pagination ? Math.min(pagination.page * pagination.limit, pagination.total) : 0;

  const tabStyle = (key: TabKey): React.CSSProperties => {
    const active = activeTab === key;
    return {
      display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', fontSize: 13,
      fontWeight: active ? 600 : 400, color: active ? '#2563eb' : '#6b7280',
      background: 'transparent', border: 'none',
      borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
      borderRadius: 0, cursor: 'pointer', fontFamily: 'inherit',
      transition: 'color 0.12s, border-color 0.12s', whiteSpace: 'nowrap',
    };
  };

  const pageBtn = (isActive: boolean, isDisabled: boolean): React.CSSProperties => ({
    minWidth: 28, height: 28, padding: '0 5px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: isActive ? '#2563eb' : '#ffffff',
    border: `1px solid ${isActive ? '#2563eb' : '#e5e7eb'}`,
    borderRadius: 5, color: isActive ? '#ffffff' : '#374151',
    fontSize: 12, fontWeight: isActive ? 600 : 400,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled && !isActive ? 0.4 : 1, fontFamily: 'inherit',
  });

  return (
    <AdminLayout pageTitle="User Management">
      <div style={{ padding: '2px 0 20px' }}>

        {/* Page header */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>User Management</h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>
            Manage users, roles, permissions and organization structure
          </p>
        </div>

        {/* KPI Cards */}
        <UserKpiCards kpiSummary={data?.kpiSummary ?? null} loading={loading && !data} />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, overflowX: 'auto', borderBottom: '1px solid #e5e7eb', background: '#ffffff', borderRadius: '8px 8px 0 0', padding: '0 4px' }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => handleTabChange(tab.key)} style={tabStyle(tab.key)}>
              <span style={{ fontSize: 13 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Analytics tab */}
        {activeTab === 'analytics' && <UserAnalytics />}

        {/* Per-tab components */}
        {activeTab === 'invitations'          && <InvitationsTab />}
        {activeTab === 'suspended'            && <SuspendedTab />}
        {activeTab === 'pending-verification' && <PendingVerificationTab />}
        {activeTab === 'archived'             && <ArchivedTab />}
        {activeTab !== 'users' && activeTab !== 'analytics' &&
          activeTab !== 'invitations' && activeTab !== 'suspended' &&
          activeTab !== 'pending-verification' && activeTab !== 'archived' && (
          <ComingSoon label={TABS.find(t => t.key === activeTab)?.label ?? ''} />
        )}

        {/* ── Users tab ─────────────────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <>
            {/* Error banner */}
            {error && !loading && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#b91c1c', fontSize: 12, padding: '8px 12px', marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <span>{error}</span>
                <button onClick={load} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, color: '#b91c1c', fontSize: 12, fontWeight: 600, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
              </div>
            )}

            {/* ── Unified single-row toolbar ─────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8, paddingBottom: 8, flexWrap: 'wrap' }}>

              {/* Search */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <svg style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="text" placeholder="Search users..."
                  value={search} onChange={e => handleSearch(e.target.value)}
                  style={{ ...INPUT_BASE, paddingLeft: 28, paddingRight: 10, paddingTop: 5, paddingBottom: 5, width: 200 }}
                  onFocus={focusIn} onBlur={focusOut}
                />
              </div>

              {/* Role */}
              <select value={role} onChange={e => { setRole(e.target.value); setPage(1); }} style={{ ...INPUT_BASE, padding: '5px 8px', width: 120, cursor: 'pointer' }} onFocus={focusIn} onBlur={focusOut}>
                <option value="">All Roles</option>
                <option value="Student">Student</option>
                <option value="Instructor">Instructor</option>
                <option value="Administrator">Administrator</option>
                <option value="Manager">Manager</option>
                <option value="HR Manager">HR Manager</option>
                <option value="Finance Manager">Finance Manager</option>
                <option value="Branch Manager">Branch Manager</option>
              </select>

              {/* Department */}
              <select value={department} onChange={e => { setDepartment(e.target.value); setPage(1); }} style={{ ...INPUT_BASE, padding: '5px 8px', width: 150, cursor: 'pointer' }} onFocus={focusIn} onBlur={focusOut}>
                <option value="">All Departments</option>
                {DEPARTMENT_OPTIONS.filter(o => o.value !== '').map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {/* Status */}
              <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} style={{ ...INPUT_BASE, padding: '5px 8px', width: 115, cursor: 'pointer' }} onFocus={focusIn} onBlur={focusOut}>
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="pending">Pending</option>
                <option value="archived">Archived</option>
                <option value="invited">Invited</option>
              </select>

              {/* Divider */}
              <div style={{ width: 1, height: 22, background: '#e5e7eb', flexShrink: 0 }} />

              {/* Filters button */}
              <div ref={filtersRef} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  onClick={() => { setFiltersOpen(o => !o); setColsOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', fontSize: 12, fontWeight: 500,
                    background: filtersOpen || activeFilterCount > 0 ? '#eff6ff' : '#f9fafb',
                    color: filtersOpen || activeFilterCount > 0 ? '#2563eb' : '#6b7280',
                    border: `1px solid ${filtersOpen || activeFilterCount > 0 ? '#bfdbfe' : '#d1d5db'}`,
                    borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
                  Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.12s' }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {filtersOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 30, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 9, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 280, padding: '14px 16px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>Advanced Filters</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Created After</div>
                        <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                          style={{ ...INPUT_BASE, padding: '5px 8px', width: '100%', boxSizing: 'border-box' as const }}
                          onFocus={focusIn} onBlur={focusOut}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Created Before</div>
                        <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }}
                          style={{ ...INPUT_BASE, padding: '5px 8px', width: '100%', boxSizing: 'border-box' as const }}
                          onFocus={focusIn} onBlur={focusOut}
                        />
                      </div>
                    </div>
                    {(dateFrom || dateTo || role || department || status) && (
                      <button
                        onClick={() => { setRole(''); setDepartment(''); setStatus(''); setDateFrom(''); setDateTo(''); setPage(1); setFiltersOpen(false); }}
                        style={{ marginTop: 12, width: '100%', padding: '6px', fontSize: 12, fontWeight: 600, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer', color: '#b91c1c', fontFamily: 'inherit' }}
                      >
                        Clear All Filters
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Columns button */}
              <div ref={colsRef} style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  onClick={() => { setColsOpen(o => !o); setFiltersOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '5px 10px', fontSize: 12, fontWeight: 500,
                    background: colsOpen ? '#eff6ff' : '#f9fafb',
                    color: colsOpen ? '#2563eb' : '#6b7280',
                    border: `1px solid ${colsOpen ? '#bfdbfe' : '#d1d5db'}`,
                    borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
                  Columns
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: colsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.12s' }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {colsOpen && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 30, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 9, boxShadow: '0 8px 24px rgba(0,0,0,0.1)', minWidth: 195, overflow: 'hidden' }}>
                    <div style={{ padding: '7px 12px 4px', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Toggle Columns</div>
                    <div style={{ height: 1, background: '#f3f4f6' }} />
                    {COLUMNS.map(col => (
                      <label key={col.key}
                        style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 12px', cursor: 'pointer', fontSize: 13, color: visibleCols.has(col.key) ? '#111827' : '#6b7280' }}
                        onMouseEnter={e => { e.currentTarget.style.background = '#f8faff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <input type="checkbox" checked={visibleCols.has(col.key)} onChange={() => toggleCol(col.key)} style={{ accentColor: '#2563eb' }} />
                        {col.label}
                      </label>
                    ))}
                    <div style={{ padding: '6px 12px 8px', borderTop: '1px solid #f3f4f6' }}>
                      <button onClick={resetCols} style={{ width: '100%', fontSize: 11, padding: '5px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 5, cursor: 'pointer', color: '#6b7280', fontFamily: 'inherit' }}>
                        Reset to default
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right-side action buttons */}
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* Add User */}
                <button
                  onClick={() => setAddUserOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', fontSize: 12, fontWeight: 600, background: '#16a34a', color: '#fff', border: '1px solid #15803d', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#15803d'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#16a34a'; }}
                >
                  + Add User
                </button>

                {/* Import */}
                <button
                  onClick={() => setImportOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, fontWeight: 500, background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Import
                </button>

                {/* Export */}
                <button
                  onClick={() => setExportOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', fontSize: 12, fontWeight: 500, background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Export
                </button>

                {/* Bulk Actions */}
                <BulkActionsMenu
                  selectedIds={selectedUserIds}
                  users={data?.users ?? []}
                  onClearSelection={() => setSelectedUserIds([])}
                  onSuccess={() => { load(); notifyDashboard(); }}
                  showToast={showToast}
                />
              </div>
            </div>

            {/* Table */}
            <UserTable
              users={data?.users ?? []}
              loading={loading}
              visibleCols={visibleCols}
              onViewUser={id => setSelectedUserId(id)}
              onEditUser={user => setEditUser(user)}
              onDeleteUser={user => setDeleteUser(user)}
              selectedIds={selectedUserIds}
              onSelectChange={setSelectedUserIds}
            />

            {/* Pagination */}
            {pagination && pagination.total > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 40, gap: 10, flexWrap: 'wrap', background: '#ffffff', border: '1px solid #e5e7eb', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '0 14px' }}>
                <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                  Showing {showingFrom.toLocaleString()} to {showingTo.toLocaleString()} of {pagination.total.toLocaleString()} users
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <button onClick={() => setPage(p => p - 1)} disabled={page <= 1 || loading} style={pageBtn(false, page <= 1 || loading)}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>
                  {pageRange(page, pagination.totalPages).map((p, i) =>
                    p === '…'
                      ? <span key={`e-${i}`} style={{ padding: '0 3px', fontSize: 12, color: '#9ca3af' }}>…</span>
                      : <button key={p} onClick={() => setPage(p)} disabled={loading} style={pageBtn(p === page, loading)}>{p}</button>
                  )}
                  <button onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages || loading} style={pageBtn(false, page >= pagination.totalPages || loading)}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>Rows / page</span>
                  <select value={limit} onChange={e => { setLimit(Number(e.target.value)); setPage(1); }}
                    style={{ padding: '3px 6px', fontSize: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 5, color: '#374151', fontFamily: 'inherit', outline: 'none', cursor: 'pointer' }}>
                    {LIMIT_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Drawers & Modals */}
      {selectedUserId && (
        <UserDetailsDrawer userId={selectedUserId} onClose={() => setSelectedUserId(null)} showToast={showToast} onUserUpdated={() => { load(); notifyDashboard(); }} />
      )}
      {addUserOpen && (
        <AddUserModal onClose={() => setAddUserOpen(false)} onSuccess={() => { setAddUserOpen(false); load(); notifyDashboard(); }} showToast={showToast} />
      )}
      {editUser && (
        <EditUserModal
          userId={editUser.id}
          initialData={{ fullName: editUser.fullName, phone: editUser.phone ?? null, department: editUser.department, branch: editUser.branch, groupId: null, accessLevel: null, managerId: null, skills: null }}
          onClose={() => setEditUser(null)}
          onSuccess={() => { setEditUser(null); load(); notifyDashboard(); }}
          showToast={showToast}
        />
      )}
      {deleteUser && (
        <DeleteUserDialog
          userId={deleteUser.id} email={deleteUser.email} fullName={deleteUser.fullName}
          onClose={() => setDeleteUser(null)}
          onSuccess={() => { if (selectedUserId === deleteUser.id) setSelectedUserId(null); setDeleteUser(null); load(); notifyDashboard(); }}
          showToast={showToast}
        />
      )}
      {importOpen && (
        <ImportUsersModal onClose={() => setImportOpen(false)} showToast={showToast} />
      )}
      {exportOpen && (
        <ExportUsersModal
          onClose={() => setExportOpen(false)}
          totalUsers={data?.pagination.total}
          filterParams={{ search: debouncedSearch || undefined, role: role || undefined, department: department || undefined, status: status || undefined, createdAfter: dateFrom || undefined, createdBefore: dateTo || undefined }}
        />
      )}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </AdminLayout>
  );
}
