import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Plus, ChevronLeft } from 'lucide-react';
import { getLmFilterOptions } from '../../services/lmApi';
import { getCourse, createCourse, updateCourse } from '../../services/coursesApi';
import { CourseApiError } from '../../types/courses';
import type { CourseDetail, CourseLevel, CreateCoursePayload } from '../../types/courses';
import type { LmFilterOptions } from '../../types/lm';

const LEVELS: CourseLevel[] = ['Beginner', 'Intermediate', 'Advanced'];
const LANGUAGES = ['English', 'Arabic', 'French', 'Spanish', 'German', 'Chinese', 'Japanese'];

interface FormValues {
  title:        string;
  subtitle:     string;
  description:  string;
  category:     string;
  tags:         string[];
  language:     string;
  level:        CourseLevel | '';
  thumbnail:    string;
  instructorId: string;
}

const EMPTY: FormValues = {
  title: '', subtitle: '', description: '', category: '',
  tags: [], language: '', level: '', thumbnail: '', instructorId: '',
};

interface Props {
  mode:     'create' | 'edit';
  courseId?: string;
  onSaved:  (course: CourseDetail) => void;
  onCancel: () => void;
}

export default function CourseForm({ mode, courseId, onSaved, onCancel }: Props) {
  const navigate = useNavigate();

  const [filterOptions, setFilterOptions] = useState<LmFilterOptions | null>(null);
  const [values,     setValues]     = useState<FormValues>(EMPTY);
  const [original,   setOriginal]   = useState<FormValues>(EMPTY);
  const [tagInput,   setTagInput]   = useState('');
  const [loading,    setLoading]    = useState(mode === 'edit');
  const [submitting, setSubmitting] = useState(false);
  const [loadError,  setLoadError]  = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [globalError, setGlobalError]  = useState<string | null>(null);
  const [imgBroken,  setImgBroken]  = useState(false);

  const prevThumbnail = useRef('');

  // Load filter-options
  useEffect(() => {
    getLmFilterOptions().then(setFilterOptions).catch(() => null);
  }, []);

  // Prefill form in edit mode
  useEffect(() => {
    if (mode !== 'edit' || !courseId) return;
    let cancelled = false;
    (() => { setLoading(true); setLoadError(null); })();
    getCourse(courseId)
      .then((c) => {
        if (cancelled) return;
        const v: FormValues = {
          title:        c.title,
          subtitle:     c.subtitle     ?? '',
          description:  c.description  ?? '',
          category:     c.category,
          tags:         c.tags,
          language:     c.language     ?? '',
          level:        c.level,
          thumbnail:    c.thumbnail    ?? '',
          instructorId: c.instructorId,
        };
        setValues(v);
        setOriginal(v);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof CourseApiError && err.status === 401) { navigate('/login'); return; }
        setLoadError(err instanceof Error ? err.message : 'Failed to load course.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [mode, courseId, navigate]);

  // Reset broken-img flag when thumbnail URL changes
  useEffect(() => {
    if (values.thumbnail !== prevThumbnail.current) {
      prevThumbnail.current = values.thumbnail;
      setImgBroken(false);
    }
  }, [values.thumbnail]);

  function set(field: keyof FormValues, value: FormValues[keyof FormValues]) {
    setValues((v) => ({ ...v, [field]: value }));
    setFieldErrors((e) => { const n = { ...e }; delete n[field]; return n; });
    setGlobalError(null);
  }

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (!tag || values.tags.includes(tag)) { setTagInput(''); return; }
    set('tags', [...values.tags, tag]);
    setTagInput('');
  }

  function removeTag(tag: string) {
    set('tags', values.tags.filter((t) => t !== tag));
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput); }
  }

  const isValid = values.title.trim().length > 0 && values.instructorId !== '';

  async function handleSubmit() {
    setFieldErrors({});
    setGlobalError(null);
    const errs: Partial<Record<keyof FormValues, string>> = {};
    if (!values.title.trim())   errs.title        = 'Title is required.';
    if (!values.instructorId)   errs.instructorId = 'Instructor is required.';
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }

    (() => setSubmitting(true))();
    try {
      let saved: CourseDetail;
      if (mode === 'create') {
        const payload: CreateCoursePayload = {
          title:        values.title.trim(),
          instructorId: values.instructorId,
          ...(values.subtitle    && { subtitle:    values.subtitle }),
          ...(values.description && { description: values.description }),
          ...(values.category    && { category:    values.category }),
          ...(values.tags.length && { tags:        values.tags }),
          ...(values.language    && { language:    values.language }),
          ...(values.level       && { level:       values.level as CourseLevel }),
          ...(values.thumbnail   && { thumbnail:   values.thumbnail }),
        };
        saved = await createCourse(payload);
      } else {
        // Send only changed fields
        const patch: Record<string, unknown> = {};
        (Object.keys(values) as (keyof FormValues)[]).forEach((k) => {
          const v = values[k];
          const o = original[k];
          if (k === 'tags') {
            if (JSON.stringify(v) !== JSON.stringify(o)) patch[k] = v;
          } else if (v !== o) {
            patch[k] = v === '' ? null : v;
          }
        });
        saved = await updateCourse(courseId!, patch as Parameters<typeof updateCourse>[1]);
      }
      onSaved(saved);
    } catch (err) {
      if (err instanceof CourseApiError) {
        if (err.status === 401) { navigate('/login'); return; }
        if (err.status === 400) {
          setGlobalError(err.message);
        } else {
          setGlobalError(err.message);
        }
      } else {
        setGlobalError('An unexpected error occurred.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="tw:flex tw:flex-col tw:gap-5">
        <div className="tw:flex tw:items-center tw:gap-3">
          <div className="tw:h-5 tw:w-16 tw:animate-pulse tw:rounded tw:bg-slate-100" />
          <div className="tw:h-7 tw:w-48 tw:animate-pulse tw:rounded tw:bg-slate-100" />
        </div>
        <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="tw:mb-5 tw:space-y-1.5">
              <div className="tw:h-3 tw:w-24 tw:animate-pulse tw:rounded tw:bg-slate-100" />
              <div className="tw:h-9 tw:w-full tw:animate-pulse tw:rounded tw:bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="tw:rounded-xl tw:border tw:border-red-100 tw:bg-white tw:p-6 tw:text-center">
        <p className="tw:text-[13px] tw:text-red-500">{loadError}</p>
        <button type="button" onClick={onCancel} className="tw:mt-3 tw:text-[13px] tw:font-medium tw:text-blue-600">
          ← Back to list
        </button>
      </div>
    );
  }

  // ── Form ─────────────────────────────────────────────────────────────────

  const instructor = filterOptions?.instructors.find((i) => i.id === values.instructorId);

  return (
    <div className="tw:flex tw:flex-col tw:gap-5">
      {/* Header */}
      <div className="tw:flex tw:items-center tw:justify-between">
        <div className="tw:flex tw:items-center tw:gap-3">
          <button type="button" onClick={onCancel}
            className="tw:flex tw:items-center tw:gap-1 tw:text-[13px] tw:font-medium tw:text-slate-500 tw:hover:text-slate-700">
            <ChevronLeft className="tw:h-4 tw:w-4" strokeWidth={2} />
            Back
          </button>
          <h2 className="tw:m-0 tw:text-[17px] tw:font-semibold tw:text-slate-900">
            {mode === 'create' ? 'Create Course' : 'Edit Course — Basic Info'}
          </h2>
        </div>
        {mode === 'create' && (
          <span className="tw:rounded-full tw:bg-amber-50 tw:px-3 tw:py-1 tw:text-[11px] tw:font-semibold tw:text-amber-700">
            Saves as Draft
          </span>
        )}
      </div>

      {globalError && (
        <div className="tw:rounded-lg tw:border tw:border-red-100 tw:bg-red-50 tw:px-4 tw:py-2.5 tw:text-[13px] tw:text-red-600">
          {globalError}
        </div>
      )}

      <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-6">
        <div className="tw:grid tw:grid-cols-2 tw:gap-x-6 tw:gap-y-5">

          {/* Title */}
          <div className="tw:col-span-2">
            <label className="tw:mb-1.5 tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">
              Title <span className="tw:text-red-500">*</span>
            </label>
            <input
              type="text"
              value={values.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="e.g. Advanced Python Programming"
              className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400 focus:tw:ring-2 focus:tw:ring-blue-100"
            />
            {fieldErrors.title && (
              <p className="tw:mt-1 tw:text-[11px] tw:text-red-500">{fieldErrors.title}</p>
            )}
          </div>

          {/* Subtitle */}
          <div className="tw:col-span-2">
            <label className="tw:mb-1.5 tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">Subtitle</label>
            <input
              type="text"
              value={values.subtitle}
              onChange={(e) => set('subtitle', e.target.value)}
              placeholder="Short description shown in cards"
              className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400 focus:tw:ring-2 focus:tw:ring-blue-100"
            />
          </div>

          {/* Description */}
          <div className="tw:col-span-2">
            <label className="tw:mb-1.5 tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">Description</label>
            <textarea
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Full course description…"
              rows={4}
              className="tw:w-full tw:resize-none tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400 focus:tw:ring-2 focus:tw:ring-blue-100"
            />
          </div>

          {/* Category */}
          <div>
            <label className="tw:mb-1.5 tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">Category</label>
            <select
              value={values.category}
              onChange={(e) => set('category', e.target.value)}
              className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-700 tw:outline-none focus:tw:border-blue-400"
            >
              <option value="">Select category…</option>
              {filterOptions?.categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Instructor */}
          <div>
            <label className="tw:mb-1.5 tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">
              Instructor <span className="tw:text-red-500">*</span>
            </label>
            <select
              value={values.instructorId}
              onChange={(e) => set('instructorId', e.target.value)}
              className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-700 tw:outline-none focus:tw:border-blue-400"
            >
              <option value="">Select instructor…</option>
              {filterOptions?.instructors.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
            {fieldErrors.instructorId && (
              <p className="tw:mt-1 tw:text-[11px] tw:text-red-500">{fieldErrors.instructorId}</p>
            )}
            {instructor && (
              <p className="tw:mt-1 tw:text-[11px] tw:text-slate-400">ID: {instructor.id}</p>
            )}
          </div>

          {/* Difficulty Level */}
          <div>
            <label className="tw:mb-1.5 tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">Difficulty Level</label>
            <select
              value={values.level}
              onChange={(e) => set('level', e.target.value as CourseLevel | '')}
              className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-700 tw:outline-none focus:tw:border-blue-400"
            >
              <option value="">Select level…</option>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Language */}
          <div>
            <label className="tw:mb-1.5 tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">Language</label>
            <select
              value={values.language}
              onChange={(e) => set('language', e.target.value)}
              className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-700 tw:outline-none focus:tw:border-blue-400"
            >
              <option value="">Select language…</option>
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          {/* Tags */}
          <div className="tw:col-span-2">
            <label className="tw:mb-1.5 tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">Tags</label>
            <div className="tw:flex tw:min-h-[38px] tw:flex-wrap tw:gap-1.5 tw:rounded-lg tw:border tw:border-slate-200 tw:p-2 focus-within:tw:border-blue-400 focus-within:tw:ring-2 focus-within:tw:ring-blue-100">
              {values.tags.map((tag) => (
                <span key={tag}
                  className="tw:flex tw:items-center tw:gap-1 tw:rounded-full tw:bg-blue-50 tw:px-2.5 tw:py-0.5 tw:text-[11px] tw:font-medium tw:text-blue-700">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)}
                    className="tw:leading-none tw:text-blue-400 tw:hover:text-blue-700">
                    <X className="tw:h-3 tw:w-3" strokeWidth={2.5} />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                placeholder={values.tags.length === 0 ? 'Type a tag and press Enter…' : ''}
                className="tw:min-w-[120px] tw:flex-1 tw:border-none tw:bg-transparent tw:text-[12px] tw:text-slate-700 tw:outline-none"
              />
            </div>
            <p className="tw:mt-1 tw:text-[11px] tw:text-slate-400">Press Enter or comma to add a tag.</p>
          </div>

          {/* Thumbnail */}
          <div className="tw:col-span-2">
            <label className="tw:mb-1.5 tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">
              Thumbnail URL
              <span className="tw:ml-1 tw:text-[11px] tw:font-normal tw:text-slate-400">(file upload is out of scope — paste a URL)</span>
            </label>
            <input
              type="url"
              value={values.thumbnail}
              onChange={(e) => set('thumbnail', e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400 focus:tw:ring-2 focus:tw:ring-blue-100"
            />
            {values.thumbnail && !imgBroken && (
              <img
                src={values.thumbnail}
                alt="Thumbnail preview"
                onError={() => setImgBroken(true)}
                className="tw:mt-2 tw:h-24 tw:w-40 tw:rounded-lg tw:border tw:border-slate-200 tw:object-cover"
              />
            )}
            {values.thumbnail && imgBroken && (
              <p className="tw:mt-1 tw:text-[11px] tw:text-amber-600">Could not load preview for this URL.</p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="tw:flex tw:items-center tw:justify-between">
        <button type="button" onClick={onCancel}
          className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50">
          Cancel
        </button>
        <div className="tw:flex tw:items-center tw:gap-3">
          <button
            type="button"
            disabled
            title="Steps 2–6 coming later"
            className="tw:rounded-lg tw:border tw:border-dashed tw:border-slate-300 tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:text-slate-300 tw:cursor-not-allowed"
          >
            Next: Course Builder →
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700 tw:disabled:cursor-not-allowed tw:disabled:opacity-50"
          >
            <Plus className="tw:h-4 tw:w-4" strokeWidth={2.5} />
            {submitting ? 'Saving…' : 'Save Draft'}
          </button>
        </div>
      </div>
    </div>
  );
}
