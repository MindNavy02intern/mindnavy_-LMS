import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ToastType } from '../users/Toast';
import type {
  PermissionMatrixData,
  PermissionCategory,
  MatrixPermission,
} from '../../types/rolesPage';
import {
  getPermissionMatrix,
  togglePermission as apiToggle,
} from '../../api/rolesPage';

// ── Category metadata ─────────────────────────────────────────────────────────

interface CatMeta { bg: string; color: string; label: string; border: string }

const CATEGORY_META: Record<PermissionCategory, CatMeta> = {
  USERS:        { bg: '#eff6ff', color: '#1d4ed8', border: '#3b82f6', label: 'Users'        },
  REPORTS:      { bg: '#f5f3ff', color: '#7c3aed', border: '#8b5cf6', label: 'Reports'      },
  SETTINGS:     { bg: '#fff7ed', color: '#c2410c', border: '#f97316', label: 'Settings'     },
  ORGANIZATION: { bg: '#f0fdf4', color: '#15803d', border: '#22c55e', label: 'Organization' },
  LEARNERS:     { bg: '#f0fdfa', color: '#0f766e', border: '#14b8a6', label: 'Learners'     },
  COURSES:      { bg: '#eef2ff', color: '#4338ca', border: '#6366f1', label: 'Courses'      },
  ADMIN:        { bg: '#fef2f2', color: '#b91c1c', border: '#ef4444', label: 'Admin'        },
};

const CATEGORY_ORDER: PermissionCategory[] = [
  'USERS', 'REPORTS', 'SETTINGS', 'ORGANIZATION', 'LEARNERS', 'COURSES', 'ADMIN',
];

// ── Access state ──────────────────────────────────────────────────────────────

type AccessState = 'full' | 'none';

const STATE_META: Record<AccessState, { bg: string; color: string; label: string }> = {
  full: { bg: '#dcfce7', color: '#16a34a', label: 'Full Access' },
  none: { bg: '#f1f5f9', color: '#94a3b8', label: 'No Access'   },
};

// ── Legend items ──────────────────────────────────────────────────────────────

