import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import InstructorLayout from './InstructorLayout';
import InstructorThumbnailUpload from './InstructorThumbnailUpload';
import InstructorVideoUpload from './InstructorVideoUpload';
import InstructorQuizStep from './InstructorQuizStep';
import InstructorSettingsStep from './InstructorSettingsStep';
import InstructorPreviewStep from './InstructorPreviewStep';
import { LABEL, INPUT, BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, ERROR_BANNER, disabledStyle, statusBadgeStyle } from './instructorUiKit';
import {
  getMyCourse, updateMyCourse, submitMyCourse,
  listMySections, createMySection, updateMySection, deleteMySection,
  createMyLesson, updateMyLesson, deleteMyLesson,
  reorderMyCourse,
} from '../../api/instructorCoursesApi';
import { CourseApiError, type CourseDetail } from '../../types/courses';
import type { CourseSection, Lesson, LessonType } from '../../types/courseBuilder';

// Full-parity multi-step Course Wizard, mirroring admin's Course Wizard
// (components/learningManagement/CoursesTab.tsx view machine: Basic Info ->
// Content -> Settings -> Preview -> Submit). A Quiz step is inserted between
// Content and Settings — admin itself manages quizzes from a separate
// "Assessments" tab rather than inside its own Course Builder wizard (see
// InstructorQuizStep.tsx header comment), but the instructor portal has no
// equivalent standalone tab, so this is the only place an instructor can
// attach one. Unlike admin's wizard, every step is reachable directly via
// the tab strip below (never gated) — courseId always exists by the time
// this page loads (created from the My Courses list), so there is no
// "save draft first" ordering constraint to enforce between steps.

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

type StepKey = 'basic' | 'content' | 'quiz' | 'settings' | 'preview' | 'submit';
const STEPS: { key: StepKey; label: string }[] = [
  { key: 'basic', label: '1. Basic Info' },
  { key: 'content', label: '2. Content' },
  { key: 'quiz', label: '3. Quiz' },
  { key: 'settings', label: '4. Settings' },
  { key: 'preview', label: '5. Preview' },
  { key: 'submit', label: '6. Submit' },
];

