import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState,
} from 'react';
import {
  ChevronDown, ChevronLeft, ChevronRight, Columns3, Eye, ListFilter,
  MoreVertical, Pencil, Search,
} from 'lucide-react';
import { listInstructors } from '../../services/instructorsApi';
import { InstructorApiError } from '../../types/instructors';
import type { Instructor, InstructorStatus, InstructorTabCounts } from '../../types/instructors';
import { listCategories } from '../../services/categoriesApi';
import type { CategoryNode } from '../../types/categories';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { deleteInstructor, reactivateInstructor } from '../../services/instructorsApi';
import SuspendInstructorDialog from './SuspendInstructorDialog';
import SendMessageModal from '../users/SendMessageModal';

export type ServerTab = 'all' | 'active' | 'inactive' | 'suspended' | 'top';
export type SortKey = 'recent' | 'name' | 'courses' | 'students';

interface Props {
  serverTab:          ServerTab;
  /** When true (Invitations tab), fetches serverTab='inactive' then shows only status==='invited' rows. */
  filterInvitedOnly?: boolean;
  onTabCountsChanged: (counts: InstructorTabCounts) => void;
  onView:             (id: string) => void;
  onEdit:             (instructor: Instructor) => void;
  /** Fired after any row-level mutation (suspend/reactivate/delete/message)
   *  succeeds, with the affected instructor's id — lets the page refresh an
   *  open side panel for that same instructor. */
  onMutated?:         (id: string) => void;
  showToast:          (type: 'success' | 'error', message: string) => void;
}

export interface InstructorsTableHandle { refetch: () => void }

const STATUS_BADGE: Record<InstructorStatus, { bg: string; fg: string }> = {
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
  { value: 'students', label: 'Students' },
];

type ColumnKey = 'email' | 'specialization' | 'rating' | 'revenue';
const OPTIONAL_COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'email',          label: 'Email' },
  { key: 'specialization', label: 'Specialization' },
  { key: 'rating',         label: 'Rating' },
  { key: 'revenue',        label: 'Revenue' },
];

function initials(name: string): string {
  return (name || '?').split(' ').map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase();
}

function pageRange(current: number, total: number): number[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, i) => start + i);
}

