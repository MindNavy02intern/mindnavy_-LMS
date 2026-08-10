// Learner Courses tab (side panel) — GET /learners/:id/progress (Part 3).
// Progress bars per course + Reset Progress action, same green/yellow/red
// thresholds as LearnersTable's ProgressBar.

import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { getLearnerProgress, resetLearnerProgress, deleteLearnerEnrollment } from '../../services/learnersApi';
import { LearnerApiError } from '../../types/learners';
import type { LearnerProgressCourse } from '../../types/learners';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  learnerId: string;
  onChanged: () => void; // a progress reset changes coursesCount/avgProgress on the panel header
  showToast: (type: 'success' | 'error', message: string) => void;
}

const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  NOT_STARTED: { bg: '#f1f5f9', fg: '#475569' },
  IN_PROGRESS: { bg: '#dbeafe', fg: '#1d4ed8' },
  COMPLETED:   { bg: '#dcfce7', fg: '#15803d' },
  OVERDUE:     { bg: '#fee2e2', fg: '#b91c1c' },
};

function progressColor(pct: number): string {
  if (pct >= 80) return '#16a34a';
  if (pct >= 40) return '#ca8a04';
  return '#dc2626';
}

function ProgressBar({ value }: { value: number }) {
  const color = progressColor(value);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, minWidth: 30, textAlign: 'right' }}>{value}%</span>
    </div>
  );
}

export default function LearnerCoursesTab({ learnerId, onChanged, showToast }: Props) {
  const [courses, setCourses] = useState<LearnerProgressCourse[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchList = useCallback(() => {
    setLoading(true);
    setListError(null);
    getLearnerProgress(learnerId)
      .then(res => setCourses(res.courses))
      .catch(err => setListError(err instanceof LearnerApiError ? err.message : 'Failed to load courses.'))
      .finally(() => setLoading(false));
  }, [learnerId]);

  useEffect(() => { fetchList(); }, [fetchList]);

  async function handleReset(course: LearnerProgressCourse) {
    if (!window.confirm(`Reset progress for "${course.courseTitle ?? 'this course'}"? This sets it back to 0% / Not Started.`)) return;
    setBusyId(course.enrollmentId);
    try {
      await resetLearnerProgress(learnerId, course.courseId);
      invalidateFor(appQueryClient, 'learner.progressReset', { id: learnerId, courseId: course.courseId });
      showToast('success', 'Progress reset.');
      fetchList();
      onChanged();
    } catch (err) {
      showToast('error', err instanceof LearnerApiError ? err.message : 'Reset failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnenroll(course: LearnerProgressCourse) {
    if (!window.confirm(`Unenroll from "${course.courseTitle ?? 'this course'}"?\n\nThis cannot be undone.`)) return;
    setBusyId(course.enrollmentId);
    try {
      await deleteLearnerEnrollment(learnerId, course.enrollmentId);
      invalidateFor(appQueryClient, 'learner.unenroll', { id: learnerId, courseId: course.courseId });
      showToast('success', 'Learner unenrolled.');
      fetchList();
      onChanged();
    } catch (err) {
      showToast('error', err instanceof LearnerApiError ? err.message : 'Unenroll failed.');
    } finally {
      setBusyId(null);
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

      {!loading && !listError && courses && courses.length === 0 && (
        <div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, background: '#f8fafc', padding: '32px 16px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          Not enrolled in any courses yet.
        </div>
      )}

      {!loading && courses && courses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {courses.map(c => {
            const busy = busyId === c.enrollmentId;
            const badge = STATUS_BADGE[c.status] ?? STATUS_BADGE.NOT_STARTED;
            return (
              <div key={c.enrollmentId} style={{ border: '1px solid #f1f5f9', borderRadius: 8, padding: '10px 12px', opacity: busy ? 0.5 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.courseTitle ?? undefined}>
                    {c.courseTitle ?? 'Untitled course'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.fg }}>
                      {c.status.replace('_', ' ')}
                    </span>
                    <button
                      type="button" title="Reset Progress" aria-label={`Reset progress for ${c.courseTitle ?? 'course'}`}
                      disabled={busy || c.progress === 0}
                      onClick={() => handleReset(c)}
                      style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer', opacity: c.progress === 0 ? 0.4 : 1 }}
                    >
                      <RotateCcw size={12} color="#64748b" strokeWidth={2} />
                    </button>
                    <button
                      type="button" title="Unenroll" aria-label={`Unenroll from ${c.courseTitle ?? 'course'}`}
                      disabled={busy}
                      onClick={() => handleUnenroll(c)}
                      style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
                    >
                      <Trash2 size={12} color="#dc2626" strokeWidth={2} />
                    </button>
                  </div>
                </div>
                <ProgressBar value={c.progress} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
