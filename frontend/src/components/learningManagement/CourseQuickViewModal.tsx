// Course Quick View Modal — triggered by the eye icon in the Courses table.
// GET /courses/:id/preview via getPreview(). Read-only; no mutations.
// Escape key, X button, and backdrop all close the modal.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { getPreview } from '../../services/courseWizardApi';
import { CourseApiError } from '../../types/courses';
import type { CoursePreviewData } from '../../services/courseWizardApi';
import { LessonRow } from './CoursePreview';

const STATUS_BADGE: Record<string, string> = {
  Published: 'tw:bg-green-50 tw:text-green-700',
  Draft:     'tw:bg-amber-50 tw:text-amber-700',
  Pending:   'tw:bg-blue-50 tw:text-blue-700',
  Archived:  'tw:bg-slate-100 tw:text-slate-500',
};

interface Props {
  courseId: string;
  onClose:  () => void;
}

export default function CourseQuickViewModal({ courseId, onClose }: Props) {
  const navigate = useNavigate();

  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [data,       setData]       = useState<CoursePreviewData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const result = await getPreview(courseId);
      setData(result);
    } catch (err) {
      if (err instanceof CourseApiError && err.status === 401) { navigate('/login'); return; }
      setFetchError(err instanceof Error ? err.message : 'Failed to load course.');
    } finally {
      setLoading(false);
    }
  }, [courseId, navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {/* Backdrop */}
      <div
        aria-label="modal backdrop"
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={data ? `Course quick view: ${data.course.title}` : 'Course quick view'}
        className="tw:relative tw:w-full tw:max-w-2xl tw:rounded-xl tw:bg-white tw:shadow-2xl tw:flex tw:flex-col tw:max-h-[90vh]"
      >
        {/* Header */}
        <div className="tw:flex tw:flex-shrink-0 tw:items-center tw:justify-between tw:border-b tw:border-slate-200 tw:px-5 tw:py-4">
          <h3 className="tw:m-0 tw:text-[15px] tw:font-semibold tw:text-slate-900">Course Details</h3>
          <button type="button" onClick={onClose} aria-label="Close preview"
            className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-slate-100">
            <X className="tw:h-4 tw:w-4" strokeWidth={2} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="tw:flex-1 tw:overflow-y-auto tw:px-5 tw:py-4">
          {loading && (
            <div className="tw:flex tw:flex-col tw:gap-4">
              <div className="tw:h-[160px] tw:w-full tw:animate-pulse tw:rounded-lg tw:bg-slate-100" />
              <div className="tw:h-6 tw:w-3/4 tw:animate-pulse tw:rounded tw:bg-slate-100" />
              <div className="tw:h-4 tw:w-1/2 tw:animate-pulse tw:rounded tw:bg-slate-100" />
              <div className="tw:h-20 tw:w-full tw:animate-pulse tw:rounded tw:bg-slate-100" />
            </div>
          )}

          {!loading && fetchError && (
            <div className="tw:rounded-xl tw:border tw:border-red-100 tw:bg-red-50 tw:p-5 tw:text-center">
              <p className="tw:text-[13px] tw:text-red-500">{fetchError}</p>
              <button type="button" onClick={load}
                className="tw:mt-2 tw:text-[13px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">
                Retry
              </button>
            </div>
          )}

          {!loading && !fetchError && data && (() => {
            const { course, sections } = data;

            // Settings chips — mirrors CoursePreview.tsx IIFE
            const s = course.settings;
            const chips: { label: string; color: 'green' | 'slate' | 'amber' }[] = [];
            if (s.isFree) {
              chips.push({ label: 'Free', color: 'green' });
            } else if (s.price != null) {
              const amt = `${(s.price / 100).toFixed(2)} ${s.currency ?? ''}`.trim();
              chips.push({ label: amt, color: 'amber' });
            }
            chips.push({ label: s.visibility, color: 'slate' });
            if (s.certificateEnabled)  chips.push({ label: 'Certificate', color: 'green' });
            if (s.dripContentEnabled)  chips.push({ label: 'Drip content', color: 'slate' });
            if (s.enrollmentLimit != null) {
              chips.push({ label: `Limit: ${s.enrollmentLimit}`, color: 'slate' });
            }
            const colorMap = {
              green:  'tw:bg-green-50 tw:text-green-700',
              slate:  'tw:bg-slate-100 tw:text-slate-600',
              amber:  'tw:bg-amber-50 tw:text-amber-700',
            };

            const totalLessons = sections.reduce((n, sec) => n + sec.lessons.length, 0);

            return (
              <div className="tw:flex tw:flex-col tw:gap-4">
                {course.thumbnail && (
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="tw:w-full tw:rounded-lg tw:object-cover tw:max-h-[200px]"
                  />
                )}

                <div className="tw:flex tw:items-start tw:justify-between tw:gap-3">
                  <div>
                    <h4 className="tw:m-0 tw:text-[17px] tw:font-bold tw:text-slate-900">{course.title}</h4>
                    {course.subtitle && (
                      <p className="tw:m-0 tw:mt-1 tw:text-[13px] tw:text-slate-500">{course.subtitle}</p>
                    )}
                  </div>
                  <span className={`tw:flex-shrink-0 tw:rounded-full tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-medium ${STATUS_BADGE[course.status] ?? ''}`}>
                    {course.status}
                  </span>
                </div>

                <div className="tw:flex tw:flex-wrap tw:gap-2">
                  <span className="tw:rounded-full tw:bg-slate-100 tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-medium tw:text-slate-600">
                    {course.level}
                  </span>
                  {course.language && (
                    <span className="tw:rounded-full tw:bg-slate-100 tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-medium tw:text-slate-600">
                      {course.language}
                    </span>
                  )}
                  {course.instructor && (
                    <span className="tw:rounded-full tw:bg-blue-50 tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-medium tw:text-blue-700">
                      {course.instructor}
                    </span>
                  )}
                </div>

                {chips.length > 0 && (
                  <div aria-label="Settings summary" className="tw:flex tw:flex-wrap tw:gap-1.5">
                    {chips.map(c => (
                      <span key={c.label}
                        className={`tw:rounded-full tw:px-2.5 tw:py-1 tw:text-[10px] tw:font-semibold ${colorMap[c.color]}`}>
                        {c.label}
                      </span>
                    ))}
                  </div>
                )}

                {course.description && (
                  <p className="tw:text-[13px] tw:leading-relaxed tw:text-slate-700">{course.description}</p>
                )}

                <div className="tw:flex tw:flex-col tw:gap-3">
                  <h5 className="tw:m-0 tw:text-[13px] tw:font-semibold tw:text-slate-800">
                    Course Content
                    <span className="tw:ml-2 tw:font-normal tw:text-slate-400">
                      {sections.length} section{sections.length !== 1 ? 's' : ''} · {totalLessons} lesson{totalLessons !== 1 ? 's' : ''}
                    </span>
                  </h5>

                  {sections.length === 0 && (
                    <p className="tw:rounded-lg tw:border tw:border-dashed tw:border-slate-200 tw:p-4 tw:text-center tw:text-[13px] tw:text-slate-400">
                      No sections yet.
                    </p>
                  )}

                  {sections.map((section, idx) => (
                    <div key={section.id} className="tw:rounded-xl tw:border tw:border-slate-200 tw:overflow-hidden">
                      <div className="tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-slate-100 tw:bg-slate-50 tw:px-4 tw:py-3">
                        <span className="tw:flex tw:h-5 tw:w-5 tw:items-center tw:justify-center tw:rounded-full tw:bg-slate-200 tw:text-[10px] tw:font-bold tw:text-slate-600">
                          {idx + 1}
                        </span>
                        <span className="tw:text-[13px] tw:font-semibold tw:text-slate-900">{section.title}</span>
                        <span className="tw:ml-auto tw:text-[11px] tw:text-slate-400">
                          {section.lessons.length} lesson{section.lessons.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="tw:flex tw:flex-col tw:gap-2 tw:p-3">
                        {section.lessons.length === 0 && (
                          <p className="tw:py-1 tw:text-[12px] tw:italic tw:text-slate-400">No lessons in this section.</p>
                        )}
                        {section.lessons.map(lesson => (
                          <LessonRow key={lesson.id} lesson={lesson} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
