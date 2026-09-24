import { useEffect, useState } from 'react';
import InstructorLayout from './InstructorLayout';
import { INPUT, BTN_SECONDARY, ERROR_BANNER, TH, TD, statusBadgeStyle } from './instructorUiKit';
import {
  listMyStudents, getMyStudent, getMyStudentAssessments, getMyStudentAttendance,
  getMyStudentCertificates, getMyStudentActivity,
  InstructorStudentsApiError,
} from '../../api/instructorStudentsApi';
import type {
  StudentEnrollmentRow, MyCourseOption, StudentDetail, StudentAssessment,
  StudentAttendanceRecord, AttendanceSummary, EnrollmentStatus,
  StudentCertificate, StudentActivityEvent,
} from '../../types/instructorStudents';

// Mirrors InstructorCoursesPage.tsx's shell (mn-db-welcome header, mn-db-card
// table, instructorUiKit constants) — read-only per the task spec: no
// row actions exist here (no edit/suspend/unenroll/reset-progress). Blueprint
// 2.5 documents those as instructor actions for a later phase; this page is
// the GET-only view the backend (instructorStudents.service.js) currently
// supports.

const STATUS_OPTIONS: { value: EnrollmentStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'OVERDUE', label: 'Overdue' },
];

const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  NOT_STARTED: 'Not Started', IN_PROGRESS: 'In Progress', COMPLETED: 'Completed', OVERDUE: 'Overdue',
};
// Reuses statusBadgeStyle's existing color palette (Draft/Pending/Published/
// Rejected) for the closest semantic match — no new CSS needed.
const STATUS_BADGE_KEY: Record<EnrollmentStatus, string> = {
  NOT_STARTED: 'Draft', IN_PROGRESS: 'Pending', COMPLETED: 'Published', OVERDUE: 'Rejected',
};

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 80, height: 6, borderRadius: 3, background: '#e5e7eb', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: '#2563eb' }} />
      </div>
      <span style={{ fontSize: 11, color: '#64748b' }}>{pct}%</span>
    </div>
  );
}

