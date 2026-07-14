import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, Pencil, Archive, Plus, ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { getLmFilterOptions } from '../../services/lmApi';
import { listCourses, archiveCourse } from '../../services/coursesApi';
import { approveCourse, rejectCourse } from '../../services/courseWizardApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { CourseApiError } from '../../types/courses';
import type {
  CourseListRow,
  CourseStatusFilter,
  CourseStatusCounts,
  CoursesListParams,
} from '../../types/courses';
import type { LmFilterOptions } from '../../types/lm';
import CourseForm from './CourseForm';
import CourseBuilder from './CourseBuilder';
import CourseSettings from './CourseSettings';
import CoursePreview from './CoursePreview';
import CourseSubmit from './CourseSubmit';
import CourseQuickViewModal from './CourseQuickViewModal';

// ── Status tabs ───────────────────────────────────────────────────────────────

const STATUS_TABS: CourseStatusFilter[] = ['All', 'Published', 'Draft', 'Pending', 'Archived'];

const STATUS_BADGE: Record<string, string> = {
  Published: 'tw:bg-green-50 tw:text-green-700',
  Draft:     'tw:bg-amber-50 tw:text-amber-700',
  Pending:   'tw:bg-blue-50 tw:text-blue-700',
  Archived:  'tw:bg-slate-100 tw:text-slate-500',
};

const LEVEL_BADGE: Record<string, string> = {
  Beginner:     'tw:bg-emerald-50 tw:text-emerald-700',
  Intermediate: 'tw:bg-violet-50 tw:text-violet-700',
  Advanced:     'tw:bg-orange-50 tw:text-orange-700',
};

// ── Page number helper ────────────────────────────────────────────────────────

function pageRange(current: number, total: number): number[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, i) => start + i);
}

// ── Toast ─────────────────────────────────────────────────────────────────────

interface Toast { type: 'success' | 'error'; message: string }

// ── View state ────────────────────────────────────────────────────────────────

type View =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit';     courseId: string }
  | { kind: 'builder';  courseId: string }
  | { kind: 'settings'; courseId: string }
  | { kind: 'preview';  courseId: string }
  | { kind: 'submit';   courseId: string };

// ── Main component ────────────────────────────────────────────────────────────

interface CoursesTabProps {
  /** When true, mount directly into the create form (used by LmGuide shortcut). */
  openCreateOnMount?: boolean;
}

