// Instructor Quiz step — Course Wizard step 3 (Basic Info -> Content -> Quiz ->
// Settings -> Preview -> Submit). Admin has no equivalent step inside its own
// Course Builder wizard — quizzes are a separate "Assessments" tab
// (components/learningManagement/AssessmentsTab.tsx) where courseId is an
// optional field on an otherwise-freestanding quiz. Since the instructor
// portal has no equivalent Assessments tab, this step is the ONLY place an
// instructor can manage a quiz — it always creates/edits a quiz forced onto
// the current course (never detachable), self-scoped via the new
// /api/instructor/courses/:id/quizzes endpoints.
//
// Logic (validate/buildData/option+pair helpers) ports the exact rules from
// AssessmentsTab.tsx's QuestionEditor — same 6 question types, same
// client-side validation — restyled with instructorUiKit inline styles.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listMyQuizzes, createMyQuiz, updateMyQuiz, deleteMyQuiz,
  getMyQuiz, createMyQuestion, updateMyQuestion, deleteMyQuestion,
  InstructorQuizApiError,
} from '../../api/instructorQuizzesApi';
import type {
  Quiz, QuizDetail, Question, QuestionType,
  MultipleChoiceData, MultiSelectData, MatchingPair,
  CreateQuestionPayload, UpdateQuestionPayload,
} from '../../types/quizzes';
import { LABEL, INPUT, BTN_PRIMARY, BTN_SECONDARY, BTN_DANGER, ERROR_BANNER, disabledStyle } from './instructorUiKit';

interface Props {
  courseId: string;
  onBack: () => void;
  onNext: () => void;
}

const V1_TYPES: QuestionType[] = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'MULTI_SELECT', 'ESSAY', 'FILL_IN_BLANK', 'MATCHING'];
const TYPE_LABEL: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: 'Multiple Choice',
  TRUE_FALSE: 'True / False',
  MULTI_SELECT: 'Multi-Select',
  ESSAY: 'Essay (manual grading)',
  FILL_IN_BLANK: 'Fill in the Blank',
  MATCHING: 'Matching',
};

const MIN_OPTIONS = 2, MAX_OPTIONS = 10, MIN_PAIRS = 2, MAX_PAIRS = 10;
function emptyOptions(): string[] { return ['', '']; }
function emptyPairs(): MatchingPair[] { return [{ left: '', right: '' }, { left: '', right: '' }]; }

// ── Quiz form (create + edit) ────────────────────────────────────────────────

interface QuizFormValues {
  title: string;
  passingGrade: number;
  attemptsUnlimited: boolean;
  attemptsAllowed: number;
  timeLimitNone: boolean;
  timeLimit: number;
  randomizeQuestions: boolean;
}

