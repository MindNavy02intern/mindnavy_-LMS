// Live Sessions Tab — v1: REAL Zoom integration (LIVE_SESSIONS_CONTRACT.md).
//
// Key invariants (read twice — easy to get wrong):
//  - startUrl is the Zoom HOST link — rendered ONLY behind the "Start (host)"
//    admin action, never passed to any shared/learner-facing surface.
//  - status is 100% server-derived (UPCOMING/LIVE/ENDED from startTime+
//    durationMin) — there is NO status control anywhere in this UI; the badge
//    just renders whatever the GET response says.
//  - 503 ("Zoom is not configured…") is an EXPECTED state right now, not a bug
//    — rendered verbatim in an info banner, distinct from 502 (transient Zoom
//    API failure, retry-suggested) and 400 (validation).
//  - provider is ZOOM-only in v1 — no provider picker is rendered at all.
//  - PATCH only ever sends fields that actually changed (empty patch = 400).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, ChevronLeft, Pencil, Trash2, Radio, ExternalLink, ShieldAlert, AlertCircle, Info,
} from 'lucide-react';
import {
  listLiveSessions, createLiveSession, updateLiveSession, deleteLiveSession,
  LiveSessionApiError,
} from '../../services/liveSessionsApi';
import { listCourses } from '../../services/coursesApi';
import { getUsers } from '../../api/users';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { LiveSession, LiveSessionStatus } from '../../types/liveSessions';
import type { CourseListRow } from '../../types/courses';
import type { User } from '../../types/users';

// ── Timezones (IANA — real runtime list, never hardcoded business data) ────────

const FALLBACK_TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Beirut',
  'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Tokyo', 'Australia/Sydney',
];

function getIanaTimezones(): string[] {
  const IntlWithTZ = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  if (typeof IntlWithTZ.supportedValuesOf === 'function') {
    try {
      const zones = IntlWithTZ.supportedValuesOf('timeZone');
      if (zones.length > 0) return zones;
    } catch { /* fall through to fallback list */ }
  }
  return FALLBACK_TIMEZONES;
}

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

// ── Status badge — pure render of server value, never computed ─────────────────

const STATUS_META: Record<LiveSessionStatus, { label: string; className: string }> = {
  UPCOMING: { label: 'Upcoming', className: 'tw:bg-blue-100 tw:text-blue-700' },
  LIVE:     { label: 'Live',     className: 'tw:bg-red-100 tw:text-red-700' },
  ENDED:    { label: 'Ended',    className: 'tw:bg-slate-100 tw:text-slate-500' },
};