export default function CoursesTab({ openCreateOnMount }: CoursesTabProps) {
  const navigate = useNavigate();

  const [view, setView] = useState<View>(openCreateOnMount ? { kind: 'create' } : { kind: 'list' });
  const [viewCourseId, setViewCourseId] = useState<string | null>(null);

  // List state
  const [rows,         setRows]         = useState<CourseListRow[]>([]);
  const [statusCounts, setStatusCounts] = useState<CourseStatusCounts | null>(null);
  const [total,        setTotal]        = useState(0);
  const [pages,        setPages]        = useState(1);
  const [loading,      setLoading]      = useState(true);
  const [listError,    setListError]    = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<CourseStatusFilter>('All');
  const [category,     setCategory]     = useState('');
  const [instructor,   setInstructor]   = useState('');
  const [searchInput,  setSearchInput]  = useState('');
  const [search,       setSearch]       = useState('');
  const [page,         setPage]         = useState(1);
  const limit = 10;

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter options
  const [filterOptions, setFilterOptions] = useState<LmFilterOptions | null>(null);

  // Archive state
  const [archivingId,  setArchivingId]  = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  // Approve / Reject state
  const [approvingId,  setApprovingId]  = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<CourseListRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError,  setRejectError]  = useState<string | null>(null);
  const [rejecting,    setRejecting]    = useState(false);

  // Toast
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(type: Toast['type'], message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // Load filter-options once
  useEffect(() => {
    getLmFilterOptions().then(setFilterOptions).catch(() => null);
  }, []);

  // Fetch list whenever filters/page change
  const fetchList = useCallback(() => {
    (() => { setLoading(true); setListError(null); })();
    const params: CoursesListParams = {
      page, limit, status: statusFilter,
      ...(category   && { category }),
      ...(instructor && { instructor }),
      ...(search     && { search }),
    };
    listCourses(params)
      .then((res) => {
        setRows(res.courses);
        setStatusCounts(res.statusCounts);
        setTotal(res.pagination.total);
        setPages(res.pagination.pages);
      })
      .catch((err) => {
        if (err instanceof CourseApiError && err.status === 401) { navigate('/login'); return; }
        setListError(err instanceof Error ? err.message : 'Failed to load courses.');
      })
      .finally(() => setLoading(false));
  }, [page, statusFilter, category, instructor, search, navigate]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // Debounce search input
  function handleSearchChange(val: string) {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearch(val); setPage(1); }, 400);
  }

  function applyStatusTab(tab: CourseStatusFilter) {
    setStatusFilter(tab);
    setPage(1);
  }

  function applyCategory(val: string) { setCategory(val); setPage(1); }
  function applyInstructor(val: string) { setInstructor(val); setPage(1); }

  // ── Archive ─────────────────────────────────────────────────────────────

  async function handleArchive(row: CourseListRow) {
    if (!window.confirm(`Archive "${row.title}"? It will move to the Archived tab and students won't see it.`)) return;
    setArchivingId(row.id);
    setArchiveError(null);
    try {
      await archiveCourse(row.id);
      showToast('success', `"${row.title}" archived.`);
      invalidateFor(appQueryClient, 'course.archive');
      fetchList();
    } catch (err) {
      if (err instanceof CourseApiError && err.status === 401) { navigate('/login'); return; }
      const msg = err instanceof Error ? err.message : 'Failed to archive.';
      setArchiveError(msg);
      showToast('error', msg);
    } finally {
      setArchivingId(null);
    }
  }

  // ── Approve ──────────────────────────────────────────────────────────────

  async function handleApprove(row: CourseListRow) {
    if (!window.confirm(`Approve "${row.title}"? It will be published immediately.`)) return;
    setApprovingId(row.id);
    try {
      await approveCourse(row.id);
      showToast('success', `"${row.title}" approved and published.`);
      fetchList();
    } catch (err) {
      if (err instanceof CourseApiError && err.status === 401) { navigate('/login'); return; }
      if (err instanceof CourseApiError && err.status === 429) {
        showToast('error', 'Too many requests — slow down and try again.');
        return;
      }
      // Race condition (400) or unexpected error — refetch current state, show message verbatim
      fetchList();
      showToast('error', err instanceof Error ? err.message : 'Approval failed.');
    } finally {
      setApprovingId(null);
    }
  }

  // ── Reject ────────────────────────────────────────────────────────────────

  function openRejectModal(row: CourseListRow) {
    setRejectTarget(row);
    setRejectReason('');
    setRejectError(null);
  }

  async function handleRejectSubmit() {
    if (!rejectTarget) return;
    const reason = rejectReason.trim();
    if (!reason) { setRejectError('Reason is required.'); return; }
    if (reason.length > 1000) { setRejectError('Reason must be ≤ 1000 characters.'); return; }
    setRejecting(true);
    setRejectError(null);
    try {
      await rejectCourse(rejectTarget.id, reason);
      showToast('success', `"${rejectTarget.title}" returned to Draft with feedback.`);
      setRejectTarget(null);
      fetchList();
    } catch (err) {
      if (err instanceof CourseApiError && err.status === 401) { navigate('/login'); return; }
      // Race condition 400 — close modal, refetch current state, show message verbatim
      setRejectTarget(null);
      fetchList();
      showToast('error', err instanceof Error ? err.message : 'Rejection failed.');
    } finally {
      setRejecting(false);
    }
  }

  // ── Form callbacks ───────────────────────────────────────────────────────

  function handleSaved() {
    const mutationName = view.kind === 'create' ? 'course.createDraft' : 'course.update';
    showToast('success', view.kind === 'create' ? 'Draft saved!' : 'Course updated.');
    invalidateFor(appQueryClient, mutationName);
    setView({ kind: 'list' });
    fetchList();
  }

  function handleGoToBuilder(courseId: string) {
    // CourseForm already invalidated 'course.createDraft' before calling this.
    // Just pre-warm the list (for when user navigates back) and switch views.
    fetchList();
    setView({ kind: 'builder', courseId });
  }

  // ── Render wizard steps ──────────────────────────────────────────────────

  if (view.kind === 'settings') {
    return (
      <>
        <CourseSettings
          courseId={view.courseId}
          onBack={() => setView({ kind: 'builder', courseId: view.courseId })}
          onNext={() => setView({ kind: 'preview', courseId: view.courseId })}
        />
        {toast && <ToastBanner {...toast} />}
      </>
    );
  }

  if (view.kind === 'preview') {
    return (
      <>
        <CoursePreview
          courseId={view.courseId}
          onBack={() => setView({ kind: 'settings', courseId: view.courseId })}
          onNext={() => setView({ kind: 'submit', courseId: view.courseId })}
        />
        {toast && <ToastBanner {...toast} />}
      </>
    );
  }

  if (view.kind === 'submit') {
    return (
      <>
        <CourseSubmit
          courseId={view.courseId}
          onBack={() => setView({ kind: 'preview', courseId: view.courseId })}
          onDone={() => { fetchList(); setView({ kind: 'list' }); }}
        />
        {toast && <ToastBanner {...toast} />}
      </>
    );
  }

  if (view.kind === 'builder') {
    return (
      <>
        <CourseBuilder
          courseId={view.courseId}
          onBack={() => { fetchList(); setView({ kind: 'list' }); }}
          onNext={() => setView({ kind: 'settings', courseId: view.courseId })}
        />
        {toast && <ToastBanner {...toast} />}
      </>
    );
  }

  // ── Render form ──────────────────────────────────────────────────────────

  if (view.kind === 'create' || view.kind === 'edit') {
    return (
      <>
        <CourseForm
          mode={view.kind === 'create' ? 'create' : 'edit'}
          courseId={view.kind === 'edit' ? view.courseId : undefined}
          onSaved={handleSaved}
          onCancel={() => setView({ kind: 'list' })}
          onGoToBuilder={handleGoToBuilder}
        />
        {toast && <ToastBanner {...toast} />}
      </>
    );
  }

  // ── Render list ──────────────────────────────────────────────────────────

  const rowStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rowEnd   = Math.min(page * limit, total);
  const pnums    = pageRange(page, pages);

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">

      {/* Header */}
      <div className="tw:flex tw:items-center tw:justify-between">
        <h2 className="tw:m-0 tw:text-[16px] tw:font-semibold tw:text-slate-900">Courses</h2>
        <button
          type="button"
          onClick={() => setView({ kind: 'create' })}
          className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-3.5 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700"
        >
          <Plus className="tw:h-4 tw:w-4" strokeWidth={2.5} />
          Create Course
        </button>
      </div>

      {/* Status tabs */}
      <div className="tw:flex tw:gap-1 tw:border-b tw:border-slate-200">
        {STATUS_TABS.map((tab) => {
          const count = statusCounts ? statusCounts[tab.toLowerCase() as keyof CourseStatusCounts] : null;
          const isActive = statusFilter === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => applyStatusTab(tab)}
              className={
                'tw:-mb-px tw:flex tw:items-center tw:gap-1.5 tw:border-b-2 tw:px-3 tw:py-2.5 tw:text-[12px] tw:font-medium tw:transition-colors' +
                (isActive
                  ? ' tw:border-blue-600 tw:text-blue-600'
                  : ' tw:border-transparent tw:text-slate-500 tw:hover:text-slate-700')
              }
            >
              {tab}
              {count !== null && (
                <span className={
                  'tw:rounded-full tw:px-1.5 tw:py-0.5 tw:text-[10px] tw:font-bold' +
                  (isActive ? ' tw:bg-blue-100 tw:text-blue-700' : ' tw:bg-slate-100 tw:text-slate-500')
                }>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters row */}
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2.5">
        {/* Search */}
        <div className="tw:relative tw:flex tw:min-w-[180px] tw:items-center">
          <Search className="tw:absolute tw:left-2.5 tw:h-3.5 tw:w-3.5 tw:text-slate-400" strokeWidth={2} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search courses…"
            className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:py-1.5 tw:pl-8 tw:pr-3 tw:text-[12px] tw:text-slate-700 tw:outline-none focus:tw:border-blue-400"
          />
        </div>

        {/* Category */}
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(e) => applyCategory(e.target.value)}
          className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-2.5 tw:py-1.5 tw:text-[12px] tw:text-slate-600 tw:outline-none"
        >
          <option value="">All Categories</option>
          {filterOptions?.categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Instructor */}
        <select
          aria-label="Filter by instructor"
          value={instructor}
          onChange={(e) => applyInstructor(e.target.value)}
          className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-2.5 tw:py-1.5 tw:text-[12px] tw:text-slate-600 tw:outline-none"
        >
          <option value="">All Instructors</option>
          {filterOptions?.instructors.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>

        {/* Clear filters */}
        {(category || instructor || search) && (
          <button
            type="button"
            onClick={() => { setCategory(''); setInstructor(''); setSearchInput(''); setSearch(''); setPage(1); }}
            className="tw:text-[12px] tw:font-medium tw:text-slate-400 tw:hover:text-slate-600"
          >
            Clear ✕
          </button>
        )}
      </div>

      {/* Error */}
      {listError && (
        <div className="tw:rounded-lg tw:border tw:border-red-100 tw:bg-red-50 tw:px-4 tw:py-2.5 tw:text-[13px] tw:text-red-600">
          {listError}
        </div>
      )}
      {archiveError && (
        <div className="tw:rounded-lg tw:border tw:border-red-100 tw:bg-red-50 tw:px-4 tw:py-2.5 tw:text-[13px] tw:text-red-600">
          {archiveError}
        </div>
      )}

      {/* Table */}
      <div className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white">
        <div className="tw:overflow-x-auto">
          <table className="tw:w-full tw:border-collapse">
            <thead>
              <tr className="tw:border-b tw:border-slate-200 tw:bg-slate-50 tw:text-left">
                {['Course', 'Instructor', 'Category', 'Level', 'Enrolled', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="tw:px-3 tw:py-2.5 tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="tw:border-b tw:border-slate-100">
                  {Array.from({ length: 7 }).map((__, j) => (
                    <td key={j} className="tw:px-3 tw:py-3">
                      <div className="tw:h-3 tw:w-full tw:animate-pulse tw:rounded tw:bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))}

              {!loading && !listError && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="tw:px-3 tw:py-10 tw:text-center tw:text-[13px] tw:text-slate-400">
                    No courses found
                  </td>
                </tr>
              )}

              {!loading && rows.map((r) => {
                const isArchiving = archivingId === r.id;
                return (
                  <tr key={r.id}
                    className={'tw:border-b tw:border-slate-100 tw:transition-colors tw:hover:bg-slate-50' + (isArchiving ? ' tw:opacity-50' : '')}>

                    {/* Course thumbnail + title */}
                    <td className="tw:px-3 tw:py-3">
                      <div className="tw:flex tw:max-w-[240px] tw:items-center tw:gap-2.5">
                        {r.thumbnail ? (
                          <img src={r.thumbnail} alt=""
                            className="tw:h-8 tw:w-11 tw:shrink-0 tw:rounded tw:object-cover" />
                        ) : (
                          <div className="tw:h-8 tw:w-11 tw:shrink-0 tw:rounded tw:bg-slate-200" />
                        )}
                        <span className="tw:line-clamp-2 tw:text-[13px] tw:font-medium tw:leading-tight tw:text-slate-900">
                          {r.title}
                        </span>
                      </div>
                    </td>

                    <td className="tw:px-3 tw:py-3 tw:text-[13px] tw:text-slate-700">{r.instructor}</td>
                    <td className="tw:px-3 tw:py-3 tw:text-[13px] tw:text-slate-700">{r.category}</td>

                    <td className="tw:px-3 tw:py-3">
                      <span className={`tw:rounded-full tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-medium ${LEVEL_BADGE[r.level] ?? ''}`}>
                        {r.level}
                      </span>
                    </td>

                    <td className="tw:px-3 tw:py-3 tw:text-[13px] tw:text-slate-700">
                      {r.enrolledCount.toLocaleString()}
                    </td>

                    <td className="tw:px-3 tw:py-3">
                      <span className={`tw:rounded-full tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-medium ${STATUS_BADGE[r.status] ?? ''}`}>
                        {r.status}
                      </span>
                    </td>

                    <td className="tw:px-3 tw:py-3">
                      <div className="tw:flex tw:items-center tw:gap-1 tw:text-slate-400">
                        {/* View */}
                        <button type="button"
                          onClick={() => setViewCourseId(r.id)}
                          aria-label={`View ${r.title}`}
                          title="Quick view"
                          className="tw:rounded tw:p-1 tw:hover:bg-slate-100 tw:hover:text-slate-700">
                          <Eye className="tw:h-4 tw:w-4" strokeWidth={2} />
                        </button>
                        {/* Edit */}
                        <button type="button"
                          onClick={() => setView({ kind: 'edit', courseId: r.id })}
                          aria-label={`Edit ${r.title}`}
                          className="tw:rounded tw:p-1 tw:hover:bg-slate-100 tw:hover:text-blue-600">
                          <Pencil className="tw:h-4 tw:w-4" strokeWidth={2} />
                        </button>
                        {/* Archive */}
                        {r.status !== 'Archived' && (
                          <button type="button"
                            onClick={() => handleArchive(r)}
                            disabled={isArchiving}
                            aria-label={`Archive ${r.title}`}
                            className="tw:rounded tw:p-1 tw:hover:bg-red-50 tw:hover:text-red-500 tw:disabled:opacity-40">
                            <Archive className="tw:h-4 tw:w-4" strokeWidth={2} />
                          </button>
                        )}
                        {/* Approve — Pending only */}
                        {r.status === 'Pending' && (
                          <button type="button"
                            onClick={() => handleApprove(r)}
                            disabled={approvingId === r.id}
                            aria-label={`Approve ${r.title}`}
                            title="Approve — publishes the course"
                            className="tw:rounded tw:p-1 tw:hover:bg-green-50 tw:hover:text-green-600 tw:disabled:opacity-40">
                            <CheckCircle className="tw:h-4 tw:w-4" strokeWidth={2} />
                          </button>
                        )}
                        {/* Reject — Pending only */}
                        {r.status === 'Pending' && (
                          <button type="button"
                            onClick={() => openRejectModal(r)}
                            disabled={approvingId === r.id}
                            aria-label={`Reject ${r.title}`}
                            title="Request changes — returns course to Draft"
                            className="tw:rounded tw:p-1 tw:hover:bg-red-50 tw:hover:text-red-500 tw:disabled:opacity-40">
                            <XCircle className="tw:h-4 tw:w-4" strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="tw:flex tw:items-center tw:justify-between tw:border-t tw:border-slate-100 tw:px-4 tw:py-3">
          <span className="tw:text-[12px] tw:text-slate-500">
            {loading ? 'Loading…' : `Showing ${rowStart}–${rowEnd} of ${total} courses`}
          </span>
          <div className="tw:flex tw:items-center tw:gap-1">
            <button type="button" disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="tw:flex tw:h-7 tw:w-7 tw:items-center tw:justify-center tw:rounded-md tw:border tw:border-slate-200 tw:text-slate-400 tw:hover:bg-slate-50 tw:disabled:opacity-40">
              <ChevronLeft className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
            </button>
            {pnums.map((p) => (
              <button key={p} type="button"
                onClick={() => setPage(p)}
                className={
                  'tw:flex tw:h-7 tw:w-7 tw:items-center tw:justify-center tw:rounded-md tw:text-[12px] tw:font-medium' +
                  (p === page ? ' tw:bg-blue-600 tw:text-white' : ' tw:text-slate-600 tw:hover:bg-slate-50')
                }>
                {p}
              </button>
            ))}
            {pages > 5 && pnums[pnums.length - 1] < pages && (
              <>
                <span className="tw:px-1 tw:text-[12px] tw:text-slate-400">…</span>
                <button type="button" onClick={() => setPage(pages)}
                  className="tw:flex tw:h-7 tw:w-7 tw:items-center tw:justify-center tw:rounded-md tw:text-[12px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50">
                  {pages}
                </button>
              </>
            )}
            <button type="button" disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="tw:flex tw:h-7 tw:w-7 tw:items-center tw:justify-center tw:rounded-md tw:border tw:border-slate-200 tw:text-slate-400 tw:hover:bg-slate-50 tw:disabled:opacity-40">
              <ChevronRight className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Course quick view modal ─────────────────────────────────── */}
      {viewCourseId && (
        <CourseQuickViewModal
          courseId={viewCourseId}
          onClose={() => setViewCourseId(null)}
        />
      )}

      {/* ── Reject reason modal ──────────────────────────────────────── */}
      {rejectTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
            onClick={!rejecting ? () => setRejectTarget(null) : undefined} />
          <div className="tw:relative tw:w-full tw:max-w-md tw:rounded-xl tw:bg-white tw:shadow-2xl tw:flex tw:flex-col">
            {/* Header */}
            <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-slate-200 tw:px-5 tw:py-4">
              <h3 className="tw:m-0 tw:text-[15px] tw:font-semibold tw:text-slate-900">
                Request Changes
              </h3>
              <button type="button" onClick={() => setRejectTarget(null)} disabled={rejecting}
                className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-slate-100 tw:disabled:opacity-40">
                <XCircle className="tw:h-4 tw:w-4" strokeWidth={2} />
              </button>
            </div>
            {/* Body */}
            <div className="tw:px-5 tw:py-4 tw:flex tw:flex-col tw:gap-3">
              <p className="tw:m-0 tw:text-[13px] tw:text-slate-600">
                Returning <strong className="tw:font-semibold">{rejectTarget.title}</strong> to Draft.
                Provide feedback for the course author.
              </p>
              {rejectError && (
                <div className="tw:rounded-lg tw:border tw:border-red-100 tw:bg-red-50 tw:px-3 tw:py-2 tw:text-[12px] tw:text-red-600">
                  {rejectError}
                </div>
              )}
              <div>
                <div className="tw:flex tw:items-end tw:justify-between tw:mb-1">
                  <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">
                    Reason <span className="tw:text-red-500">*</span>
                  </label>
                  <span className={
                    'tw:text-[11px] tw:font-mono' +
                    (rejectReason.length > 1000 ? ' tw:text-red-500' : ' tw:text-slate-400')
                  }>
                    {rejectReason.length}/1000
                  </span>
                </div>
                <textarea
                  aria-label="Rejection reason"
                  value={rejectReason}
                  onChange={e => { setRejectReason(e.target.value); setRejectError(null); }}
                  placeholder="Explain what needs to be improved…"
                  rows={5}
                  autoFocus
                  className="tw:w-full tw:resize-y tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400 focus:tw:ring-2 focus:tw:ring-blue-100"
                />
              </div>
            </div>
            {/* Footer */}
            <div className="tw:flex tw:justify-end tw:gap-2 tw:border-t tw:border-slate-100 tw:px-5 tw:py-3.5">
              <button type="button" onClick={() => setRejectTarget(null)} disabled={rejecting}
                className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50 tw:disabled:opacity-40">
                Cancel
              </button>
              <button type="button" onClick={handleRejectSubmit}
                disabled={rejecting || !rejectReason.trim() || rejectReason.length > 1000}
                aria-label="Submit rejection"
                className="tw:rounded-lg tw:bg-red-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-red-700 tw:disabled:opacity-40">
                {rejecting ? 'Sending…' : 'Request Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <ToastBanner {...toast} />}
    </div>
  );
}

// ── Toast banner ──────────────────────────────────────────────────────────────

function ToastBanner({ type, message }: Toast) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9000,
      background: type === 'success' ? '#16a34a' : '#dc2626',
      color: '#fff', padding: '10px 18px', borderRadius: 8,
      fontSize: 13, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
    }}>
      {message}
    </div>
  );
}