export default function InstructorCourseBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<StepKey>('basic');

  const load = () => {
    if (!id) return;
    setLoading(true);
    getMyCourse(id)
      .then((c) => { setCourse(c); setError(null); })
      .catch((err: unknown) => setError(err instanceof CourseApiError ? err.message : 'Failed to load course.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  if (!id) return null;

  return (
    <InstructorLayout>
      <div className="mn-db-welcome">
        <div>
          <h1 className="mn-db-welcome-title">
            {course?.title ?? 'Course Builder'}
            {course && (
              <span style={{ marginLeft: 10, verticalAlign: 'middle' }}>
                <span style={statusBadgeStyle(course.isRejected ? 'Rejected' : course.status)}>
                  {course.isRejected ? 'REJECTED' : course.status.toUpperCase()}
                </span>
              </span>
            )}
          </h1>
          <p className="mn-db-welcome-sub">Basic Info · Content · Quiz · Settings · Preview · Submit</p>
        </div>
        <button type="button" style={BTN_SECONDARY} onClick={() => navigate('/instructor/courses')}>← Back to My Courses</button>
      </div>

      {error && <div style={{ ...ERROR_BANNER, marginBottom: 14 }}>{error}</div>}

      {loading || !course ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="mn-spinner" /></div>
      ) : (
        <>
          {course.isRejected && course.rejectionReason && (
            <div style={{ ...ERROR_BANNER, marginBottom: 14 }}>
              <strong>Rejected by admin:</strong> {course.rejectionReason}
            </div>
          )}

          {/* Step tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
            {STEPS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStep(s.key)}
                style={{
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  background: 'none',
                  border: 'none',
                  borderBottom: step === s.key ? '2px solid #2563eb' : '2px solid transparent',
                  color: step === s.key ? '#2563eb' : '#64748b',
                  cursor: 'pointer',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          {step === 'basic' && <BasicInfoStep course={course} onSaved={(c) => setCourse(c)} onNext={() => setStep('content')} />}
          {step === 'content' && <ContentStep courseId={id} onBack={() => setStep('basic')} onNext={() => setStep('quiz')} />}
          {step === 'quiz' && <InstructorQuizStep courseId={id} onBack={() => setStep('content')} onNext={() => setStep('settings')} />}
          {step === 'settings' && <InstructorSettingsStep courseId={id} onBack={() => setStep('quiz')} onNext={() => setStep('preview')} />}
          {step === 'preview' && <InstructorPreviewStep courseId={id} onBack={() => setStep('settings')} onNext={() => setStep('submit')} />}
          {step === 'submit' && <SubmitStep course={course} onBack={() => setStep('preview')} onSubmitted={() => navigate('/instructor/courses')} />}
        </>
      )}
    </InstructorLayout>
  );
}

// ── Step 1: Basic Info ───────────────────────────────────────────────────────

function BasicInfoStep({ course, onSaved, onNext }: { course: CourseDetail; onSaved: (c: CourseDetail) => void; onNext: () => void }) {
  const [title, setTitle] = useState(course.title);
  const [description, setDescription] = useState(course.description ?? '');
  const [category, setCategory] = useState(course.category ?? '');
  const [thumbnail, setThumbnail] = useState(course.thumbnail ?? '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSave(): Promise<boolean> {
    setSaving(true);
    setMsg(null);
    try {
      const updated = await updateMyCourse(course.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
        thumbnail: thumbnail.trim() || null,
      });
      onSaved(updated);
      setMsg('Saved.');
      return true;
    } catch (err) {
      setMsg(err instanceof CourseApiError ? err.message : 'Save failed.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mn-db-card">
        <div className="mn-db-card-header"><div className="mn-db-card-title">Basic Info</div></div>
        {msg && msg !== 'Saved.' && <div style={{ ...ERROR_BANNER, marginBottom: 12 }}>{msg}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={LABEL}>Title</label>
            <input style={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={LABEL}>Description</label>
            <textarea style={{ ...INPUT, resize: 'vertical' }} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={5000} />
          </div>
          <div>
            <label style={LABEL}>Category</label>
            <input style={INPUT} value={category} onChange={(e) => setCategory(e.target.value)} maxLength={100} placeholder="e.g. Web Development" />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={LABEL}>Thumbnail</label>
            <InstructorThumbnailUpload courseId={course.id} initialUrl={thumbnail || undefined} onChange={setThumbnail} />
          </div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" style={disabledStyle(BTN_SECONDARY, saving)} disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {msg === 'Saved.' && <span style={{ fontSize: 12, color: '#15803d' }}>Saved.</span>}
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" style={BTN_PRIMARY} onClick={async () => { if (await handleSave()) onNext(); }}>Next: Content →</button>
      </div>
    </div>
  );
}

// ── Step 2: Content (sections & lessons) ─────────────────────────────────────

function ContentStep({ courseId, onBack, onNext }: { courseId: string; onBack: () => void; onNext: () => void }) {
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [lessonModal, setLessonModal] = useState<{ sectionId: string; lesson: Lesson | null } | null>(null);

  const load = () => {
    setLoading(true);
    listMySections(courseId)
      .then((s) => setSections(s))
      .catch((err) => alert(err instanceof CourseApiError ? err.message : 'Failed to load sections.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [courseId]);

  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) return;
    try {
      await createMySection(courseId, newSectionTitle.trim());
      setNewSectionTitle('');
      load();
    } catch (err) {
      alert(err instanceof CourseApiError ? err.message : 'Failed to add section.');
    }
  };

  const handleRenameSection = async (section: CourseSection, newTitle: string) => {
    if (!newTitle.trim() || newTitle === section.title) return;
    try {
      await updateMySection(courseId, section.id, { title: newTitle.trim() });
      load();
    } catch (err) {
      alert(err instanceof CourseApiError ? err.message : 'Rename failed.');
    }
  };

  const handleDeleteSection = async (section: CourseSection) => {
    if (!confirm(`Delete section "${section.title}"? This removes its ${section.lessons.length} lesson(s) too.`)) return;
    try {
      await deleteMySection(courseId, section.id);
      load();
    } catch (err) {
      alert(err instanceof CourseApiError ? err.message : 'Delete failed.');
    }
  };

  const moveSection = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    const reordered = [...sections];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    try {
      await reorderMyCourse(courseId, { sections: reordered.map((s, i) => ({ id: s.id, order: i })) });
      load();
    } catch (err) {
      alert(err instanceof CourseApiError ? err.message : 'Reorder failed.');
    }
  };

  const moveLesson = async (section: CourseSection, index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= section.lessons.length) return;
    const reordered = [...section.lessons];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    try {
      await reorderMyCourse(courseId, { lessons: reordered.map((l, i) => ({ id: l.id, sectionId: section.id, order: i })) });
      load();
    } catch (err) {
      alert(err instanceof CourseApiError ? err.message : 'Reorder failed.');
    }
  };

  const handleDeleteLesson = async (section: CourseSection, lesson: Lesson) => {
    if (!confirm(`Delete lesson "${lesson.title}"?`)) return;
    try {
      await deleteMyLesson(courseId, section.id, lesson.id);
      load();
    } catch (err) {
      alert(err instanceof CourseApiError ? err.message : 'Delete failed.');
    }
  };

  return (
    <div>
      <div className="mn-db-card">
        <div className="mn-db-card-header"><div className="mn-db-card-title">Sections & Lessons</div></div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><div className="mn-spinner" /></div>
        ) : (
          <>
            {sections.length === 0 && (
              <p style={{ fontSize: 12, color: '#94a3b8', padding: '10px 0' }}>No sections yet — add one below.</p>
            )}

            {sections.map((section, sIdx) => (
              <div key={section.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button type="button" title="Move up" disabled={sIdx === 0} onClick={() => moveSection(sIdx, -1)} style={{ background: 'none', border: 'none', cursor: sIdx === 0 ? 'default' : 'pointer', opacity: sIdx === 0 ? 0.3 : 1, fontSize: 11, lineHeight: 1 }}>▲</button>
                    <button type="button" title="Move down" disabled={sIdx === sections.length - 1} onClick={() => moveSection(sIdx, 1)} style={{ background: 'none', border: 'none', cursor: sIdx === sections.length - 1 ? 'default' : 'pointer', opacity: sIdx === sections.length - 1 ? 0.3 : 1, fontSize: 11, lineHeight: 1 }}>▼</button>
                  </div>
                  <input
                    defaultValue={section.title}
                    onBlur={(e) => handleRenameSection(section, e.target.value)}
                    style={{ ...INPUT, flex: 1, fontWeight: 600, background: 'transparent', border: '1px solid transparent' }}
                    onFocus={(e) => { e.target.style.border = '1px solid #e5e7eb'; e.target.style.background = '#fff'; }}
                  />
                  <button type="button" style={BTN_SECONDARY} onClick={() => setLessonModal({ sectionId: section.id, lesson: null })}>+ Add Lesson</button>
                  <button type="button" style={BTN_DANGER} onClick={() => handleDeleteSection(section)}>Delete</button>
                </div>

                {section.lessons.length === 0 ? (
                  <p style={{ fontSize: 12, color: '#94a3b8', padding: '10px 14px' }}>No lessons in this section yet.</p>
                ) : (
                  <div>
                    {section.lessons.map((lesson, lIdx) => (
                      <div key={lesson.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: lIdx < section.lessons.length - 1 ? '1px solid #f1f5f9' : undefined }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <button type="button" title="Move up" disabled={lIdx === 0} onClick={() => moveLesson(section, lIdx, -1)} style={{ background: 'none', border: 'none', cursor: lIdx === 0 ? 'default' : 'pointer', opacity: lIdx === 0 ? 0.3 : 1, fontSize: 10, lineHeight: 1 }}>▲</button>
                          <button type="button" title="Move down" disabled={lIdx === section.lessons.length - 1} onClick={() => moveLesson(section, lIdx, 1)} style={{ background: 'none', border: 'none', cursor: lIdx === section.lessons.length - 1 ? 'default' : 'pointer', opacity: lIdx === section.lessons.length - 1 ? 0.3 : 1, fontSize: 10, lineHeight: 1 }}>▼</button>
                        </div>
                        <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: lesson.type === 'TEXT' ? '#eef2ff' : '#fce7f3', color: lesson.type === 'TEXT' ? '#4338ca' : '#be185d' }}>
                          {lesson.type === 'TEXT' ? 'TEXT' : 'VIDEO'}
                        </span>
                        <span style={{ flex: 1, fontSize: 12, color: '#374151' }}>{lesson.title}</span>
                        {lesson.durationMin != null && <span style={{ fontSize: 11, color: '#94a3b8' }}>{lesson.durationMin} min</span>}
                        <button type="button" style={{ ...BTN_SECONDARY, padding: '4px 10px' }} onClick={() => setLessonModal({ sectionId: section.id, lesson })}>Edit</button>
                        <button type="button" style={{ ...BTN_DANGER, padding: '4px 10px' }} onClick={() => handleDeleteLesson(section, lesson)}>Delete</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input
                style={{ ...INPUT, maxWidth: 320 }}
                placeholder="New section title…"
                value={newSectionTitle}
                onChange={(e) => setNewSectionTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddSection(); }}
              />
              <button type="button" style={BTN_SECONDARY} onClick={handleAddSection}>+ Add Section</button>
            </div>
          </>
        )}
      </div>

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" style={BTN_SECONDARY} onClick={onBack}>← Back: Basic Info</button>
        <button type="button" style={BTN_PRIMARY} onClick={onNext}>Next: Quiz →</button>
      </div>

      {lessonModal && (
        <LessonModal
          courseId={courseId}
          sectionId={lessonModal.sectionId}
          lesson={lessonModal.lesson}
          onClose={() => setLessonModal(null)}
          onSaved={() => { setLessonModal(null); load(); }}
        />
      )}
    </div>
  );
}

function LessonModal({ courseId, sectionId, lesson, onClose, onSaved }: {
  courseId: string; sectionId: string; lesson: Lesson | null; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(lesson?.title ?? '');
  const [type, setType] = useState<LessonType>(lesson?.type ?? 'TEXT');
  const [content, setContent] = useState(lesson?.content ?? '');
  const [durationMin, setDurationMin] = useState<string>(lesson?.durationMin != null ? String(lesson.durationMin) : '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [videoMode, setVideoMode] = useState<'url' | 'file'>('url');
  const [isVideoUploading, setIsVideoUploading] = useState(false);

  // Mirrors admin's LessonFormModal: Upload File is only safe once the
  // lesson is actually saved as VIDEO_URL (upload needs a real lessonId, and
  // uploads.service verifies the target lesson IS a video lesson) — a brand
  // new lesson or one still saved as TEXT must save the type change first.
  const savedType = lesson?.type ?? 'TEXT';
  const uploadNeedsSave = type === 'VIDEO_URL' && savedType !== 'VIDEO_URL';

  const handleSave = async () => {
    if (!title.trim()) { setErr('Title is required.'); return; }
    const skipUrlCheck = !!lesson && type === 'VIDEO_URL' && videoMode === 'file';
    if (type === 'VIDEO_URL' && !skipUrlCheck && !content.trim()) { setErr('A video URL is required for a Video lesson.'); return; }
    setSaving(true);
    setErr(null);
    try {
      const trimmedContent = content.trim();
      const durationVal = durationMin ? Number(durationMin) : undefined;
      // Upload File mode: any stale text left in `content` (e.g. leftover TEXT
      // body, or a not-yet-valid URL) must NOT be sent as-is — null it out so the
      // lesson saves with pending content, then the upload pipeline fills it in.
      const videoUploadPending = type === 'VIDEO_URL' && videoMode === 'file' && !isValidUrl(trimmedContent);

      if (lesson) {
        await updateMyLesson(courseId, sectionId, lesson.id, {
          title: title.trim(),
          type,
          content: videoUploadPending ? null : (trimmedContent || null),
          durationMin: durationVal,
        });
      } else {
        await createMyLesson(courseId, sectionId, {
          title: title.trim(),
          type,
          ...(trimmedContent ? { content: trimmedContent } : {}),
          durationMin: durationVal,
        });
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof CourseApiError ? e.message : 'Save failed.');
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!saving ? onClose : undefined} />
      <div role="dialog" aria-label="Lesson" style={{ position: 'relative', width: '100%', maxWidth: 480, maxHeight: '88vh', overflowY: 'auto', background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>{lesson ? 'Edit Lesson' : 'Add Lesson'}</h3>
        </div>
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {err && <div style={ERROR_BANNER}>{err}</div>}
          <div>
            <label style={LABEL}>Title *</label>
            <input style={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus />
          </div>
          <div>
            <label style={LABEL}>Type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" style={type === 'TEXT' ? BTN_PRIMARY : BTN_SECONDARY} onClick={() => setType('TEXT')}>Text</button>
              <button type="button" style={type === 'VIDEO_URL' ? BTN_PRIMARY : BTN_SECONDARY} onClick={() => setType('VIDEO_URL')}>Video</button>
            </div>
          </div>
          {type === 'TEXT' ? (
            <div>
              <label style={LABEL}>Content</label>
              <textarea style={{ ...INPUT, resize: 'vertical' }} rows={5} value={content} onChange={(e) => setContent(e.target.value)} maxLength={20000} />
            </div>
          ) : (
            <>
              <div>
                <label style={LABEL}>Video source</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button type="button" style={videoMode === 'url' ? BTN_PRIMARY : BTN_SECONDARY} onClick={() => setVideoMode('url')}>Paste URL</button>
                  <button type="button" style={videoMode === 'file' ? BTN_PRIMARY : BTN_SECONDARY} onClick={() => setVideoMode('file')}>Upload File</button>
                </div>
                {videoMode === 'url' ? (
                  <>
                    <label style={LABEL}>Video URL *</label>
                    <input style={INPUT} value={content} onChange={(e) => setContent(e.target.value)} placeholder="https://…" maxLength={2000} />
                  </>
                ) : (
                  <InstructorVideoUpload
                    courseId={courseId}
                    lessonId={lesson?.id}
                    disabled={uploadNeedsSave ? 'Save the lesson as Video type first, then you can upload a file.' : undefined}
                    onChange={setContent}
                    onUploadingChange={setIsVideoUploading}
                  />
                )}
              </div>
            </>
          )}
          <div>
            <label style={LABEL}>Duration (minutes)</label>
            <input style={{ ...INPUT, maxWidth: 140 }} type="number" min={0} value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #f1f5f9' }}>
          <button type="button" style={BTN_SECONDARY} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" style={disabledStyle(BTN_PRIMARY, saving || isVideoUploading)} disabled={saving || isVideoUploading} onClick={handleSave}
            title={isVideoUploading ? 'Wait for the upload to complete' : undefined}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 6: Submit ────────────────────────────────────────────────────────────

function SubmitStep({ course, onBack, onSubmitted }: { course: CourseDetail; onBack: () => void; onSubmitted: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitErrors, setSubmitErrors] = useState<string[] | null>(null);

  const handleSubmit = async () => {
    if (!confirm('Submit this course for admin review?')) return;
    setSubmitting(true);
    setSubmitErrors(null);
    try {
      await submitMyCourse(course.id);
      onSubmitted();
    } catch (err) {
      if (err instanceof CourseApiError && err.errors?.length) {
        setSubmitErrors(err.errors);
      } else {
        setSubmitErrors([err instanceof CourseApiError ? err.message : 'Submit failed.']);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="mn-db-card">
        <div className="mn-db-card-header"><div className="mn-db-card-title">Submit for Review</div></div>
        {submitErrors && (
          <div style={{ ...ERROR_BANNER, marginBottom: 10 }}>
            <strong>Not ready to submit:</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {submitErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}
        {course.status === 'Draft' ? (
          <button type="button" style={disabledStyle(BTN_PRIMARY, submitting)} disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Submitting…' : 'Submit for Review'}
          </button>
        ) : (
          <p style={{ fontSize: 12, color: '#94a3b8' }}>
            Only Draft courses can be submitted — this course is {course.status}.
          </p>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <button type="button" style={BTN_SECONDARY} onClick={onBack}>← Back: Preview</button>
      </div>
    </div>
  );
}
