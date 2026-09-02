// Read-only "View" detail (eye icon) — Instructor Dashboard Course View.
// Matches admin depth per the Part 1 audit, and goes further where the
// audit found gaps even on the admin side (quiz question list, completion
// rate, recent enrollments, per-course reviews, enrollment trend) — see
// IMPACT_MAP.md / the audit report for what admin does and doesn't show.
// Deliberately separate from "Edit" (InstructorCourseBuilderPage) — this
// component makes zero mutating calls.
import { useEffect, useState } from 'react';
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_BANNER, TH, TD, statusBadgeStyle } from './instructorUiKit';
import { getMyCourseDetail, type CourseDetailView } from '../../api/instructorCoursesApi';
import { CourseApiError } from '../../types/courses';
import type { Lesson } from '../../types/courseBuilder';
import type { Question } from '../../types/quizzes';

const CARD: React.CSSProperties = { border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 14 };
const CARD_TITLE: React.CSSProperties = { margin: '0 0 10px', fontSize: 13, fontWeight: 700, color: '#0f172a' };

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#16a34a' : pct >= 40 ? '#ca8a04' : '#dc2626';
  return (
    <div style={{ width: 80, height: 6, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', background: color }} />
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ flex: 1, padding: '10px 14px', background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function LessonRow({ lesson }: { lesson: Lesson }) {
  return (
    <div style={{ padding: '8px 10px', borderRadius: 6, background: '#fafafa', marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: lesson.type === 'VIDEO_URL' || lesson.content ? 6 : 0 }}>
        <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: lesson.type === 'VIDEO_URL' ? '#eef2ff' : '#f1f5f9', color: lesson.type === 'VIDEO_URL' ? '#4338ca' : '#475569' }}>
          {lesson.type === 'VIDEO_URL' ? 'VIDEO' : 'TEXT'}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>{lesson.title}</span>
        {lesson.durationMin != null && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>{lesson.durationMin} min</span>}
      </div>
      {lesson.type === 'VIDEO_URL' && lesson.content && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={lesson.content} controls style={{ width: '100%', maxHeight: 220, borderRadius: 6, background: '#000' }} />
      )}
      {lesson.type === 'TEXT' && lesson.content && (
        <div style={{ fontSize: 12, color: '#374151', whiteSpace: 'pre-wrap', maxHeight: 160, overflowY: 'auto', padding: 8, background: '#fff', borderRadius: 6, border: '1px solid #f1f5f9' }}>
          {lesson.content}
        </div>
      )}
    </div>
  );
}

function questionAnswerSummary(q: Question): string {
  switch (q.type) {
    case 'MULTIPLE_CHOICE': return `Correct: ${q.data.options[q.data.correctIndex] ?? '—'}`;
    case 'TRUE_FALSE': return `Correct: ${q.data.correct ? 'True' : 'False'}`;
    case 'MULTI_SELECT': return `Correct: ${q.data.correctIndexes.map((i) => q.data.options[i]).join(', ')}`;
    case 'FILL_IN_BLANK': return `Correct: ${q.data.correctAnswer}`;
    case 'MATCHING': return q.data.pairs.map((p) => `${p.left} → ${p.right}`).join('; ');
    case 'ESSAY': return 'Manually graded';
  }
}

function QuestionRow({ q, index }: { q: Question; index: number }) {
  return (
    <div style={{ padding: '8px 10px', borderRadius: 6, background: '#fafafa', marginBottom: 6, fontSize: 12.5 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ fontWeight: 700, color: '#94a3b8', minWidth: 18 }}>{index + 1}.</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#0f172a', fontWeight: 600 }}>{q.prompt}</div>
          <div style={{ color: '#64748b', marginTop: 3 }}>{questionAnswerSummary(q)}</div>
        </div>
        <span style={{ fontSize: 10.5, color: '#94a3b8', whiteSpace: 'nowrap' }}>{q.points} pt{q.points === 1 ? '' : 's'}</span>
      </div>
    </div>
  );
}

