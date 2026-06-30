import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToastType } from '../users/Toast';
import {
  getAssignmentStats,
  getAssignments,
  deleteAssignment,
  UserRoleAssignmentError,
} from '../../api/userRoleAssignments';
import type {
  AssignmentStats,
  Assignment,
  AssignmentType,
  AssignmentStatus,
} from '../../api/userRoleAssignments';
import AssignRoleModal from './AssignRoleModal';
import EditAssignmentModal from './EditAssignmentModal';

const PAGE_SIZE = 50;

// ── Badge color maps ───────────────────────────────────────────────────────────

const TYPE_BADGE: Record<AssignmentType, { bg: string; color: string }> = {
  PRIMARY:   { bg: '#eff6ff', color: '#2563eb' },
  SECONDARY: { bg: '#f3f4f6', color: '#374151' },
  TEMPORARY: { bg: '#fffbeb', color: '#b45309' },
  EMERGENCY: { bg: '#fef2f2', color: '#dc2626' },
};

const STATUS_BADGE: Record<AssignmentStatus, { bg: string; color: string }> = {
  ACTIVE:  { bg: '#f0fdf4', color: '#16a34a' },
  EXPIRED: { bg: '#f9fafb', color: '#6b7280' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Avatar helper ──────────────────────────────────────────────────────────────

function Avatar({ name, src }: { name: string; src: string | null }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  const hue = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }

  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
      background: `hsl(${hue},55%,88%)`, color: `hsl(${hue},55%,32%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700,
    }}>
      {initials || '?'}
    </div>
  );
}

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
      {[180, 90, 140, 80, 80, 70, 70].map((w, i) => (
        <td key={i} style={{ padding: '11px 14px' }}>
          <div style={{ width: w, height: 11, borderRadius: 4, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  );
}

// ── Grouping ───────────────────────────────────────────────────────────────────
// API returns a flat list (one row per assignment). Group by user.id so each
// user renders as one table row. The PRIMARY assignment (if any) drives the
// TYPE/STATUS/EXPIRY columns; if a user has no PRIMARY, the most recent
// assignment stands in as the "driver" so the row still shows a sensible
// type/status instead of being blank.

interface UserGroup {
  user:    Assignment['user'];
  driver:  Assignment;
  primary: Assignment | null;
  others:  Assignment[];
}

function groupByUser(rows: Assignment[]): UserGroup[] {
  const order: string[] = [];
  const byUser = new Map<string, Assignment[]>();
  for (const row of rows) {
    if (!byUser.has(row.user.id)) { byUser.set(row.user.id, []); order.push(row.user.id); }
    byUser.get(row.user.id)!.push(row);
  }
  return order.map(id => {
    const assignments = byUser.get(id)!;
    const primary = assignments.find(a => a.assignmentType === 'PRIMARY') ?? null;
    const driver  = primary ?? assignments[0];
    const others  = assignments.filter(a => a !== driver);
    return { user: assignments[0].user, driver, primary, others };
  });
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  showToast: (type: ToastType, message: string) => void;
}

export default function UserRoleAssignmentsTab({ showToast }: Props) {
  // Stats
  const [stats, setStats] = useState<AssignmentStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchStats = useCallback(() => {
    (() => setStatsLoading(true))();
    getAssignmentStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, []);

  // List + filters
  const [rows, setRows] = useState<Assignment[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [typeFilter, setTypeFilter] = useState<AssignmentType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | 'ALL'>('ALL');

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchInput = (value: string) => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { setSearch(value); setPage(1); }, 400);
  };

  const fetchList = useCallback(() => {
    (() => setListLoading(true))();
    getAssignments({
      page, limit: PAGE_SIZE, search,
      assignmentType: typeFilter,
      status: statusFilter,
    })
      .then(res => {
        setRows(res.data);
        setTotalRows(res.pagination.total);
        setTotalPages(res.pagination.pages);
      })
      .catch(() => { setRows([]); showToast('error', 'Failed to load role assignments'); })
      .finally(() => setListLoading(false));
  }, [page, search, typeFilter, statusFilter, showToast]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchList();  }, [fetchList]);

  useEffect(() => {
    const refresh = () => { fetchStats(); fetchList(); };
    window.addEventListener('rolesUpdated', refresh);
    window.addEventListener('userDataChanged', refresh);
    return () => {
      window.removeEventListener('rolesUpdated', refresh);
      window.removeEventListener('userDataChanged', refresh);
    };
  }, [fetchStats, fetchList]);

  const groups = groupByUser(rows);

  // Modal state
  const [assignOpen, setAssignOpen] = useState(false);
  const [editAssignment, setEditAssignment] = useState<Assignment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAssignSuccess = () => { setAssignOpen(false); fetchStats(); fetchList(); };
  const handleEditSuccess   = () => { setEditAssignment(null); fetchStats(); fetchList(); };

  const handleDelete = async (a: Assignment) => {
    if (!window.confirm(`Remove "${a.role.name}" from ${a.user.fullName}?`)) return;
    setDeletingId(a.id);
    try {
      await deleteAssignment(a.id);
      showToast('success', 'Assignment removed');
      window.dispatchEvent(new CustomEvent('rolesUpdated'));
      window.dispatchEvent(new CustomEvent('userDataChanged'));
      fetchStats(); fetchList();
    } catch (err) {
      if (err instanceof UserRoleAssignmentError && err.status === 404) {
        showToast('error', 'Assignment not found');
      } else {
        showToast('error', err instanceof Error ? err.message : 'Failed to remove assignment');
      }
    } finally { setDeletingId(null); }
  };

  const rowStart = (page - 1) * PAGE_SIZE + 1;
  const rowEnd   = Math.min(page * PAGE_SIZE, totalRows);

  return (
    <div>
      <style>{`@keyframes rp-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }`}</style>

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        <StatCard label="Total Users with Roles" value={stats?.totalUsersWithRoles ?? 0} loading={statsLoading}
          iconBg="#eff6ff" iconColor="#2563eb"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
        <StatCard label="Users with Multiple Roles" value={stats?.usersWithMultipleRoles ?? 0} loading={statsLoading}
          iconBg="#faf5ff" iconColor="#7c3aed"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>} />
        <StatCard label="Temporary Role Assignments" value={stats?.temporaryAssignments ?? 0} loading={statsLoading}
          iconBg="#fffbeb" iconColor="#d97706"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} />
        <StatCard label="Expired Role Assignments" value={stats?.expiredAssignments ?? 0} loading={statsLoading}
          iconBg="#fef2f2" iconColor="#dc2626"
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} />
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
              placeholder="Search by name or email..."
              value={searchInput}
              onChange={e => handleSearchInput(e.target.value)}
              style={{ paddingLeft: 28, paddingRight: 10, paddingTop: 6, paddingBottom: 6, border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', color: '#374151', background: '#fff', width: 200, outline: 'none' }}
              onFocus={e => (e.target.style.borderColor = '#3b82f6')}
              onBlur={e  => (e.target.style.borderColor = '#e5e7eb')}
            />
          </div>

          <select className="rp-select" value={typeFilter} onChange={e => { setTypeFilter(e.target.value as AssignmentType | 'ALL'); setPage(1); }}>
            <option value="ALL">All Types</option>
            <option value="PRIMARY">Primary</option>
            <option value="SECONDARY">Secondary</option>
            <option value="TEMPORARY">Temporary</option>
            <option value="EMERGENCY">Emergency</option>
          </select>

          <select className="rp-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value as AssignmentStatus | 'ALL'); setPage(1); }}>
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
          </select>

          <button
            onClick={() => setAssignOpen(true)}
            style={{ marginLeft: 'auto', padding: '7px 14px', fontSize: 12.5, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 1px 3px rgba(37,99,235,0.3)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Manage Assignments
          </button>
        </div>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
                <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px', minWidth: 200 }}>USER</th>
                <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px' }}>PRIMARY ROLE</th>
                <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px', minWidth: 160 }}>OTHER ROLES</th>
                <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px' }}>TYPE</th>
                <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px' }}>EXPIRY</th>
                <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px' }}>STATUS</th>
                <th style={{ padding: '9px 12px', textAlign: 'center', fontWeight: 600, color: '#6b7280', fontSize: 11, letterSpacing: '0.3px' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {listLoading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

              {!listLoading && groups.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>No assignments found.</span>
                      <button
                        onClick={() => setAssignOpen(true)}
                        style={{ padding: '6px 14px', fontSize: 12.5, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        + Assign your first role
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!listLoading && groups.map(group => {
                const { user, driver, primary, others } = group;
                const typeBadge   = TYPE_BADGE[driver.assignmentType] ?? { bg: '#f3f4f6', color: '#374151' };
                const statusBadge = STATUS_BADGE[driver.status] ?? { bg: '#f9fafb', color: '#6b7280' };
                const isDeleting  = deletingId === driver.id;
                return (
                  <tr key={user.id} className="rp-table-row" style={{ borderBottom: '1px solid #f3f4f6', opacity: isDeleting ? 0.5 : 1 }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={user.fullName} src={user.avatar} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#111827', fontSize: 12.5, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{user.fullName}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      {primary ? (
                        <span style={{ background: '#eff6ff', color: '#2563eb', borderRadius: 100, fontSize: 10.5, fontWeight: 600, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                          {primary.role.name}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      {others.length === 0 ? (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {others.map(o => {
                            const b = TYPE_BADGE[o.assignmentType] ?? { bg: '#f3f4f6', color: '#374151' };
                            return (
                              <span key={o.id} title={o.assignmentType} style={{ background: b.bg, color: b.color, borderRadius: 100, fontSize: 10.5, fontWeight: 600, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                                {o.role.name}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{ background: typeBadge.bg, color: typeBadge.color, borderRadius: 100, fontSize: 10.5, fontWeight: 600, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                        {driver.assignmentType}
                      </span>
                    </td>
                    <td style={{ padding: '10px 10px', color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatDate(driver.expiresAt)}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span style={{ background: statusBadge.bg, color: statusBadge.color, borderRadius: 100, fontSize: 10.5, fontWeight: 600, padding: '2px 8px' }}>
                        {driver.status === 'ACTIVE' ? 'Active' : 'Expired'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <button className="rp-action-btn" title="Edit assignment" onClick={() => setEditAssignment(driver)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button className="rp-action-btn danger" title="Remove assignment" disabled={isDeleting} onClick={() => handleDelete(driver)}>
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
              Showing {totalRows === 0 ? 0 : rowStart} to {rowEnd} of {totalRows} assignments
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

      {/* ── Assign Role modal ─────────────────────────────────────────────── */}
      {assignOpen && (
        <AssignRoleModal
          onClose={() => setAssignOpen(false)}
          onSuccess={handleAssignSuccess}
          showToast={showToast}
        />
      )}

      {/* ── Edit Assignment modal ─────────────────────────────────────────── */}
      {editAssignment && (
        <EditAssignmentModal
          assignment={editAssignment}
          onClose={() => setEditAssignment(null)}
          onSuccess={handleEditSuccess}
          showToast={showToast}
        />
      )}
    </div>
  );
}
