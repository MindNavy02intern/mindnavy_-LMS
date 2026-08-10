// Quick Actions "Enroll" / "Assign Path" — both call the SAME backend endpoint
// (POST /learners/:id/enrollments with courseId OR learningPathId), so one
// modal covers both, switching only which picker it shows. startDate/
// expiryDate/cohortId are real, accepted fields (Part 3) but have no UI here
// yet — scope kept to what Part 4 actually needs; the API still works if a
// future modal wants to send them.

import { useEffect, useState } from 'react';
import { listCourses } from '../../services/coursesApi';
import { listPaths } from '../../services/learningPathsApi';
import { createLearnerEnrollment } from '../../services/learnersApi';
import { LearnerApiError } from '../../types/learners';
import type { CourseListRow } from '../../types/courses';
import type { LearningPath } from '../../types/learningPaths';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  mode:      'course' | 'path';
  learnerId: string;
  fullName:  string;
  onClose:   () => void;
  onSuccess: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

const SELECT: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13,
  border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151',
  fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
};

export default function EnrollLearnerModal({ mode, learnerId, fullName, onClose, onSuccess, showToast }: Props) {
  const [courses, setCourses] = useState<CourseListRow[] | null>(null);
  const [paths, setPaths] = useState<LearningPath[] | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoadingOptions(true);
    setOptionsError(null);
    if (mode === 'course') {
      listCourses({ limit: 100, status: 'Published' })
        .then(res => setCourses(res.courses))
        .catch(e => setOptionsError(e instanceof Error ? e.message : 'Failed to load courses.'))
        .finally(() => setLoadingOptions(false));
    } else {
      listPaths()
        .then(setPaths)
        .catch(e => setOptionsError(e instanceof Error ? e.message : 'Failed to load learning paths.'))
        .finally(() => setLoadingOptions(false));
    }
  }, [mode]);

  async function handleSubmit() {
    if (!selectedId) { setErr(mode === 'course' ? 'Select a course.' : 'Select a learning path.'); return; }
    setErr('');
    setSubmitting(true);
    try {
      await createLearnerEnrollment(learnerId, mode === 'course' ? { courseId: selectedId } : { learningPathId: selectedId });
      invalidateFor(appQueryClient, 'learner.enroll', { id: learnerId, courseId: mode === 'course' ? selectedId : undefined });
      showToast('success', mode === 'course' ? `${fullName} enrolled.` : `${fullName} assigned to the learning path.`);
      onSuccess();
    } catch (e) {
      showToast('error', e instanceof LearnerApiError ? e.message : 'Enrollment failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!submitting ? onClose : undefined} />
      <div role="dialog" aria-label={mode === 'course' ? 'Enroll in Course' : 'Assign Learning Path'} style={{ position: 'relative', width: '100%', maxWidth: 380, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>
            {mode === 'course' ? 'Enroll in Course' : 'Assign Learning Path'}
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>For <strong>{fullName}</strong></p>
        </div>
        <div style={{ padding: '14px 18px' }}>
          {optionsError && <div style={{ fontSize: 12, color: '#b91c1c', marginBottom: 8 }}>{optionsError}</div>}
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            {mode === 'course' ? 'Course' : 'Learning Path'} <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <select
            aria-label={mode === 'course' ? 'Course' : 'Learning path'}
            value={selectedId}
            onChange={e => { setSelectedId(e.target.value); setErr(''); }}
            style={SELECT}
            disabled={loadingOptions}
          >
            <option value="">{loadingOptions ? 'Loading…' : `Select a ${mode === 'course' ? 'course' : 'learning path'}…`}</option>
            {mode === 'course'
              ? courses?.map(c => <option key={c.id} value={c.id}>{c.title}</option>)
              : paths?.map(p => <option key={p.id} value={p.id}>{p.title} ({p.itemCount} item{p.itemCount === 1 ? '' : 's'})</option>)}
          </select>
          {err && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{err}</div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #f1f5f9' }}>
          <button type="button" onClick={onClose} disabled={submitting} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting || loadingOptions} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, background: submitting ? '#9ca3af' : '#2563eb', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#fff' }}>
            {submitting ? 'Enrolling…' : mode === 'course' ? 'Enroll' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}
