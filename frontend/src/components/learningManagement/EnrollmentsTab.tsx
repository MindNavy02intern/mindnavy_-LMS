// Enrollments Tab — v1 (ENROLLMENTS_CONTRACT.md). Rides the EXISTING
// course_enrollments table — every write here moves LM KPIs, the trend chart,
// top-courses, and courses.enrolledCount, so every mutation invalidates the
// FULL IMPACT_MAP §5.2 row, never a subset.
//
// Key invariants (read twice — easy to get wrong):
//  - progress is learner-derived and READ-ONLY — rendered as a bar, never an
//    input. The status PATCH payload type has no `progress` field at all, so
//    sending it alongside a status change is structurally impossible here.
//  - There is NO "DROPPED" status. "Remove learner" = DELETE (unenroll), a
//    completely different action from a status change.
//  - Marking COMPLETED does not set progress to 100 client-side (it isn't
//    server-set either) — only completedAt changes.
//  - Unenroll does NOT revoke an issued certificate — the confirm dialog stays
//    neutral and never implies otherwise.
//  - course.enrollmentLimit is enforced server-side (400 "Course is full…") —
//    that message renders directly above the Enroll dialog's submit button,
//    never as a toast.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Trash2, Search } from 'lucide-react';
import {
  listEnrollments, createEnrollment, updateEnrollmentStatus, deleteEnrollment,
  EnrollmentApiError,
} from '../../services/enrollmentsApi';
import { listCourses } from '../../services/coursesApi';
import { getUsers } from '../../api/users';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { Enrollment, EnrollmentStatus, EnrollmentStatusFilter, EnrollmentStatusCounts } from '../../types/enrollments';
import type { CourseListRow } from '../../types/courses';
import type { User } from '../../types/users';

// ── Toast ─────────────────────────────────────────────────────────────────────

interface Toast { type: 'success' | 'error'; message: string }

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

// ── Status meta ───────────────────────────────────────────────────────────────

const STATUS_VALUES: EnrollmentStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE'];

const STATUS_META: Record<EnrollmentStatus, { label: string; className: string }> = {
  NOT_STARTED: { label: 'Not Started', className: 'tw:bg-slate-100 tw:text-slate-600' },
  IN_PROGRESS: { label: 'In Progress', className: 'tw:bg-blue-100 tw:text-blue-700' },
  COMPLETED:   { label: 'Completed',   className: 'tw:bg-green-100 tw:text-green-700' },
  OVERDUE:     { label: 'Overdue',     className: 'tw:bg-red-100 tw:text-red-700' },
};

const CHIP_FILTERS: { key: EnrollmentStatusFilter; label: string; countKey: keyof EnrollmentStatusCounts }[] = [
  { key: 'All',         label: 'All',          countKey: 'All' },
  { key: 'NOT_STARTED', label: 'Not Started',  countKey: 'NOT_STARTED' },
  { key: 'IN_PROGRESS', label: 'In Progress',  countKey: 'IN_PROGRESS' },
  { key: 'COMPLETED',   label: 'Completed',    countKey: 'COMPLETED' },
  { key: 'OVERDUE',     label: 'Overdue',      countKey: 'OVERDUE' },
];

// ── Progress bar — always read-only, never computed from status ────────────────

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="tw:flex tw:items-center tw:gap-2">
      <div className="tw:h-1.5 tw:w-20 tw:overflow-hidden tw:rounded-full tw:bg-slate-100">
        <div className="tw:h-full tw:rounded-full tw:bg-blue-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="tw:text-[11px] tw:text-slate-500">{value}%</span>
    </div>
  );
}

// ── Enroll dialog ─────────────────────────────────────────────────────────────

interface EnrollDialogProps {
  onClose:    () => void;
  onEnrolled: (enrollment: Enrollment) => void;
}