function QuizForm({
  mode, initial, onSave, onCancel,
}: {
  mode: 'create' | 'edit';
  initial: QuizFormValues;
  onSave: (v: QuizFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [passingGrade, setPassingGrade] = useState(initial.passingGrade);
  const [attemptsUnlimited, setAttemptsUnlimited] = useState(initial.attemptsUnlimited);
  const [attemptsAllowed, setAttemptsAllowed] = useState(initial.attemptsAllowed);
  const [timeLimitNone, setTimeLimitNone] = useState(initial.timeLimitNone);
  const [timeLimit, setTimeLimit] = useState(initial.timeLimit);
  const [randomizeQuestions, setRandomizeQuestions] = useState(initial.randomizeQuestions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!title.trim()) { setError('Title is required.'); return; }
    if (title.trim().length > 200) { setError('Title must be at most 200 characters.'); return; }
    if (!Number.isInteger(passingGrade) || passingGrade < 0 || passingGrade > 100) {
      setError('Passing grade must be an integer between 0 and 100.'); return;
    }
    if (!attemptsUnlimited && (!Number.isInteger(attemptsAllowed) || attemptsAllowed < 1 || attemptsAllowed > 100)) {
      setError('Attempts allowed must be an integer between 1 and 100 (or unlimited).'); return;
    }
    if (!timeLimitNone && (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > 600)) {
      setError('Time limit must be an integer between 1 and 600 minutes (or none).'); return;
    }
    setSaving(true); setError(null);
    try {
      await onSave({ title: title.trim(), passingGrade, attemptsUnlimited, attemptsAllowed, timeLimitNone, timeLimit, randomizeQuestions });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mn-db-card">
      <div className="mn-db-card-header"><div className="mn-db-card-title">{mode === 'create' ? 'Create Quiz' : 'Edit Quiz'}</div></div>
      {error && <div style={{ ...ERROR_BANNER, marginBottom: 12 }}>{error}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={LABEL}>Title *</label>
          <input style={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="e.g. Module 1 Quiz" autoFocus />
        </div>
        <div>
          <label style={LABEL}>Passing grade (%)</label>
          <input style={{ ...INPUT, maxWidth: 140 }} type="number" min={0} max={100} value={passingGrade} onChange={(e) => setPassingGrade(Number(e.target.value))} />
        </div>
        <div>
          <label style={LABEL}>Randomize questions</label>
          <button type="button" style={randomizeQuestions ? BTN_PRIMARY : BTN_SECONDARY} onClick={() => setRandomizeQuestions((v) => !v)}>
            {randomizeQuestions ? 'On' : 'Off'}
          </button>
        </div>
        <div>
          <label style={LABEL}>Attempts allowed</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input style={{ ...INPUT, maxWidth: 100 }} type="number" min={1} max={100} value={attemptsAllowed} disabled={attemptsUnlimited}
              onChange={(e) => setAttemptsAllowed(Number(e.target.value))} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569' }}>
              <input type="checkbox" checked={attemptsUnlimited} onChange={(e) => setAttemptsUnlimited(e.target.checked)} /> Unlimited
            </label>
          </div>
        </div>
        <div>
          <label style={LABEL}>Time limit (minutes)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input style={{ ...INPUT, maxWidth: 100 }} type="number" min={1} max={600} value={timeLimit} disabled={timeLimitNone}
              onChange={(e) => setTimeLimit(Number(e.target.value))} />
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569' }}>
              <input type="checkbox" checked={timeLimitNone} onChange={(e) => setTimeLimitNone(e.target.checked)} /> No limit
            </label>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" style={BTN_SECONDARY} onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="button" style={disabledStyle(BTN_PRIMARY, saving)} disabled={saving} onClick={handleSubmit}>
          {saving ? 'Saving…' : mode === 'create' ? 'Create Quiz' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ── Question editor modal (all 6 types) ──────────────────────────────────────

function QuestionEditor({
  courseId, quizId, existing, onSaved, onClose,
}: {
  courseId: string;
  quizId: string;
  existing: Question | null;
  onSaved: (q: Question) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [type, setType] = useState<QuestionType>(existing?.type ?? 'MULTIPLE_CHOICE');
  const [prompt, setPrompt] = useState(existing?.prompt ?? '');
  const [points, setPoints] = useState(existing?.points ?? 1);

  const [options, setOptions] = useState<string[]>(
    existing && (existing.type === 'MULTIPLE_CHOICE' || existing.type === 'MULTI_SELECT') ? existing.data.options : emptyOptions(),
  );
  const [correctIndex, setCorrectIndex] = useState<number | null>(existing?.type === 'MULTIPLE_CHOICE' ? existing.data.correctIndex : null);
  const [correctIndexes, setCorrectIndexes] = useState<Set<number>>(new Set(existing?.type === 'MULTI_SELECT' ? existing.data.correctIndexes : []));
  const [correct, setCorrect] = useState<boolean>(existing?.type === 'TRUE_FALSE' ? existing.data.correct : false);
  const [correctAnswer, setCorrectAnswer] = useState<string>(existing?.type === 'FILL_IN_BLANK' ? existing.data.correctAnswer : '');
  const [pairs, setPairs] = useState<MatchingPair[]>(existing?.type === 'MATCHING' ? existing.data.pairs : emptyPairs());

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ prompt?: string; options?: string; points?: string }>({});

  function handleTypeChange(next: QuestionType) {
    setType(next);
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
  function addPair() { setPairs((prev) => (prev.length < MAX_PAIRS ? [...prev, { left: '', right: '' }] : prev)); }
  function removePair(idx: number) { setPairs((prev) => (prev.length <= MIN_PAIRS ? prev : prev.filter((_, i) => i !== idx))); }

  function updateOption(idx: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
    setFieldErrors((prev) => ({ ...prev, options: undefined }));
  }
  function addOption() { setOptions((prev) => (prev.length < MAX_OPTIONS ? [...prev, ''] : prev)); }
  function removeOption(idx: number) {
    setOptions((prev) => (prev.length <= MIN_OPTIONS ? prev : prev.filter((_, i) => i !== idx)));
    setCorrectIndex((prev) => (prev === null ? null : prev === idx ? null : prev > idx ? prev - 1 : prev));
    setCorrectIndexes((prev) => {
      const next = new Set<number>();
      for (const i of prev) { if (i === idx) continue; next.add(i > idx ? i - 1 : i); }
      return next;
    });
  }
  function toggleCorrectIndex(idx: number) {
    setCorrectIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function buildData(): MultipleChoiceData | MultiSelectData | { correct: boolean } | { correctAnswer: string } | { pairs: MatchingPair[] } | null {
    if (type === 'ESSAY') return null;
    if (type === 'TRUE_FALSE') return { correct };
    if (type === 'FILL_IN_BLANK') return { correctAnswer: correctAnswer.trim() };
    if (type === 'MATCHING') return { pairs: pairs.map((p) => ({ left: p.left.trim(), right: p.right.trim() })) };
    if (type === 'MULTIPLE_CHOICE') return { options: options.map((o) => o.trim()), correctIndex: correctIndex as number };
    return { options: options.map((o) => o.trim()), correctIndexes: [...correctIndexes].sort((a, b) => a - b) };
  }

  function validate(): { prompt?: string; options?: string; points?: string } {
    const errors: { prompt?: string; options?: string; points?: string } = {};
    if (!prompt.trim()) errors.prompt = 'Prompt is required.';
    else if (prompt.trim().length > 2000) errors.prompt = 'Prompt must be at most 2000 characters.';

    if (!Number.isInteger(points) || points < 1 || points > 100) errors.points = 'Points must be an integer between 1 and 100.';

    if (type === 'MULTIPLE_CHOICE' || type === 'MULTI_SELECT') {
      if (options.length < MIN_OPTIONS || options.length > MAX_OPTIONS) errors.options = `Provide between ${MIN_OPTIONS} and ${MAX_OPTIONS} options.`;
      else if (options.some((o) => !o.trim())) errors.options = 'Every option must be filled in.';
      else if (options.some((o) => o.trim().length > 500)) errors.options = 'Each option must be at most 500 characters.';
      else if (type === 'MULTIPLE_CHOICE' && correctIndex === null) errors.options = 'Select the correct answer before saving.';
      else if (type === 'MULTI_SELECT' && correctIndexes.size === 0) errors.options = 'Select at least one correct answer before saving.';
    }
    if (type === 'FILL_IN_BLANK') {
      if (!correctAnswer.trim()) errors.options = 'Correct answer is required.';
      else if (correctAnswer.trim().length > 500) errors.options = 'Correct answer must be at most 500 characters.';
    }
    if (type === 'MATCHING') {
      if (pairs.length < MIN_PAIRS || pairs.length > MAX_PAIRS) errors.options = `Provide between ${MIN_PAIRS} and ${MAX_PAIRS} pairs.`;
      else if (pairs.some((p) => !p.left.trim() || !p.right.trim())) errors.options = 'Every pair needs both a left and right value.';
      else if (pairs.some((p) => p.left.trim().length > 200 || p.right.trim().length > 200)) errors.options = 'Each pair value must be at most 200 characters.';
    }
    return errors;
  }

  async function handleSave() {
    const errors = validate();
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({}); setSaving(true); setSaveError(null);
    try {
      const payload = { type, data: buildData(), prompt: prompt.trim(), points } as CreateQuestionPayload;
      const saved = existing
        ? await updateMyQuestion(courseId, quizId, existing.id, payload as UpdateQuestionPayload)
        : await createMyQuestion(courseId, quizId, payload);
      onSaved(saved);
    } catch (err) {
      if (err instanceof InstructorQuizApiError && err.status === 401) { navigate('/instructor/login'); return; }
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
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!saving ? onClose : undefined} />
      <div role="dialog" aria-modal="true" aria-label={existing ? 'Edit question' : 'Add question'}
        style={{ position: 'relative', width: '100%', maxWidth: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>{existing ? 'Edit Question' : 'Add Question'}</h3>
        </div>

        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          {saveError && <div style={ERROR_BANNER}>{saveError}</div>}

          <div>
            <label style={LABEL}>Question type</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {V1_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => handleTypeChange(t)}
                  style={type === t
                    ? { ...BTN_PRIMARY, textAlign: 'left', fontWeight: 600 }
                    : { ...BTN_SECONDARY, textAlign: 'left' }}>
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={LABEL}>Prompt *</label>
            <textarea style={{ ...INPUT, resize: 'vertical' }} rows={2} value={prompt} maxLength={2000}
              onChange={(e) => { setPrompt(e.target.value); setFieldErrors((p) => ({ ...p, prompt: undefined })); }} />
            {fieldErrors.prompt && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#dc2626' }}>{fieldErrors.prompt}</p>}
          </div>

          {/* Per-type answer data */}
          {(type === 'MULTIPLE_CHOICE' || type === 'MULTI_SELECT') && (
            <div>
              <label style={LABEL}>Options {type === 'MULTIPLE_CHOICE' ? '(select the correct one)' : '(check all correct answers)'}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {options.map((opt, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type={type === 'MULTIPLE_CHOICE' ? 'radio' : 'checkbox'}
                      name="correct-option"
                      checked={type === 'MULTIPLE_CHOICE' ? correctIndex === idx : correctIndexes.has(idx)}
                      onChange={() => (type === 'MULTIPLE_CHOICE' ? setCorrectIndex(idx) : toggleCorrectIndex(idx))}
                      aria-label={`Option ${idx + 1} correct`}
                    />
                    <input style={{ ...INPUT, flex: 1 }} value={opt} maxLength={500}
                      onChange={(e) => updateOption(idx, e.target.value)} placeholder={`Option ${idx + 1}`} />
                    <button type="button" disabled={options.length <= MIN_OPTIONS} onClick={() => removeOption(idx)}
                      style={{ ...BTN_DANGER, padding: '4px 8px', opacity: options.length <= MIN_OPTIONS ? 0.4 : 1 }}>×</button>
                  </div>
                ))}
              </div>
              <button type="button" disabled={options.length >= MAX_OPTIONS} onClick={addOption}
                style={{ ...BTN_SECONDARY, marginTop: 8, padding: '4px 10px', opacity: options.length >= MAX_OPTIONS ? 0.4 : 1 }}>+ Add option</button>
              {fieldErrors.options && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#dc2626' }}>{fieldErrors.options}</p>}
            </div>
          )}

          {type === 'TRUE_FALSE' && (
            <div>
              <label style={LABEL}>Correct answer</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" style={correct ? BTN_PRIMARY : BTN_SECONDARY} onClick={() => setCorrect(true)}>True</button>
                <button type="button" style={!correct ? BTN_PRIMARY : BTN_SECONDARY} onClick={() => setCorrect(false)}>False</button>
              </div>
            </div>
          )}

          {type === 'FILL_IN_BLANK' && (
            <div>
              <label style={LABEL}>Correct answer (exact match) *</label>
              <input style={INPUT} value={correctAnswer} maxLength={500}
                onChange={(e) => { setCorrectAnswer(e.target.value); setFieldErrors((p) => ({ ...p, options: undefined })); }} />
              {fieldErrors.options && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#dc2626' }}>{fieldErrors.options}</p>}
            </div>
          )}

          {type === 'MATCHING' && (
            <div>
              <label style={LABEL}>Pairs</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pairs.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input style={{ ...INPUT, flex: 1 }} value={p.left} maxLength={200} placeholder="Left"
                      onChange={(e) => updatePair(idx, 'left', e.target.value)} />
                    <span style={{ color: '#94a3b8', fontSize: 12 }}>↔</span>
                    <input style={{ ...INPUT, flex: 1 }} value={p.right} maxLength={200} placeholder="Right"
                      onChange={(e) => updatePair(idx, 'right', e.target.value)} />
                    <button type="button" disabled={pairs.length <= MIN_PAIRS} onClick={() => removePair(idx)}
                      style={{ ...BTN_DANGER, padding: '4px 8px', opacity: pairs.length <= MIN_PAIRS ? 0.4 : 1 }}>×</button>
                  </div>
                ))}
              </div>
              <button type="button" disabled={pairs.length >= MAX_PAIRS} onClick={addPair}
                style={{ ...BTN_SECONDARY, marginTop: 8, padding: '4px 10px', opacity: pairs.length >= MAX_PAIRS ? 0.4 : 1 }}>+ Add pair</button>
              {fieldErrors.options && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#dc2626' }}>{fieldErrors.options}</p>}
            </div>
          )}

          {type === 'ESSAY' && (
            <p style={{ fontSize: 12, color: '#94a3b8' }}>Essay questions are graded manually — no answer key needed.</p>
          )}

          <div>
            <label style={LABEL}>Points</label>
            <input style={{ ...INPUT, maxWidth: 100 }} type="number" min={1} max={100} value={points}
              onChange={(e) => { setPoints(Number(e.target.value)); setFieldErrors((p) => ({ ...p, points: undefined })); }} />
            {fieldErrors.points && <p style={{ margin: '4px 0 0', fontSize: 11, color: '#dc2626' }}>{fieldErrors.points}</p>}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #f1f5f9', flexShrink: 0 }}>
          <button type="button" style={BTN_SECONDARY} onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" style={disabledStyle(BTN_PRIMARY, saving)} disabled={saving} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save Question'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Quiz detail (questions manager) ──────────────────────────────────────────

function QuizDetailView({
  courseId, quizId, onBack, onEditQuiz, onDeleteQuiz,
}: {
  courseId: string;
  quizId: string;
  onBack: () => void;
  onEditQuiz: () => void;
  onDeleteQuiz: () => void;
}) {
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<QuizDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [questionModal, setQuestionModal] = useState<{ mode: 'create' } | { mode: 'edit'; question: Question } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getMyQuiz(courseId, quizId)
      .then((q) => { setQuiz(q); setError(null); })
      .catch((err) => {
        if (err instanceof InstructorQuizApiError && err.status === 401) { navigate('/instructor/login'); return; }
        setError(err instanceof Error ? err.message : 'Failed to load quiz.');
      })
      .finally(() => setLoading(false));
  }, [courseId, quizId, navigate]);

  useEffect(load, [load]);

  async function handleDeleteQuestion(q: Question) {
    if (!confirm(`Delete this question? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteMyQuestion(courseId, quizId, q.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setBusy(false);
    }
  }

  async function moveQuestion(index: number, direction: -1 | 1) {
    if (!quiz) return;
    const target = index + direction;
    if (target < 0 || target >= quiz.questions.length) return;
    const reordered = [...quiz.questions];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setBusy(true);
    try {
      await Promise.all(reordered.map((q, i) => updateMyQuestion(courseId, quizId, q.id, { order: i })));
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Reorder failed.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><div className="mn-spinner" /></div>;
  if (error) return <div style={ERROR_BANNER}>{error}</div>;
  if (!quiz) return null;

  return (
    <div className="mn-db-card">
      <div className="mn-db-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="mn-db-card-title">{quiz.title}</div>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>
            {quiz.questionCount} question{quiz.questionCount !== 1 ? 's' : ''} · {quiz.totalPoints} pts · passing {quiz.passingGrade}%
            {quiz.autoGradable ? '' : ' · contains manually-graded questions'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={BTN_SECONDARY} onClick={onBack}>← Back to quizzes</button>
          <button type="button" style={BTN_SECONDARY} onClick={onEditQuiz}>Edit Quiz</button>
          <button type="button" style={BTN_DANGER} onClick={onDeleteQuiz}>Delete Quiz</button>
        </div>
      </div>

      {quiz.questions.length === 0 ? (
        <p style={{ fontSize: 12, color: '#94a3b8', padding: '10px 0' }}>No questions yet — add one below.</p>
      ) : (
        <div>
          {quiz.questions.map((q, idx) => (
            <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px', borderBottom: idx < quiz.questions.length - 1 ? '1px solid #f1f5f9' : undefined }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <button type="button" title="Move up" disabled={idx === 0 || busy} onClick={() => moveQuestion(idx, -1)}
                  style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.3 : 1, fontSize: 10, lineHeight: 1 }}>▲</button>
                <button type="button" title="Move down" disabled={idx === quiz.questions.length - 1 || busy} onClick={() => moveQuestion(idx, 1)}
                  style={{ background: 'none', border: 'none', cursor: idx === quiz.questions.length - 1 ? 'default' : 'pointer', opacity: idx === quiz.questions.length - 1 ? 0.3 : 1, fontSize: 10, lineHeight: 1 }}>▼</button>
              </div>
              <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 700, background: '#eef2ff', color: '#4338ca' }}>{TYPE_LABEL[q.type]}</span>
              <span style={{ flex: 1, fontSize: 12, color: '#374151' }}>{q.prompt}</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{q.points} pt{q.points !== 1 ? 's' : ''}</span>
              <button type="button" style={{ ...BTN_SECONDARY, padding: '4px 10px' }} onClick={() => setQuestionModal({ mode: 'edit', question: q })}>Edit</button>
              <button type="button" style={{ ...BTN_DANGER, padding: '4px 10px' }} onClick={() => handleDeleteQuestion(q)}>Delete</button>
            </div>
          ))}
        </div>
      )}

      <button type="button" style={{ ...BTN_SECONDARY, marginTop: 12 }} onClick={() => setQuestionModal({ mode: 'create' })}>+ Add Question</button>

      {questionModal && (
        <QuestionEditor
          courseId={courseId}
          quizId={quizId}
          existing={questionModal.mode === 'edit' ? questionModal.question : null}
          onClose={() => setQuestionModal(null)}
          onSaved={() => { setQuestionModal(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Main step component ──────────────────────────────────────────────────────

export default function InstructorQuizStep({ courseId, onBack, onNext }: Props) {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<{ kind: 'list' } | { kind: 'create' } | { kind: 'edit'; quiz: Quiz } | { kind: 'detail'; quizId: string }>({ kind: 'list' });

  const load = useCallback(() => {
    setLoading(true);
    listMyQuizzes(courseId)
      .then((q) => { setQuizzes(q); setError(null); })
      .catch((err) => {
        if (err instanceof InstructorQuizApiError && err.status === 401) { navigate('/instructor/login'); return; }
        setError(err instanceof Error ? err.message : 'Failed to load quizzes.');
      })
      .finally(() => setLoading(false));
  }, [courseId, navigate]);

  useEffect(load, [load]);

  async function handleCreate(v: QuizFormValues) {
    await createMyQuiz(courseId, {
      title: v.title,
      passingGrade: v.passingGrade,
      attemptsAllowed: v.attemptsUnlimited ? null : v.attemptsAllowed,
      timeLimit: v.timeLimitNone ? null : v.timeLimit,
      randomizeQuestions: v.randomizeQuestions,
    });
    setView({ kind: 'list' });
    load();
  }

  async function handleEdit(quizId: string, v: QuizFormValues) {
    await updateMyQuiz(courseId, quizId, {
      title: v.title,
      passingGrade: v.passingGrade,
      attemptsAllowed: v.attemptsUnlimited ? null : v.attemptsAllowed,
      timeLimit: v.timeLimitNone ? null : v.timeLimit,
      randomizeQuestions: v.randomizeQuestions,
    });
    setView({ kind: 'list' });
    load();
  }

  async function handleDelete(quiz: Quiz) {
    if (!confirm(`Delete quiz "${quiz.title}"? Its questions are removed too. This cannot be undone.`)) return;
    try {
      await deleteMyQuiz(courseId, quiz.id);
      setView({ kind: 'list' });
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  const header = (
    <div className="mn-db-card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div className="mn-db-card-title">Quiz</div>
        <p style={{ margin: '2px 0 0', fontSize: 11, color: '#94a3b8' }}>Optional — attach or create a quiz for this course.</p>
      </div>
    </div>
  );

  if (view.kind === 'create') {
    return (
      <QuizForm
        mode="create"
        initial={{ title: '', passingGrade: 60, attemptsUnlimited: true, attemptsAllowed: 1, timeLimitNone: true, timeLimit: 30, randomizeQuestions: false }}
        onSave={handleCreate}
        onCancel={() => setView({ kind: 'list' })}
      />
    );
  }

  if (view.kind === 'edit') {
    const q = view.quiz;
    return (
      <QuizForm
        mode="edit"
        initial={{
          title: q.title, passingGrade: q.passingGrade,
          attemptsUnlimited: q.attemptsAllowed == null, attemptsAllowed: q.attemptsAllowed ?? 1,
          timeLimitNone: q.timeLimit == null, timeLimit: q.timeLimit ?? 30,
          randomizeQuestions: q.randomizeQuestions,
        }}
        onSave={(v) => handleEdit(q.id, v)}
        onCancel={() => setView({ kind: 'list' })}
      />
    );
  }

  if (view.kind === 'detail') {
    return (
      <>
        <QuizDetailView
          courseId={courseId}
          quizId={view.quizId}
          onBack={() => setView({ kind: 'list' })}
          onEditQuiz={() => {
            const q = quizzes.find((x) => x.id === view.quizId);
            if (q) setView({ kind: 'edit', quiz: q });
          }}
          onDeleteQuiz={() => {
            const q = quizzes.find((x) => x.id === view.quizId);
            if (q) handleDelete(q);
          }}
        />
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between' }}>
          <button type="button" style={BTN_SECONDARY} onClick={onBack}>← Back: Content</button>
          <button type="button" style={BTN_PRIMARY} onClick={onNext}>Next: Settings →</button>
        </div>
      </>
    );
  }

  // list
  return (
    <div>
      <div className="mn-db-card">
        {header}
        {error && <div style={{ ...ERROR_BANNER, marginBottom: 12 }}>{error}</div>}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><div className="mn-spinner" /></div>
        ) : quizzes.length === 0 ? (
          <p style={{ fontSize: 12, color: '#94a3b8', padding: '10px 0' }}>No quiz attached yet.</p>
        ) : (
          <div>
            {quizzes.map((q, idx) => (
              <div key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 4px', borderBottom: idx < quizzes.length - 1 ? '1px solid #f1f5f9' : undefined }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#374151' }}>{q.title}</span>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>{q.questionCount} question{q.questionCount !== 1 ? 's' : ''}</span>
                <button type="button" style={{ ...BTN_SECONDARY, padding: '4px 10px' }} onClick={() => setView({ kind: 'detail', quizId: q.id })}>Manage</button>
                <button type="button" style={{ ...BTN_DANGER, padding: '4px 10px' }} onClick={() => handleDelete(q)}>Delete</button>
              </div>
            ))}
          </div>
        )}
        <button type="button" style={{ ...BTN_SECONDARY, marginTop: 12 }} onClick={() => setView({ kind: 'create' })}>+ Create Quiz</button>
      </div>

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between' }}>
        <button type="button" style={BTN_SECONDARY} onClick={onBack}>← Back: Content</button>
        <button type="button" style={BTN_PRIMARY} onClick={onNext}>Next: Settings →</button>
      </div>
    </div>
  );
}
