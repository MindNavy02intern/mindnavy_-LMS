// Instructor Preview step — Course Wizard step 5. One GET /courses/:id/preview
// call -> read-only section/lesson tree, mirrors admin's CoursePreview.tsx
// (components/learningManagement/CoursePreview.tsx) with instructorUiKit
// inline styles. Backend returns { course, sections } where sections is the
// exact courseBuilderService.listSections() shape (lessons[].durationMin),
// verified against backend/src/services/courseWorkflow.service.js:getPreview
// — NOT the { duration, content } shape admin's own CoursePreviewData type
// declares (that type appears stale/unused there).
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMyCoursePreview } from '../../api/instructorCoursesApi';
import { CourseApiError, type CourseDetail } from '../../types/courses';
import type { CourseSection } from '../../types/courseBuilder';
import { BTN_PRIMARY, BTN_SECONDARY, ERROR_BANNER } from './instructorUiKit';

interface Props {
  courseId: string;
  onBack: () => void;
  onNext: () => void;
}

export default function InstructorPreviewStep({ courseId, onBack, onNext }: Props) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [sections, setSections] = useState<CourseSection[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    getMyCoursePreview(courseId)
      .then((data) => { setCourse(data.course); setSections(data.sections); setError(null); })
      .catch((err) => {
        if (err instanceof CourseApiError && err.status === 401) { navigate('/instructor/login'); return; }
        setError(err instanceof Error ? err.message : 'Failed to load preview.');
      })
      .finally(() => setLoading(false));
  }, [courseId, navigate]);

  useEffect(load, [load]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="mn-spinner" /></div>;
  if (error) {
    return (
      <div style={ERROR_BANNER}>
        {error}{' '}
        <button type="button" onClick={load} style={{ background: 'none', border: 'none', color: '#b91c1c', textDecoration: 'underline', cursor: 'pointer', fontSize: 12 }}>Retry</button>
      </div>
    );
  }
  if (!course) return null;

  const totalLessons = sections.reduce((n, s) => n + s.lessons.length, 0);
  const s = course.settings;
  const chips: string[] = [];
  if (s.isFree) chips.push('Free');
  else if (s.price != null) chips.push(`${(s.price / 100).toFixed(2)} ${s.currency ?? ''}`.trim());
  chips.push(s.visibility);
  if (s.certificateEnabled) chips.push('Certificate');
  if (s.dripContentEnabled) chips.push('Drip content');
  if (s.enrollmentLimit != null) chips.push(`Limit: ${s.enrollmentLimit}`);

  return (
    <div>
      <div className="mn-db-card">
        <div className="mn-db-card-header"><div className="mn-db-card-title">Preview</div></div>

        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          {course.thumbnail && (
            <img src={course.thumbnail} alt={course.title} style={{ width: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'cover', marginBottom: 12 }} />
          )}
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>{course.title}</h3>
          {course.subtitle && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>{course.subtitle}</p>}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '10px 0' }}>
            {chips.map((c) => (
              <span key={c} style={{ padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: '#eef2ff', color: '#4338ca' }}>{c}</span>
            ))}
          </div>

          {course.description && <p style={{ fontSize: 13, lineHeight: 1.6, color: '#374151' }}>{course.description}</p>}

          <h4 style={{ margin: '16px 0 8px', fontSize: 13, fontWeight: 700, color: '#374151' }}>
            Course Content <span style={{ fontWeight: 400, color: '#94a3b8' }}>({sections.length} section{sections.length !== 1 ? 's' : ''} · {totalLessons} lesson{totalLessons !== 1 ? 's' : ''})</span>
          </h4>

          {sections.length === 0 ? (
            <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', border: '1px dashed #e5e7eb', borderRadius: 8, padding: 16 }}>
              No sections yet. Add sections in the Content step.
            </p>
          ) : (
            sections.map((section, idx) => (
              <div key={section.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ display: 'flex', height: 18, width: 18, alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: '#e2e8f0', fontSize: 10, fontWeight: 700, color: '#475569' }}>{idx + 1}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{section.title}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>{section.lessons.length} lesson{section.lessons.length !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ padding: '6px 12px' }}>
                  {section.lessons.length === 0 ? (
                    <p style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic', padding: '6px 0' }}>No lessons in this section.</p>
                  ) : (
                    section.lessons.map((lesson) => (
                      <div key={lesson.id} style={{ padding: '8px 0', borderTop: '1px solid #f8fafc' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: lesson.type === 'TEXT' ? '#eef2ff' : '#fce7f3', color: lesson.type === 'TEXT' ? '#4338ca' : '#be185d' }}>
                            {lesson.type === 'TEXT' ? 'TEXT' : 'VIDEO'}
                          </span>
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: '#374151' }}>{lesson.title}</span>
                          {lesson.durationMin != null && <span style={{ fontSize: 11, color: '#94a3b8' }}>{lesson.durationMin} min</span>}
                        </div>
                        {lesson.type === 'VIDEO_URL' && lesson.content && (
                          <video src={lesson.content} controls preload="none" style={{ width: '100%', maxHeight: 180, borderRadius: 6, marginTop: 6 }} />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" style={BTN_SECONDARY} onClick={onBack}>← Back: Settings</button>
        <button type="button" style={BTN_PRIMARY} onClick={onNext}>Next: Submit →</button>
      </div>
    </div>
  );
}
