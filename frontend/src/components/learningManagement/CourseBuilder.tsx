// Course Builder — Step 2.
// Renders an ordered section/lesson tree for a saved Draft course.
// All writes go through invalidateFor(); no ad-hoc invalidation.
// Reorder always sends ONE bulk PATCH — never per-item patches while moving.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, ChevronUp, ChevronDown, Pencil, Trash2, Check, X, BookOpen, Video, Link } from 'lucide-react';
import VideoUpload from './VideoUpload';
import {
  getSections,
  createSection,
  updateSection,
  deleteSection,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderSections,
} from '../../services/courseBuilderApi';
import { CourseBuilderApiError } from '../../types/courseBuilder';
import type {
  CourseSection,
  Lesson,
  LessonType,
  CreateLessonPayload,
  UpdateLessonPayload,
} from '../../types/courseBuilder';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

// ── Helpers ────────────────────────────────────────────────────────────────────

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

function parseDuration(val: string): number | null {
  if (!val.trim()) return null;
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 0 || n > 100000 || String(n) !== val.trim()) return null;
  return n;
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  courseId: string;
  onBack:   () => void;
  onNext?:  () => void;
}

interface ToastState { type: 'success' | 'error'; message: string }

type LessonModal =
  | { mode: 'create'; sectionId: string }
  | { mode: 'edit';   lesson: Lesson; sectionId: string };

interface LessonFormState {
  title:       string;
  type:        LessonType;
  content:     string;
  durationStr: string;
}

interface LessonFormErrors {
  title?:    string;
  content?:  string;
  duration?: string;
}

const EMPTY_LESSON_FORM: LessonFormState = {
  title: '', type: 'TEXT', content: '', durationStr: '',
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function ToastBanner({ type, message }: ToastState) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9000,
      background: type === 'success' ? '#16a34a' : '#dc2626',
      color: '#fff', padding: '10px 18px', borderRadius: 8,
      fontSize: 13, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      maxWidth: 360,
    }}>
      {message}
    </div>
  );
}

function BuilderSkeleton() {
  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      {[1, 2].map(i => (
        <div key={i} className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-4">
          <div className="tw:h-4 tw:w-48 tw:animate-pulse tw:rounded tw:bg-slate-100 tw:mb-4" />
          {[1, 2].map(j => (
            <div key={j} className="tw:mb-2 tw:h-10 tw:w-full tw:animate-pulse tw:rounded tw:bg-slate-50" />
          ))}
        </div>
      ))}
    </div>
  );
}

function TypeBadge({ type }: { type: LessonType }) {
  if (type === 'VIDEO_URL') {
    return (
      <span className="tw:inline-flex tw:items-center tw:gap-1 tw:rounded-full tw:bg-violet-50 tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-semibold tw:text-violet-700">
        <Video className="tw:h-2.5 tw:w-2.5" strokeWidth={2.5} /> Video
      </span>
    );
  }
  return (
    <span className="tw:inline-flex tw:items-center tw:gap-1 tw:rounded-full tw:bg-sky-50 tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-semibold tw:text-sky-700">
      <BookOpen className="tw:h-2.5 tw:w-2.5" strokeWidth={2.5} /> Text
    </span>
  );
}

// ── Lesson form modal ──────────────────────────────────────────────────────────

interface LessonFormModalProps {
  modal:    LessonModal;
  courseId: string;
  onClose:  () => void;
  onSaved:  (mutationName: 'lesson.create' | 'lesson.update', courseId: string) => void;
  /** Called after a type-change-only save (TEXT→VIDEO_URL in upload-file mode).
   *  The modal stays open so the user can immediately do the upload. */
  onPartialSave?: () => void;
}