function EnrollmentTrendChart({ points }: { points: CourseDetailView['enrollmentTrend'] }) {
  const max = Math.max(1, ...points.map((p) => p.count));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
      {points.map((p) => (
        <div key={p.weekStart} title={`${new Date(p.weekStart).toLocaleDateString()}: ${p.count}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
          <div style={{ width: '100%', maxWidth: 14, height: `${(p.count / max) * 100}%`, minHeight: p.count > 0 ? 3 : 0, background: '#3b82f6', borderRadius: '2px 2px 0 0' }} />
        </div>
      ))}
    </div>
  );
}

interface Props {
  courseId: string;
  onClose: () => void;
  onEdit: (courseId: string) => void;
}

export default function InstructorCourseViewModal({ courseId, onClose, onEdit }: Props) {
  const [detail, setDetail] = useState<CourseDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMyCourseDetail(courseId)
      .then((d) => { if (!cancelled) { setDetail(d); setError(null); } })
      .catch((err: unknown) => { if (!cancelled) setError(err instanceof CourseApiError ? err.message : 'Failed to load course detail.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [courseId]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div role="dialog" aria-label="Course detail" style={{ position: 'relative', width: '100%', maxWidth: 720, maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>{detail?.course.title ?? 'Course'}</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            {detail && <button type="button" style={BTN_PRIMARY} onClick={() => onEdit(courseId)}>Edit</button>}
            <button type="button" style={BTN_SECONDARY} onClick={onClose}>Close</button>
          </div>
        </div>

        <div style={{ padding: '16px 18px', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><div className="mn-spinner" /></div>
          ) : error ? (
            <div style={ERROR_BANNER}>{error}</div>
          ) : detail && (
            <>
              {/* Overview */}
              <div style={CARD}>
                <div style={{ display: 'flex', gap: 14 }}>
                  {detail.course.thumbnail && (
                    <img src={detail.course.thumbnail} alt="" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      <span style={statusBadgeStyle(detail.course.isRejected ? 'Rejected' : detail.course.status)}>
                        {detail.course.isRejected ? 'REJECTED' : detail.course.status.toUpperCase()}
                      </span>
                      {detail.course.category && <span style={{ fontSize: 11, color: '#64748b' }}>{detail.course.category}</span>}
                      <span style={{ fontSize: 11, color: '#64748b' }}>· {detail.course.level}</span>
                      {detail.course.language && <span style={{ fontSize: 11, color: '#64748b' }}>· {detail.course.language}</span>}
                    </div>
                    {detail.course.subtitle && <div style={{ fontSize: 12.5, color: '#374151', fontWeight: 600, marginBottom: 4 }}>{detail.course.subtitle}</div>}
                    {detail.course.description && <div style={{ fontSize: 12, color: '#64748b' }}>{detail.course.description}</div>}
                  </div>
                </div>

                {(detail.course.status === 'Pending' || detail.course.isRejected) && (
                  <div style={{ marginTop: 12, padding: '8px 10px', borderRadius: 6, background: detail.course.isRejected ? '#fef2f2' : '#fffbeb', fontSize: 12 }}>
                    {detail.course.isRejected ? (
                      <>
                        <strong style={{ color: '#b91c1c' }}>Rejected</strong>
                        {detail.course.rejectionReason && <span style={{ color: '#991b1b' }}>: {detail.course.rejectionReason}</span>}
                      </>
                    ) : (
                      <strong style={{ color: '#92400e' }}>Pending admin review</strong>
                    )}
                    {detail.course.submittedAt && <div style={{ color: '#78716c', marginTop: 2 }}>Submitted {new Date(detail.course.submittedAt).toLocaleString()}</div>}
                    {detail.course.reviewedAt && <div style={{ color: '#78716c' }}>Reviewed {new Date(detail.course.reviewedAt).toLocaleString()}</div>}
                  </div>
                )}
              </div>

              {/* Enrollment stats */}
              <div style={CARD}>
                <h4 style={CARD_TITLE}>Enrollment</h4>
                <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                  <StatBox label="Total Students" value={detail.stats.totalStudents} />
                  <StatBox label="Completion Rate" value={`${detail.stats.completionRate}%`} />
                  <StatBox label="Avg Progress" value={`${detail.stats.avgProgress}%`} />
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 6 }}>ENROLLMENTS — LAST 12 WEEKS</div>
                <EnrollmentTrendChart points={detail.enrollmentTrend} />
              </div>

              {/* Recent enrollments */}
              <div style={CARD}>
                <h4 style={CARD_TITLE}>Recent Enrollments</h4>
                {detail.recentEnrollments.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#94a3b8' }}>No enrollments yet.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr><th style={TH}>Student</th><th style={TH}>Enrolled</th><th style={TH}>Progress</th><th style={TH}>Status</th></tr>
                    </thead>
                    <tbody>
                      {detail.recentEnrollments.map((e) => (
                        <tr key={e.id}>
                          <td style={TD}>{e.studentName ?? '—'}<div style={{ fontSize: 10, color: '#94a3b8' }}>{e.studentEmail}</div></td>
                          <td style={TD}>{new Date(e.enrolledAt).toLocaleDateString()}</td>
                          <td style={TD}><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ProgressBar pct={e.progress} />{e.progress}%</div></td>
                          <td style={TD}>{e.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Sections + lessons */}
              <div style={CARD}>
                <h4 style={CARD_TITLE}>Content ({detail.sections.length} section{detail.sections.length === 1 ? '' : 's'})</h4>
                {detail.sections.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#94a3b8' }}>No sections yet.</p>
                ) : detail.sections.map((s) => (
                  <div key={s.id} style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{s.title}</div>
                    {s.lessons.map((l) => <LessonRow key={l.id} lesson={l} />)}
                  </div>
                ))}
              </div>

              {/* Quiz */}
              <div style={CARD}>
                <h4 style={CARD_TITLE}>Quiz{detail.quizzes.length === 1 ? '' : 'zes'} ({detail.quizzes.length})</h4>
                {detail.quizzes.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#94a3b8' }}>No quiz attached.</p>
                ) : detail.quizzes.map((q) => (
                  <div key={q.id} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a' }}>{q.title}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>Passing grade {q.passingGrade}% · {q.totalPoints} pts total · {q.questionCount} question{q.questionCount === 1 ? '' : 's'}</span>
                    </div>
                    {q.questions.map((qn, i) => <QuestionRow key={qn.id} q={qn} index={i} />)}
                  </div>
                ))}
              </div>

              {/* Settings */}
              <div style={CARD}>
                <h4 style={CARD_TITLE}>Settings</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                  <div><span style={{ color: '#94a3b8' }}>Visibility:</span> {detail.course.settings.visibility}</div>
                  <div><span style={{ color: '#94a3b8' }}>Pricing:</span> {detail.course.settings.isFree ? 'Free' : detail.course.settings.price != null ? `${(detail.course.settings.price / 100).toFixed(2)} ${detail.course.settings.currency ?? ''}` : '—'}</div>
                  <div><span style={{ color: '#94a3b8' }}>Certificate:</span> {detail.course.settings.certificateEnabled ? 'Enabled' : 'Disabled'}</div>
                  <div><span style={{ color: '#94a3b8' }}>Drip content:</span> {detail.course.settings.dripContentEnabled ? 'Enabled' : 'Disabled'}</div>
                  <div><span style={{ color: '#94a3b8' }}>Enrollment limit:</span> {detail.course.settings.enrollmentLimit ?? 'Unlimited'}</div>
                </div>
                {(detail.course.settings.seoTitle || detail.course.settings.seoDescription) && (
                  <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div style={{ color: '#94a3b8', fontWeight: 700, fontSize: 10.5, marginBottom: 3 }}>SEO</div>
                    {detail.course.settings.seoTitle && <div>{detail.course.settings.seoTitle}</div>}
                    {detail.course.settings.seoDescription && <div style={{ color: '#64748b' }}>{detail.course.settings.seoDescription}</div>}
                  </div>
                )}
              </div>

              {/* Reviews */}
              <div style={{ ...CARD, marginBottom: 0 }}>
                <h4 style={CARD_TITLE}>Reviews ({detail.reviews.length})</h4>
                {detail.reviews.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#94a3b8' }}>No approved reviews yet.</p>
                ) : detail.reviews.map((r) => (
                  <div key={r.id} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ color: '#f59e0b', fontSize: 12 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: '#0f172a' }}>{r.studentName ?? 'Anonymous'}</span>
                      <span style={{ fontSize: 10.5, color: '#94a3b8' }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    {r.comment && <div style={{ fontSize: 12, color: '#374151' }}>{r.comment}</div>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