const LEGEND: { state: AccessState; dot: string }[] = [
  { state: 'full', dot: '#16a34a' },
  { state: 'none', dot: '#94a3b8' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  showToast: (type: ToastType, message: string) => void;
  fullPage?: boolean;
}

// ── SVG icons ─────────────────────────────────────────────────────────────────

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function IconMinus() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function IconSpinner() {
  return (
    <svg
      width="15" height="15" viewBox="0 0 24 24" fill="none"
      stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round"
      style={{ animation: 'pm-spin 0.8s linear infinite' }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function MatrixSkeleton() {
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
        {[220, 140, 160].map((w, i) => (
          <div key={i} style={{ width: w, height: 34, borderRadius: 7, background: '#f0f0f0', animation: 'pm-pulse 1.4s ease-in-out infinite' }} />
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ width: 260, height: 14, borderRadius: 4, background: '#f0f0f0', animation: 'pm-pulse 1.4s ease-in-out infinite' }} />
      </div>
      <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 16, padding: '10px 16px', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>
          {[80, 120, 100, 90].map((w, i) => (
            <div key={i} style={{ width: w, height: 10, borderRadius: 4, background: '#e0e0e0', animation: 'pm-pulse 1.4s ease-in-out infinite' }} />
          ))}
        </div>
        <div style={{ background: '#f9fafb', padding: '12px 16px', display: 'flex', gap: 20, borderBottom: '2px solid #e5e7eb' }}>
          <div style={{ width: 250, height: 14, borderRadius: 4, background: '#e0e0e0', animation: 'pm-pulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} style={{ width: 90, height: 42, borderRadius: 6, background: '#e0e0e0', animation: 'pm-pulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 20, padding: '11px 16px', borderBottom: '1px solid #f3f4f6', alignItems: 'center' }}>
            <div style={{ width: 220, height: 12, borderRadius: 4, background: '#f0f0f0', animation: 'pm-pulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
            {[0, 1, 2, 3, 4].map(j => (
              <div key={j} style={{ width: 28, height: 28, borderRadius: '50%', background: '#f0f0f0', animation: 'pm-pulse 1.4s ease-in-out infinite', marginLeft: 31 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PermissionMatrixTab({ showToast, fullPage = false }: Props) {
  const [matrixData,       setMatrixData]       = useState<PermissionMatrixData | null>(null);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState<string | null>(null);
  const [roleStatusFilter, setRoleStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [categoryFilter,   setCategoryFilter]   = useState('ALL');
  const [searchInput,      setSearchInput]      = useState('');
  const [search,           setSearch]           = useState('');
  const [pendingToggles,   setPendingToggles]   = useState<Map<string, boolean>>(new Map());

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); }, []);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setSearch(value), 400);
  };

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchMatrix = useCallback(() => {
    (() => { setLoading(true); setError(null); })();
    getPermissionMatrix({
      roleStatus: roleStatusFilter !== 'ALL' ? roleStatusFilter : undefined,
      category:   categoryFilter   !== 'ALL' ? categoryFilter   : undefined,
      search:     search.trim()              || undefined,
    })
      .then(data => { setMatrixData(data); setLoading(false); })
      .catch(e   => { setError(e instanceof Error ? e.message : 'Failed to load matrix'); setLoading(false); });
  }, [roleStatusFilter, categoryFilter, search]);

  useEffect(() => { fetchMatrix(); }, [fetchMatrix]);

  // ── State helpers ─────────────────────────────────────────────────────────

  const checkedSet = useMemo(
    () => new Set(matrixData?.assignments.map(a => `${a.roleId}:${a.permissionId}`) ?? []),
    [matrixData?.assignments],
  );

  const getCellState = (roleId: string, permId: string): AccessState => {
    const key = `${roleId}:${permId}`;
    const enabled = pendingToggles.has(key) ? pendingToggles.get(key)! : checkedSet.has(key);
    return enabled ? 'full' : 'none';
  };

  const isPending = (roleId: string, permId: string) =>
    pendingToggles.has(`${roleId}:${permId}`);

  // ── Toggle (optimistic) ───────────────────────────────────────────────────

  const handleToggle = async (roleId: string, permId: string) => {
    const key = `${roleId}:${permId}`;
    if (pendingToggles.has(key)) return;

    const newEnabled = !checkedSet.has(key);
    setPendingToggles(prev => new Map(prev).set(key, newEnabled));

    try {
      await apiToggle({ roleId, permissionId: permId, enabled: newEnabled });
      setMatrixData(prev => {
        if (!prev) return prev;
        const newAssignments = newEnabled
          ? [...prev.assignments, { roleId, permissionId: permId }]
          : prev.assignments.filter(a => !(a.roleId === roleId && a.permissionId === permId));
        return { ...prev, assignments: newAssignments };
      });
      window.dispatchEvent(new CustomEvent('rolesUpdated'));
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update permission');
    } finally {
      setPendingToggles(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // ── Group permissions by category ─────────────────────────────────────────

  const groupedPermissions = useMemo(() => {
    if (!matrixData) return [] as [string, MatrixPermission[]][];
    const map = new Map<string, MatrixPermission[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const perm of matrixData.permissions) {
      const existing = map.get(perm.category);
      if (existing) existing.push(perm);
      else          map.set(perm.category, [perm]);
    }
    return Array.from(map.entries()).filter(([, perms]) => perms.length > 0);
  }, [matrixData?.permissions]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const roles     = matrixData?.roles ?? [];
  const summary   = matrixData?.summary;
  const firstLoad = loading && !matrixData;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <style>{`
        @keyframes pm-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }
        @keyframes pm-spin  { to { transform: rotate(360deg); } }
        .pm-perm-cell {
          position: sticky; left: 0; z-index: 1;
          background: #fff; padding: 10px 14px;
          border-right: 1px solid #e5e7eb;
          min-width: 260px; max-width: 320px;
        }
        .pm-icon-cell {
          text-align: center; vertical-align: middle;
          padding: 8px 10px;
          border-right: 1px solid #f3f4f6;
          user-select: none;
        }
        .pm-icon-cell:not(.pm-pending):hover .pm-state-badge {
          transform: scale(1.15);
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        .pm-state-badge {
          display: inline-flex; align-items: center; justify-content: center;
          width: 30px; height: 30px; border-radius: 50%;
          transition: transform 0.12s ease, box-shadow 0.12s ease;
          cursor: pointer;
        }
        .pm-pending .pm-state-badge { cursor: wait; }
        .pm-spinner-wrap {
          display: inline-flex; align-items: center; justify-content: center;
          width: 30px; height: 30px;
        }
        .pm-cat-row > td { background: #f8fafc; }
      `}</style>

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round"
            style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search roles or permissions..."
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
            style={{
              paddingLeft: 30, paddingRight: 10, paddingTop: 7, paddingBottom: 7,
              border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13,
              fontFamily: 'inherit', color: '#374151', background: '#fff',
              width: 220, outline: 'none',
            }}
            onFocus={e => (e.target.style.borderColor = '#3b82f6')}
            onBlur={e  => (e.target.style.borderColor = '#e5e7eb')}
          />
        </div>

        {/* Status filter */}
        <select
          value={roleStatusFilter}
          onChange={e => setRoleStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
          style={{ padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none' }}
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">Active Only</option>
          <option value="INACTIVE">Inactive Only</option>
        </select>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          style={{ padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', color: '#374151', background: '#fff', cursor: 'pointer', outline: 'none' }}
        >
          <option value="ALL">All Categories</option>
          {CATEGORY_ORDER.map(cat => (
            <option key={cat} value={cat}>{CATEGORY_META[cat].label}</option>
          ))}
        </select>

        <div style={{ flex: 1 }} />

        {/* Summary */}
        {summary && !loading && (
          <span style={{ fontSize: 12, color: '#9ca3af' }}>
            {summary.totalRoles} roles · {summary.totalPermissions} permissions · {summary.totalAssignments} assignments
          </span>
        )}

        {/* Re-fetch spinner */}
        {loading && matrixData && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" style={{ animation: 'pm-spin 1s linear infinite', flexShrink: 0 }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        )}
      </div>

      {/* ── Initial skeleton ───────────────────────────────────────────────── */}
      {firstLoad && <MatrixSkeleton />}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {!loading && error && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 220 }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{error}</div>
          <button onClick={fetchMatrix} style={{ padding: '6px 14px', fontSize: 13, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>
            Retry
          </button>
        </div>
      )}

      {/* ── Matrix ────────────────────────────────────────────────────────── */}
      {!firstLoad && !error && matrixData && (
        roles.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 220, color: '#9ca3af' }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <div style={{ fontSize: 14, fontWeight: 600 }}>No roles found. Try adjusting your filters.</div>
          </div>
        ) : matrixData.permissions.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 220, color: '#9ca3af' }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>No permissions configured yet.</div>
          </div>
        ) : (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', background: '#fff' }}>

            {/* ── Legend bar ─────────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '9px 16px', borderBottom: '1px solid #e5e7eb', background: '#fafafa' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Legend:
              </span>
              {LEGEND.map(({ state, dot }) => (
                <span key={state} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#374151' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: dot, display: 'inline-block', flexShrink: 0 }} />
                  {STATE_META[state].label}
                </span>
              ))}
            </div>

            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: fullPage ? 'calc(100vh - 150px)' : 'calc(100vh - 420px)' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: '100%' }}>

                {/* ── Column headers ──────────────────────────────────────── */}
                <thead>
                  <tr>
                    {/* Corner cell */}
                    <th style={{
                      position: 'sticky', left: 0, top: 0, zIndex: 3,
                      background: '#f9fafb', padding: '10px 14px',
                      borderBottom: '2px solid #e5e7eb', borderRight: '1px solid #e5e7eb',
                      textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280',
                      textTransform: 'uppercase', letterSpacing: '0.5px', minWidth: 260,
                      whiteSpace: 'nowrap',
                    }}>
                      PERMISSION
                    </th>

                    {/* One column per role */}
                    {roles.map(role => (
                      <th key={role.id} style={{
                        position: 'sticky', top: 0, zIndex: 2,
                        background: '#f9fafb', padding: '10px 12px 8px',
                        borderBottom: '2px solid #e5e7eb', borderRight: '1px solid #f0f0f0',
                        textAlign: 'center', minWidth: 110, verticalAlign: 'bottom',
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{
                              width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                              background: role.status === 'ACTIVE' ? '#16a34a' : '#9ca3af',
                            }} />
                            <span
                              title={role.name}
                              style={{ fontSize: 12, fontWeight: 700, color: '#111827', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                            >
                              {role.name}
                            </span>
                          </div>
                          <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 500 }}>
                            {role.userCount} {role.userCount === 1 ? 'user' : 'users'}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* ── Rows grouped by category ────────────────────────────── */}
                <tbody>
                  {groupedPermissions.flatMap(([category, perms]) => {
                    const catMeta: CatMeta = CATEGORY_META[category as PermissionCategory]
                      ?? { bg: '#f3f4f6', color: '#6b7280', border: '#9ca3af', label: category };

                    return [
                      // Category header row
                      <tr key={`cat-${category}`} className="pm-cat-row">
                        <td
                          colSpan={roles.length + 1}
                          style={{
                            padding: '7px 14px 7px 10px',
                            borderTop: '1px solid #e5e7eb',
                            borderBottom: '1px solid #e5e7eb',
                            borderLeft: `4px solid ${catMeta.border}`,
                          }}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              display: 'inline-flex', padding: '2px 9px', borderRadius: 100,
                              background: catMeta.bg, color: catMeta.color,
                              fontSize: 10, fontWeight: 700, letterSpacing: '0.3px',
                            }}>
                              {catMeta.label.toUpperCase()}
                            </span>
                            <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>
                              {perms.length} permission{perms.length !== 1 ? 's' : ''}
                            </span>
                          </span>
                        </td>
                      </tr>,

                      // Permission rows
                      ...perms.map(perm => (
                        <tr key={perm.id} style={{ borderBottom: '1px solid #f3f4f6' }}>

                          {/* Permission name — sticky left */}
                          <td className="pm-perm-cell" style={{ borderLeft: `3px solid ${catMeta.border}28` }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                              <span style={{
                                display: 'inline-flex', padding: '2px 5px', borderRadius: 100,
                                background: catMeta.bg, color: catMeta.color,
                                fontSize: 9, fontWeight: 700, flexShrink: 0, marginTop: 2,
                              }}>
                                {catMeta.label.substring(0, 3).toUpperCase()}
                              </span>
                              <div>
                                <div style={{ fontWeight: 600, color: '#111827', fontSize: 12, lineHeight: 1.4 }}>
                                  {perm.name}
                                </div>
                                {perm.description && (
                                  <div style={{ fontSize: 11, color: '#9ca3af', maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                                    {perm.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* State icon per role */}
                          {roles.map(role => {
                            const state   = getCellState(role.id, perm.id);
                            const pending = isPending(role.id, perm.id);
                            const meta    = STATE_META[state];
                            return (
                              <td
                                key={role.id}
                                className={`pm-icon-cell${pending ? ' pm-pending' : ''}`}
                                title={pending ? 'Saving…' : `${role.name}: ${meta.label} — click to toggle`}
                                style={{ opacity: pending ? 0.6 : 1, cursor: pending ? 'wait' : 'pointer' }}
                                onClick={() => !pending && handleToggle(role.id, perm.id)}
                              >
                                {pending ? (
                                  <div className="pm-spinner-wrap">
                                    <IconSpinner />
                                  </div>
                                ) : (
                                  <div
                                    className="pm-state-badge"
                                    style={{ background: meta.bg, color: meta.color }}
                                  >
                                    {state === 'full' && <IconCheck />}
                                    {state === 'none' && <IconMinus />}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      )),
                    ];
                  })}
                </tbody>

              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