export default function InstructorStudentsPage() {
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('');
  const [status, setStatus] = useState<EnrollmentStatus | ''>('');
  const [students, setStudents] = useState<StudentEnrollmentRow[]>([]);
  const [courses, setCourses] = useState<MyCourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelStudentId, setPanelStudentId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    listMyStudents({ search: search || undefined, courseId: courseId || undefined, status: status || undefined })
      .then((res) => { setStudents(res.students); setCourses(res.courses); setError(null); })
      .catch((err: unknown) => setError(err instanceof InstructorStudentsApiError ? err.message : 'Failed to load students.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, search ? 350 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, courseId, status]);

  return (
    <InstructorLayout>
      <div className="mn-db-welcome">
        <div>
          <h1 className="mn-db-welcome-title">My Students</h1>
          <p className="mn-db-welcome-sub">Learners enrolled in your courses</p>
        </div>
      </div>

      {error && <div style={{ ...ERROR_BANNER, marginBottom: 14 }}>{error}</div>}

      <div className="mn-db-card">
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            style={{ ...INPUT, maxWidth: 260 }}
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select aria-label="Filter by course" style={{ ...INPUT, maxWidth: 220 }} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">All my courses</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <select aria-label="Filter by status" style={{ ...INPUT, maxWidth: 180 }} value={status} onChange={(e) => setStatus(e.target.value as EnrollmentStatus | '')}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="mn-spinner" /></div>
        ) : students.length === 0 ? (
          <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>
            No students match these filters yet.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={TH}>Student</th>
                <th style={TH}>Email</th>
                <th style={TH}>Course</th>
                <th style={TH}>Progress</th>
                <th style={TH}>Status</th>
                <th style={TH}>Enrolled Date</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr
                  key={s.enrollmentId}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setPanelStudentId(s.studentId)}
                >
                  <td style={TD}>{s.studentName ?? '—'}</td>
                  <td style={TD}>{s.studentEmail ?? '—'}</td>
                  <td style={TD}>{s.courseTitle ?? '—'}</td>
                  <td style={TD}><ProgressBar value={s.progress} /></td>
                  <td style={TD}><span style={statusBadgeStyle(STATUS_BADGE_KEY[s.status])}>{STATUS_LABEL[s.status]}</span></td>
                  <td style={TD}>{s.enrolledAt ? new Date(s.enrolledAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {panelStudentId && <StudentPanel studentId={panelStudentId} onClose={() => setPanelStudentId(null)} />}
    </InstructorLayout>
  );
}

// ── Side panel — Student in My Course(s) ────────────────────────────────────────

type PanelTab = 'courses' | 'assessments' | 'attendance' | 'certificates' | 'activity';

const CERT_STATUS_COLOR: Record<string, string> = { active: '#15803d', revoked: '#b91c1c', expired: '#94a3b8' };

function StudentPanel({ studentId, onClose }: { studentId: string; onClose: () => void }) {
  const [tab, setTab] = useState<PanelTab>('courses');
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [assessments, setAssessments] = useState<StudentAssessment[] | null>(null);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [assessmentsError, setAssessmentsError] = useState<string | null>(null);

  const [attendance, setAttendance] = useState<StudentAttendanceRecord[] | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  const [certificates, setCertificates] = useState<StudentCertificate[] | null>(null);
  const [certificatesLoading, setCertificatesLoading] = useState(false);
  const [certificatesError, setCertificatesError] = useState<string | null>(null);

  const [activity, setActivity] = useState<StudentActivityEvent[] | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getMyStudent(studentId)
      .then((d) => { setDetail(d); setError(null); })
      .catch((err: unknown) => setError(err instanceof InstructorStudentsApiError ? err.message : 'Failed to load student.'))
      .finally(() => setLoading(false));
  }, [studentId]);

  useEffect(() => {
    if (tab === 'assessments' && assessments === null && !assessmentsLoading) {
      setAssessmentsLoading(true);
      getMyStudentAssessments(studentId)
        .then((res) => { setAssessments(res.assessments); setAssessmentsError(null); })
        .catch((err: unknown) => setAssessmentsError(err instanceof InstructorStudentsApiError ? err.message : 'Failed to load assessments.'))
        .finally(() => setAssessmentsLoading(false));
    }
    if (tab === 'attendance' && attendance === null && !attendanceLoading) {
      setAttendanceLoading(true);
      getMyStudentAttendance(studentId)
        .then((res) => { setAttendance(res.records); setAttendanceSummary(res.summary); setAttendanceError(null); })
        .catch((err: unknown) => setAttendanceError(err instanceof InstructorStudentsApiError ? err.message : 'Failed to load attendance.'))
        .finally(() => setAttendanceLoading(false));
    }
    if (tab === 'certificates' && certificates === null && !certificatesLoading) {
      setCertificatesLoading(true);
      getMyStudentCertificates(studentId)
        .then((res) => { setCertificates(res.certificates); setCertificatesError(null); })
        .catch((err: unknown) => setCertificatesError(err instanceof InstructorStudentsApiError ? err.message : 'Failed to load certificates.'))
        .finally(() => setCertificatesLoading(false));
    }
    if (tab === 'activity' && activity === null && !activityLoading) {
      setActivityLoading(true);
      getMyStudentActivity(studentId)
        .then((res) => { setActivity(res.events); setActivityError(null); })
        .catch((err: unknown) => setActivityError(err instanceof InstructorStudentsApiError ? err.message : 'Failed to load activity.'))
        .finally(() => setActivityLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, studentId]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div
        role="dialog" aria-label="Student in My Course"
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: 460,
          background: '#fff', boxShadow: '-20px 0 60px rgba(0,0,0,0.22)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Student in My Course</h3>
          <button type="button" style={BTN_SECONDARY} onClick={onClose}>Close</button>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><div className="mn-spinner" /></div>
        ) : error ? (
          <div style={{ padding: 18 }}><div style={ERROR_BANNER}>{error}</div></div>
        ) : detail ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{detail.fullName}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>{detail.email}</div>
            </div>

            <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb' }}>
              {(['courses', 'assessments', 'activity', 'certificates', 'attendance'] as PanelTab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  style={{
                    padding: '7px 12px', border: 'none', background: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, fontFamily: 'inherit', textTransform: 'capitalize',
                    color: tab === t ? '#2563eb' : '#64748b',
                    borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === 'courses' && (
              detail.courses.length === 0 ? (
                <p style={{ fontSize: 12, color: '#94a3b8' }}>Not enrolled in any of your courses.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {detail.courses.map((c) => (
                    <div key={c.enrollmentId} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{c.courseTitle ?? '—'}</span>
                        <span style={statusBadgeStyle(STATUS_BADGE_KEY[c.status])}>{STATUS_LABEL[c.status]}</span>
                      </div>
                      <ProgressBar value={c.progress} />
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 6 }}>
                        Enrolled {c.enrolledAt ? new Date(c.enrolledAt).toLocaleDateString() : '—'}
                        {c.completedAt ? ` · Completed ${new Date(c.completedAt).toLocaleDateString()}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === 'assessments' && (
              assessmentsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="mn-spinner" /></div>
              ) : assessmentsError ? (
                <div style={ERROR_BANNER}>{assessmentsError}</div>
              ) : !assessments || assessments.length === 0 ? (
                <p style={{ fontSize: 12, color: '#94a3b8' }}>No quiz attempts on your courses yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {assessments.map((a) => (
                    <div key={a.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{a.quizTitle ?? 'Untitled quiz'}</span>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>{a.courseTitle ?? '—'}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        {a.status}{a.score != null ? ` · Score ${a.score}${a.passingGrade != null ? ` (pass ${a.passingGrade})` : ''}` : ' · Not graded yet'}
                        {' · Attempt #'}{a.attemptNo}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === 'certificates' && (
              certificatesLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="mn-spinner" /></div>
              ) : certificatesError ? (
                <div style={ERROR_BANNER}>{certificatesError}</div>
              ) : !certificates || certificates.length === 0 ? (
                <p style={{ fontSize: 12, color: '#94a3b8' }}>No certificates issued for your courses yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {certificates.map((c) => (
                    <div key={c.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{c.courseTitle ?? '—'}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: CERT_STATUS_COLOR[c.status] ?? '#64748b' }}>{c.status.toUpperCase()}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                        Issued {c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : '—'}
                        {c.expiresAt ? ` · Expires ${new Date(c.expiresAt).toLocaleDateString()}` : ''}
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, fontFamily: 'monospace' }}>{c.verificationCode}</div>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === 'activity' && (
              activityLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="mn-spinner" /></div>
              ) : activityError ? (
                <div style={ERROR_BANNER}>{activityError}</div>
              ) : !activity || activity.length === 0 ? (
                <p style={{ fontSize: 12, color: '#94a3b8' }}>No activity on your courses/sessions yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activity.map((e) => (
                    <div key={e.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: e.type === 'quiz_attempt' ? '#7c3aed' : '#16a34a', marginTop: 5, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12.5, color: '#374151' }}>{e.title}</div>
                        <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{new Date(e.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {tab === 'attendance' && (
              attendanceLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="mn-spinner" /></div>
              ) : attendanceError ? (
                <div style={ERROR_BANNER}>{attendanceError}</div>
              ) : !attendance || attendance.length === 0 ? (
                <p style={{ fontSize: 12, color: '#94a3b8' }}>No attendance records for your sessions yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {attendanceSummary && (
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#64748b' }}>
                      <span>Present: {attendanceSummary.present}</span>
                      <span>Late: {attendanceSummary.late}</span>
                      <span>Absent: {attendanceSummary.absent}</span>
                      <span>Excused: {attendanceSummary.excused}</span>
                    </div>
                  )}
                  {attendance.map((r) => (
                    <div key={r.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{r.sessionTitle ?? 'Untitled session'}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: r.status === 'PRESENT' ? '#15803d' : r.status === 'LATE' ? '#a16207' : r.status === 'EXCUSED' ? '#1d4ed8' : '#b91c1c' }}>
                          {r.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                        {r.sessionStartTime ? new Date(r.sessionStartTime).toLocaleString() : '—'}
                        {r.durationMin != null ? ` · ${r.durationMin} min` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
