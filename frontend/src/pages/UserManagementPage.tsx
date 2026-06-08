import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout';
import { getUsers } from '../api/users';
import type { UsersResponse } from '../types/users';
import UserKpiCards from '../components/users/UserKpiCards';
import UserFilters from '../components/users/UserFilters';
import UserTable from '../components/users/UserTable';
import UserDetailsDrawer from '../components/users/UserDetailsDrawer';
import AddUserModal from '../components/users/AddUserModal';
import EditUserModal from '../components/users/EditUserModal';
import DeleteUserDialog from '../components/users/DeleteUserDialog';
import { useToast, ToastContainer } from '../components/users/Toast';
import type { User } from '../types/users';

// ── Tab config ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'users',                label: 'Users',               icon: '👥' },
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

// ── Page range helper ──────────────────────────────────────────────────────────

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

// ── Coming Soon ────────────────────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8,
      padding: '3rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
    }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
      </svg>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</div>
      <div style={{ fontSize: 12, color: '#9ca3af' }}>This section is coming soon.</div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function UserManagementPage() {
  const [data,    setData]    = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [activeTab,  setActiveTab]  = useState<TabKey>('users');
  const [search,     setSearch]     = useState('');
  const [role,       setRole]       = useState('');
  const [department, setDepartment] = useState('');
  const [status,     setStatus]     = useState('');
  const [page,       setPage]       = useState(1);
  const [limit,      setLimit]      = useState(10);

  const { toasts, showToast, dismiss } = useToast();
  const [addUserOpen, setAddUserOpen]  = useState(false);
  const [editUser,    setEditUser]     = useState<User | null>(null);
  const [deleteUser,  setDeleteUser]   = useState<User | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('modal') === 'addUser') {
      setAddUserOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const handleSearch = (q: string) => {
    setSearch(q);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setDebouncedSearch(q); setPage(1); }, 400);
  };

  const notifyDashboard = () => window.dispatchEvent(new CustomEvent('userDataChanged'));

  const load = useCallback(async () => {
    if (activeTab !== 'users') return;
    setLoading(true);
    setError(null);
    try {
      const result = await getUsers({
        page, limit,
        search:     debouncedSearch || undefined,
        role:       role            || undefined,
        department: department      || undefined,
        status:     status          || undefined,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, page, limit, debouncedSearch, role, department, status]);

  useEffect(() => { load(); }, [load]);

  const handleTabChange = (key: TabKey) => { setActiveTab(key); if (key === 'users') setPage(1); };
  const filterSetter = (setter: (v: string) => void) => (v: string) => { setter(v); setPage(1); };
  const handleLimitChange = (n: number) => { setLimit(n); setPage(1); };

  const pagination = data?.pagination;
  const showingFrom = pagination ? (pagination.page - 1) * pagination.limit + 1 : 0;
  const showingTo   = pagination ? Math.min(pagination.page * pagination.limit, pagination.total) : 0;

  const tabStyle = (key: TabKey): React.CSSProperties => {
    const active = activeTab === key;
    return {
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '8px 12px', fontSize: 13,
      fontWeight: active ? 600 : 400,
      color: active ? '#2563eb' : '#6b7280',
      background: 'transparent', border: 'none',
      borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
      borderRadius: 0, cursor: 'pointer', fontFamily: 'inherit',
      transition: 'color 0.12s ease, border-color 0.12s ease',
      whiteSpace: 'nowrap',
    };
  };

  const pageBtn = (isActive: boolean, isDisabled: boolean): React.CSSProperties => ({
    minWidth: 28, height: 28, padding: '0 5px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: isActive ? '#2563eb' : '#ffffff',
    border: `1px solid ${isActive ? '#2563eb' : '#e5e7eb'}`,
    borderRadius: 5,
    color: isActive ? '#ffffff' : '#374151',
    fontSize: 12, fontWeight: isActive ? 600 : 400,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled && !isActive ? 0.4 : 1,
    fontFamily: 'inherit',
  });

  return (
    <AdminLayout pageTitle="User Management">
      <div style={{ padding: '2px 0 20px' }}>

        {/* ── Page header ───────────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>
            User Management
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>
            Manage users, roles, permissions and organization structure
          </p>
        </div>

        {/* ── KPI Cards ─────────────────────────────────────────────────────────── */}
        <UserKpiCards kpiSummary={data?.kpiSummary ?? null} loading={loading && !data} />

        {/* ── Tabs ──────────────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', gap: 0, overflowX: 'auto',
          borderBottom: '1px solid #e5e7eb',
          background: '#ffffff',
          borderRadius: '8px 8px 0 0',
          padding: '0 4px',
        }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => handleTabChange(tab.key)} style={tabStyle(tab.key)}>
              <span style={{ fontSize: 13 }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Non-Users tabs ────────────────────────────────────────────────────── */}
        {activeTab !== 'users' && (
          <ComingSoon label={TABS.find(t => t.key === activeTab)?.label ?? ''} />
        )}

        {/* ── Users tab content ─────────────────────────────────────────────────── */}
        {activeTab === 'users' && (
          <>
            {/* Error banner */}
            {error && !loading && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 6, color: '#b91c1c', fontSize: 12,
                padding: '8px 12px', marginTop: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              }}>
                <span>{error}</span>
                <button onClick={load} style={{
                  background: '#fee2e2', border: '1px solid #fca5a5',
                  borderRadius: 5, color: '#b91c1c', fontSize: 12, fontWeight: 600,
                  padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit',
                }}>Retry</button>
              </div>
            )}

            {/* Filter + action buttons row */}
            <div style={{ paddingTop: 8 }}>
              <UserFilters
                search={search}         onSearch={handleSearch}
                role={role}             onRole={filterSetter(setRole)}
                department={department} onDepartment={filterSetter(setDepartment)}
                status={status}         onStatus={filterSetter(setStatus)}
                onAddUser={() => setAddUserOpen(true)}
              />
            </div>

            {/* Table — flush top, shares border with filter row above */}
            <UserTable
              users={data?.users ?? []}
              loading={loading}
              onViewUser={id => setSelectedUserId(id)}
              onEditUser={user => setEditUser(user)}
              onDeleteUser={user => setDeleteUser(user)}
            />

            {/* ── Pagination ─────────────────────────────────────────────────────── */}
            {pagination && pagination.total > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                height: 40, gap: 10, flexWrap: 'wrap',
                background: '#ffffff', border: '1px solid #e5e7eb', borderTop: 'none',
                borderRadius: '0 0 8px 8px', padding: '0 14px',
              }}>
                {/* Left */}
                <span style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                  Showing {showingFrom.toLocaleString()} to {showingTo.toLocaleString()} of{' '}
                  {pagination.total.toLocaleString()} users
                </span>

                {/* Center */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <button onClick={() => setPage(p => p - 1)} disabled={page <= 1 || loading} style={pageBtn(false, page <= 1 || loading)}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  </button>

                  {pageRange(page, pagination.totalPages).map((p, i) =>
                    p === '…'
                      ? <span key={`e-${i}`} style={{ padding: '0 3px', fontSize: 12, color: '#9ca3af' }}>…</span>
                      : <button key={p} onClick={() => setPage(p)} disabled={loading} style={pageBtn(p === page, loading)}>{p}</button>
                  )}

                  <button onClick={() => setPage(p => p + 1)} disabled={page >= pagination.totalPages || loading} style={pageBtn(false, page >= pagination.totalPages || loading)}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                </div>

                {/* Right */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>Rows / page</span>
                  <select
                    value={limit}
                    onChange={e => handleLimitChange(Number(e.target.value))}
                    style={{
                      padding: '3px 6px', fontSize: 12,
                      background: '#ffffff', border: '1px solid #e5e7eb',
                      borderRadius: 5, color: '#374151',
                      fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
                    }}
                  >
                    {LIMIT_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      {/* ── User Details Drawer ───────────────────────────────────────────── */}
      {selectedUserId && (
        <UserDetailsDrawer
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          showToast={showToast}
          onUserUpdated={() => { load(); notifyDashboard(); }}
        />
      )}
      {addUserOpen && (
        <AddUserModal
          onClose={() => setAddUserOpen(false)}
          onSuccess={() => { setAddUserOpen(false); load(); notifyDashboard(); }}
          showToast={showToast}
        />
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
          userId={deleteUser.id}
          email={deleteUser.email}
          fullName={deleteUser.fullName}
          onClose={() => setDeleteUser(null)}
          onSuccess={() => {
            if (selectedUserId === deleteUser.id) setSelectedUserId(null);
            setDeleteUser(null);
            load();
            notifyDashboard();
          }}
          showToast={showToast}
        />
      )}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </AdminLayout>
  );
}
