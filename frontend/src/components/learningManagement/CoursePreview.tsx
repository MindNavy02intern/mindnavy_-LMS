// Course Preview — Step 5 of the Course Wizard.
// One GET /courses/:id/preview call → read-only section/lesson tree.
// Desktop/Mobile CSS toggle (no new request). VIDEO_URL lessons render <video>.

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Monitor, Smartphone, BookOpen, Video } from 'lucide-react';
import { getPreview } from '../../services/courseWizardApi';
import { CourseApiError } from '../../types/courses';
import type { CoursePreviewData } from '../../services/courseWizardApi';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  courseId: string;
  onBack:   () => void;
  onNext:   () => void;
}

type ViewMode = 'desktop' | 'mobile';

// ── Sub-components ────────────────────────────────────────────────────────────

export function LessonRow({ lesson }: { lesson: CoursePreviewData['sections'][number]['lessons'][number] }) {
  const isVideo = lesson.type === 'VIDEO_URL';
  return (
    <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded-lg tw:border tw:border-slate-100 tw:bg-slate-50 tw:p-3">
      <div className="tw:flex tw:items-center tw:gap-2">
        {isVideo ? (
          <span className="tw:inline-flex tw:items-center tw:gap-1 tw:rounded-full tw:bg-violet-50 tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-semibold tw:text-violet-700">
            <Video className="tw:h-2.5 tw:w-2.5" strokeWidth={2.5} /> Video
          </span>
        ) : (
          <span className="tw:inline-flex tw:items-center tw:gap-1 tw:rounded-full tw:bg-sky-50 tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-semibold tw:text-sky-700">
            <BookOpen className="tw:h-2.5 tw:w-2.5" strokeWidth={2.5} /> Text
          </span>
        )}
        <span className="tw:flex-1 tw:text-[13px] tw:font-medium tw:text-slate-800">{lesson.title}</span>
        {lesson.duration != null && (
          <span className="tw:flex-shrink-0 tw:text-[11px] tw:text-slate-400">{lesson.duration} min</span>
        )}
      </div>

      {/* VIDEO_URL renders inline player */}
      {isVideo && lesson.content && (
        <video
          src={lesson.content}
          controls
          preload="none"
          className="tw:w-full tw:rounded tw:max-h-[180px]"
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CoursePreview({ courseId, onBack, onNext }: Props) {
  const navigate = useNavigate();

  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [data,       setData]       = useState<CoursePreviewData | null>(null);
  const [viewMode,   setViewMode]   = useState<ViewMode>('desktop');

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const result = await getPreview(courseId);
      setData(result);
    } catch (err) {
      if (err instanceof CourseApiError && err.status === 401) { navigate('/login'); return; }
      setFetchError(err instanceof Error ? err.message : 'Failed to load preview.');
    } finally {
      setLoading(false);
    }
  }, [courseId, navigate]);

  useEffect(() => { load(); }, [load]);

  // ── Render: loading ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="tw:flex tw:flex-col tw:gap-4">
        <div className="tw:flex tw:items-center tw:gap-3">
          <div className="tw:h-5 tw:w-16 tw:animate-pulse tw:rounded tw:bg-slate-100" />
          <div className="tw:h-6 tw:w-48 tw:animate-pulse tw:rounded tw:bg-slate-100" />
        </div>
        <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-6 tw:flex tw:flex-col tw:gap-4">
          {[1, 2].map(i => (
            <div key={i} className="tw:h-20 tw:w-full tw:animate-pulse tw:rounded tw:bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="tw:flex tw:flex-col tw:gap-4">
        <div className="tw:rounded-xl tw:border tw:border-red-100 tw:bg-red-50 tw:p-5 tw:text-center">
          <p className="tw:text-[13px] tw:text-red-500">{fetchError}</p>
          <button type="button" onClick={load}
            className="tw:mt-2 tw:text-[13px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { course, sections } = data;

  // CSS width classes for desktop / mobile simulation
  const previewWidth = viewMode === 'mobile' ? 'tw:max-w-[390px]' : 'tw:w-full';

  return (
    <div className="tw:flex tw:flex-col tw:gap-5">

      {/* Header */}
      <div className="tw:flex tw:items-center tw:justify-between">
        <div className="tw:flex tw:items-center tw:gap-3">
          <button type="button" onClick={onBack}
            className="tw:flex tw:items-center tw:gap-1 tw:text-[13px] tw:font-medium tw:text-slate-500 tw:hover:text-slate-700">
            <ChevronLeft className="tw:h-4 tw:w-4" strokeWidth={2} />
            Back
          </button>
          <div>
            <h2 className="tw:m-0 tw:text-[17px] tw:font-semibold tw:text-slate-900">Course Preview</h2>
            <p className="tw:m-0 tw:text-[11px] tw:text-slate-400">Step 5 — Read-only view of your course</p>
          </div>
        </div>

        {/* Desktop / Mobile toggle */}
        <div className="tw:flex tw:rounded-lg tw:border tw:border-slate-200 tw:p-0.5">
          <button
            type="button"
            aria-label="Desktop view"
            onClick={() => setViewMode('desktop')}
            className={
              'tw:flex tw:items-center tw:gap-1 tw:rounded-md tw:px-3 tw:py-1.5 tw:text-[12px] tw:font-medium tw:transition-colors' +
              (viewMode === 'desktop'
                ? ' tw:bg-slate-900 tw:text-white'
                : ' tw:text-slate-500 tw:hover:text-slate-700')
            }
          >
            <Monitor className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
            Desktop
          </button>
          <button
            type="button"
            aria-label="Mobile view"
            onClick={() => setViewMode('mobile')}
            className={
              'tw:flex tw:items-center tw:gap-1 tw:rounded-md tw:px-3 tw:py-1.5 tw:text-[12px] tw:font-medium tw:transition-colors' +
              (viewMode === 'mobile'
                ? ' tw:bg-slate-900 tw:text-white'
                : ' tw:text-slate-500 tw:hover:text-slate-700')
            }
          >
            <Smartphone className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
            Mobile
          </button>
        </div>
      </div>

      {/* Preview container */}
      <div className={`${previewWidth} tw:mx-auto tw:flex tw:flex-col tw:gap-4 tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:transition-all`}>

        {/* Course header */}
        {course.thumbnail && (
          <img
            src={course.thumbnail}
            alt={course.title}
            className="tw:w-full tw:rounded-lg tw:object-cover tw:max-h-[200px]"
          />
        )}

        <div>
          <h3 className="tw:m-0 tw:text-[18px] tw:font-bold tw:text-slate-900">{course.title}</h3>
          {course.subtitle && (
            <p className="tw:mt-1 tw:text-[14px] tw:text-slate-600">{course.subtitle}</p>
          )}
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

        {/* Settings summary */}
        {(() => {
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

          return (
            <div aria-label="Settings summary" className="tw:flex tw:flex-wrap tw:gap-1.5">
              {chips.map(c => (
                <span key={c.label}
                  className={`tw:rounded-full tw:px-2.5 tw:py-1 tw:text-[10px] tw:font-semibold ${colorMap[c.color]}`}>
                  {c.label}
                </span>
              ))}
            </div>
          );
        })()}

        {course.description && (
          <p className="tw:text-[13px] tw:leading-relaxed tw:text-slate-700">{course.description}</p>
        )}

        {/* Section / lesson tree */}
        <div className="tw:flex tw:flex-col tw:gap-3">
          <h4 className="tw:m-0 tw:text-[13px] tw:font-semibold tw:text-slate-800">
            Course Content
            <span className="tw:ml-2 tw:font-normal tw:text-slate-400">
              {sections.length} section{sections.length !== 1 ? 's' : ''} · {sections.reduce((n, s) => n + s.lessons.length, 0)} lesson{sections.reduce((n, s) => n + s.lessons.length, 0) !== 1 ? 's' : ''}
            </span>
          </h4>

          {sections.length === 0 && (
            <p className="tw:rounded-lg tw:border tw:border-dashed tw:border-slate-200 tw:p-4 tw:text-center tw:text-[13px] tw:text-slate-400">
              No sections yet. Add sections in the Course Builder.
            </p>
          )}

          {sections.map((section, idx) => (
            <div key={section.id} className="tw:rounded-xl tw:border tw:border-slate-200 tw:overflow-hidden">
              {/* Section header */}
              <div className="tw:flex tw:items-center tw:gap-2 tw:bg-slate-50 tw:px-4 tw:py-3 tw:border-b tw:border-slate-100">
                <span className="tw:flex tw:h-5 tw:w-5 tw:items-center tw:justify-center tw:rounded-full tw:bg-slate-200 tw:text-[10px] tw:font-bold tw:text-slate-600">
                  {idx + 1}
                </span>
                <span className="tw:text-[13px] tw:font-semibold tw:text-slate-900">{section.title}</span>
                <span className="tw:ml-auto tw:text-[11px] tw:text-slate-400">
                  {section.lessons.length} lesson{section.lessons.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Lessons */}
              <div className="tw:p-3 tw:flex tw:flex-col tw:gap-2">
                {section.lessons.length === 0 && (
                  <p className="tw:text-[12px] tw:italic tw:text-slate-400 tw:py-1">No lessons in this section.</p>
                )}
                {section.lessons.map(lesson => (
                  <LessonRow key={lesson.id} lesson={lesson} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="tw:flex tw:items-center tw:justify-between tw:py-2">
        <button type="button" onClick={onBack}
          className="tw:flex tw:items-center tw:gap-1 tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50">
          <ChevronLeft className="tw:h-4 tw:w-4" strokeWidth={2} />
          Back to Settings
        </button>
        <button type="button" onClick={onNext}
          className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700">
          Next: Submit
          <ChevronRight className="tw:h-4 tw:w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