function EnrollDialog({ onClose, onEnrolled }: EnrollDialogProps) {
  const navigate = useNavigate();
  const [courses, setCourses]   = useState<CourseListRow[]>([]);
  const [users, setUsers]       = useState<User[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [courseId, setCourseId] = useState('');
  const [userId, setUserId]     = useState('');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      listCourses({ limit: 200 }).then((r) => r.courses.filter((c) => c.status !== 'Archived')).catch(() => []),
      getUsers({ limit: 200 }).then((r) => r.users.filter((u) => u.status !== 'archived')).catch(() => []),
    ]).then(([c, u]) => { setCourses(c); setUsers(u); }).finally(() => setLoadingOptions(false));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!courseId || !userId) { setError('Select both a learner and a course.'); return; }
    setSaving(true);
    setError(null);
    try {
      const created = await createEnrollment({ courseId, userId });
      onEnrolled(created);
    } catch (err) {
      if (err instanceof EnrollmentApiError && err.status === 401) { navigate('/login'); return; }
      // Covers all 4 documented 400s verbatim: unknown/archived course, unknown/archived
      // user, already enrolled, course full (enrollmentLimit) — shown here, never a toast.
      setError(err instanceof Error ? err.message : 'Enrollment failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div aria-label="modal backdrop" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Enroll learner"
        className="tw:relative tw:flex tw:w-full tw:max-w-md tw:flex-col tw:rounded-xl tw:bg-white tw:shadow-2xl">
        <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-slate-200 tw:px-5 tw:py-4">
          <h3 className="tw:m-0 tw:text-[15px] tw:font-semibold tw:text-slate-900">Enroll Learner</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-slate-100">
            <X className="tw:h-4 tw:w-4" strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="tw:flex tw:flex-col tw:gap-4 tw:px-5 tw:py-4">
          <div className="tw:flex tw:flex-col tw:gap-1.5">
            <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">
              Learner <span className="tw:text-red-500">*</span>
            </label>
            {loadingOptions ? (
              <div className="tw:h-9 tw:w-full tw:animate-pulse tw:rounded-lg tw:bg-slate-100" />
            ) : (
              <select value={userId} onChange={(e) => setUserId(e.target.value)} required aria-label="Learner"
                className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400">
                <option value="">— Select learner —</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>)}
              </select>
            )}
          </div>

          <div className="tw:flex tw:flex-col tw:gap-1.5">
            <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">
              Course <span className="tw:text-red-500">*</span>
            </label>
            {loadingOptions ? (
              <div className="tw:h-9 tw:w-full tw:animate-pulse tw:rounded-lg tw:bg-slate-100" />
            ) : (
              <select value={courseId} onChange={(e) => setCourseId(e.target.value)} required aria-label="Course"
                className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400">
                <option value="">— Select course —</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            )}
          </div>

          {/* Error (incl. "Course is full…") renders right here, directly above
              the submit button — never as a toast. */}
          {error && (
            <div role="alert" className="tw:rounded-lg tw:border tw:border-red-100 tw:bg-red-50 tw:px-3 tw:py-2.5 tw:text-[13px] tw:text-red-600">
              {error}
            </div>
          )}

          <div className="tw:flex tw:items-center tw:justify-end tw:gap-2 tw:border-t tw:border-slate-100 tw:pt-4">
            <button type="button" onClick={onClose} disabled={saving}
              className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50 tw:disabled:opacity-40">
              Cancel
            </button>
            <button type="submit" disabled={saving || !courseId || !userId}
              className="tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700 tw:disabled:opacity-40">
              {saving ? 'Enrolling…' : 'Enroll'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

interface RowProps {
  enrollment: Enrollment;
  busy:       boolean;
  onStatusChange: (status: EnrollmentStatus) => void;
  onUnenroll: () => void;
}

function EnrollmentRow({ enrollment, busy, onStatusChange, onUnenroll }: RowProps) {
  return (
    <tr className="tw:border-b tw:border-slate-50 tw:last:border-0 tw:hover:bg-slate-50">
      <td className="tw:px-4 tw:py-3">
        <div>
          <p className="tw:m-0 tw:text-[13px] tw:font-semibold tw:text-slate-900">{enrollment.userName ?? '—'}</p>
          <p className="tw:m-0 tw:mt-0.5 tw:text-[12px] tw:text-slate-400">{enrollment.userEmail ?? '—'}</p>
        </div>
      </td>
      <td className="tw:px-4 tw:py-3 tw:text-[13px] tw:text-slate-700">{enrollment.courseTitle ?? '—'}</td>
      <td className="tw:px-4 tw:py-3"><ProgressBar value={enrollment.progress} /></td>
      <td className="tw:px-4 tw:py-3">
        <select
          value={enrollment.status}
          disabled={busy}
          aria-label={`Status for ${enrollment.userName ?? 'learner'}`}
          onChange={(e) => onStatusChange(e.target.value as EnrollmentStatus)}
          className={`tw:rounded-full tw:border-0 tw:px-2 tw:py-1 tw:text-[11px] tw:font-semibold tw:outline-none ${STATUS_META[enrollment.status].className}`}
        >
          {STATUS_VALUES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
      </td>
      <td className="tw:px-4 tw:py-3 tw:text-[12px] tw:text-slate-400">
        {new Date(enrollment.enrolledAt).toLocaleDateString()}
      </td>
      <td className="tw:px-4 tw:py-3">
        <div className="tw:flex tw:items-center tw:justify-end">
          <button type="button" onClick={onUnenroll} disabled={busy}
            aria-label={`Unenroll ${enrollment.userName ?? 'learner'}`}
            className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-red-50 tw:hover:text-red-500 tw:disabled:opacity-40">
            <Trash2 className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export default function EnrollmentsTab() {
  const navigate = useNavigate();

  const [enrollments, setEnrollments]   = useState<Enrollment[]>([]);
  const [statusCounts, setStatusCounts] = useState<EnrollmentStatusCounts | null>(null);
  const [pagination, setPagination]     = useState({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<EnrollmentStatusFilter>('All');
  const [courseFilter, setCourseFilter] = useState('');
  const [search, setSearch]             = useState('');
  const [page, setPage]                 = useState(1);

  const [courses, setCourses] = useState<CourseListRow[]>([]);
  const [showEnroll, setShowEnroll] = useState(false);
  const [busyId, setBusyId]         = useState<string | null>(null);
  const [toast, setToast]           = useState<Toast | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    listCourses({ limit: 200 }).then((r) => setCourses(r.courses)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listEnrollments({
        status: statusFilter, courseId: courseFilter || undefined,
        search: search || undefined, page, limit: PAGE_SIZE,
      });
      setEnrollments(data.enrollments);
      setStatusCounts(data.statusCounts);
      setPagination(data.pagination);
    } catch (err) {
      if (err instanceof EnrollmentApiError && err.status === 401) { navigate('/login'); return; }
      setError(err instanceof Error ? err.message : 'Failed to load enrollments.');
    } finally {
      setLoading(false);
    }
  }, [navigate, statusFilter, courseFilter, search, page]);

  useEffect(() => { load(); }, [load]);

  function invalidateEnrollment(mutation: 'enrollment.create' | 'enrollment.statusUpdate' | 'enrollment.cancel', e: Enrollment) {
    invalidateFor(appQueryClient, mutation, { studentId: e.userId, courseId: e.courseId });
    // invalidateFor() above is a no-op today (no TanStack Query consumer is
    // wired up anywhere in this app) — this is the real refresh bridge every
    // other tab/panel listens to (e.g. NotificationAutomation.sentCount for
    // COURSE_ENROLLMENT/COURSE_COMPLETION triggers). Without it, enrolling or
    // completing a course here never refreshed anything outside this tab.
    window.dispatchEvent(new CustomEvent('analyticsUpdated'));
  }

  function handleEnrolled(created: Enrollment) {
    invalidateEnrollment('enrollment.create', created);
    setShowEnroll(false);
    setPage(1);
    load();
    showToast('success', 'Learner enrolled.');
  }

  async function handleStatusChange(enrollment: Enrollment, status: EnrollmentStatus) {
    setBusyId(enrollment.id);
    try {
      const updated = await updateEnrollmentStatus(enrollment.id, { status });
      invalidateEnrollment('enrollment.statusUpdate', updated);
      setEnrollments((prev) => prev.map((e) => (e.id === enrollment.id ? updated : e)));
      showToast('success', 'Enrollment status updated.');
    } catch (err) {
      if (err instanceof EnrollmentApiError && err.status === 401) { navigate('/login'); return; }
      showToast('error', err instanceof Error ? err.message : 'Status update failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnenroll(enrollment: Enrollment) {
    if (!window.confirm(
      `Unenroll ${enrollment.userName ?? 'this learner'} from ${enrollment.courseTitle ?? 'this course'}?\n\nThis cannot be undone.`
    )) return;
    setBusyId(enrollment.id);
    try {
      await deleteEnrollment(enrollment.id);
      invalidateEnrollment('enrollment.cancel', enrollment);
      setEnrollments((prev) => prev.filter((e) => e.id !== enrollment.id));
      showToast('success', 'Learner unenrolled.');
    } catch (err) {
      if (err instanceof EnrollmentApiError && err.status === 401) { navigate('/login'); return; }
      showToast('error', err instanceof Error ? err.message : 'Unenroll failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <div className="tw:flex tw:items-center tw:justify-between">
        <h2 className="tw:m-0 tw:text-[17px] tw:font-semibold tw:text-slate-900">Enrollments</h2>
        <button type="button" onClick={() => setShowEnroll(true)}
          className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700">
          <Plus className="tw:h-4 tw:w-4" strokeWidth={2.5} /> Enroll Learner
        </button>
      </div>

      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <div className="tw:relative">
          <Search className="tw:pointer-events-none tw:absolute tw:left-2.5 tw:top-1/2 tw:h-3.5 tw:w-3.5 tw:-translate-y-1/2 tw:text-slate-400" strokeWidth={2} />
          <input
            type="text" value={search} placeholder="Search learner or course…"
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            aria-label="Search enrollments"
            className="tw:w-56 tw:rounded-lg tw:border tw:border-slate-200 tw:py-1.5 tw:pl-8 tw:pr-3 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
          />
        </div>
        <select value={courseFilter} onChange={(e) => { setCourseFilter(e.target.value); setPage(1); }}
          aria-label="Filter by course"
          className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-1.5 tw:text-[13px] tw:text-slate-700 tw:outline-none">
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>

      <div className="tw:flex tw:flex-wrap tw:gap-1.5">
        {CHIP_FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => { setStatusFilter(f.key); setPage(1); }}
            className={
              'tw:flex tw:items-center tw:gap-1.5 tw:rounded-full tw:px-3 tw:py-1 tw:text-[12px] tw:font-medium tw:transition-colors' +
              (statusFilter === f.key ? ' tw:bg-blue-600 tw:text-white' : ' tw:bg-slate-100 tw:text-slate-600 tw:hover:bg-slate-200')
            }>
            {f.label}
            {statusCounts && <span className="tw:opacity-70">({statusCounts[f.countKey]})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="tw:flex tw:flex-col tw:gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="tw:h-14 tw:w-full tw:animate-pulse tw:rounded-xl tw:bg-slate-100" />)}
        </div>
      ) : error ? (
        <div className="tw:rounded-xl tw:border tw:border-red-100 tw:bg-red-50 tw:p-5 tw:text-center">
          <p className="tw:text-[13px] tw:text-red-500">{error}</p>
          <button type="button" onClick={load} className="tw:mt-2 tw:text-[13px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">Retry</button>
        </div>
      ) : enrollments.length === 0 ? (
        <div className="tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-3 tw:rounded-xl tw:border tw:border-dashed tw:border-slate-300 tw:bg-white tw:py-20">
          <p className="tw:m-0 tw:text-[14px] tw:text-slate-500">No enrollments match these filters.</p>
        </div>
      ) : (
        <>
          <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:overflow-hidden">
            <table className="tw:w-full tw:border-collapse">
              <thead>
                <tr className="tw:border-b tw:border-slate-100 tw:bg-slate-50">
                  <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Learner</th>
                  <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Course</th>
                  <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Progress</th>
                  <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Status</th>
                  <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Enrolled</th>
                  <th className="tw:px-4 tw:py-3" />
                </tr>
              </thead>
              <tbody>
                {enrollments.map((e) => (
                  <EnrollmentRow
                    key={e.id}
                    enrollment={e}
                    busy={busyId === e.id}
                    onStatusChange={(status) => handleStatusChange(e, status)}
                    onUnenroll={() => handleUnenroll(e)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="tw:flex tw:items-center tw:justify-between tw:text-[12px] tw:text-slate-500">
              <span>Page {pagination.page} of {pagination.pages} ({pagination.total} total)</span>
              <div className="tw:flex tw:gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                  className="tw:rounded tw:border tw:border-slate-200 tw:px-3 tw:py-1 tw:font-medium tw:text-slate-600 tw:disabled:opacity-40">
                  Previous
                </button>
                <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}
                  className="tw:rounded tw:border tw:border-slate-200 tw:px-3 tw:py-1 tw:font-medium tw:text-slate-600 tw:disabled:opacity-40">
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showEnroll && <EnrollDialog onClose={() => setShowEnroll(false)} onEnrolled={handleEnrolled} />}
      {toast && <ToastBanner {...toast} />}
    </div>
  );
}
