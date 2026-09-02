// Assessments Tab (Quizzes & Exams) — all 6 design-doc question types:
// MULTIPLE_CHOICE, TRUE_FALSE, MULTI_SELECT, ESSAY, FILL_IN_BLANK, MATCHING.
//
// KNOWN GAP (intentional, do not "fix"): this tab's URL param is
// ?tab=assessments (see LM_TAB_KEYS in LearningManagementPage.tsx) even
// though the blueprint doc titles the section "Quizzes & Exams" — that
// naming mismatch is documented in docs/blueprint/pages/04-learning-management.md.
//
// Key invariants (mirrors LearningPathsTab.tsx conventions):
//  - questionCount / totalPoints / autoGradable are always rendered from the
//    server response, never computed client-side (IMPACT_MAP R1/R4)
//  - a question's (type, data) always travel together on save — the question
//    editor always bundles both, so a "type without data" PATCH is
//    structurally impossible from this UI
//  - addQuestion success APPENDS the returned question to local state (no refetch)
//  - reorder sends ONE bulk call; replaces local state from the FULL response
//  - quiz PATCH only sent when at least one field changed (empty patch is a backend 400)
//  - quiz delete is a HARD delete (questions cascade) — confirm copy says so explicitly

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, ChevronLeft, Pencil, Trash2, ChevronUp, ChevronDown, X,
  ListChecks, ToggleLeft, CheckSquare, FileText, PenLine, ArrowLeftRight,
} from 'lucide-react';
import {
  listQuizzes, getQuiz, createQuiz, updateQuiz, deleteQuiz,
  createQuestion, updateQuestion, deleteQuestion, reorderQuestions,
  QuizApiError,
} from '../../services/quizzesApi';
import { listCourses } from '../../services/coursesApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type {
  Quiz, QuizDetail, Question, QuestionType,
  MultipleChoiceData, MultiSelectData, MatchingPair,
} from '../../types/quizzes';
import type { CourseListRow } from '../../types/courses';

// ── Toast ─────────────────────────────────────────────────────────────────────

interface Toast { type: 'success' | 'error'; message: string }

function ToastBanner({ type, message }: Toast) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9000,
      background: type === 'success' ? '#16a34a' : '#dc2626',
      color: '#fff', padding: '10px 18px', borderRadius: 8,
      fontSize: 13, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
    }}>
      {message}
    </div>
  );
}

// ── View state ────────────────────────────────────────────────────────────────

type View =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit';   quiz: Quiz }
  | { kind: 'detail'; quizId: string };

// ── Question type metadata (all 6 design-doc types) ─────────────────────────────

const V1_TYPES: QuestionType[] = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'MULTI_SELECT', 'ESSAY', 'FILL_IN_BLANK', 'MATCHING'];

const TYPE_META: Record<QuestionType, { label: string; icon: typeof ListChecks; hint?: string }> = {
  MULTIPLE_CHOICE: { label: 'Multiple Choice', icon: ListChecks },
  TRUE_FALSE:      { label: 'True / False',    icon: ToggleLeft },
  MULTI_SELECT:    { label: 'Multi-Select',    icon: CheckSquare },
  ESSAY:           { label: 'Essay',           icon: FileText, hint: 'Manually graded' },
  FILL_IN_BLANK:   { label: 'Fill in the Blank', icon: PenLine },
  MATCHING:        { label: 'Matching',        icon: ArrowLeftRight },
};

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;
const MIN_PAIRS = 2;
const MAX_PAIRS = 10;

function emptyOptions(): string[] { return ['', '']; }
function emptyPairs(): MatchingPair[] { return [{ left: '', right: '' }, { left: '', right: '' }]; }

// ── Quiz form (create + edit) ───────────────────────────────────────────────────

interface QuizFormValues {
  title:               string;
  description:         string;
  courseId:             string; // '' = no course
  passingGrade:         number;
  attemptsUnlimited:    boolean;
  attemptsAllowed:      number;
  timeLimitNone:        boolean;
  timeLimit:            number;
  randomizeQuestions:   boolean;
}

interface QuizFormProps {
  mode:    'create' | 'edit';
  initial: QuizFormValues;
  onSave:  (values: QuizFormValues) => Promise<void>;
  onBack:  () => void;
}

