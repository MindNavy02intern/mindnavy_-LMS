import { useEffect, useState } from 'react';
import InstructorLayout from './InstructorLayout';
import { LABEL, INPUT, BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, ERROR_BANNER, TH, TD, disabledStyle, statusBadgeStyle } from './instructorUiKit';
import {
  listMySessions, createMySession, updateMySession, deleteMySession, endMySession,
} from '../../api/instructorLiveSessionsApi';
import { listMyCourses } from '../../api/instructorCoursesApi';
import { InstructorApiError } from '../../types/instructors';
import type { LiveSession, LiveSessionStatus } from '../../types/liveSessions';
import type { CourseListRow } from '../../types/courses';

type TabKey = 'Upcoming' | 'Live' | 'Ended';
const TABS: { key: TabKey; label: string; status: LiveSessionStatus }[] = [
  { key: 'Upcoming', label: 'Upcoming', status: 'UPCOMING' },
  { key: 'Live', label: 'Live', status: 'LIVE' },
  { key: 'Ended', label: 'Ended', status: 'ENDED' },
];

export default function InstructorLiveSessionsPage() {
  const [tab, setTab] = useState<TabKey>('Upcoming');
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [myCourses, setMyCourses] = useState<CourseListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showForm, setShowForm] = useState<{ mode: 'create' } | { mode: 'edit'; session: LiveSession } | null>(null);
  const [attendanceFor, setAttendanceFor] = useState<LiveSession | null>(null);

  const load = () => {
    (() => setLoading(true))();
    const status = TABS.find((t) => t.key === tab)!.status.toLowerCase() as 'upcoming' | 'live' | 'ended';
    listMySessions({ status })
      .then((res) => { setSessions(res); setError(null); })
      .catch((err: unknown) => setError(err instanceof InstructorApiError ? err.message : 'Failed to load sessions.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [tab]);
  useEffect(() => {
    listMyCourses({ status: 'All', limit: 100 }).then((res) => setMyCourses(res.courses)).catch(err => console.error(err));
  }, []);

  const handleEnd = async (session: LiveSession) => {
    if (!confirm(`End "${session.title}" now?`)) return;
    setBusyId(session.id);
    try {
      await endMySession(session.id);
      load();
    } catch (err) {
      alert(err instanceof InstructorApiError ? err.message : 'Failed to end session.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (session: LiveSession) => {
    if (!confirm(`Cancel "${session.title}"? This deletes the Zoom meeting too.`)) return;
    setBusyId(session.id);
    try {
      await deleteMySession(session.id);
      load();
    } catch (err) {
      alert(err instanceof InstructorApiError ? err.message : 'Failed to cancel session.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <InstructorLayout>
      <div className="mn-db-welcome">
        <div>
          <h1 className="mn-db-welcome-title">My Live Sessions</h1>
          <p className="mn-db-welcome-sub">Schedule and host Zoom sessions for your courses</p>
        </div>
        <button type="button" style={BTN_PRIMARY} onClick={() => setShowForm({ mode: 'create' })}>+ Schedule Session</button>
      </div>

      {error && <div style={{ ...ERROR_BANNER, marginBottom: 14 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 4, marginBottom: 12, borderBottom: '1px solid #e2e8f0' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              padding: '7px 14px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
              color: tab === t.key ? '#2563eb' : '#64748b',
              borderBottom: tab === t.key ? '2px solid #2563eb' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mn-db-card">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="mn-spinner" /></div>
        ) : sessions.length === 0 ? (
          <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>No sessions in this tab yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={TH}>Title</th>
                <th style={TH}>Course</th>
                <th style={TH}>Start</th>
                <th style={TH}>Duration</th>
                <th style={TH}>Status</th>
                <th style={TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const busy = busyId === s.id;
                return (
                  <tr key={s.id} style={busy ? { opacity: 0.5 } : undefined}>
                    <td style={TD}>
                      {s.title}
                      {s.description && <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{s.description.length > 60 ? `${s.description.slice(0, 60)}…` : s.description}</div>}
                    </td>
                    <td style={TD}>{s.courseTitle ?? '—'}</td>
                    <td style={TD}>{new Date(s.startTime).toLocaleString()} <span style={{ color: '#94a3b8' }}>({s.timezone})</span></td>
                    <td style={TD}>{s.durationMin} min</td>
                    <td style={TD}><span style={statusBadgeStyle(s.status)}>{s.status}</span></td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {s.joinUrl && s.status !== 'ENDED' && (
                          <a href={s.joinUrl} target="_blank" rel="noreferrer" style={{ ...BTN_SECONDARY, textDecoration: 'none', display: 'inline-block' }}>Join</a>
                        )}
                        {s.startUrl && s.status !== 'ENDED' && (
                          <a href={s.startUrl} target="_blank" rel="noreferrer" style={{ ...BTN_PRIMARY, textDecoration: 'none', display: 'inline-block' }}>Start (Host)</a>
                        )}
                        {s.status === 'LIVE' && (
                          <button type="button" disabled={busy} style={disabledStyle(BTN_DANGER, busy)} onClick={() => handleEnd(s)}>End Session</button>
                        )}
                        {(s.status === 'LIVE' || s.status === 'ENDED') && (
                          <button type="button" style={BTN_SECONDARY} onClick={() => setAttendanceFor(s)}>Attendance</button>
                        )}
                        {s.status === 'UPCOMING' && (
                          <button type="button" style={BTN_SECONDARY} onClick={() => setShowForm({ mode: 'edit', session: s })}>Edit</button>
                        )}
                        {s.status !== 'ENDED' && (
                          <button type="button" disabled={busy} style={disabledStyle(BTN_DANGER, busy)} onClick={() => handleCancel(s)}>Cancel</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <SessionFormModal
          mode={showForm.mode}
          session={showForm.mode === 'edit' ? showForm.session : null}
          myCourses={myCourses}
          onClose={() => setShowForm(null)}
          onSaved={() => { setShowForm(null); load(); }}
        />
      )}

      {attendanceFor && (
        <AttendanceGapModal session={attendanceFor} onClose={() => setAttendanceFor(null)} />
      )}
    </InstructorLayout>
  );
}

function SessionFormModal({ mode, session, myCourses, onClose, onSaved }: {
  mode: 'create' | 'edit'; session: LiveSession | null; myCourses: CourseListRow[];
  onClose: () => void; onSaved: () => void;
}) {
  const defaultTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [title, setTitle] = useState(session?.title ?? '');
  const [description, setDescription] = useState(session?.description ?? '');
  const [courseId, setCourseId] = useState(session?.courseId ?? '');
  const [startTime, setStartTime] = useState(session ? toLocalInputValue(session.startTime) : '');
  const [durationMin, setDurationMin] = useState(String(session?.durationMin ?? 60));
  const [timezone] = useState(session?.timezone ?? defaultTz);
  const [maxParticipants, setMaxParticipants] = useState(session?.maxParticipants ? String(session.maxParticipants) : '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async () => {
    if (!title.trim()) { setErr('Title is required.'); return; }
    if (!startTime) { setErr('Start time is required.'); return; }
    setSaving(true);
    setErr(null);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || undefined,
        courseId: courseId || null,
        startTime: new Date(startTime).toISOString(),
        durationMin: Number(durationMin) || 60,
        timezone,
        maxParticipants: maxParticipants ? Number(maxParticipants) : undefined,
      };
      if (mode === 'edit' && session) await updateMySession(session.id, body);
      else await createMySession(body);
      onSaved();
    } catch (e) {
      setErr(e instanceof InstructorApiError ? e.message : 'Save failed.');
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!saving ? onClose : undefined} />
      <div role="dialog" aria-label="Schedule Session" style={{ position: 'relative', width: '100%', maxWidth: 460, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>{mode === 'edit' ? 'Edit Session' : 'Schedule Session'}</h3>
        </div>
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {err && <div style={ERROR_BANNER}>{err}</div>}
          <div>
            <label style={LABEL}>Title *</label>
            <input style={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus />
          </div>
          <div>
            <label style={LABEL}>Description</label>
            <textarea style={{ ...INPUT, resize: 'vertical' }} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
          </div>
          <div>
            <label style={LABEL}>Course (optional — own courses only)</label>
            <select style={INPUT} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">No course link</option>
              {myCourses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL}>Start Time *</label>
              <input style={INPUT} type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <label style={LABEL}>Duration (min)</label>
              <input style={INPUT} type="number" min={5} max={1440} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={LABEL}>Max Participants (optional)</label>
            <input style={{ ...INPUT, maxWidth: 160 }} type="number" min={1} value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} />
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>Timezone: {timezone}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #f1f5f9' }}>
          <button type="button" style={BTN_SECONDARY} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" style={disabledStyle(BTN_PRIMARY, saving)} disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : mode === 'edit' ? 'Save Changes' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Mark Attendance's real roster ("enrolled learners of the session's course")
// has no instructor-scoped source yet — GET /instructor/students (blueprint
// Section 2.5, "My Students") doesn't exist until a later phase, and no
// other instructor-facing endpoint returns a course's enrolled-learner list.
// The backend write endpoint (PATCH /live-sessions/:id/attendance) IS fully
// built and verified (see Part 2) — only the roster READ this modal would
// need to render checkboxes is missing. Showing an honest gap state here
// rather than a fabricated or broken roster, consistent with this project's
// established "available:false, real reason" convention.
function AttendanceGapModal({ session, onClose }: { session: LiveSession; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div role="dialog" aria-label="Attendance" style={{ position: 'relative', width: '100%', maxWidth: 420, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Attendance — {session.title}</h3>
        </div>
        <div style={{ padding: '14px 18px' }}>
          <div style={ERROR_BANNER}>
            The student roster for this session isn't available in the Instructor Dashboard yet — that ships with
            the My Students page. The attendance-recording endpoint itself is already live; this screen will fill
            in once the roster source exists.
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 18px', borderTop: '1px solid #f1f5f9' }}>
          <button type="button" style={BTN_SECONDARY} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