function StatusBadge({ status }: { status: LiveSessionStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`tw:rounded-full tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

// ── Zoom error banner — distinguishes 503 (permanent-for-now) vs 502 (transient) ─

interface ZoomError { kind: '503' | '502' | 'other'; message: string }

function ZoomErrorBanner({ error }: { error: ZoomError }) {
  if (error.kind === '503') {
    return (
      <div role="status" className="tw:flex tw:items-start tw:gap-2 tw:rounded-lg tw:border tw:border-amber-200 tw:bg-amber-50 tw:px-3 tw:py-2.5 tw:text-[12px] tw:text-amber-700">
        <Info className="tw:mt-0.5 tw:h-4 tw:w-4 tw:shrink-0" strokeWidth={2} />
        <span>{error.message}</span>
      </div>
    );
  }
  return (
    <div role="alert" className="tw:flex tw:items-start tw:gap-2 tw:rounded-lg tw:border tw:border-red-100 tw:bg-red-50 tw:px-3 tw:py-2.5 tw:text-[12px] tw:text-red-600">
      <AlertCircle className="tw:mt-0.5 tw:h-4 tw:w-4 tw:shrink-0" strokeWidth={2} />
      <span>{error.message}{error.kind === '502' ? ' Please try again.' : ''}</span>
    </div>
  );
}

function toZoomError(err: unknown): ZoomError | null {
  if (err instanceof LiveSessionApiError) {
    if (err.status === 503) return { kind: '503', message: err.message };
    if (err.status === 502) return { kind: '502', message: err.message };
  }
  return null;
}

// ── Form values ───────────────────────────────────────────────────────────────

interface FormValues {
  title:            string;
  description:      string;
  courseId:         string; // '' = none
  instructorId:     string;
  startTime:        string; // datetime-local value
  durationMin:      number;
  timezone:         string;
  maxParticipants:  string; // '' = no cap
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface SessionFormProps {
  mode:    'create' | 'edit';
  initial: FormValues;
  onSave:  (values: FormValues) => Promise<void>;
  onBack:  () => void;
}

function SessionForm({ mode, initial, onSave, onBack }: SessionFormProps) {
  const [title, setTitle]                 = useState(initial.title);
  const [description, setDescription]     = useState(initial.description);
  const [courseId, setCourseId]           = useState(initial.courseId);
  const [instructorId, setInstructorId]   = useState(initial.instructorId);
  const [startTime, setStartTime]         = useState(initial.startTime);
  const [durationMin, setDurationMin]     = useState(initial.durationMin);
  const [timezone, setTimezone]           = useState(initial.timezone);
  const [maxParticipants, setMaxParticipants] = useState(initial.maxParticipants);

  const [courses, setCourses]             = useState<CourseListRow[]>([]);
  const [instructors, setInstructors]     = useState<User[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving]               = useState(false);
  const [fieldError, setFieldError]       = useState<string | null>(null);
  const [zoomError, setZoomError]         = useState<ZoomError | null>(null);

  const timezones = useMemo(() => getIanaTimezones(), []);

  useEffect(() => {
    Promise.all([
      listCourses({ limit: 200 }).then((r) => r.courses.filter((c) => c.status !== 'Archived')).catch(() => []),
      getUsers({ role: 'instructor', limit: 200 }).then((r) => r.users.filter((u) => u.status !== 'archived')).catch(() => []),
    ]).then(([c, i]) => { setCourses(c); setInstructors(i); }).finally(() => setLoadingOptions(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setZoomError(null);

    if (!title.trim()) { setFieldError('Title is required.'); return; }
    if (title.trim().length > 200) { setFieldError('Title must be at most 200 characters.'); return; }
    if (!instructorId) { setFieldError('Instructor is required.'); return; }
    if (!startTime) { setFieldError('Start time is required.'); return; }
    if (new Date(startTime).getTime() <= Date.now()) { setFieldError('Start time must be in the future.'); return; }
    if (!Number.isInteger(durationMin) || durationMin < 5 || durationMin > 1440) {
      setFieldError('Duration must be an integer between 5 and 1440 minutes.'); return;
    }
    if (maxParticipants !== '' && (!Number.isInteger(Number(maxParticipants)) || Number(maxParticipants) < 1 || Number(maxParticipants) > 10000)) {
      setFieldError('Max participants must be an integer between 1 and 10000 (or left blank for no cap).'); return;
    }

    setSaving(true);
    try {
      await onSave({
        title: title.trim(), description, courseId, instructorId,
        startTime, durationMin, timezone, maxParticipants,
      });
    } catch (err) {
      const ze = toZoomError(err);
      if (ze) { setZoomError(ze); }
      else { setFieldError(err instanceof Error ? err.message : 'Save failed.'); }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tw:flex tw:flex-col tw:gap-5">
      <div className="tw:flex tw:items-center tw:gap-3">
        <button type="button" onClick={onBack}
          className="tw:flex tw:items-center tw:gap-1 tw:text-[13px] tw:font-medium tw:text-slate-500 tw:hover:text-slate-700">
          <ChevronLeft className="tw:h-4 tw:w-4" strokeWidth={2} />
          Back
        </button>
        <h2 className="tw:m-0 tw:text-[17px] tw:font-semibold tw:text-slate-900">
          {mode === 'create' ? 'Schedule Session' : 'Edit Session'}
        </h2>
      </div>

      <form onSubmit={handleSubmit}
        className="tw:flex tw:flex-col tw:gap-4 tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-6">
        {zoomError && <ZoomErrorBanner error={zoomError} />}
        {fieldError && (
          <div role="alert" className="tw:rounded-lg tw:border tw:border-red-100 tw:bg-red-50 tw:px-3 tw:py-2.5 tw:text-[13px] tw:text-red-600">
            {fieldError}
          </div>
        )}

        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">
            Title <span className="tw:text-red-500">*</span>
          </label>
          <input
            type="text" value={title} maxLength={200} required
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Intro Webinar"
            className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400 focus:tw:ring-2 focus:tw:ring-blue-100"
          />
        </div>

        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Description</label>
          <textarea
            value={description} rows={3} maxLength={2000}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional session overview…"
            className="tw:w-full tw:resize-y tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400 focus:tw:ring-2 focus:tw:ring-blue-100"
          />
        </div>

        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">
            Instructor <span className="tw:text-red-500">*</span>
          </label>
          {loadingOptions ? (
            <div className="tw:h-9 tw:w-full tw:animate-pulse tw:rounded-lg tw:bg-slate-100" />
          ) : (
            <select
              value={instructorId} required aria-label="Instructor"
              onChange={(e) => setInstructorId(e.target.value)}
              className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
            >
              <option value="">— Select instructor —</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>{i.fullName} ({i.email})</option>
              ))}
            </select>
          )}
        </div>

        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Link to course (optional)</label>
          {loadingOptions ? (
            <div className="tw:h-9 tw:w-full tw:animate-pulse tw:rounded-lg tw:bg-slate-100" />
          ) : (
            <select
              value={courseId} aria-label="Link to course"
              onChange={(e) => setCourseId(e.target.value)}
              className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
            >
              <option value="">— No course —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title} ({c.status})</option>
              ))}
            </select>
          )}
        </div>

        <div className="tw:grid tw:grid-cols-2 tw:gap-4">
          <div className="tw:flex tw:flex-col tw:gap-1.5">
            <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">
              Start time <span className="tw:text-red-500">*</span>
            </label>
            <input
              type="datetime-local" value={startTime} required
              onChange={(e) => setStartTime(e.target.value)}
              className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
            />
          </div>
          <div className="tw:flex tw:flex-col tw:gap-1.5">
            <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Timezone</label>
            <select
              value={timezone} aria-label="Timezone"
              onChange={(e) => setTimezone(e.target.value)}
              className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
            >
              {timezones.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>

        <div className="tw:grid tw:grid-cols-2 tw:gap-4">
          <div className="tw:flex tw:flex-col tw:gap-1.5">
            <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Duration (minutes)</label>
            <input
              type="number" min={5} max={1440} value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
            />
          </div>
          <div className="tw:flex tw:flex-col tw:gap-1.5">
            <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Max participants (optional)</label>
            <input
              type="number" min={1} max={10000} value={maxParticipants}
              placeholder="No cap"
              onChange={(e) => setMaxParticipants(e.target.value)}
              className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
            />
          </div>
        </div>

        <div className="tw:flex tw:items-center tw:justify-end tw:gap-2 tw:border-t tw:border-slate-100 tw:pt-4">
          <button type="button" onClick={onBack} disabled={saving}
            className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50 tw:disabled:opacity-40">
            Cancel
          </button>
          <button type="submit" disabled={saving || !title.trim() || !instructorId}
            className="tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700 tw:disabled:opacity-40">
            {saving ? 'Saving…' : mode === 'create' ? 'Schedule Session' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── List row ──────────────────────────────────────────────────────────────────

interface SessionRowProps {
  session:  LiveSession;
  onEdit:   () => void;
  onCancel: () => void;
}

function SessionRow({ session, onEdit, onCancel }: SessionRowProps) {
  const start = new Date(session.startTime).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  return (
    <tr className="tw:border-b tw:border-slate-50 tw:last:border-0 tw:hover:bg-slate-50">
      <td className="tw:px-4 tw:py-3">
        <div className="tw:flex tw:items-center tw:gap-2">
          <Radio className="tw:h-3.5 tw:w-3.5 tw:shrink-0 tw:text-red-500" strokeWidth={2} />
          <div>
            <p className="tw:m-0 tw:text-[13px] tw:font-semibold tw:text-slate-900">{session.title}</p>
            {session.description && (
              <p className="tw:m-0 tw:mt-0.5 tw:max-w-xs tw:truncate tw:text-[12px] tw:text-slate-400">{session.description}</p>
            )}
          </div>
        </div>
      </td>
      <td className="tw:px-4 tw:py-3 tw:text-[13px] tw:text-slate-700">
        {session.courseTitle ?? <span className="tw:text-slate-400">Standalone</span>}
      </td>
      <td className="tw:px-4 tw:py-3 tw:text-[13px] tw:text-slate-700">{session.instructorName ?? '—'}</td>
      <td className="tw:px-4 tw:py-3 tw:text-[13px] tw:text-slate-700">
        {start} <span className="tw:text-slate-400">({session.timezone})</span>
      </td>
      <td className="tw:px-4 tw:py-3 tw:text-[13px] tw:text-slate-700">{session.durationMin} min</td>
      <td className="tw:px-4 tw:py-3"><StatusBadge status={session.status} /></td>
      <td className="tw:px-4 tw:py-3">
        <div className="tw:flex tw:items-center tw:justify-end tw:gap-1.5">
          {session.joinUrl && (
            <button type="button"
              onClick={() => window.open(session.joinUrl!, '_blank', 'noopener,noreferrer')}
              className="tw:flex tw:items-center tw:gap-1 tw:rounded tw:border tw:border-slate-200 tw:px-2 tw:py-1 tw:text-[11px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50">
              <ExternalLink className="tw:h-3 tw:w-3" strokeWidth={2} /> Join
            </button>
          )}
          {session.startUrl && (
            <button type="button"
              onClick={() => window.open(session.startUrl!, '_blank', 'noopener,noreferrer')}
              title="Host-only link — never share with learners"
              className="tw:flex tw:items-center tw:gap-1 tw:rounded tw:border tw:border-violet-200 tw:bg-violet-50 tw:px-2 tw:py-1 tw:text-[11px] tw:font-medium tw:text-violet-700 tw:hover:bg-violet-100">
              <ShieldAlert className="tw:h-3 tw:w-3" strokeWidth={2} /> Start (host)
            </button>
          )}
          <button type="button" onClick={onEdit} aria-label={`Edit ${session.title}`}
            className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-slate-100 tw:hover:text-blue-600">
            <Pencil className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
          </button>
          <button type="button" onClick={onCancel} aria-label={`Cancel ${session.title}`}
            className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-red-50 tw:hover:text-red-500">
            <Trash2 className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'upcoming' | 'live' | 'ended';
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'upcoming', label: 'Upcoming' },
  { key: 'live', label: 'Live' }, { key: 'ended', label: 'Ended' },
];

// ── Main component ────────────────────────────────────────────────────────────

type View = { kind: 'list' } | { kind: 'create' } | { kind: 'edit'; session: LiveSession };

export default function LiveSessionsTab() {
  const navigate = useNavigate();

  const [view, setView]           = useState<View>({ kind: 'list' });
  const [sessions, setSessions]   = useState<LiveSession[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [toast, setToast]         = useState<Toast | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listLiveSessions(statusFilter === 'all' ? {} : { status: statusFilter });
      setSessions(rows);
    } catch (err) {
      if (err instanceof LiveSessionApiError && err.status === 401) { navigate('/login'); return; }
      setError(err instanceof Error ? err.message : 'Failed to load live sessions.');
    } finally {
      setLoading(false);
    }
  }, [navigate, statusFilter]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  async function handleCreate(values: FormValues) {
    const created = await createLiveSession({
      title: values.title,
      instructorId: values.instructorId,
      startTime: new Date(values.startTime).toISOString(),
      durationMin: values.durationMin,
      timezone: values.timezone,
      courseId: values.courseId || null,
      description: values.description.trim() || undefined,
      maxParticipants: values.maxParticipants !== '' ? Number(values.maxParticipants) : undefined,
    });
    invalidateFor(appQueryClient, 'liveSession.create');
    setSessions((prev) => [created, ...prev]);
    setView({ kind: 'list' });
    showToast('success', 'Live session scheduled.');
  }

  async function handleEdit(session: LiveSession, values: FormValues) {
    const patch: Record<string, unknown> = {};
    if (values.title !== session.title) patch.title = values.title;
    const nextDesc = values.description.trim() || null;
    if (nextDesc !== session.description) patch.description = nextDesc;
    const nextCourseId = values.courseId || null;
    if (nextCourseId !== session.courseId) patch.courseId = nextCourseId;
    if (values.instructorId !== session.instructorId) patch.instructorId = values.instructorId;
    const nextStartIso = new Date(values.startTime).toISOString();
    if (nextStartIso !== session.startTime) patch.startTime = nextStartIso;
    if (values.durationMin !== session.durationMin) patch.durationMin = values.durationMin;
    if (values.timezone !== session.timezone) patch.timezone = values.timezone;
    const nextMax = values.maxParticipants !== '' ? Number(values.maxParticipants) : null;
    if (nextMax !== session.maxParticipants) patch.maxParticipants = nextMax;

    if (Object.keys(patch).length === 0) {
      // Nothing changed — empty patch is a backend 400, so just go back.
      setView({ kind: 'list' });
      return;
    }

    const updated = await updateLiveSession(session.id, patch);
    invalidateFor(appQueryClient, 'liveSession.update');
    setSessions((prev) => prev.map((s) => (s.id === session.id ? updated : s)));
    setView({ kind: 'list' });
    showToast('success', 'Live session updated.');
  }

  async function handleCancel(session: LiveSession) {
    if (!window.confirm(
      `Cancel "${session.title}"?\n\nThis will cancel the session and delete the Zoom meeting. This cannot be undone.`
    )) return;
    try {
      await deleteLiveSession(session.id);
      invalidateFor(appQueryClient, 'liveSession.delete');
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      showToast('success', 'Live session canceled.');
    } catch (err) {
      if (err instanceof LiveSessionApiError && err.status === 401) { navigate('/login'); return; }
      showToast('error', err instanceof Error ? err.message : 'Cancel failed.');
    }
  }

  if (view.kind === 'create') {
    return (
      <>
        <SessionForm
          mode="create"
          initial={{
            title: '', description: '', courseId: '', instructorId: '',
            startTime: '', durationMin: 60, timezone: 'UTC', maxParticipants: '',
          }}
          onSave={handleCreate}
          onBack={() => setView({ kind: 'list' })}
        />
        {toast && <ToastBanner {...toast} />}
      </>
    );
  }

  if (view.kind === 'edit') {
    const session = view.session;
    return (
      <>
        <SessionForm
          mode="edit"
          initial={{
            title: session.title, description: session.description ?? '',
            courseId: session.courseId ?? '', instructorId: session.instructorId ?? '',
            startTime: toLocalInputValue(session.startTime), durationMin: session.durationMin,
            timezone: session.timezone, maxParticipants: session.maxParticipants != null ? String(session.maxParticipants) : '',
          }}
          onSave={(values) => handleEdit(session, values)}
          onBack={() => setView({ kind: 'list' })}
        />
        {toast && <ToastBanner {...toast} />}
      </>
    );
  }

  // List view
  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <div className="tw:flex tw:items-center tw:justify-between">
        <h2 className="tw:m-0 tw:text-[17px] tw:font-semibold tw:text-slate-900">Live Sessions</h2>
        <button type="button" onClick={() => setView({ kind: 'create' })}
          className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700">
          <Plus className="tw:h-4 tw:w-4" strokeWidth={2.5} />
          Schedule Session
        </button>
      </div>

      <div className="tw:flex tw:gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button key={f.key} type="button" onClick={() => setStatusFilter(f.key)}
            className={
              'tw:rounded-full tw:px-3 tw:py-1 tw:text-[12px] tw:font-medium tw:transition-colors' +
              (statusFilter === f.key ? ' tw:bg-blue-600 tw:text-white' : ' tw:bg-slate-100 tw:text-slate-600 tw:hover:bg-slate-200')
            }>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="tw:flex tw:flex-col tw:gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="tw:h-16 tw:w-full tw:animate-pulse tw:rounded-xl tw:bg-slate-100" />)}
        </div>
      ) : error ? (
        <div className="tw:rounded-xl tw:border tw:border-red-100 tw:bg-red-50 tw:p-5 tw:text-center">
          <p className="tw:text-[13px] tw:text-red-500">{error}</p>
          <button type="button" onClick={loadSessions} className="tw:mt-2 tw:text-[13px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">
            Retry
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <div className="tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-3 tw:rounded-xl tw:border tw:border-dashed tw:border-slate-300 tw:bg-white tw:py-20">
          <p className="tw:m-0 tw:text-[14px] tw:text-slate-500">No live sessions yet.</p>
          <button type="button" onClick={() => setView({ kind: 'create' })}
            className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700">
            <Plus className="tw:h-4 tw:w-4" strokeWidth={2.5} /> Schedule Session
          </button>
        </div>
      ) : (
        <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:overflow-hidden">
          <table className="tw:w-full tw:border-collapse">
            <thead>
              <tr className="tw:border-b tw:border-slate-100 tw:bg-slate-50">
                <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Title</th>
                <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Course</th>
                <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Instructor</th>
                <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Start</th>
                <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Duration</th>
                <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Status</th>
                <th className="tw:px-4 tw:py-3" />
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <SessionRow key={s.id} session={s}
                  onEdit={() => setView({ kind: 'edit', session: s })}
                  onCancel={() => handleCancel(s)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && <ToastBanner {...toast} />}
    </div>
  );
}
