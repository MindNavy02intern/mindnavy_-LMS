// Learners table. Mirrors InstructorsTable.tsx's structure (fetch/search/
// sort/pagination/row-menu patterns) with the column set + actions Part 2
// literally specifies — no optional-columns toggle, no top-performer badge
// (not asked for here). Enroll / Assign Path reuse EnrollLearnerModal (same
// component LearnerSidePanel's Quick Actions use) against the real
// POST /learners/:id/enrollments endpoint.

import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState,
} from 'react';
import {
  ChevronDown, ChevronLeft, ChevronRight, Eye, ListFilter, MoreVertical, Pencil, Search,
} from 'lucide-react';
import { listLearners, deleteLearner, reactivateLearner } from '../../services/learnersApi';
import { LearnerApiError } from '../../types/learners';
import type { Learner, LearnerStatus, LearnerTabCounts } from '../../types/learners';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import SuspendLearnerDialog from './SuspendLearnerDialog';
import ResetLearnerPasswordDialog from './ResetLearnerPasswordDialog';
import SendMessageModal from '../users/SendMessageModal';
import EnrollLearnerModal from './EnrollLearnerModal';

export type ServerTab = 'all' | 'active' | 'inactive' | 'suspended' | 'at-risk' | 'completed' | 'pending-verification' | 'graduated';
export type SortKey = 'recent' | 'name' | 'courses' | 'progress';

interface Props {
  serverTab:          ServerTab;
  onTabCountsChanged: (counts: LearnerTabCounts) => void;
  onView:             (id: string) => void;
  onEdit:             (learner: Learner) => void;
  /** Fired after any row-level mutation succeeds, with the affected learner's
   *  id — lets the page refresh an open side panel for that same learner. */
  onMutated?:         (id: string) => void;
  showToast:          (type: 'success' | 'error', message: string) => void;
}

export interface LearnersTableHandle { refetch: () => void }

const STATUS_BADGE: Record<LearnerStatus, { bg: string; fg: string }> = {
  active:    { bg: '#dcfce7', fg: '#15803d' },
  suspended: { bg: '#fee2e2', fg: '#b91c1c' },
  pending:   { bg: '#fef9c3', fg: '#a16207' },
  invited:   { bg: '#f1f5f9', fg: '#475569' },
  archived:  { bg: '#f1f5f9', fg: '#64748b' },
};

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent',   label: 'Most Recent' },
  { value: 'name',     label: 'Name' },
  { value: 'courses',  label: 'Courses' },
  { value: 'progress', label: 'Progress' },
];

function initials(name: string): string {
  return (name || '?').split(' ').map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase();
}

function formatLastActive(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// green 80+, yellow 40-79, red <40 — task's literal thresholds.
function progressColor(pct: number): string {
  if (pct >= 80) return '#16a34a';
  if (pct >= 40) return '#ca8a04';
  return '#dc2626';
}

function ProgressBar({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: '#cbd5e1', fontSize: 12 }}>—</span>;
  const color = progressColor(value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 90 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, minWidth: 30, textAlign: 'right' }}>{value}%</span>
    </div>
  );
}

function pageRange(current: number, total: number): number[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, i) => start + i);
}