function LessonFormModal({ modal, courseId, onClose, onSaved, onPartialSave }: LessonFormModalProps) {
  const isEdit   = modal.mode === 'edit';
  const original = isEdit ? (modal as { mode: 'edit'; lesson: Lesson; sectionId: string }).lesson : null;
  const lessonId = original?.id; // defined only in edit mode

  const [form, setForm] = useState<LessonFormState>(() =>
    isEdit && original
      ? {
          title:       original.title,
          type:        original.type,
          content:     original.content ?? '',
          durationStr: original.durationMin != null ? String(original.durationMin) : '',
        }
      : EMPTY_LESSON_FORM,
  );
  const [errors, setErrors] = useState<LessonFormErrors>({});
  const [saving, setSaving] = useState(false);
  const [apiErr, setApiErr] = useState<string | null>(null);

  // Video input mode: 'url' = paste a link, 'file' = upload a file.
  const [videoInputMode,   setVideoInputMode]   = useState<'url' | 'file'>('url');
  const [isVideoUploading, setIsVideoUploading] = useState(false);

  // savedType: the lesson type currently persisted in the DB (may lag form.type
  // while an unsaved type-change is in progress). Upload File is gated behind
  // this to prevent a confirm call the backend would reject.
  const [savedType, setSavedType] = useState<LessonType>(
    isEdit && original ? original.type : 'TEXT',
  );

  // Upload File must be disabled until the type change is actually saved.
  // Paste URL stays available — pasting a URL IS the save for that path.
  const uploadNeedsSave = form.type === 'VIDEO_URL' && savedType !== 'VIDEO_URL';

  function setField<K extends keyof LessonFormState>(key: K, val: LessonFormState[K]) {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => { const n = { ...e }; delete n[key as keyof LessonFormErrors]; return n; });
    setApiErr(null);
  }

  function validate(): boolean {
    const errs: LessonFormErrors = {};
    if (!form.title.trim())          errs.title   = 'Title is required.';
    else if (form.title.length > 200) errs.title  = 'Title must be ≤ 200 characters.';

    if (form.type === 'VIDEO_URL') {
      // In edit + upload-file mode the URL will be set by the upload pipeline.
      // Skipping the URL requirement here lets the user save the type change
      // first (which unlocks the drop zone), then upload. Create mode always
      // requires a URL because !lessonId blocks the upload anyway.
      const skipUrlCheck = isEdit && videoInputMode === 'file';
      if (!skipUrlCheck) {
        if (!form.content.trim())           errs.content = 'Video URL is required.';
        else if (!isValidUrl(form.content)) errs.content = 'Must be a valid http/https URL.';
        else if (form.content.length > 2000) errs.content = 'URL must be ≤ 2000 characters.';
      }
    } else {
      if (form.content.length > 20000)    errs.content = 'Content must be ≤ 20000 characters.';
    }

    if (form.durationStr.trim()) {
      if (parseDuration(form.durationStr) === null) errs.duration = 'Must be a whole number 0–100000.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setApiErr(null);

    const durationMin = parseDuration(form.durationStr);

    try {
      if (isEdit && original) {
        const patch: UpdateLessonPayload = {};
        if (form.title.trim() !== original.title) patch.title = form.title.trim();
        if (form.type          !== original.type)  patch.type  = form.type;

        // Content handling for VIDEO_URL in upload mode: the URL will come from
        // the upload pipeline. If switching from TEXT, null out the old text body
        // explicitly so the backend doesn't inherit a non-URL string as content.
        const newContent = (() => {
          if (form.type !== 'VIDEO_URL') return form.content.trim() || null;
          if (videoInputMode === 'file' && !isValidUrl(form.content)) return null;
          return form.content.trim();
        })();
        if (newContent !== original.content) patch.content = newContent;
        if (durationMin !== original.durationMin) patch.durationMin = durationMin;

        if (Object.keys(patch).length > 0) {
          await updateLesson(original.id, patch);

          // If this save introduced the VIDEO_URL type while in upload-file mode,
          // keep the modal open so the user can upload without re-opening it.
          const firstTypeChangeToVideo =
            patch.type === 'VIDEO_URL' && savedType !== 'VIDEO_URL' && videoInputMode === 'file';
          if (firstTypeChangeToVideo) {
            setSavedType('VIDEO_URL');
            onPartialSave?.();
          } else {
            onSaved('lesson.update', courseId);
          }
        } else {
          onClose();
        }
      } else {
        const payload: CreateLessonPayload = {
          title: form.title.trim(),
          type:  form.type,
          ...(form.type === 'VIDEO_URL'
            ? { content: form.content.trim() }
            : (form.content.trim() ? { content: form.content.trim() } : {})),
          ...(durationMin != null ? { durationMin } : {}),
        };
        await createLesson(modal.sectionId, payload);
        onSaved('lesson.create', courseId);
      }
    } catch (err) {
      setApiErr(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
        onClick={!saving ? onClose : undefined} />
      <div className="tw:relative tw:w-full tw:max-w-lg tw:max-h-[90vh] tw:flex tw:flex-col tw:overflow-hidden tw:rounded-xl tw:bg-white tw:shadow-2xl">

        {/* Header */}
        <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-slate-200 tw:px-5 tw:py-4 tw:flex-shrink-0">
          <h3 className="tw:m-0 tw:text-[15px] tw:font-semibold tw:text-slate-900">
            {isEdit ? 'Edit Lesson' : 'Add Lesson'}
          </h3>
          <button type="button" onClick={onClose} disabled={saving}
            className="tw:rounded-md tw:p-1 tw:text-slate-400 tw:hover:bg-slate-100 tw:hover:text-slate-600 tw:disabled:opacity-40">
            <X className="tw:h-4 tw:w-4" strokeWidth={2.5} />
          </button>
        </div>

        {/* Body */}
        <div className="tw:flex-1 tw:overflow-y-auto tw:px-5 tw:py-4 tw:flex tw:flex-col tw:gap-4">
          {apiErr && (
            <div className="tw:rounded-lg tw:border tw:border-red-100 tw:bg-red-50 tw:px-3 tw:py-2 tw:text-[12px] tw:text-red-600">
              {apiErr}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="tw:mb-1 tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">
              Title <span className="tw:text-red-500">*</span>
            </label>
            <input
              aria-label="Lesson title"
              type="text"
              value={form.title}
              onChange={e => setField('title', e.target.value)}
              placeholder="e.g. Introduction to Variables"
              className={
                'tw:w-full tw:rounded-lg tw:border tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:ring-2 focus:tw:ring-blue-100' +
                (errors.title ? ' tw:border-red-300 tw:bg-red-50 focus:tw:border-red-400' : ' tw:border-slate-200 focus:tw:border-blue-400')
              }
              maxLength={200}
              autoFocus
            />
            {errors.title && <p className="tw:mt-1 tw:text-[11px] tw:text-red-500">{errors.title}</p>}
          </div>

          {/* Type */}
          <div>
            <label className="tw:mb-1.5 tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">Type</label>
            <div className="tw:flex tw:gap-2">
              {(['TEXT', 'VIDEO_URL'] as LessonType[]).map(t => (
                <button
                  key={t}
                  type="button"
                  aria-label={t === 'TEXT' ? 'Text type' : 'Video URL type'}
                  onClick={() => setField('type', t)}
                  className={
                    'tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:border tw:px-3 tw:py-1.5 tw:text-[12px] tw:font-medium tw:transition-colors' +
                    (form.type === t
                      ? ' tw:border-blue-400 tw:bg-blue-50 tw:text-blue-700'
                      : ' tw:border-slate-200 tw:text-slate-500 tw:hover:border-slate-300 tw:hover:text-slate-700')
                  }
                >
                  {t === 'TEXT'
                    ? <><BookOpen className="tw:h-3.5 tw:w-3.5" strokeWidth={2} /> Text</>
                    : <><Video className="tw:h-3.5 tw:w-3.5" strokeWidth={2} /> Video URL</>}
                </button>
              ))}
            </div>
          </div>

          {/* Content — conditional on type */}
          {form.type === 'TEXT' ? (
            <div>
              <label className="tw:mb-1 tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">Content</label>
              <textarea
                aria-label="Lesson content"
                value={form.content}
                onChange={e => setField('content', e.target.value)}
                placeholder="Lesson content (optional)…"
                rows={6}
                maxLength={20000}
                className={
                  'tw:w-full tw:resize-y tw:rounded-lg tw:border tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:ring-2 focus:tw:ring-blue-100' +
                  (errors.content ? ' tw:border-red-300 tw:bg-red-50 focus:tw:border-red-400' : ' tw:border-slate-200 focus:tw:border-blue-400')
                }
              />
              <div className="tw:flex tw:justify-between tw:mt-0.5">
                {errors.content
                  ? <p className="tw:text-[11px] tw:text-red-500">{errors.content}</p>
                  : <span />}
                <span className="tw:text-[11px] tw:text-slate-400">{form.content.length}/20000</span>
              </div>
            </div>
          ) : (
            <>
              {/* Video input mode tabs — URL or File Upload */}
              <div>
                <div className="tw:mb-2 tw:flex tw:gap-1">
                  <button
                    type="button"
                    onClick={() => setVideoInputMode('url')}
                    className={
                      'tw:flex tw:items-center tw:gap-1.5 tw:rounded-md tw:border tw:px-3 tw:py-1.5 tw:text-[12px] tw:font-medium tw:transition-colors' +
                      (videoInputMode === 'url'
                        ? ' tw:border-blue-400 tw:bg-blue-50 tw:text-blue-700'
                        : ' tw:border-slate-200 tw:text-slate-500 tw:hover:border-slate-300')
                    }
                  >
                    <Link className="tw:h-3.5 tw:w-3.5" strokeWidth={2} /> Paste URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoInputMode('file')}
                    className={
                      'tw:flex tw:items-center tw:gap-1.5 tw:rounded-md tw:border tw:px-3 tw:py-1.5 tw:text-[12px] tw:font-medium tw:transition-colors' +
                      (videoInputMode === 'file'
                        ? ' tw:border-violet-400 tw:bg-violet-50 tw:text-violet-700'
                        : ' tw:border-slate-200 tw:text-slate-500 tw:hover:border-slate-300')
                    }
                  >
                    <Video className="tw:h-3.5 tw:w-3.5" strokeWidth={2} /> Upload File
                  </button>
                </div>

                {videoInputMode === 'url' ? (
                  <>
                    <label className="tw:mb-1 tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">
                      Video URL <span className="tw:text-red-500">*</span>
                    </label>
                    <input
                      aria-label="Video URL"
                      type="url"
                      value={form.content}
                      onChange={e => setField('content', e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=…"
                      maxLength={2000}
                      className={
                        'tw:w-full tw:rounded-lg tw:border tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:ring-2 focus:tw:ring-blue-100' +
                        (errors.content ? ' tw:border-red-300 tw:bg-red-50 focus:tw:border-red-400' : ' tw:border-slate-200 focus:tw:border-blue-400')
                      }
                    />
                    {errors.content && <p className="tw:mt-1 tw:text-[11px] tw:text-red-500">{errors.content}</p>}
                    <p className="tw:mt-1 tw:text-[11px] tw:text-slate-400">Paste any http/https URL — YouTube, Vimeo, etc.</p>
                  </>
                ) : (
                  <VideoUpload
                    courseId={courseId}
                    lessonId={lessonId}
                    disabled={uploadNeedsSave
                      ? 'Save the lesson as Video URL type first, then you can upload a file.'
                      : undefined}
                    onChange={(url) => setField('content', url)}
                    onUploadingChange={setIsVideoUploading}
                  />
                )}
              </div>

              <div>
                <label className="tw:mb-1 tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">
                  Duration <span className="tw:text-slate-400 tw:font-normal">(minutes, optional)</span>
                </label>
                <input
                  aria-label="Duration in minutes"
                  type="number"
                  min={0}
                  max={100000}
                  step={1}
                  value={form.durationStr}
                  onChange={e => setField('durationStr', e.target.value)}
                  placeholder="e.g. 15"
                  className={
                    'tw:w-32 tw:rounded-lg tw:border tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:ring-2 focus:tw:ring-blue-100' +
                    (errors.duration ? ' tw:border-red-300 tw:bg-red-50 focus:tw:border-red-400' : ' tw:border-slate-200 focus:tw:border-blue-400')
                  }
                />
                {errors.duration && <p className="tw:mt-1 tw:text-[11px] tw:text-red-500">{errors.duration}</p>}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="tw:flex tw:justify-end tw:gap-2 tw:border-t tw:border-slate-100 tw:px-5 tw:py-3.5 tw:flex-shrink-0">
          <button type="button" onClick={onClose} disabled={saving}
            className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50 tw:disabled:opacity-40">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || isVideoUploading}
            title={isVideoUploading ? 'Wait for the upload to complete' : undefined}
            className="tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700 tw:disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Lesson'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CourseBuilder({ courseId, onBack, onNext }: Props) {
  const navigate = useNavigate();

  const [sections,   setSections]   = useState<CourseSection[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [busy,       setBusy]       = useState(false);
  const [toast,      setToast]      = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Section — add inline
  const [addingSection,   setAddingSection]   = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [addSectionErr,   setAddSectionErr]   = useState<string | null>(null);
  const [addSectionBusy,  setAddSectionBusy]  = useState(false);

  // Section — edit inline
  const [editSectionId,    setEditSectionId]    = useState<string | null>(null);
  const [editSectionTitle, setEditSectionTitle] = useState('');
  const [editSectionErr,   setEditSectionErr]   = useState<string | null>(null);

  // Lesson modal
  const [lessonModal, setLessonModal] = useState<LessonModal | null>(null);

  function showToast(type: ToastState['type'], message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 3500);
  }

  // ── Load ────────────────────────────────────────────────────────────────────

  const loadSections = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await getSections(courseId);
      setSections(
        data
          .sort((a, b) => a.order - b.order)
          .map(s => ({ ...s, lessons: [...s.lessons].sort((a, b) => a.order - b.order) })),
      );
    } catch (err) {
      if (err instanceof CourseBuilderApiError && err.status === 401) { navigate('/login'); return; }
      setFetchError(err instanceof Error ? err.message : 'Failed to load sections.');
    } finally {
      setLoading(false);
    }
  }, [courseId, navigate]);

  useEffect(() => { loadSections(); }, [loadSections]);

  // ── Section — add ───────────────────────────────────────────────────────────

  async function handleAddSection() {
    const title = newSectionTitle.trim();
    if (!title)          { setAddSectionErr('Title is required.');              return; }
    if (title.length > 200) { setAddSectionErr('Title must be ≤ 200 characters.'); return; }
    setAddSectionBusy(true);
    setAddSectionErr(null);
    try {
      await createSection(courseId, { title });
      invalidateFor(appQueryClient, 'section.create', { courseId });
      setAddingSection(false);
      setNewSectionTitle('');
      showToast('success', `Section "${title}" added.`);
      await loadSections();
    } catch (err) {
      if (err instanceof CourseBuilderApiError && err.status === 401) { navigate('/login'); return; }
      setAddSectionErr(err instanceof Error ? err.message : 'Failed to add section.');
    } finally {
      setAddSectionBusy(false);
    }
  }

  // ── Section — edit ──────────────────────────────────────────────────────────

  function startEditSection(section: CourseSection) {
    setEditSectionId(section.id);
    setEditSectionTitle(section.title);
    setEditSectionErr(null);
  }

  async function commitEditSection(section: CourseSection) {
    const title = editSectionTitle.trim();
    if (!title)             { setEditSectionErr('Title is required.');              return; }
    if (title.length > 200) { setEditSectionErr('Title must be ≤ 200 characters.'); return; }
    if (title === section.title) { setEditSectionId(null); return; }
    setBusy(true);
    try {
      await updateSection(section.id, { title });
      invalidateFor(appQueryClient, 'section.update', { courseId });
      setEditSectionId(null);
      await loadSections();
    } catch (err) {
      if (err instanceof CourseBuilderApiError && err.status === 401) { navigate('/login'); return; }
      setEditSectionErr(err instanceof Error ? err.message : 'Failed to update section.');
    } finally {
      setBusy(false);
    }
  }

  function cancelEditSection() { setEditSectionId(null); setEditSectionErr(null); }

  // ── Section — delete ────────────────────────────────────────────────────────

  async function handleDeleteSection(section: CourseSection) {
    const n = section.lessons.length;
    const msg = n > 0
      ? `Delete "${section.title}" and its ${n} lesson${n !== 1 ? 's' : ''}? This cannot be undone.`
      : `Delete "${section.title}"? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await deleteSection(section.id);
      invalidateFor(appQueryClient, 'section.delete', { courseId });
      showToast('success', `Section "${section.title}" deleted.`);
      await loadSections();
    } catch (err) {
      if (err instanceof CourseBuilderApiError && err.status === 401) { navigate('/login'); return; }
      showToast('error', err instanceof Error ? err.message : 'Failed to delete section.');
    } finally {
      setBusy(false);
    }
  }

  // ── Lesson — saved (create or update) ──────────────────────────────────────

  async function handleLessonSaved(mutationName: 'lesson.create' | 'lesson.update', cId: string) {
    invalidateFor(appQueryClient, mutationName, { courseId: cId });
    showToast('success', mutationName === 'lesson.create' ? 'Lesson added.' : 'Lesson updated.');
    setLessonModal(null);
    await loadSections();
  }

  // Called after a type-change-only save (TEXT→VIDEO_URL in upload-file mode).
  // The modal stays open; reload the section tree to reflect the new type.
  async function handleLessonPartialSave() {
    showToast('success', 'Lesson type saved — you can now upload a video file.');
    await loadSections();
  }

  // ── Lesson — delete ─────────────────────────────────────────────────────────

  async function handleDeleteLesson(lesson: Lesson) {
    if (!window.confirm(`Delete "${lesson.title}"? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteLesson(lesson.id);
      invalidateFor(appQueryClient, 'lesson.delete', { courseId });
      showToast('success', `"${lesson.title}" deleted.`);
      await loadSections();
    } catch (err) {
      if (err instanceof CourseBuilderApiError && err.status === 401) { navigate('/login'); return; }
      showToast('error', err instanceof Error ? err.message : 'Failed to delete lesson.');
    } finally {
      setBusy(false);
    }
  }

  // ── Reorder — ONE bulk call ─────────────────────────────────────────────────

  async function sendReorder(newSections: CourseSection[]) {
    const payload = {
      sections: newSections.map((s, i) => ({ id: s.id, order: i + 1 })),
      lessons:  newSections.flatMap(s =>
        s.lessons.map((l, i) => ({ id: l.id, sectionId: s.id, order: i + 1 })),
      ),
    };
    try {
      const updated = await reorderSections(courseId, payload);
      invalidateFor(appQueryClient, 'sections.reorder', { courseId });
      setSections(
        updated
          .sort((a, b) => a.order - b.order)
          .map(s => ({ ...s, lessons: [...s.lessons].sort((a, b) => a.order - b.order) })),
      );
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Reorder failed.');
      await loadSections();
    }
  }

  function moveSection(idx: number, dir: 'up' | 'down') {
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    [next[idx], next[target]] = [next[target], next[idx]];
    setSections(next);
    sendReorder(next);
  }

  function moveLesson(sectionId: string, lessonIdx: number, dir: 'up' | 'down') {
    const next = sections.map(s => {
      if (s.id !== sectionId) return s;
      const target = dir === 'up' ? lessonIdx - 1 : lessonIdx + 1;
      if (target < 0 || target >= s.lessons.length) return s;
      const ls = [...s.lessons];
      [ls[lessonIdx], ls[target]] = [ls[target], ls[lessonIdx]];
      return { ...s, lessons: ls };
    });
    setSections(next);
    sendReorder(next);
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">

      {/* Header */}
      <div className="tw:flex tw:items-center tw:justify-between">
        <div className="tw:flex tw:items-center tw:gap-3">
          <button type="button" onClick={onBack}
            className="tw:flex tw:items-center tw:gap-1 tw:text-[13px] tw:font-medium tw:text-slate-500 tw:hover:text-slate-700">
            <ChevronLeft className="tw:h-4 tw:w-4" strokeWidth={2} />
            Back
          </button>
          <div>
            <h2 className="tw:m-0 tw:text-[17px] tw:font-semibold tw:text-slate-900">Course Builder</h2>
            <p className="tw:m-0 tw:text-[11px] tw:text-slate-400">Step 2 — Sections &amp; Lessons</p>
          </div>
        </div>
        <div className="tw:flex tw:items-center tw:gap-2">
          <span className="tw:rounded-full tw:bg-blue-50 tw:px-3 tw:py-1 tw:text-[11px] tw:font-semibold tw:text-blue-700">
            {sections.length} section{sections.length !== 1 ? 's' : ''}
            {' · '}
            {sections.reduce((n, s) => n + s.lessons.length, 0)} lesson{sections.reduce((n, s) => n + s.lessons.length, 0) !== 1 ? 's' : ''}
          </span>
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              aria-label="Next: Settings"
              className="tw:flex tw:items-center tw:gap-1 tw:rounded-lg tw:bg-blue-600 tw:px-3.5 tw:py-1.5 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700"
            >
              Next: Settings
              <ChevronRight className="tw:h-4 tw:w-4" strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && <BuilderSkeleton />}

      {/* Error */}
      {!loading && fetchError && (
        <div className="tw:rounded-xl tw:border tw:border-red-100 tw:bg-red-50 tw:p-5 tw:text-center">
          <p className="tw:text-[13px] tw:text-red-500">{fetchError}</p>
          <button type="button" onClick={loadSections}
            className="tw:mt-2 tw:text-[13px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !fetchError && sections.length === 0 && !addingSection && (
        <div className="tw:rounded-xl tw:border tw:border-dashed tw:border-slate-300 tw:bg-white tw:p-10 tw:text-center">
          <BookOpen className="tw:mx-auto tw:mb-3 tw:h-8 tw:w-8 tw:text-slate-300" strokeWidth={1.5} />
          <p className="tw:text-[14px] tw:font-semibold tw:text-slate-500">No sections yet</p>
          <p className="tw:mt-1 tw:text-[13px] tw:text-slate-400">Add a section to start organising your course.</p>
          <button type="button" onClick={() => setAddingSection(true)}
            className="tw:mt-4 tw:inline-flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700">
            <Plus className="tw:h-4 tw:w-4" strokeWidth={2.5} /> Add Section
          </button>
        </div>
      )}

      {/* Section list */}
      {!loading && !fetchError && sections.length > 0 && (
        <div className="tw:flex tw:flex-col tw:gap-3">
          {sections.map((section, sIdx) => {
            const isEditingThis = editSectionId === section.id;
            return (
              <div key={section.id}
                className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white">

                {/* Section header */}
                <div className="tw:flex tw:items-center tw:gap-2 tw:border-b tw:border-slate-100 tw:bg-slate-50 tw:px-4 tw:py-3">
                  <span className="tw:flex-shrink-0 tw:flex tw:h-5 tw:w-5 tw:items-center tw:justify-center tw:rounded-full tw:bg-slate-200 tw:text-[10px] tw:font-bold tw:text-slate-600">
                    {sIdx + 1}
                  </span>

                  {/* Up / Down */}
                  <div className="tw:flex tw:gap-0.5 tw:flex-shrink-0">
                    <button type="button" disabled={sIdx === 0 || busy}
                      onClick={() => moveSection(sIdx, 'up')}
                      aria-label="Move section up"
                      className="tw:rounded tw:p-0.5 tw:text-slate-400 tw:hover:bg-slate-200 tw:hover:text-slate-700 tw:disabled:opacity-30">
                      <ChevronUp className="tw:h-3.5 tw:w-3.5" strokeWidth={2.5} />
                    </button>
                    <button type="button" disabled={sIdx === sections.length - 1 || busy}
                      onClick={() => moveSection(sIdx, 'down')}
                      aria-label="Move section down"
                      className="tw:rounded tw:p-0.5 tw:text-slate-400 tw:hover:bg-slate-200 tw:hover:text-slate-700 tw:disabled:opacity-30">
                      <ChevronDown className="tw:h-3.5 tw:w-3.5" strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* Title — inline edit */}
                  {isEditingThis ? (
                    <div className="tw:flex tw:flex-1 tw:items-center tw:gap-2">
                      <input
                        type="text"
                        value={editSectionTitle}
                        onChange={e => { setEditSectionTitle(e.target.value); setEditSectionErr(null); }}
                        onKeyDown={e => {
                          if (e.key === 'Enter')  commitEditSection(section);
                          if (e.key === 'Escape') cancelEditSection();
                        }}
                        maxLength={200}
                        autoFocus
                        aria-label="Section title input"
                        className="tw:flex-1 tw:rounded-md tw:border tw:border-blue-300 tw:bg-white tw:px-2 tw:py-1 tw:text-[13px] tw:font-semibold tw:text-slate-900 tw:outline-none focus:tw:ring-2 focus:tw:ring-blue-100"
                      />
                      <button type="button" onClick={() => commitEditSection(section)} disabled={busy}
                        aria-label="Confirm section title"
                        className="tw:rounded tw:p-1 tw:text-green-600 tw:hover:bg-green-50 tw:disabled:opacity-40">
                        <Check className="tw:h-4 tw:w-4" strokeWidth={2.5} />
                      </button>
                      <button type="button" onClick={cancelEditSection}
                        aria-label="Cancel edit"
                        className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-slate-100">
                        <X className="tw:h-4 tw:w-4" strokeWidth={2.5} />
                      </button>
                    </div>
                  ) : (
                    <span className="tw:flex-1 tw:text-[13px] tw:font-semibold tw:text-slate-900 tw:truncate">
                      {section.title}
                    </span>
                  )}

                  {editSectionErr && (
                    <span className="tw:text-[11px] tw:text-red-500">{editSectionErr}</span>
                  )}

                  {/* Section actions */}
                  {!isEditingThis && (
                    <div className="tw:flex tw:items-center tw:gap-1 tw:flex-shrink-0">
                      <button type="button" onClick={() => startEditSection(section)} disabled={busy}
                        aria-label={`Edit section ${section.title}`}
                        className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-slate-100 tw:hover:text-blue-600 tw:disabled:opacity-40">
                        <Pencil className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
                      </button>
                      <button type="button" onClick={() => handleDeleteSection(section)} disabled={busy}
                        aria-label={`Delete section ${section.title}`}
                        className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-red-50 tw:hover:text-red-500 tw:disabled:opacity-40">
                        <Trash2 className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Lesson list */}
                <div className="tw:px-4 tw:py-2">
                  {section.lessons.length === 0 && (
                    <p className="tw:py-2 tw:text-[12px] tw:text-slate-400 tw:italic">No lessons yet.</p>
                  )}
                  {section.lessons.map((lesson, lIdx) => (
                    <div key={lesson.id}
                      className="tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:px-2 tw:py-2 tw:hover:bg-slate-50">

                      <div className="tw:flex tw:gap-0.5 tw:flex-shrink-0">
                        <button type="button" disabled={lIdx === 0 || busy}
                          onClick={() => moveLesson(section.id, lIdx, 'up')}
                          aria-label="Move lesson up"
                          className="tw:rounded tw:p-0.5 tw:text-slate-300 tw:hover:bg-slate-200 tw:hover:text-slate-600 tw:disabled:opacity-30">
                          <ChevronUp className="tw:h-3 tw:w-3" strokeWidth={2.5} />
                        </button>
                        <button type="button" disabled={lIdx === section.lessons.length - 1 || busy}
                          onClick={() => moveLesson(section.id, lIdx, 'down')}
                          aria-label="Move lesson down"
                          className="tw:rounded tw:p-0.5 tw:text-slate-300 tw:hover:bg-slate-200 tw:hover:text-slate-600 tw:disabled:opacity-30">
                          <ChevronDown className="tw:h-3 tw:w-3" strokeWidth={2.5} />
                        </button>
                      </div>

                      <TypeBadge type={lesson.type} />

                      <span className="tw:flex-1 tw:text-[13px] tw:text-slate-800 tw:truncate">
                        {lesson.title}
                      </span>

                      {lesson.durationMin != null && (
                        <span className="tw:text-[11px] tw:text-slate-400 tw:flex-shrink-0">
                          {lesson.durationMin} min
                        </span>
                      )}

                      <div className="tw:flex tw:items-center tw:gap-0.5 tw:flex-shrink-0">
                        <button type="button" disabled={busy}
                          onClick={() => setLessonModal({ mode: 'edit', lesson, sectionId: section.id })}
                          aria-label={`Edit lesson ${lesson.title}`}
                          className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-slate-100 tw:hover:text-blue-600 tw:disabled:opacity-40">
                          <Pencil className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
                        </button>
                        <button type="button" disabled={busy}
                          onClick={() => handleDeleteLesson(lesson)}
                          aria-label={`Delete lesson ${lesson.title}`}
                          className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-red-50 tw:hover:text-red-500 tw:disabled:opacity-40">
                          <Trash2 className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* + Add Lesson */}
                  <button type="button" disabled={busy}
                    onClick={() => setLessonModal({ mode: 'create', sectionId: section.id })}
                    aria-label={`Add lesson to ${section.title}`}
                    className="tw:mt-1 tw:mb-1 tw:flex tw:items-center tw:gap-1 tw:rounded-md tw:px-2 tw:py-1.5 tw:text-[12px] tw:font-medium tw:text-blue-600 tw:hover:bg-blue-50 tw:disabled:opacity-40">
                    <Plus className="tw:h-3.5 tw:w-3.5" strokeWidth={2.5} /> Add Lesson
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Section inline form / button */}
      {addingSection ? (
        <div className="tw:rounded-xl tw:border tw:border-blue-200 tw:bg-blue-50 tw:p-4">
          <p className="tw:mb-2 tw:text-[12px] tw:font-semibold tw:text-blue-700">New Section</p>
          <div className="tw:flex tw:gap-2">
            <input
              type="text"
              value={newSectionTitle}
              onChange={e => { setNewSectionTitle(e.target.value); setAddSectionErr(null); }}
              onKeyDown={e => {
                if (e.key === 'Enter')  handleAddSection();
                if (e.key === 'Escape') { setAddingSection(false); setNewSectionTitle(''); setAddSectionErr(null); }
              }}
              placeholder="Section title…"
              maxLength={200}
              autoFocus
              aria-label="New section title"
              className="tw:flex-1 tw:rounded-lg tw:border tw:border-blue-300 tw:bg-white tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:ring-2 focus:tw:ring-blue-100"
            />
            <button type="button" onClick={handleAddSection} disabled={addSectionBusy}
              className="tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700 tw:disabled:opacity-50">
              {addSectionBusy ? 'Adding…' : 'Add'}
            </button>
            <button type="button"
              onClick={() => { setAddingSection(false); setNewSectionTitle(''); setAddSectionErr(null); }}
              className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-500 tw:hover:bg-slate-50">
              Cancel
            </button>
          </div>
          {addSectionErr && <p className="tw:mt-1 tw:text-[12px] tw:text-red-500">{addSectionErr}</p>}
        </div>
      ) : (
        !loading && !fetchError && (
          <button type="button" onClick={() => setAddingSection(true)} disabled={busy}
            className="tw:flex tw:items-center tw:justify-center tw:gap-1.5 tw:rounded-xl tw:border tw:border-dashed tw:border-slate-300 tw:py-3 tw:text-[13px] tw:font-medium tw:text-slate-500 tw:hover:border-blue-300 tw:hover:bg-blue-50 tw:hover:text-blue-600 tw:disabled:opacity-40 tw:transition-colors">
            <Plus className="tw:h-4 tw:w-4" strokeWidth={2.5} /> Add Section
          </button>
        )
      )}

      {/* Lesson form modal */}
      {lessonModal && (
        <LessonFormModal
          modal={lessonModal}
          courseId={courseId}
          onClose={() => setLessonModal(null)}
          onSaved={handleLessonSaved}
          onPartialSave={handleLessonPartialSave}
        />
      )}

      {toast && <ToastBanner {...toast} />}
    </div>
  );
}
