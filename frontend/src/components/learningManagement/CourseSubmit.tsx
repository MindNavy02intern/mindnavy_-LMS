// Course Submit — Step 6 of the Course Wizard.
// POST /courses/:id/submit (no body). Draft-only.
// Renders full errors[] array on 400 SUBMIT_CHECKS_FAILED.
// Race-condition 400 → shows exact backend message, no auto-retry.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Send, CheckCircle, XCircle } from 'lucide-react';
import { getCourse } from '../../services/coursesApi';
import { submitCourse } from '../../services/courseWizardApi';
import { CourseApiError } from '../../types/courses';
import type { CourseDetail } from '../../types/courses';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  courseId: string;
  onBack:   () => void;
  onDone:   () => void;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CourseSubmit({ courseId, onBack, onDone }: Props) {
  const navigate = useNavigate();

  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [course,     setCourse]     = useState<CourseDetail | null>(null);
  const [submitting,   setSubmitting]   = useState(false);
  const [submitErrors, setSubmitErrors] = useState<string[] | null>(null);
  const [submitMsg,    setSubmitMsg]    = useState<string | null>(null);
  const [submitted,    setSubmitted]    = useState(false);
  const [toastMsg,     setToastMsg]     = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const c = await getCourse(courseId);
      setCourse(c);
    } catch (err) {
      if (err instanceof CourseApiError && err.status === 401) { navigate('/login'); return; }
      setFetchError(err instanceof Error ? err.message : 'Failed to load course.');
    } finally {
      setLoading(false);
    }
  }, [courseId, navigate]);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    toastTimer.current = setTimeout(() => setToastMsg(null), 4000);
  }

  async function handleSubmit() {
    if (!window.confirm('Submit this course for approval? You won\'t be able to edit it until it\'s reviewed.')) return;
    setSubmitting(true);
    setSubmitErrors(null);
    setSubmitMsg(null);
    try {
      await submitCourse(courseId);
      setSubmitted(true);
    } catch (err) {
      if (err instanceof CourseApiError && err.status === 401) { navigate('/login'); return; }
      if (err instanceof CourseApiError && err.status === 429) {
        showToast('Too many requests — slow down and try again.');
        return;
      }
      if (err instanceof CourseApiError && err.errors && err.errors.length > 0) {
        setSubmitErrors(err.errors);
      } else {
        setSubmitMsg(err instanceof Error ? err.message : 'Submission failed.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="tw:flex tw:flex-col tw:gap-4">
        <div className="tw:flex tw:items-center tw:gap-3">
          <div className="tw:h-5 tw:w-16 tw:animate-pulse tw:rounded tw:bg-slate-100" />
          <div className="tw:h-6 tw:w-48 tw:animate-pulse tw:rounded tw:bg-slate-100" />
        </div>
        <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-8 tw:flex tw:flex-col tw:gap-4">
          <div className="tw:h-10 tw:w-full tw:animate-pulse tw:rounded tw:bg-slate-100" />
          <div className="tw:h-8 tw:w-32 tw:animate-pulse tw:rounded tw:bg-slate-100" />
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="tw:rounded-xl tw:border tw:border-red-100 tw:bg-red-50 tw:p-5 tw:text-center">
        <p className="tw:text-[13px] tw:text-red-500">{fetchError}</p>
        <button type="button" onClick={load}
          className="tw:mt-2 tw:text-[13px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">
          Retry
        </button>
      </div>
    );
  }

  if (!course) return null;

  // ── Success state ─────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <div className="tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-5 tw:py-16">
        <CheckCircle className="tw:h-14 tw:w-14 tw:text-green-500" strokeWidth={1.5} />
        <div className="tw:text-center">
          <h2 className="tw:m-0 tw:text-[20px] tw:font-bold tw:text-slate-900">Submitted for Review!</h2>
          <p className="tw:mt-1 tw:text-[14px] tw:text-slate-500">
            Your course is now pending admin approval. You'll be notified when it's reviewed.
          </p>
        </div>
        <button type="button" onClick={onDone}
          className="tw:rounded-lg tw:bg-blue-600 tw:px-6 tw:py-2.5 tw:text-[14px] tw:font-semibold tw:text-white tw:hover:tw:bg-blue-700">
          Back to Courses
        </button>
      </div>
    );
  }

  // ── Non-Draft guard ───────────────────────────────────────────────────────

  if (course.status !== 'Draft') {
    const statusMsg: Record<string, string> = {
      Pending:   'This course is already pending review.',
      Published: 'This course is already published.',
      Archived:  'Archived courses cannot be submitted.',
    };
    return (
      <div className="tw:flex tw:flex-col tw:gap-5">
        <div className="tw:flex tw:items-center tw:gap-3">
          <button type="button" onClick={onBack}
            className="tw:flex tw:items-center tw:gap-1 tw:text-[13px] tw:font-medium tw:text-slate-500 tw:hover:text-slate-700">
            <ChevronLeft className="tw:h-4 tw:w-4" strokeWidth={2} />
            Back
          </button>
          <h2 className="tw:m-0 tw:text-[17px] tw:font-semibold tw:text-slate-900">Submit Course</h2>
        </div>
        <div className="tw:rounded-xl tw:border tw:border-amber-100 tw:bg-amber-50 tw:p-5 tw:text-center">
          <p className="tw:text-[13px] tw:text-amber-700">
            {statusMsg[course.status] ?? `Course is ${course.status} — cannot submit.`}
          </p>
          <button type="button" onClick={onDone}
            className="tw:mt-3 tw:text-[13px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">
            Back to Courses
          </button>
        </div>
      </div>
    );
  }

  // ── Submit form ───────────────────────────────────────────────────────────

  return (
    <div className="tw:flex tw:flex-col tw:gap-5">

      {/* Toast — 429 rate-limit */}
      {toastMsg && (
        <div role="status" className="tw:rounded-lg tw:border tw:border-amber-200 tw:bg-amber-50 tw:px-4 tw:py-2.5 tw:text-[13px] tw:text-amber-700">
          {toastMsg}
        </div>
      )}

      {/* Header */}
      <div className="tw:flex tw:items-center tw:gap-3">
        <button type="button" onClick={onBack}
          className="tw:flex tw:items-center tw:gap-1 tw:text-[13px] tw:font-medium tw:text-slate-500 tw:hover:text-slate-700">
          <ChevronLeft className="tw:h-4 tw:w-4" strokeWidth={2} />
          Back
        </button>
        <div>
          <h2 className="tw:m-0 tw:text-[17px] tw:font-semibold tw:text-slate-900">Submit for Review</h2>
          <p className="tw:m-0 tw:text-[11px] tw:text-slate-400">Step 6 — Send your course to admin for approval</p>
        </div>
      </div>

      {/* Course card */}
      <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:flex tw:gap-4">
        {course.thumbnail && (
          <img
            src={course.thumbnail}
            alt={course.title}
            className="tw:h-16 tw:w-24 tw:flex-shrink-0 tw:rounded-lg tw:object-cover"
          />
        )}
        <div className="tw:flex-1 tw:min-w-0">
          <p className="tw:m-0 tw:text-[15px] tw:font-semibold tw:text-slate-900 tw:truncate">{course.title}</p>
          {course.subtitle && (
            <p className="tw:mt-0.5 tw:text-[12px] tw:text-slate-500 tw:line-clamp-2">{course.subtitle}</p>
          )}
          <span className="tw:mt-1.5 tw:inline-block tw:rounded-full tw:bg-amber-50 tw:px-2.5 tw:py-0.5 tw:text-[11px] tw:font-medium tw:text-amber-700">
            Draft
          </span>
        </div>
      </div>

      {/* Readiness errors from SUBMIT_CHECKS_FAILED */}
      {submitErrors && submitErrors.length > 0 && (
        <div className="tw:rounded-xl tw:border tw:border-red-100 tw:bg-red-50 tw:p-4">
          <div className="tw:flex tw:items-center tw:gap-2 tw:mb-2">
            <XCircle className="tw:h-4 tw:w-4 tw:text-red-500" strokeWidth={2} />
            <p className="tw:m-0 tw:text-[13px] tw:font-semibold tw:text-red-700">
              Course is not ready to submit. Fix the following:
            </p>
          </div>
          <ul className="tw:m-0 tw:pl-5 tw:list-disc">
            {submitErrors.map((err, i) => (
              <li key={i} className="tw:text-[13px] tw:text-red-600 tw:mb-0.5">{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Wrong-state / race-condition message */}
      {submitMsg && (
        <div className="tw:rounded-lg tw:border tw:border-red-100 tw:bg-red-50 tw:px-4 tw:py-2.5 tw:text-[13px] tw:text-red-600">
          {submitMsg}
        </div>
      )}

      {/* Info box */}
      <div className="tw:rounded-xl tw:border tw:border-blue-100 tw:bg-blue-50 tw:p-4 tw:text-[13px] tw:text-blue-700">
        <p className="tw:m-0 tw:font-semibold">Before you submit:</p>
        <ul className="tw:mt-1.5 tw:mb-0 tw:pl-4 tw:list-disc tw:space-y-0.5">
          <li>Your course must have a title, description, and thumbnail.</li>
          <li>At least one section with at least one lesson is required.</li>
          <li>Once submitted, the course cannot be edited until reviewed.</li>
        </ul>
      </div>

      {/* Actions */}
      <div className="tw:flex tw:items-center tw:justify-between tw:py-2">
        <button type="button" onClick={onDone} disabled={submitting}
          className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50 tw:disabled:opacity-40">
          Save as Draft
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          aria-label="Submit for Review"
          className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-5 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700 tw:disabled:opacity-40"
        >
          <Send className="tw:h-4 tw:w-4" strokeWidth={2} />
          {submitting ? 'Submitting…' : 'Submit for Review'}
        </button>
      </div>
    </div>
  );
}