const TH: React.CSSProperties = { padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left', whiteSpace: 'nowrap' };
const TD: React.CSSProperties = { padding: '10px 12px', fontSize: 13, color: '#374151', borderTop: '1px solid #f1f5f9', verticalAlign: 'middle' };

const InstructorsTable = forwardRef<InstructorsTableHandle, Props>(function InstructorsTable(
  { serverTab, filterInvitedOnly, onTabCountsChanged, onView, onEdit, onMutated, showToast }, ref,
) {
  const [rows, setRows] = useState<Instructor[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [page, setPage] = useState(1);
  const limit = 10;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [specOptions, setSpecOptions] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [topIds, setTopIds] = useState<Set<string>>(new Set());

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(new Set(['email', 'specialization', 'rating', 'revenue']));

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [suspendTarget, setSuspendTarget] = useState<Instructor | null>(null);
  const [messageTarget, setMessageTarget] = useState<Instructor | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Reset to page 1 when the active tab changes. Also default `sort` to
  // 'students' when entering Top Performers — GET /instructors only falls
  // back to the students-ranked order when `sort` is OMITTED from the query;
  // this component always sends an explicit value, so without this the tab
  // would silently render "Most Recent" order instead of actual top performers
  // (the admin could still change it via the Sort dropdown afterward).
  useEffect(() => {
    (() => {
      setPage(1);
      setSelected(new Set());
      if (serverTab === 'top') setSort('students');
    })();
  }, [serverTab, filterInvitedOnly]);

  // Guards against out-of-order responses (e.g. clicking through tabs faster
  // than the network resolves) overwriting the table with stale data.
  const requestIdRef = useRef(0);

  const fetchList = useCallback(() => {
    const myRequestId = ++requestIdRef.current;
    (() => { setLoading(true); setListError(null); })();

    const baseParams = {
      tab: serverTab,
      sort,
      ...(search ? { search } : {}),
      ...(specialization ? { specialization } : {}),
      ...(categoryId ? { categoryId } : {}),
    };

    // Invitations has no dedicated backend tab — it's the 'inactive' bucket
    // (PENDING | INVITED) client-filtered to status==='invited'. The backend
    // caps `limit` at 100/request, so once the inactive bucket exceeds 100
    // rows a single page can silently under-count/omit invited rows past
    // that window. Fetch every page of the bucket (bounded by the real
    // tabCounts.inactive total) and merge before filtering, instead of
    // capping at one page.
    const listPromise = filterInvitedOnly
      ? listInstructors({ ...baseParams, page: 1, limit: 100 }).then(async (first) => {
          if (first.pagination.pages <= 1) return first;
          const rest = await Promise.all(
            Array.from({ length: first.pagination.pages - 1 }, (_, i) =>
              listInstructors({ ...baseParams, page: i + 2, limit: 100 })),
          );
          return {
            ...first,
            instructors: [first, ...rest].flatMap(r => r.instructors),
          };
        })
      : listInstructors({ ...baseParams, page, limit });

    listPromise
      .then(res => {
        if (requestIdRef.current !== myRequestId) return; // stale response — a newer request already resolved
        setRows(res.instructors);
        onTabCountsChanged(res.tabCounts);
        setTotal(filterInvitedOnly ? res.instructors.filter(r => r.status === 'invited').length : res.pagination.total);
        setPages(filterInvitedOnly ? 1 : res.pagination.pages);
        setSpecOptions(prev => {
          const names = res.instructors.map(r => r.specialization).filter((s): s is string => !!s);
          return Array.from(new Set([...prev, ...names])).sort();
        });
      })
      .catch(err => {
        if (requestIdRef.current !== myRequestId) return;
        setListError(err instanceof InstructorApiError ? err.message : 'Failed to load instructors.');
      })
      .finally(() => {
        if (requestIdRef.current === myRequestId) setLoading(false);
      });

    // Top-10 ids for the trophy badge — refetched alongside every list fetch
    // (not just once on mount) so it can't go stale after a mutation. Same
    // ranking that backs ?tab=top, per contract — one definition everywhere.
    listInstructors({ tab: 'top', limit: 10 })
      .then(res => setTopIds(new Set(res.instructors.map(i => i.id))))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, serverTab, filterInvitedOnly, sort, search, specialization, categoryId]);

  useEffect(() => { fetchList(); }, [fetchList]);
  useImperativeHandle(ref, () => ({ refetch: fetchList }), [fetchList]);

  useEffect(() => {
    listCategories().then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (filtersRef.current && !filtersRef.current.contains(e.target as Node)) setFiltersOpen(false);
      if (columnsRef.current && !columnsRef.current.contains(e.target as Node)) setColumnsOpen(false);
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

  function toggleColumn(key: ColumnKey) {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const displayRows = filterInvitedOnly ? rows.filter(r => r.status === 'invited') : rows;
  const allOnPageSelected = displayRows.length > 0 && displayRows.every(r => selected.has(r.id));

  function toggleAll() {
    setSelected(prev => {
      if (allOnPageSelected) {
        const next = new Set(prev);
        displayRows.forEach(r => next.delete(r.id));
        return next;
      }
      return new Set([...prev, ...displayRows.map(r => r.id)]);
    });
  }

  async function handleReactivate(row: Instructor) {
    if (!window.confirm(`Reactivate ${row.fullName}?`)) return;
    setBusyId(row.id);
    try {
      await reactivateInstructor(row.id);
      invalidateFor(appQueryClient, 'instructor.reactivate', { id: row.id });
      showToast('success', `${row.fullName} reactivated.`);
      fetchList();
      onMutated?.(row.id);
    } catch (err) {
      showToast('error', err instanceof InstructorApiError ? err.message : 'Reactivation failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(row: Instructor) {
    if (!window.confirm(`Archive ${row.fullName}? Blocked while they still own courses or live sessions.`)) return;
    setBusyId(row.id);
    try {
      await deleteInstructor(row.id);
      invalidateFor(appQueryClient, 'instructor.delete');
      showToast('success', `${row.fullName} archived.`);
      fetchList();
      onMutated?.(row.id);
    } catch (err) {
      if (err instanceof InstructorApiError && err.status === 409 && err.data) {
        const { courses = 0, liveSessions = 0 } = err.data;
        showToast('error', `${err.message} (${courses} course${courses === 1 ? '' : 's'}, ${liveSessions} live session${liveSessions === 1 ? '' : 's'})`);
      } else {
        showToast('error', err instanceof InstructorApiError ? err.message : 'Delete failed.');
      }
    } finally {
      setBusyId(null);
    }
  }

  const rowStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rowEnd = filterInvitedOnly ? displayRows.length : Math.min(page * limit, total);
  const pnums = pageRange(page, pages);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        <div style={{ position: 'relative', minWidth: 200 }}>
          <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 9 }} />
          <input
            type="text" value={searchInput} onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search instructors…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 30px', fontSize: 12, fontFamily: 'inherit', border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none' }}
          />
        </div>

        <select
          aria-label="Filter by specialization"
          value={specialization}
          onChange={e => { setSpecialization(e.target.value); setPage(1); }}
          style={SELECT_STYLE}
        >
          <option value="">All Specializations</option>
          {specOptions.map(s => <option key={s} value={s}>{s}</option>)}
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
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>CATEGORY</div>
              <select
                aria-label="Filter by category"
                value={categoryId}
                onChange={e => { setCategoryId(e.target.value); setPage(1); }}
                style={{ ...SELECT_STYLE, width: '100%' }}
              >
                <option value="">All Categories</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {(specialization || categoryId || search) && (
                <button
                  type="button"
                  onClick={() => { setSpecialization(''); setCategoryId(''); setSearchInput(''); setSearch(''); setPage(1); }}
                  style={{ marginTop: 10, fontSize: 12, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}
        </div>

        <div ref={columnsRef} style={{ position: 'relative' }}>
          <button type="button" onClick={() => setColumnsOpen(o => !o)} style={ICON_LABEL_BTN}>
            <Columns3 size={13} /> Columns <ChevronDown size={12} />
          </button>
          {columnsOpen && (
            <div style={POPOVER}>
              {OPTIONAL_COLUMNS.map(c => (
                <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                  <input type="checkbox" checked={visibleCols.has(c.key)} onChange={() => toggleColumn(c.key)} />
                  {c.label}
                </label>
              ))}
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
                <th style={TH}>Instructor</th>
                {visibleCols.has('email') && <th style={TH}>Email</th>}
                {visibleCols.has('specialization') && <th style={TH}>Specialization</th>}
                <th style={TH}>Courses</th>
                <th style={TH}>Students</th>
                {visibleCols.has('rating') && <th style={TH}>Rating</th>}
                {visibleCols.has('revenue') && <th style={TH}>Revenue</th>}
                <th style={TH}>Status</th>
                <th style={TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 + visibleCols.size }).map((__, j) => (
                    <td key={j} style={TD}><div style={{ height: 12, background: '#f1f5f9', borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))}

              {!loading && !listError && displayRows.length === 0 && (
                <tr><td colSpan={6 + visibleCols.size} style={{ ...TD, textAlign: 'center', color: '#94a3b8', padding: '32px 12px' }}>No instructors found</td></tr>
              )}

              {!loading && displayRows.map(row => (
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
                      {topIds.has(row.id) && <span title="Top Instructor" style={{ fontSize: 12 }}>🏆</span>}
                    </div>
                  </td>
                  {visibleCols.has('email') && <td style={TD}>{row.email}</td>}
                  {visibleCols.has('specialization') && (
                    <td style={TD}>
                      {row.specialization
                        ? <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#eef2ff', color: '#4338ca' }}>{row.specialization}</span>
                        : <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                  )}
                  <td style={TD}>{row.coursesCount}</td>
                  <td style={TD}>{row.studentsCount.toLocaleString()}</td>
                  {visibleCols.has('rating') && <td style={{ ...TD, color: '#94a3b8' }}>—</td>}
                  {visibleCols.has('revenue') && <td style={{ ...TD, color: '#94a3b8' }}>—</td>}
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
                          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 40, width: 160, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
                            {row.status === 'suspended' ? (
                              <MenuItem label="Reactivate" onClick={() => { setOpenMenuId(null); handleReactivate(row); }} />
                            ) : (
                              <MenuItem label="Suspend" onClick={() => { setOpenMenuId(null); setSuspendTarget(row); }} />
                            )}
                            <MenuItem label="Message" onClick={() => { setOpenMenuId(null); setMessageTarget(row); }} />
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
            {loading ? 'Loading…' : `Showing ${rowStart} to ${rowEnd} of ${total} instructors`}
          </span>
          {!filterInvitedOnly && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={PAGE_BTN}><ChevronLeft size={14} /></button>
              {pnums.map(p => (
                <button key={p} type="button" onClick={() => setPage(p)} style={{ ...PAGE_BTN, ...(p === page ? { background: '#2563eb', color: '#fff', borderColor: '#2563eb' } : {}) }}>
                  {p}
                </button>
              ))}
              <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={PAGE_BTN}><ChevronRight size={14} /></button>
            </div>
          )}
        </div>
      </div>

      {suspendTarget && (
        <SuspendInstructorDialog
          instructorId={suspendTarget.id}
          fullName={suspendTarget.fullName}
          onClose={() => setSuspendTarget(null)}
          onSuccess={() => { const id = suspendTarget.id; setSuspendTarget(null); fetchList(); onMutated?.(id); }}
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
    </div>
  );
});

export default InstructorsTable;

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px',
        fontSize: 12, fontWeight: 500, fontFamily: 'inherit', background: 'none', border: 'none',
        cursor: 'pointer', color: danger ? '#dc2626' : '#374151',
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