function QuizForm({ mode, initial, onSave, onBack }: QuizFormProps) {
  const [title,              setTitle]              = useState(initial.title);
  const [description,        setDescription]        = useState(initial.description);
  const [courseId,           setCourseId]           = useState(initial.courseId);
  const [passingGrade,       setPassingGrade]       = useState(initial.passingGrade);
  const [attemptsUnlimited,  setAttemptsUnlimited]  = useState(initial.attemptsUnlimited);
  const [attemptsAllowed,    setAttemptsAllowed]    = useState(initial.attemptsAllowed);
  const [timeLimitNone,      setTimeLimitNone]      = useState(initial.timeLimitNone);
  const [timeLimit,          setTimeLimit]          = useState(initial.timeLimit);
  const [randomizeQuestions, setRandomizeQuestions] = useState(initial.randomizeQuestions);

  const [courses,        setCourses]        = useState<CourseListRow[]>([]);
  const [loadingCourses, setLoadingCourses]  = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  useEffect(() => {
    listCourses({ limit: 200 })
      .then((r) => setCourses(r.courses.filter((c) => c.status !== 'Archived')))
      .catch(() => setCourses([]))
      .finally(() => setLoadingCourses(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    if (title.trim().length > 200) { setError('Title must be at most 200 characters.'); return; }
    if (description.length > 2000) { setError('Description must be at most 2000 characters.'); return; }
    if (!Number.isInteger(passingGrade) || passingGrade < 0 || passingGrade > 100) {
      setError('Passing grade must be an integer between 0 and 100.'); return;
    }
    if (!attemptsUnlimited && (!Number.isInteger(attemptsAllowed) || attemptsAllowed < 1 || attemptsAllowed > 100)) {
      setError('Attempts allowed must be an integer between 1 and 100 (or set to unlimited).'); return;
    }
    if (!timeLimitNone && (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > 600)) {
      setError('Time limit must be an integer between 1 and 600 minutes (or set to none).'); return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(), description, courseId, passingGrade,
        attemptsUnlimited, attemptsAllowed, timeLimitNone, timeLimit,
        randomizeQuestions,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tw:flex tw:flex-col tw:gap-5">
      <div className="tw:flex tw:items-center tw:gap-3">
        <button type="button" onClick={onBack}
          className="tw:flex tw:items-center tw:gap-1 tw:text-[13px] tw:font-medium tw:text-slate-500 tw:hover:text-slate-700">
          <ChevronLeft className="tw:h-4 tw:w-4" strokeWidth={2} />
          Back
        </button>
        <h2 className="tw:m-0 tw:text-[17px] tw:font-semibold tw:text-slate-900">
          {mode === 'create' ? 'Create Quiz' : 'Edit Quiz'}
        </h2>
      </div>

      <form onSubmit={handleSubmit}
        className="tw:flex tw:flex-col tw:gap-4 tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-6">
        {error && (
          <div className="tw:rounded-lg tw:border tw:border-red-100 tw:bg-red-50 tw:px-3 tw:py-2.5 tw:text-[13px] tw:text-red-600">
            {error}
          </div>
        )}

        {/* Title */}
        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">
            Title <span className="tw:text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. React Fundamentals Quiz"
            maxLength={200}
            required
            className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400 focus:tw:ring-2 focus:tw:ring-blue-100"
          />
        </div>

        {/* Description */}
        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional overview of this quiz…"
            rows={3}
            className="tw:w-full tw:resize-y tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400 focus:tw:ring-2 focus:tw:ring-blue-100"
          />
        </div>

        {/* Course link */}
        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Link to course (optional)</label>
          {loadingCourses ? (
            <div className="tw:h-9 tw:w-full tw:animate-pulse tw:rounded-lg tw:bg-slate-100" />
          ) : (
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              aria-label="Link to course"
              className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
            >
              <option value="">— No course —</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title} ({c.status})</option>
              ))}
            </select>
          )}
        </div>

        {/* Passing grade */}
        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Passing grade (%)</label>
          <input
            type="number" min={0} max={100}
            value={passingGrade}
            onChange={(e) => setPassingGrade(Number(e.target.value))}
            className="tw:w-32 tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
          />
        </div>

        {/* Attempts allowed */}
        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Attempts allowed</label>
          <div className="tw:flex tw:items-center tw:gap-3">
            <input
              type="number" min={1} max={100}
              value={attemptsAllowed}
              disabled={attemptsUnlimited}
              onChange={(e) => setAttemptsAllowed(Number(e.target.value))}
              className="tw:w-32 tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400 tw:disabled:bg-slate-50 tw:disabled:text-slate-400"
            />
            <label className="tw:flex tw:items-center tw:gap-1.5 tw:text-[12px] tw:text-slate-600">
              <input
                type="checkbox"
                checked={attemptsUnlimited}
                onChange={(e) => setAttemptsUnlimited(e.target.checked)}
              />
              Unlimited
            </label>
          </div>
        </div>

        {/* Time limit */}
        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Time limit (minutes)</label>
          <div className="tw:flex tw:items-center tw:gap-3">
            <input
              type="number" min={1} max={600}
              value={timeLimit}
              disabled={timeLimitNone}
              onChange={(e) => setTimeLimit(Number(e.target.value))}
              className="tw:w-32 tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400 tw:disabled:bg-slate-50 tw:disabled:text-slate-400"
            />
            <label className="tw:flex tw:items-center tw:gap-1.5 tw:text-[12px] tw:text-slate-600">
              <input
                type="checkbox"
                checked={timeLimitNone}
                onChange={(e) => setTimeLimitNone(e.target.checked)}
              />
              No time limit
            </label>
          </div>
        </div>

        {/* Randomize toggle */}
        <div className="tw:flex tw:items-center tw:justify-between tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-3">
          <div>
            <p className="tw:m-0 tw:text-[13px] tw:font-semibold tw:text-slate-800">Randomize questions</p>
            <p className="tw:m-0 tw:text-[12px] tw:text-slate-500">
              {randomizeQuestions ? 'Question order is shuffled per attempt.' : 'Questions appear in a fixed order.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={randomizeQuestions}
            aria-label="Randomize questions"
            onClick={() => setRandomizeQuestions((v) => !v)}
            className={
              'tw:relative tw:h-6 tw:w-11 tw:flex-shrink-0 tw:rounded-full tw:border-2 tw:border-transparent tw:transition-colors' +
              (randomizeQuestions ? ' tw:bg-blue-600' : ' tw:bg-slate-200')
            }
          >
            <span className={
              'tw:absolute tw:top-0.5 tw:h-4 tw:w-4 tw:rounded-full tw:bg-white tw:shadow tw:transition-transform' +
              (randomizeQuestions ? ' tw:translate-x-5' : ' tw:translate-x-0.5')
            } />
          </button>
        </div>

        {/* Actions */}
        <div className="tw:flex tw:items-center tw:justify-end tw:gap-2 tw:border-t tw:border-slate-100 tw:pt-4">
          <button type="button" onClick={onBack} disabled={saving}
            className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50 tw:disabled:opacity-40">
            Cancel
          </button>
          <button type="submit" disabled={saving || !title.trim()}
            className="tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700 tw:disabled:opacity-40">
            {saving ? 'Saving…' : mode === 'create' ? 'Create Quiz' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Question editor (add + edit — always bundles type+data together) ──────────

interface QuestionEditorProps {
  quizId:   string;
  existing: Question | null; // null = create mode
  onSaved:  (question: Question) => void;
  onClose:  () => void;
}

function QuestionEditor({ quizId, existing, onSaved, onClose }: QuestionEditorProps) {
  const navigate = useNavigate();
  const [type, setType] = useState<QuestionType>(existing?.type ?? 'MULTIPLE_CHOICE');
  const [prompt, setPrompt] = useState(existing?.prompt ?? '');
  const [points, setPoints] = useState(existing?.points ?? 1);

  const promptRef  = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const pointsRef  = useRef<HTMLDivElement>(null);

  const [options, setOptions] = useState<string[]>(
    existing && (existing.type === 'MULTIPLE_CHOICE' || existing.type === 'MULTI_SELECT')
      ? existing.data.options
      : emptyOptions(),
  );
  const [correctIndex, setCorrectIndex] = useState<number | null>(
    existing?.type === 'MULTIPLE_CHOICE' ? existing.data.correctIndex : null,
  );
  const [correctIndexes, setCorrectIndexes] = useState<Set<number>>(
    new Set(existing?.type === 'MULTI_SELECT' ? existing.data.correctIndexes : []),
  );
  const [correct, setCorrect] = useState<boolean>(
    existing?.type === 'TRUE_FALSE' ? existing.data.correct : false,
  );
  const [correctAnswer, setCorrectAnswer] = useState<string>(
    existing?.type === 'FILL_IN_BLANK' ? existing.data.correctAnswer : '',
  );
  const [pairs, setPairs] = useState<MatchingPair[]>(
    existing?.type === 'MATCHING' ? existing.data.pairs : emptyPairs(),
  );

  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null); // backend/network failures only
  const [fieldErrors, setFieldErrors] = useState<{ prompt?: string; options?: string; points?: string }>({});

  function handleTypeChange(next: QuestionType) {
    setType(next);
    // Reset per-type fields — carrying stale answer data across a type switch
    // would silently mismatch the new type.
    setOptions(emptyOptions());
    setCorrectIndex(null);
    setCorrectIndexes(new Set());
    setCorrect(false);
    setCorrectAnswer('');
    setPairs(emptyPairs());
    setFieldErrors((prev) => ({ ...prev, options: undefined }));
  }

  function updatePair(idx: number, side: 'left' | 'right', value: string) {
    setPairs((prev) => prev.map((p, i) => (i === idx ? { ...p, [side]: value } : p)));
    setFieldErrors((prev) => ({ ...prev, options: undefined }));
  }

  function addPair() {
    setPairs((prev) => (prev.length < MAX_PAIRS ? [...prev, { left: '', right: '' }] : prev));
    setFieldErrors((prev) => ({ ...prev, options: undefined }));
  }

  function removePair(idx: number) {
    setPairs((prev) => (prev.length <= MIN_PAIRS ? prev : prev.filter((_, i) => i !== idx)));
    setFieldErrors((prev) => ({ ...prev, options: undefined }));
  }

  function updateOption(idx: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
    setFieldErrors((prev) => ({ ...prev, options: undefined }));
  }

  function addOption() {
    setOptions((prev) => (prev.length < MAX_OPTIONS ? [...prev, ''] : prev));
    setFieldErrors((prev) => ({ ...prev, options: undefined }));
  }

  function removeOption(idx: number) {
    setOptions((prev) => {
      if (prev.length <= MIN_OPTIONS) return prev;
      const next = prev.filter((_, i) => i !== idx);
      return next;
    });
    setCorrectIndex((prev) => {
      if (prev === null) return null;
      if (prev === idx) return null;
      return prev > idx ? prev - 1 : prev;
    });
    setCorrectIndexes((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i === idx) continue;
        next.add(i > idx ? i - 1 : i);
      }
      return next;
    });
    setFieldErrors((prev) => ({ ...prev, options: undefined }));
  }

  function selectCorrectIndex(idx: number) {
    setCorrectIndex(idx);
    setFieldErrors((prev) => ({ ...prev, options: undefined }));
  }

  function toggleCorrectIndex(idx: number) {
    setCorrectIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
    setFieldErrors((prev) => ({ ...prev, options: undefined }));
  }

  function buildData(): MultipleChoiceData | MultiSelectData | { correct: boolean } | { correctAnswer: string } | { pairs: MatchingPair[] } | null {
    if (type === 'ESSAY') return null;
    if (type === 'TRUE_FALSE') return { correct };
    if (type === 'FILL_IN_BLANK') return { correctAnswer: correctAnswer.trim() };
    if (type === 'MATCHING') return { pairs: pairs.map((p) => ({ left: p.left.trim(), right: p.right.trim() })) };
    if (type === 'MULTIPLE_CHOICE') return { options: options.map((o) => o.trim()), correctIndex: correctIndex as number };
    return { options: options.map((o) => o.trim()), correctIndexes: [...correctIndexes].sort((a, b) => a - b) };
  }

  // Returns one message per invalid field — never a single generic string.
  // A save click must NEVER silently no-op: every failure here gets a
  // visible message anchored next to the field that caused it.
  function validate(): { prompt?: string; options?: string; points?: string } {
    const errors: { prompt?: string; options?: string; points?: string } = {};

    if (!prompt.trim()) errors.prompt = 'Prompt is required.';
    else if (prompt.trim().length > 2000) errors.prompt = 'Prompt must be at most 2000 characters.';

    if (!Number.isInteger(points) || points < 1 || points > 100) {
      errors.points = 'Points must be an integer between 1 and 100.';
    }

    if (type === 'MULTIPLE_CHOICE' || type === 'MULTI_SELECT') {
      if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) {
        errors.options = `Provide between ${MIN_OPTIONS} and ${MAX_OPTIONS} options.`;
      } else if (options.some((o) => !o.trim())) {
        errors.options = 'Every option must be filled in.';
      } else if (options.some((o) => o.trim().length > 500)) {
        errors.options = 'Each option must be at most 500 characters.';
      } else if (type === 'MULTIPLE_CHOICE' && correctIndex === null) {
        errors.options = 'Select the correct answer before saving.';
      } else if (type === 'MULTI_SELECT' && correctIndexes.size === 0) {
        errors.options = 'Select at least one correct answer before saving.';
      }
    }

    if (type === 'FILL_IN_BLANK') {
      if (!correctAnswer.trim()) errors.options = 'Correct answer is required.';
      else if (correctAnswer.trim().length > 500) errors.options = 'Correct answer must be at most 500 characters.';
    }

    if (type === 'MATCHING') {
      if (pairs.length < MIN_PAIRS || pairs.length > MAX_PAIRS) {
        errors.options = `Provide between ${MIN_PAIRS} and ${MAX_PAIRS} pairs.`;
      } else if (pairs.some((p) => !p.left.trim() || !p.right.trim())) {
        errors.options = 'Every pair needs both a left and right value.';
      } else if (pairs.some((p) => p.left.trim().length > 200 || p.right.trim().length > 200)) {
        errors.options = 'Each pair value must be at most 200 characters.';
      }
    }

    return errors;
  }

  async function handleSave() {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // Never a silent no-op: scroll the first invalid field into view even
      // if it's currently off-screen below the fold.
      const target = errors.prompt ? promptRef.current : errors.options ? optionsRef.current : pointsRef.current;
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    setFieldErrors({});
    setSaving(true);
    setSaveError(null);
    try {
      // Always bundle (type, data) together — the only shape the backend
      // accepts for a data-carrying update, and correct-by-construction for create.
      const payload = { type, data: buildData(), prompt: prompt.trim(), points } as Parameters<typeof createQuestion>[1];
      const saved = existing
        ? await updateQuestion(quizId, existing.id, payload)
        : await createQuestion(quizId, payload);
      onSaved(saved);
    } catch (err) {
      if (err instanceof QuizApiError && err.status === 401) { navigate('/login'); return; }
      setSaveError(err instanceof Error ? err.message : 'Save failed.');
      setSaving(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div aria-label="modal backdrop"
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose} />

      <div role="dialog" aria-modal="true" aria-label={existing ? 'Edit question' : 'Add question'}
        className="tw:relative tw:flex tw:max-h-[85vh] tw:w-full tw:max-w-lg tw:flex-col tw:rounded-xl tw:bg-white tw:shadow-2xl">
        <div className="tw:flex tw:flex-shrink-0 tw:items-center tw:justify-between tw:border-b tw:border-slate-200 tw:px-5 tw:py-4">
          <h3 className="tw:m-0 tw:text-[15px] tw:font-semibold tw:text-slate-900">
            {existing ? 'Edit Question' : 'Add Question'}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close question editor"
            className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-slate-100">
            <X className="tw:h-4 tw:w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="tw:flex-1 tw:overflow-y-auto tw:px-5 tw:py-4 tw:flex tw:flex-col tw:gap-4">
          {/* Type selector — exactly the 4 v1 types, nothing else */}
          <div>
            <p className="tw:m-0 tw:mb-2 tw:text-[12px] tw:font-semibold tw:text-slate-700">Question type</p>
            <div className="tw:grid tw:grid-cols-2 tw:gap-2">
              {V1_TYPES.map((t) => {
                const meta = TYPE_META[t];
                const Icon = meta.icon;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTypeChange(t)}
                    aria-pressed={type === t}
                    className={
                      'tw:flex tw:flex-col tw:items-start tw:gap-0.5 tw:rounded-lg tw:border tw:px-3 tw:py-2 tw:text-left tw:text-[12px] tw:font-medium tw:transition-colors' +
                      (type === t
                        ? ' tw:border-blue-500 tw:bg-blue-50 tw:text-blue-700'
                        : ' tw:border-slate-200 tw:text-slate-600 tw:hover:bg-slate-50')
                    }
                  >
                    <span className="tw:flex tw:items-center tw:gap-1.5">
                      <Icon className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
                      {meta.label}
                    </span>
                    {meta.hint && <span className="tw:text-[10px] tw:font-normal tw:text-slate-400">{meta.hint}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt */}
          <div ref={promptRef} className="tw:flex tw:flex-col tw:gap-1.5">
            <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">
              Prompt <span className="tw:text-red-500">*</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); setFieldErrors((prev) => ({ ...prev, prompt: undefined })); }}
              placeholder="Enter the question text…"
              rows={2}
              maxLength={2000}
              className="tw:w-full tw:resize-y tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
            />
            {fieldErrors.prompt && (
              <p role="alert" className="tw:m-0 tw:text-[12px] tw:text-red-600">{fieldErrors.prompt}</p>
            )}
          </div>

          {/* Per-type fields */}
          {(type === 'MULTIPLE_CHOICE' || type === 'MULTI_SELECT') && (
            <div ref={optionsRef} className="tw:flex tw:flex-col tw:gap-2">
              <p className="tw:m-0 tw:text-[12px] tw:font-semibold tw:text-slate-700">
                Options <span className="tw:text-red-500">*</span>{' '}
                <span className="tw:font-normal tw:text-slate-400">
                  ({type === 'MULTIPLE_CHOICE' ? 'select the correct one' : 'check all correct answers'})
                </span>
              </p>
              {options.map((opt, idx) => (
                <div key={idx} className="tw:flex tw:items-center tw:gap-2">
                  {type === 'MULTIPLE_CHOICE' ? (
                    <input
                      type="radio"
                      name="correct-option"
                      aria-label={`Mark option ${idx + 1} as correct`}
                      checked={correctIndex === idx}
                      onChange={() => selectCorrectIndex(idx)}
                    />
                  ) : (
                    <input
                      type="checkbox"
                      aria-label={`Mark option ${idx + 1} as correct`}
                      checked={correctIndexes.has(idx)}
                      onChange={() => toggleCorrectIndex(idx)}
                    />
                  )}
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => updateOption(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    maxLength={500}
                    aria-label={`Option ${idx + 1} text`}
                    className="tw:flex-1 tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-1.5 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
                  />
                  <button type="button" onClick={() => removeOption(idx)}
                    disabled={options.length <= MIN_OPTIONS}
                    aria-label={`Remove option ${idx + 1}`}
                    className="tw:flex-shrink-0 tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-red-50 tw:hover:text-red-500 tw:disabled:opacity-30">
                    <Trash2 className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addOption} disabled={options.length >= MAX_OPTIONS}
                className="tw:flex tw:w-fit tw:items-center tw:gap-1 tw:text-[12px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700 tw:disabled:opacity-40">
                <Plus className="tw:h-3.5 tw:w-3.5" strokeWidth={2.5} /> Add option
              </button>
              {fieldErrors.options && (
                <p role="alert" className="tw:m-0 tw:text-[12px] tw:text-red-600">{fieldErrors.options}</p>
              )}
            </div>
          )}

          {type === 'TRUE_FALSE' && (
            <div>
              <p className="tw:m-0 tw:mb-2 tw:text-[12px] tw:font-semibold tw:text-slate-700">Correct answer</p>
              <div className="tw:flex tw:gap-2">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => setCorrect(v)}
                    aria-pressed={correct === v}
                    className={
                      'tw:rounded-lg tw:border tw:px-4 tw:py-2 tw:text-[12px] tw:font-medium tw:transition-colors' +
                      (correct === v
                        ? ' tw:border-blue-500 tw:bg-blue-50 tw:text-blue-700'
                        : ' tw:border-slate-200 tw:text-slate-600 tw:hover:bg-slate-50')
                    }
                  >
                    {v ? 'True' : 'False'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {type === 'ESSAY' && (
            <div className="tw:rounded-lg tw:border tw:border-amber-100 tw:bg-amber-50 tw:px-3 tw:py-2.5 tw:text-[12px] tw:text-amber-700">
              Essay questions have no answer data — they are graded manually.
            </div>
          )}

          {type === 'FILL_IN_BLANK' && (
            <div ref={optionsRef} className="tw:flex tw:flex-col tw:gap-1.5">
              <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">
                Correct answer <span className="tw:text-red-500">*</span>
              </label>
              <input
                type="text"
                value={correctAnswer}
                onChange={(e) => { setCorrectAnswer(e.target.value); setFieldErrors((prev) => ({ ...prev, options: undefined })); }}
                placeholder="Exact text the learner must fill in"
                maxLength={500}
                aria-label="Correct answer"
                className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-1.5 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
              />
              {fieldErrors.options && (
                <p role="alert" className="tw:m-0 tw:text-[12px] tw:text-red-600">{fieldErrors.options}</p>
              )}
            </div>
          )}

          {type === 'MATCHING' && (
            <div ref={optionsRef} className="tw:flex tw:flex-col tw:gap-2">
              <p className="tw:m-0 tw:text-[12px] tw:font-semibold tw:text-slate-700">
                Pairs <span className="tw:text-red-500">*</span>{' '}
                <span className="tw:font-normal tw:text-slate-400">(left matches right)</span>
              </p>
              {pairs.map((pair, idx) => (
                <div key={idx} className="tw:flex tw:items-center tw:gap-2">
                  <input
                    type="text"
                    value={pair.left}
                    onChange={(e) => updatePair(idx, 'left', e.target.value)}
                    placeholder={`Left ${idx + 1}`}
                    maxLength={200}
                    aria-label={`Pair ${idx + 1} left value`}
                    className="tw:flex-1 tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-1.5 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
                  />
                  <ArrowLeftRight className="tw:h-3.5 tw:w-3.5 tw:flex-shrink-0 tw:text-slate-300" strokeWidth={2} />
                  <input
                    type="text"
                    value={pair.right}
                    onChange={(e) => updatePair(idx, 'right', e.target.value)}
                    placeholder={`Right ${idx + 1}`}
                    maxLength={200}
                    aria-label={`Pair ${idx + 1} right value`}
                    className="tw:flex-1 tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-1.5 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
                  />
                  <button type="button" onClick={() => removePair(idx)}
                    disabled={pairs.length <= MIN_PAIRS}
                    aria-label={`Remove pair ${idx + 1}`}
                    className="tw:flex-shrink-0 tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-red-50 tw:hover:text-red-500 tw:disabled:opacity-30">
                    <Trash2 className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addPair} disabled={pairs.length >= MAX_PAIRS}
                className="tw:flex tw:w-fit tw:items-center tw:gap-1 tw:text-[12px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700 tw:disabled:opacity-40">
                <Plus className="tw:h-3.5 tw:w-3.5" strokeWidth={2.5} /> Add pair
              </button>
              {fieldErrors.options && (
                <p role="alert" className="tw:m-0 tw:text-[12px] tw:text-red-600">{fieldErrors.options}</p>
              )}
            </div>
          )}

          {/* Points */}
          <div ref={pointsRef} className="tw:flex tw:flex-col tw:gap-1.5">
            <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Points</label>
            <input
              type="number" min={1} max={100}
              value={points}
              onChange={(e) => { setPoints(Number(e.target.value)); setFieldErrors((prev) => ({ ...prev, points: undefined })); }}
              className="tw:w-24 tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-1.5 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
            />
            {fieldErrors.points && (
              <p role="alert" className="tw:m-0 tw:text-[12px] tw:text-red-600">{fieldErrors.points}</p>
            )}
          </div>

          {saveError && (
            <div role="alert" className="tw:rounded-lg tw:border tw:border-red-100 tw:bg-red-50 tw:px-3 tw:py-2 tw:text-[12px] tw:text-red-600">
              {saveError}
            </div>
          )}
        </div>

        <div className="tw:flex tw:flex-shrink-0 tw:justify-end tw:gap-2 tw:border-t tw:border-slate-100 tw:px-5 tw:py-3.5">
          <button type="button" onClick={onClose} disabled={saving}
            className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50 tw:disabled:opacity-40">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700 tw:disabled:opacity-40">
            {saving ? 'Saving…' : existing ? 'Save Changes' : 'Add Question'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Question row ──────────────────────────────────────────────────────────────

interface QuestionRowProps {
  question:   Question;
  index:      number;
  total:      number;
  busy:       boolean;
  onMoveUp:   () => void;
  onMoveDown: () => void;
  onEdit:     () => void;
  onDelete:   () => void;
}

function QuestionRow({ question, index, total, busy, onMoveUp, onMoveDown, onEdit, onDelete }: QuestionRowProps) {
  const meta = TYPE_META[question.type];
  const Icon = meta.icon;
  return (
    <div className="tw:flex tw:items-start tw:gap-3 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-white tw:px-3 tw:py-2.5">
      <div className="tw:flex tw:flex-col tw:gap-0.5 tw:pt-0.5">
        <button type="button" onClick={onMoveUp} disabled={busy || index === 0}
          aria-label="Move question up"
          className="tw:rounded tw:p-0.5 tw:text-slate-300 tw:hover:bg-slate-100 tw:hover:text-slate-600 tw:disabled:opacity-30">
          <ChevronUp className="tw:h-3.5 tw:w-3.5" strokeWidth={2.5} />
        </button>
        <button type="button" onClick={onMoveDown} disabled={busy || index === total - 1}
          aria-label="Move question down"
          className="tw:rounded tw:p-0.5 tw:text-slate-300 tw:hover:bg-slate-100 tw:hover:text-slate-600 tw:disabled:opacity-30">
          <ChevronDown className="tw:h-3.5 tw:w-3.5" strokeWidth={2.5} />
        </button>
      </div>

      <Icon className="tw:mt-0.5 tw:h-4 tw:w-4 tw:flex-shrink-0 tw:text-violet-500" strokeWidth={2} />

      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-1">
        <div className="tw:flex tw:items-center tw:gap-2">
          <span className="tw:rounded-full tw:bg-slate-100 tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-semibold tw:text-slate-600">
            {meta.label}
          </span>
          {question.type === 'ESSAY' && (
            <span className="tw:rounded-full tw:bg-amber-100 tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-semibold tw:text-amber-700">
              Manually graded
            </span>
          )}
          <span className="tw:text-[11px] tw:text-slate-400">{question.points} pt{question.points !== 1 ? 's' : ''}</span>
        </div>
        <p className="tw:m-0 tw:truncate tw:text-[13px] tw:font-medium tw:text-slate-800">{question.prompt}</p>
      </div>

      <div className="tw:flex tw:flex-shrink-0 tw:items-center tw:gap-1 tw:text-slate-400">
        <button type="button" onClick={onEdit} aria-label={`Edit question: ${question.prompt}`}
          className="tw:rounded tw:p-1 tw:hover:bg-slate-100 tw:hover:text-blue-600">
          <Pencil className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
        </button>
        <button type="button" onClick={onDelete} aria-label={`Delete question: ${question.prompt}`}
          className="tw:rounded tw:p-1 tw:hover:bg-red-50 tw:hover:text-red-500">
          <Trash2 className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

// ── Detail view ───────────────────────────────────────────────────────────────

interface DetailViewProps {
  quizId:    string;
  onBack:    () => void;
  onEdit:    (quiz: Quiz) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

function DetailView({ quizId, onBack, onEdit, showToast }: DetailViewProps) {
  const navigate = useNavigate();
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [detail,   setDetail]   = useState<QuizDetail | null>(null);
  const [busy,     setBusy]     = useState(false);
  const [editing,  setEditing]  = useState<Question | 'new' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getQuiz(quizId);
      setDetail(d);
    } catch (err) {
      if (err instanceof QuizApiError && err.status === 401) { navigate('/login'); return; }
      setError(err instanceof Error ? err.message : 'Failed to load quiz.');
    } finally {
      setLoading(false);
    }
  }, [quizId, navigate]);

  useEffect(() => { load(); }, [load]);

  function questionMutationCtx() {
    return { courseId: detail?.courseId ?? undefined };
  }

  async function handleDeleteQuestion(question: Question) {
    if (!detail) return;
    if (!window.confirm('Delete this question?\n\nThis cannot be undone.')) return;
    setBusy(true);
    try {
      await deleteQuestion(detail.id, question.id);
      invalidateFor(appQueryClient, 'question.delete', questionMutationCtx());
      // Remove from the local list only — questionCount/totalPoints/autoGradable
      // are server-derived (R1/R4) and stay as last loaded until the next real
      // GET (mirrors LearningPathsTab's itemCount handling on item removal).
      setDetail((d) => d ? { ...d, questions: d.questions.filter((q) => q.id !== question.id) } : d);
      showToast('success', 'Question deleted.');
    } catch (err) {
      if (err instanceof QuizApiError && err.status === 401) { navigate('/login'); return; }
      showToast('error', err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  }

  async function sendReorder(newQuestions: Question[]) {
    if (!detail) return;
    const payload = { items: newQuestions.map((q, i) => ({ id: q.id, order: i })) };
    setBusy(true);
    try {
      const updated = await reorderQuestions(detail.id, payload);
      invalidateFor(appQueryClient, 'question.reorder', questionMutationCtx());
      // Replace local state from the FULL response — never merge/patch manually.
      setDetail(updated);
    } catch (err) {
      if (err instanceof QuizApiError && err.status === 401) { navigate('/login'); return; }
      showToast('error', err instanceof Error ? err.message : 'Reorder failed.');
      await load(); // restore from server on error
    } finally {
      setBusy(false);
    }
  }

  function moveQuestion(idx: number, dir: 'up' | 'down') {
    if (!detail) return;
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= detail.questions.length) return;
    const next = [...detail.questions];
    [next[idx], next[target]] = [next[target], next[idx]];
    setDetail({ ...detail, questions: next });
    sendReorder(next);
  }

  function handleQuestionSaved(question: Question) {
    const wasNew = editing === 'new';
    // Append/replace the question in the local list only — questionCount/
    // totalPoints/autoGradable are server-derived (R1/R4) and are never summed
    // or counted client-side. They stay at their last-loaded value until the
    // next real GET (same tradeoff LearningPathsTab makes for itemCount on
    // item add: "append... rather than refetching the whole quiz").
    setDetail((d) => {
      if (!d) return d;
      const questions = wasNew
        ? [...d.questions, question]
        : d.questions.map((q) => (q.id === question.id ? question : q));
      return { ...d, questions };
    });
    invalidateFor(appQueryClient, wasNew ? 'question.create' : 'question.update', questionMutationCtx());
    setEditing(null);
    showToast('success', wasNew ? 'Question added.' : 'Question updated.');
  }

  if (loading) {
    return (
      <div className="tw:flex tw:flex-col tw:gap-4">
        <div className="tw:h-8 tw:w-48 tw:animate-pulse tw:rounded tw:bg-slate-100" />
        <div className="tw:h-48 tw:w-full tw:animate-pulse tw:rounded-xl tw:bg-slate-100" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="tw:flex tw:flex-col tw:gap-4">
        <button type="button" onClick={onBack}
          className="tw:flex tw:items-center tw:gap-1 tw:w-fit tw:text-[13px] tw:font-medium tw:text-slate-500 tw:hover:text-slate-700">
          <ChevronLeft className="tw:h-4 tw:w-4" strokeWidth={2} /> Back
        </button>
        <div className="tw:rounded-xl tw:border tw:border-red-100 tw:bg-red-50 tw:p-5 tw:text-center">
          <p className="tw:text-[13px] tw:text-red-500">{error ?? 'Not found.'}</p>
          <button type="button" onClick={load}
            className="tw:mt-2 tw:text-[13px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tw:flex tw:flex-col tw:gap-5">
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
        <div className="tw:flex tw:items-center tw:gap-3">
          <button type="button" onClick={onBack}
            className="tw:flex tw:items-center tw:gap-1 tw:text-[13px] tw:font-medium tw:text-slate-500 tw:hover:text-slate-700">
            <ChevronLeft className="tw:h-4 tw:w-4" strokeWidth={2} /> Back
          </button>
          <div>
            <h2 className="tw:m-0 tw:text-[17px] tw:font-semibold tw:text-slate-900">{detail.title}</h2>
            <div className="tw:flex tw:items-center tw:gap-2 tw:mt-0.5">
              <span className="tw:text-[11px] tw:text-slate-400">
                {detail.questionCount} question{detail.questionCount !== 1 ? 's' : ''} · {detail.totalPoints} pt{detail.totalPoints !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
        <div className="tw:flex tw:items-center tw:gap-2">
          <button type="button" onClick={() => onEdit(detail)}
            className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-1.5 tw:text-[12px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50">
            <Pencil className="tw:h-3.5 tw:w-3.5" strokeWidth={2} /> Edit
          </button>
          <button type="button" onClick={() => setEditing('new')}
            className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-3 tw:py-1.5 tw:text-[12px] tw:font-semibold tw:text-white tw:hover:bg-blue-700">
            <Plus className="tw:h-3.5 tw:w-3.5" strokeWidth={2.5} /> Add Question
          </button>
        </div>
      </div>

      {detail.description && (
        <p className="tw:m-0 tw:text-[13px] tw:leading-relaxed tw:text-slate-600">{detail.description}</p>
      )}

      <div className="tw:flex tw:flex-col tw:gap-2">
        {detail.questions.length === 0 && (
          <div className="tw:rounded-xl tw:border tw:border-dashed tw:border-slate-300 tw:bg-white tw:py-12 tw:text-center">
            <p className="tw:m-0 tw:text-[13px] tw:text-slate-400">No questions yet. Add one to get started.</p>
          </div>
        )}
        {detail.questions.map((q, idx) => (
          <QuestionRow
            key={q.id}
            question={q}
            index={idx}
            total={detail.questions.length}
            busy={busy}
            onMoveUp={() => moveQuestion(idx, 'up')}
            onMoveDown={() => moveQuestion(idx, 'down')}
            onEdit={() => setEditing(q)}
            onDelete={() => handleDeleteQuestion(q)}
          />
        ))}
      </div>

      {editing && (
        <QuestionEditor
          quizId={detail.id}
          existing={editing === 'new' ? null : editing}
          onSaved={handleQuestionSaved}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

// ── List view ─────────────────────────────────────────────────────────────────

interface ListViewProps {
  quizzes:  Quiz[];
  courseTitles: Record<string, string>;
  loading:  boolean;
  error:    string | null;
  onRetry:  () => void;
  onCreate: () => void;
  onEdit:   (quiz: Quiz) => void;
  onView:   (quiz: Quiz) => void;
  onDelete: (quiz: Quiz) => void;
}

function ListView({ quizzes, courseTitles, loading, error, onRetry, onCreate, onEdit, onView, onDelete }: ListViewProps) {
  if (loading) {
    return (
      <div className="tw:flex tw:flex-col tw:gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="tw:h-20 tw:w-full tw:animate-pulse tw:rounded-xl tw:bg-slate-100" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="tw:rounded-xl tw:border tw:border-red-100 tw:bg-red-50 tw:p-5 tw:text-center">
        <p className="tw:text-[13px] tw:text-red-500">{error}</p>
        <button type="button" onClick={onRetry}
          className="tw:mt-2 tw:text-[13px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">
          Retry
        </button>
      </div>
    );
  }

  if (quizzes.length === 0) {
    return (
      <div className="tw:flex tw:flex-col tw:items-center tw:justify-center tw:rounded-xl tw:border tw:border-dashed tw:border-slate-300 tw:bg-white tw:py-20 tw:gap-3">
        <p className="tw:m-0 tw:text-[14px] tw:text-slate-500">No quizzes yet.</p>
        <button type="button" onClick={onCreate}
          className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700">
          <Plus className="tw:h-4 tw:w-4" strokeWidth={2.5} /> Create Quiz
        </button>
      </div>
    );
  }

  return (
    <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:overflow-hidden">
      <table className="tw:w-full tw:border-collapse">
        <thead>
          <tr className="tw:border-b tw:border-slate-100 tw:bg-slate-50">
            <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Title</th>
            <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Course</th>
            <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Questions</th>
            <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Passing Grade</th>
            <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Updated</th>
            <th className="tw:px-4 tw:py-3" />
          </tr>
        </thead>
        <tbody>
          {quizzes.map((q) => (
            <tr key={q.id} className="tw:border-b tw:border-slate-50 tw:last:border-0 tw:hover:bg-slate-50">
              <td className="tw:px-4 tw:py-3">
                <div>
                  <button type="button" onClick={() => onView(q)}
                    className="tw:text-[13px] tw:font-semibold tw:text-slate-900 tw:hover:text-blue-600 tw:text-left">
                    {q.title}
                  </button>
                  {q.description && (
                    <p className="tw:m-0 tw:mt-0.5 tw:max-w-xs tw:truncate tw:text-[12px] tw:text-slate-400">{q.description}</p>
                  )}
                </div>
              </td>
              <td className="tw:px-4 tw:py-3 tw:text-[13px] tw:text-slate-700">
                {q.courseId ? (courseTitles[q.courseId] ?? '—') : <span className="tw:text-slate-400">Unattached</span>}
              </td>
              <td className="tw:px-4 tw:py-3 tw:text-[13px] tw:text-slate-700">
                {q.questionCount}
              </td>
              <td className="tw:px-4 tw:py-3 tw:text-[13px] tw:text-slate-700">
                {q.passingGrade}%
              </td>
              <td className="tw:px-4 tw:py-3 tw:text-[12px] tw:text-slate-400">
                {new Date(q.updatedAt).toLocaleDateString()}
              </td>
              <td className="tw:px-4 tw:py-3">
                <div className="tw:flex tw:items-center tw:justify-end tw:gap-1 tw:text-slate-400">
                  <button type="button" onClick={() => onEdit(q)}
                    aria-label={`Edit ${q.title}`}
                    className="tw:rounded tw:p-1 tw:hover:bg-slate-100 tw:hover:text-blue-600">
                    <Pencil className="tw:h-4 tw:w-4" strokeWidth={2} />
                  </button>
                  <button type="button" onClick={() => onDelete(q)}
                    aria-label={`Delete ${q.title}`}
                    className="tw:rounded tw:p-1 tw:hover:bg-red-50 tw:hover:text-red-500">
                    <Trash2 className="tw:h-4 tw:w-4" strokeWidth={2} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface AssessmentsTabProps {
  /** When true, mount directly into the create form (used by LmGuide's "Create Assessment" shortcut). */
  openCreateOnMount?: boolean;
}

export default function AssessmentsTab({ openCreateOnMount }: AssessmentsTabProps) {
  const navigate = useNavigate();

  const [view,    setView]    = useState<View>(openCreateOnMount ? { kind: 'create' } : { kind: 'list' });
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [courseTitles, setCourseTitles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [toast,   setToast]   = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  const loadQuizzes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listQuizzes();
      setQuizzes(rows);
      // Resolve course titles for the list's Course column (reuses the same
      // course list already fetched by the quiz form's picker — cheap, no new endpoint).
      const courseIds = [...new Set(rows.map((q) => q.courseId).filter((id): id is string => Boolean(id)))];
      if (courseIds.length > 0) {
        listCourses({ limit: 500 }).then((r) => {
          const map: Record<string, string> = {};
          for (const c of r.courses) map[c.id] = c.title;
          setCourseTitles(map);
        }).catch(err => console.error(err));
      }
    } catch (err) {
      if (err instanceof QuizApiError && err.status === 401) { navigate('/login'); return; }
      setError(err instanceof Error ? err.message : 'Failed to load quizzes.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { loadQuizzes(); }, [loadQuizzes]);

  function toCreatePayload(values: QuizFormValues) {
    return {
      title: values.title,
      description: values.description.trim() || null,
      courseId: values.courseId || null,
      passingGrade: values.passingGrade,
      attemptsAllowed: values.attemptsUnlimited ? null : values.attemptsAllowed,
      timeLimit: values.timeLimitNone ? null : values.timeLimit,
      randomizeQuestions: values.randomizeQuestions,
    };
  }

  async function handleCreate(values: QuizFormValues) {
    const payload = toCreatePayload(values);
    const created = await createQuiz(payload);
    invalidateFor(appQueryClient, 'quiz.create', { courseId: created.courseId ?? undefined });
    setQuizzes((prev) => [created, ...prev]);
    setView({ kind: 'list' });
    showToast('success', 'Quiz created.');
  }

  async function handleEdit(quiz: Quiz, values: QuizFormValues) {
    const next = toCreatePayload(values);
    const patch: Record<string, unknown> = {};
    if (next.title !== quiz.title) patch.title = next.title;
    if (next.description !== quiz.description) patch.description = next.description;
    if (next.courseId !== quiz.courseId) patch.courseId = next.courseId;
    if (next.passingGrade !== quiz.passingGrade) patch.passingGrade = next.passingGrade;
    if (next.attemptsAllowed !== quiz.attemptsAllowed) patch.attemptsAllowed = next.attemptsAllowed;
    if (next.timeLimit !== quiz.timeLimit) patch.timeLimit = next.timeLimit;
    if (next.randomizeQuestions !== quiz.randomizeQuestions) patch.randomizeQuestions = next.randomizeQuestions;

    if (Object.keys(patch).length === 0) {
      // Nothing changed — skip PATCH (empty body is a backend 400)
      setView({ kind: 'list' });
      return;
    }

    const oldCourseId = quiz.courseId;
    const updated = await updateQuiz(quiz.id, patch);
    invalidateFor(appQueryClient, 'quiz.update', { courseId: updated.courseId ?? undefined });
    if (oldCourseId && oldCourseId !== updated.courseId) {
      // courseId changed away from a course that was showing this quiz — invalidate it too
      invalidateFor(appQueryClient, 'quiz.update', { courseId: oldCourseId });
    }
    setQuizzes((prev) => prev.map((q) => (q.id === quiz.id ? updated : q)));
    setView({ kind: 'list' });
    showToast('success', 'Quiz updated.');
  }

  async function handleDelete(quiz: Quiz) {
    if (!window.confirm(
      `Delete "${quiz.title}"?\n\nThis will permanently delete the quiz and all its questions. This cannot be undone.`
    )) return;
    try {
      await deleteQuiz(quiz.id);
      invalidateFor(appQueryClient, 'quiz.delete', { courseId: quiz.courseId ?? undefined });
      setQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
      showToast('success', 'Quiz deleted.');
    } catch (err) {
      if (err instanceof QuizApiError && err.status === 401) { navigate('/login'); return; }
      showToast('error', err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (view.kind === 'create') {
    return (
      <>
        <QuizForm
          mode="create"
          initial={{
            title: '', description: '', courseId: '',
            passingGrade: 60, attemptsUnlimited: true, attemptsAllowed: 1,
            timeLimitNone: true, timeLimit: 30, randomizeQuestions: false,
          }}
          onSave={handleCreate}
          onBack={() => setView({ kind: 'list' })}
        />
        {toast && <ToastBanner {...toast} />}
      </>
    );
  }

  if (view.kind === 'edit') {
    const quiz = view.quiz;
    return (
      <>
        <QuizForm
          mode="edit"
          initial={{
            title: quiz.title, description: quiz.description ?? '', courseId: quiz.courseId ?? '',
            passingGrade: quiz.passingGrade,
            attemptsUnlimited: quiz.attemptsAllowed === null, attemptsAllowed: quiz.attemptsAllowed ?? 1,
            timeLimitNone: quiz.timeLimit === null, timeLimit: quiz.timeLimit ?? 30,
            randomizeQuestions: quiz.randomizeQuestions,
          }}
          onSave={(values) => handleEdit(quiz, values)}
          onBack={() => setView({ kind: 'list' })}
        />
        {toast && <ToastBanner {...toast} />}
      </>
    );
  }

  if (view.kind === 'detail') {
    return (
      <>
        <DetailView
          quizId={view.quizId}
          onBack={() => { setView({ kind: 'list' }); loadQuizzes(); }}
          onEdit={(quiz) => setView({ kind: 'edit', quiz })}
          showToast={showToast}
        />
        {toast && <ToastBanner {...toast} />}
      </>
    );
  }

  // List view
  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <div className="tw:flex tw:items-center tw:justify-between">
        <h2 className="tw:m-0 tw:text-[17px] tw:font-semibold tw:text-slate-900">Assessments</h2>
        <button type="button" onClick={() => setView({ kind: 'create' })}
          aria-label="Create Quiz"
          className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700">
          <Plus className="tw:h-4 tw:w-4" strokeWidth={2.5} />
          Create Quiz
        </button>
      </div>

      <ListView
        quizzes={quizzes}
        courseTitles={courseTitles}
        loading={loading}
        error={error}
        onRetry={loadQuizzes}
        onCreate={() => setView({ kind: 'create' })}
        onEdit={(q) => setView({ kind: 'edit', quiz: q })}
        onView={(q) => setView({ kind: 'detail', quizId: q.id })}
        onDelete={handleDelete}
      />

      {toast && <ToastBanner {...toast} />}
    </div>
  );
}