const TH: React.CSSProperties = { padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left', whiteSpace: 'nowrap' };
const TD: React.CSSProperties = { padding: '10px 12px', fontSize: 13, color: '#374151', borderTop: '1px solid #f1f5f9', verticalAlign: 'middle' };

const LearnersTable = forwardRef<LearnersTableHandle, Props>(function LearnersTable(
  { serverTab, onTabCountsChanged, onView, onEdit, onMutated, showToast }, ref,
) {
  const [rows, setRows] = useState<Learner[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [program, setProgram] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [page, setPage] = useState(1);
  const limit = 10;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [departmentOptions, setDepartmentOptions] = useState<string[]>([]);
  const [programOptions, setProgramOptions] = useState<string[]>([]);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [suspendTarget, setSuspendTarget] = useState<Learner | null>(null);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<Learner | null>(null);
  const [messageTarget, setMessageTarget] = useState<Learner | null>(null);
  const [enrollTarget, setEnrollTarget] = useState<{ learner: Learner; mode: 'course' | 'path' } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    (() => { setPage(1); setSelected(new Set()); })();
  }, [serverTab]);

  // Guards against out-of-order responses overwriting the table with stale data.
  const requestIdRef = useRef(0);

  const fetchList = useCallback(() => {
    const myRequestId = ++requestIdRef.current;
    (() => { setLoading(true); setListError(null); })();

    listLearners({
      tab: serverTab, sort, page, limit,
      ...(search ? { search } : {}),
      ...(department ? { department } : {}),
      ...(program ? { program } : {}),
    })
      .then(res => {
        if (requestIdRef.current !== myRequestId) return;
        setRows(res.learners);
        onTabCountsChanged(res.tabCounts);
        setTotal(res.pagination.total);
        setPages(res.pagination.pages);
        setDepartmentOptions(prev => {
          const names = res.learners.map(r => r.department).filter((d): d is string => !!d);
          return Array.from(new Set([...prev, ...names])).sort();
        });
        setProgramOptions(prev => {
          const names = res.learners.map(r => r.program).filter((p): p is string => !!p);
          return Array.from(new Set([...prev, ...names])).sort();
        });
      })
      .catch(err => {
        if (requestIdRef.current !== myRequestId) return;
        setListError(err instanceof LearnerApiError ? err.message : 'Failed to load learners.');
      })
      .finally(() => {
        if (requestIdRef.current === myRequestId) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, serverTab, sort, search, department, program]);

  useEffect(() => { fetchList(); }, [fetchList]);
  useImperativeHandle(ref, () => ({ refetch: fetchList }), [fetchList]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) setFiltersOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function handleSearchChange(val: string) {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearch(val); setPage(1); }, 400);
  }

  function toggleRow(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const allOnPageSelected = rows.length > 0 && rows.every(r => selected.has(r.id));
  function toggleAll() {
    setSelected(prev => {
      if (allOnPageSelected) {
        const next = new Set(prev);
        rows.forEach(r => next.delete(r.id));
        return next;
      }
      return new Set([...prev, ...rows.map(r => r.id)]);
    });
  }

  async function handleReactivate(row: Learner) {
    if (!window.confirm(`Reactivate ${row.fullName}?`)) return;
    setBusyId(row.id);
    try {
      await reactivateLearner(row.id);
      invalidateFor(appQueryClient, 'learner.reactivate', { id: row.id });
      showToast('success', `${row.fullName} reactivated.`);
      fetchList();
      onMutated?.(row.id);
    } catch (err) {
      showToast('error', err instanceof LearnerApiError ? err.message : 'Reactivation failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(row: Learner) {
    if (!window.confirm(`Archive ${row.fullName}? Blocked while they still have active (non-completed) enrollments.`)) return;
    setBusyId(row.id);
    try {
      await deleteLearner(row.id);
      invalidateFor(appQueryClient, 'learner.delete');
      showToast('success', `${row.fullName} archived.`);
      fetchList();
      onMutated?.(row.id);
    } catch (err) {
      if (err instanceof LearnerApiError && err.status === 409 && err.data) {
        const { activeEnrollments = 0 } = err.data;
        showToast('error', `${err.message} (${activeEnrollments} active enrollment${activeEnrollments === 1 ? '' : 's'})`);
      } else {
        showToast('error', err instanceof LearnerApiError ? err.message : 'Delete failed.');
      }
    } finally {
      setBusyId(null);
    }
  }

  const rowStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rowEnd = Math.min(page * limit, total);
  const pnums = pageRange(page, pages);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <div style={{ position: 'relative', minWidth: 200 }}>
          <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 9 }} />
          <input
            type="text" value={searchInput} onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search learners…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 30px', fontSize: 12, fontFamily: 'inherit', border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none' }}
          />
        </div>

        <select
          aria-label="Filter by program"
          value={program}
          onChange={e => { setProgram(e.target.value); setPage(1); }}
          style={SELECT_STYLE}
        >
          <option value="">All Programs</option>
          {programOptions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select
          aria-label="Sort by"
          value={sort}
          onChange={e => { setSort(e.target.value as SortKey); setPage(1); }}
          style={SELECT_STYLE}
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
        </select>

        <div ref={filtersRef} style={{ position: 'relative' }}>
          <button type="button" onClick={() => setFiltersOpen(o => !o)} style={ICON_LABEL_BTN}>
            <ListFilter size={13} /> Filters <ChevronDown size={12} />
          </button>
          {filtersOpen && (
            <div style={POPOVER}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>DEPARTMENT</div>
              <select
                aria-label="Filter by department"
                value={department}
                onChange={e => { setDepartment(e.target.value); setPage(1); }}
                style={{ ...SELECT_STYLE, width: '100%' }}
              >
                <option value="">All Departments</option>
                {departmentOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {(department || program || search) && (
                <button
                  type="button"
                  onClick={() => { setDepartment(''); setProgram(''); setSearchInput(''); setSearch(''); setPage(1); }}
                  style={{ marginTop: 10, fontSize: 12, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        {selected.size > 0 && (
          <span style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>
            {selected.size} selected
            <button type="button" onClick={() => setSelected(new Set())} style={{ marginLeft: 8, fontSize: 12, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Clear
            </button>
          </span>
        )}
      </div>

      {listError && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#b91c1c' }}>{listError}</div>
      )}

      {/* Table */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ ...TH, width: 32 }}>
                  <input type="checkbox" checked={allOnPageSelected} onChange={toggleAll} aria-label="Select all rows" />
                </th>
                <th style={TH}>Learner</th>
                <th style={TH}>ID</th>
                <th style={TH}>Email</th>
                <th style={TH}>Program</th>
                <th style={TH}>Enrolled Courses</th>
                <th style={TH}>Progress</th>
                <th style={TH}>Last Active</th>
                <th style={TH}>Status</th>
                <th style={TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 10 }).map((__, j) => (
                    <td key={j} style={TD}><div style={{ height: 12, background: '#f1f5f9', borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))}

              {!loading && !listError && rows.length === 0 && (
                <tr><td colSpan={10} style={{ ...TD, textAlign: 'center', color: '#94a3b8', padding: '32px 12px' }}>No learners found</td></tr>
              )}

              {!loading && rows.map(row => (
                <tr key={row.id} style={busyId === row.id ? { opacity: 0.5 } : undefined}>
                  <td style={TD}>
                    <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)} aria-label={`Select ${row.fullName}`} />
                  </td>
                  <td style={TD}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 160 }}>
                      {row.avatar
                        ? <img src={row.avatar} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        : <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>{initials(row.fullName)}</div>
                      }
                      <span style={{ fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.fullName}</span>
                    </div>
                  </td>
                  <td style={{ ...TD, color: '#64748b', fontFamily: 'monospace', fontSize: 12 }}>{row.learnerCode ?? '—'}</td>
                  <td style={TD}>{row.email}</td>
                  <td style={TD}>
                    {row.program
                      ? <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#eef2ff', color: '#4338ca' }}>{row.program}</span>
                      : <span style={{ color: '#94a3b8' }}>—</span>}
                  </td>
                  <td style={TD}>{row.coursesCount}</td>
                  <td style={TD}><ProgressBar value={row.avgProgress} /></td>
                  <td style={{ ...TD, color: '#64748b', fontSize: 12 }}>{formatLastActive(row.lastActiveAt)}</td>
                  <td style={TD}>
                    <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: STATUS_BADGE[row.status].bg, color: STATUS_BADGE[row.status].fg }}>
                      {row.status}
                    </span>
                  </td>
                  <td style={TD}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <button type="button" title="View" aria-label={`View ${row.fullName}`} onClick={() => onView(row.id)} style={ICON_BTN}>
                        <Eye size={15} color="#64748b" strokeWidth={2} />
                      </button>
                      <button type="button" title="Edit" aria-label={`Edit ${row.fullName}`} onClick={() => onEdit(row)} style={ICON_BTN}>
                        <Pencil size={15} color="#64748b" strokeWidth={2} />
                      </button>
                      <div style={{ position: 'relative' }} ref={openMenuId === row.id ? menuRef : undefined}>
                        <button type="button" title="More" aria-label={`More actions for ${row.fullName}`} onClick={() => setOpenMenuId(o => o === row.id ? null : row.id)} style={ICON_BTN}>
                          <MoreVertical size={15} color="#64748b" strokeWidth={2} />
                        </button>
                        {openMenuId === row.id && (
                          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 40, width: 180, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
                            <MenuItem label="Enroll" onClick={() => { setOpenMenuId(null); setEnrollTarget({ learner: row, mode: 'course' }); }} />
                            <MenuItem label="Assign Path" onClick={() => { setOpenMenuId(null); setEnrollTarget({ learner: row, mode: 'path' }); }} />
                            <MenuItem label="Message" onClick={() => { setOpenMenuId(null); setMessageTarget(row); }} />
                            <MenuItem label="Reset Password" onClick={() => { setOpenMenuId(null); setResetPasswordTarget(row); }} />
                            {row.status === 'suspended' ? (
                              <MenuItem label="Reactivate" onClick={() => { setOpenMenuId(null); handleReactivate(row); }} />
                            ) : (
                              <MenuItem label="Suspend" onClick={() => { setOpenMenuId(null); setSuspendTarget(row); }} />
                            )}
                            <MenuItem label="Delete" danger onClick={() => { setOpenMenuId(null); handleDelete(row); }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {loading ? 'Loading…' : `Showing ${rowStart} to ${rowEnd} of ${total} learners`}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={PAGE_BTN}><ChevronLeft size={14} /></button>
            {pnums.map(p => (
              <button key={p} type="button" onClick={() => setPage(p)} style={{ ...PAGE_BTN, ...(p === page ? { background: '#2563eb', color: '#fff', borderColor: '#2563eb' } : {}) }}>
                {p}
              </button>
            ))}
            <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={PAGE_BTN}><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      {suspendTarget && (
        <SuspendLearnerDialog
          learnerId={suspendTarget.id}
          fullName={suspendTarget.fullName}
          onClose={() => setSuspendTarget(null)}
          onSuccess={() => { const id = suspendTarget.id; setSuspendTarget(null); fetchList(); onMutated?.(id); }}
          showToast={showToast}
        />
      )}

      {resetPasswordTarget && (
        <ResetLearnerPasswordDialog
          learnerId={resetPasswordTarget.id}
          fullName={resetPasswordTarget.fullName}
          onClose={() => setResetPasswordTarget(null)}
          onSuccess={() => setResetPasswordTarget(null)}
          showToast={showToast}
        />
      )}

      {messageTarget && (
        <SendMessageModal
          userId={messageTarget.id}
          userName={messageTarget.fullName}
          onClose={() => setMessageTarget(null)}
          onSuccess={() => setMessageTarget(null)}
          showToast={showToast}
        />
      )}

      {enrollTarget && (
        <EnrollLearnerModal
          mode={enrollTarget.mode}
          learnerId={enrollTarget.learner.id}
          fullName={enrollTarget.learner.fullName}
          onClose={() => setEnrollTarget(null)}
          onSuccess={() => { const id = enrollTarget.learner.id; setEnrollTarget(null); fetchList(); onMutated?.(id); }}
          showToast={showToast}
        />
      )}
    </div>
  );
});

export default LearnersTable;

function MenuItem({ label, onClick, danger, disabled, title }: { label: string; onClick?: () => void; danger?: boolean; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px',
        fontSize: 12, fontWeight: 500, fontFamily: 'inherit', background: 'none', border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? '#cbd5e1' : danger ? '#dc2626' : '#374151',
      }}
    >
      {label}
    </button>
  );
}

const SELECT_STYLE: React.CSSProperties = { padding: '7px 10px', fontSize: 12, fontFamily: 'inherit', border: '1px solid #e2e8f0', borderRadius: 8, color: '#374151', background: '#fff', outline: 'none' };
const ICON_LABEL_BTN: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '7px 10px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', color: '#374151', cursor: 'pointer' };
const POPOVER: React.CSSProperties = { position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 40, width: 220, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', padding: 12 };
const ICON_BTN: React.CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 6, background: 'none', cursor: 'pointer' };
const PAGE_BTN: React.CSSProperties = { minWidth: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#64748b', fontSize: 12, fontWeight: 500, padding: '0 4px' };
