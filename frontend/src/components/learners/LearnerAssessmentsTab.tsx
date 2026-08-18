// Learner Assessments tab (side panel) — GET /learners/:id/assessments (Part 5).
// QuizAttempt is the admin-facing half of a runtime with no learner-facing
// half yet (no attempt-taking UI exists anywhere in this system) — every row
// here was seeded/inserted directly, not submitted by a learner through this
// app. Table + Reopen / Reset / Override Grade actions, per the task spec.

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, RotateCcw, Pencil } from 'lucide-react';
import { listLearnerAssessments, reopenAssessment, resetAssessment, gradeAssessment } from '../../services/learnersApi';
import { LearnerApiError } from '../../types/learners';
import type { LearnerAssessment } from '../../types/learners';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  learnerId: string;
  showToast: (type: 'success' | 'error', message: string) => void;
}

const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  IN_PROGRESS: { bg: '#dbeafe', fg: '#1d4ed8' },
  SUBMITTED:   { bg: '#fef9c3', fg: '#a16207' },
  GRADED:      { bg: '#dcfce7', fg: '#15803d' },
  REOPENED:    { bg: '#fff7ed', fg: '#ea580c' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const TH: React.CSSProperties = { padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left', whiteSpace: 'nowrap' };
const TD: React.CSSProperties = { padding: '8px 10px', fontSize: 12, color: '#374151', borderTop: '1px solid #f1f5f9', verticalAlign: 'middle' };
const ICON_BTN: React.CSSProperties = { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' };
const TA: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151', fontFamily: 'inherit', outline: 'none' };

export default function LearnerAssessmentsTab({ learnerId, showToast }: Props) {
  const [rows, setRows] = useState<LearnerAssessment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [gradeTarget, setGradeTarget] = useState<LearnerAssessment | null>(null);
  const [gradeScore, setGradeScore] = useState('');
  const [gradeFeedback, setGradeFeedback] = useState('');
  const [gradeErr, setGradeErr] = useState<string | null>(null);
  const [gradeBusy, setGradeBusy] = useState(false);

  const fetchList = useCallback(() => {
    setLoading(true);
    setListError(null);
    listLearnerAssessments(learnerId, { limit: 50 })
      .then(res => setRows(res.assessments))
      .catch(err => setListError(err instanceof LearnerApiError ? err.message : 'Failed to load assessments.'))
      .finally(() => setLoading(false));
  }, [learnerId]);

  useEffect(() => { fetchList(); }, [fetchList]);

  async function handleReopen(a: LearnerAssessment) {
    setBusyId(a.id);
    try {
      await reopenAssessment(learnerId, a.id);
      invalidateFor(appQueryClient, 'learner.assessmentReopen', { id: learnerId });
      showToast('success', `"${a.quizTitle ?? 'Assessment'}" reopened.`);
      fetchList();
    } catch (err) {
      showToast('error', err instanceof LearnerApiError ? err.message : 'Reopen failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReset(a: LearnerAssessment) {
    if (!window.confirm(`Reset "${a.quizTitle ?? 'this assessment'}"? Clears the score/feedback and starts a fresh attempt count.`)) return;
    setBusyId(a.id);
    try {
      await resetAssessment(learnerId, a.id);
      invalidateFor(appQueryClient, 'learner.assessmentReset', { id: learnerId });
      showToast('success', 'Assessment reset.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof LearnerApiError ? err.message : 'Reset failed.');
    } finally {
      setBusyId(null);
    }
  }

  function openGrade(a: LearnerAssessment) {
    setGradeTarget(a);
    setGradeScore(a.score !== null ? String(a.score) : '');
    setGradeFeedback(a.feedback ?? '');
    setGradeErr(null);
  }

  async function submitGrade() {
    if (!gradeTarget) return;
    const n = Number(gradeScore);
    if (!Number.isInteger(n) || n < 0 || n > 100) { setGradeErr('Score must be an integer 0-100.'); return; }
    setGradeBusy(true);
    try {
      await gradeAssessment(learnerId, gradeTarget.id, { score: n, feedback: gradeFeedback.trim() || undefined });
      invalidateFor(appQueryClient, 'learner.assessmentGrade', { id: learnerId });
      // Real refresh bridge (invalidateFor above is a no-op — no TanStack
      // Query consumer exists anywhere in this app) — a failing grade fires
      // the QUIZ_FAILURE automation trigger, which nothing else here signals.
      window.dispatchEvent(new CustomEvent('analyticsUpdated'));
      showToast('success', 'Grade saved.');
      setGradeTarget(null);
      fetchList();
    } catch (err) {
      showToast('error', err instanceof LearnerApiError ? err.message : 'Grading failed.');
    } finally {
      setGradeBusy(false);
    }
  }

  return (
    <div style={{ padding: '16px 20px' }}>
      {listError && (
        <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#b91c1c', marginBottom: 10 }}>
          {listError}
        </div>
      )}

      {loading && <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>Loading…</div>}

      {!loading && !listError && rows && rows.length === 0 && (
        <div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, background: '#f8fafc', padding: '32px 16px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          No assessment attempts on file.
        </div>
      )}

      {!loading && rows && rows.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={TH}>Quiz</th>
                  <th style={TH}>Course</th>
                  <th style={TH}>Score</th>
                  <th style={TH}>Status</th>
                  <th style={TH}>Date</th>
                  <th style={TH}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(a => {
                  const busy = busyId === a.id;
                  const badge = STATUS_BADGE[a.status] ?? STATUS_BADGE.IN_PROGRESS;
                  return (
                    <tr key={a.id} style={busy ? { opacity: 0.5 } : undefined}>
                      <td style={{ ...TD, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.quizTitle ?? undefined}>{a.quizTitle ?? 'Untitled quiz'}</td>
                      <td style={{ ...TD, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.courseTitle ?? undefined}>{a.courseTitle ?? '—'}</td>
                      <td style={TD}>
                        {a.score !== null ? `${a.score}${a.passingGrade !== null ? ` / ${a.passingGrade} to pass` : ''}` : '—'}
                      </td>
                      <td style={TD}>
                        <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.fg }}>
                          {a.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td style={TD}>{formatDate(a.submittedAt ?? a.startedAt)}</td>
                      <td style={TD}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button type="button" title="Reopen" aria-label={`Reopen ${a.quizTitle ?? 'assessment'}`} disabled={busy} onClick={() => handleReopen(a)} style={ICON_BTN}>
                            <RefreshCw size={12} color="#ea580c" strokeWidth={2} />
                          </button>
                          <button type="button" title="Reset" aria-label={`Reset ${a.quizTitle ?? 'assessment'}`} disabled={busy} onClick={() => handleReset(a)} style={ICON_BTN}>
                            <RotateCcw size={12} color="#64748b" strokeWidth={2} />
                          </button>
                          <button type="button" title="Override Grade" aria-label={`Override grade for ${a.quizTitle ?? 'assessment'}`} disabled={busy} onClick={() => openGrade(a)} style={ICON_BTN}>
                            <Pencil size={12} color="#2563eb" strokeWidth={2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {gradeTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!gradeBusy ? () => setGradeTarget(null) : undefined} />
          <div role="dialog" aria-label="Override Grade" style={{ position: 'relative', width: '100%', maxWidth: 360, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Override Grade</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>{gradeTarget.quizTitle ?? 'Assessment'}</p>
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Score (0-100) <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="number" min={0} max={100} aria-label="Score" value={gradeScore} onChange={e => { setGradeScore(e.target.value); setGradeErr(null); }} style={TA} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Feedback <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                <textarea aria-label="Feedback" rows={3} value={gradeFeedback} onChange={e => setGradeFeedback(e.target.value)} style={{ ...TA, resize: 'vertical' }} />
              </div>
              {gradeErr && <div style={{ fontSize: 11, color: '#dc2626' }}>{gradeErr}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #f1f5f9' }}>
              <button type="button" onClick={() => setGradeTarget(null)} disabled={gradeBusy} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
                Cancel
              </button>
              <button type="button" onClick={submitGrade} disabled={gradeBusy} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, background: gradeBusy ? '#9ca3af' : '#2563eb', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#fff' }}>
                {gradeBusy ? 'Saving…' : 'Save Grade'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
