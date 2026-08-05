// Learning Paths Tab — v1: COURSE and LIVE_SESSION items only.
//
// State machine: list → create | edit (form) | detail (items).
//
// Key invariants:
//  - itemCount is always rendered from the server field, never computed from items.length
//  - item.id (path-item id) is used for remove/reorder; item.itemId is the course/session id
//  - missing: true items render as "unavailable" rows; never hidden, never crash on null title
//  - Archived course items show "Archived" badge — distinct from missing
//  - addItem success APPENDS resolved item to local state directly (no refetch)
//  - reorder sends ONE bulk call; replaces local state from the FULL response
//  - PATCH only sent when at least one field changed (empty patch is a backend 400)

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronLeft, Pencil, Trash2, ChevronUp, ChevronDown, BookOpen, Video, AlertTriangle, X } from 'lucide-react';
import {
  listPaths, getPath, createPath, updatePath, deletePath,
  addItem, removeItem, reorderItems,
  LearningPathApiError,
} from '../../services/learningPathsApi';
import { listCourses } from '../../services/coursesApi';
import { getLmLiveSessions } from '../../services/lmApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { LearningPath, LearningPathDetail, LearningPathItem, LearningPathItemType } from '../../types/learningPaths';
import type { CourseListRow } from '../../types/courses';
import type { LiveSession } from '../../types/lm';

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
  | { kind: 'edit';   path: LearningPath }
  | { kind: 'detail'; pathId: string };

// ── Badge helpers ─────────────────────────────────────────────────────────────

const COURSE_STATUS_BADGE: Record<string, string> = {
  Published: 'tw:bg-green-50 tw:text-green-700',
  Draft:     'tw:bg-amber-50 tw:text-amber-700',
  Pending:   'tw:bg-blue-50 tw:text-blue-700',
  Archived:  'tw:bg-slate-100 tw:text-slate-500',
};

const SESSION_STATUS_BADGE: Record<string, string> = {
  upcoming: 'tw:bg-sky-50 tw:text-sky-700',
  live:     'tw:bg-green-50 tw:text-green-700',
  ended:    'tw:bg-slate-100 tw:text-slate-500',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SequentialBadge({ sequential }: { sequential: boolean }) {
  return sequential ? (
    <span className="tw:rounded-full tw:bg-violet-50 tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-semibold tw:text-violet-700">
      Sequential
    </span>
  ) : (
    <span className="tw:rounded-full tw:bg-slate-100 tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-medium tw:text-slate-500">
      Free order
    </span>
  );
}

// ── Path form (create + edit) ─────────────────────────────────────────────────

interface PathFormProps {
  mode:    'create' | 'edit';
  initial: { title: string; description: string; sequential: boolean };
  onSave:  (values: { title: string; description: string; sequential: boolean }) => Promise<void>;
  onBack:  () => void;
}

function PathForm({ mode, initial, onSave, onBack }: PathFormProps) {
  const [title,       setTitle]       = useState(initial.title);
  const [description, setDescription] = useState(initial.description);
  const [sequential,  setSequential]  = useState(initial.sequential);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    if (title.trim().length > 200) { setError('Title must be at most 200 characters.'); return; }
    if (description.length > 2000) { setError('Description must be at most 2000 characters.'); return; }
    setSaving(true);
    setError(null);
    try {
      await onSave({ title: title.trim(), description, sequential });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tw:flex tw:flex-col tw:gap-5">
      {/* Header */}
      <div className="tw:flex tw:items-center tw:gap-3">
        <button type="button" onClick={onBack}
          className="tw:flex tw:items-center tw:gap-1 tw:text-[13px] tw:font-medium tw:text-slate-500 tw:hover:text-slate-700">
          <ChevronLeft className="tw:h-4 tw:w-4" strokeWidth={2} />
          Back
        </button>
        <h2 className="tw:m-0 tw:text-[17px] tw:font-semibold tw:text-slate-900">
          {mode === 'create' ? 'Create Learning Path' : 'Edit Learning Path'}
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
            placeholder="e.g. Python Full Stack Track"
            maxLength={200}
            required
            className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400 focus:tw:ring-2 focus:tw:ring-blue-100"
          />
          <span className={
            'tw:self-end tw:text-[11px] tw:font-mono' +
            (title.length > 200 ? ' tw:text-red-500' : ' tw:text-slate-400')
          }>
            {title.length}/200
          </span>
        </div>

        {/* Description */}
        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional overview of this learning path…"
            rows={4}
            className="tw:w-full tw:resize-y tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400 focus:tw:ring-2 focus:tw:ring-blue-100"
          />
          <span className={
            'tw:self-end tw:text-[11px] tw:font-mono' +
            (description.length > 2000 ? ' tw:text-red-500' : ' tw:text-slate-400')
          }>
            {description.length}/2000
          </span>
        </div>

        {/* Sequential toggle */}
        <div className="tw:flex tw:items-center tw:justify-between tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-3">
          <div>
            <p className="tw:m-0 tw:text-[13px] tw:font-semibold tw:text-slate-800">Sequential completion</p>
            <p className="tw:m-0 tw:text-[12px] tw:text-slate-500">
              {sequential
                ? 'Learners must complete items in order.'
                : 'Learners can complete items in any order.'}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={sequential}
            aria-label="Sequential completion"
            onClick={() => setSequential((s) => !s)}
            className={
              'tw:relative tw:h-6 tw:w-11 tw:flex-shrink-0 tw:rounded-full tw:border-2 tw:border-transparent tw:transition-colors' +
              (sequential ? ' tw:bg-blue-600' : ' tw:bg-slate-200')
            }
          >
            <span className={
              'tw:absolute tw:top-0.5 tw:h-4 tw:w-4 tw:rounded-full tw:bg-white tw:shadow tw:transition-transform' +
              (sequential ? ' tw:translate-x-5' : ' tw:translate-x-0.5')
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
            {saving ? 'Saving…' : mode === 'create' ? 'Create Path' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Item picker ───────────────────────────────────────────────────────────────

interface PickerProps {
  pathId:    string;
  onAdded:   (item: LearningPathItem) => void;
  onClose:   () => void;
}

function ItemPicker({ pathId, onAdded, onClose }: PickerProps) {
  const navigate = useNavigate();
  const [itemType,    setItemType]    = useState<LearningPathItemType>('COURSE');
  const [courses,     setCourses]     = useState<CourseListRow[]>([]);
  const [sessions,    setSessions]    = useState<LiveSession[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [selected,    setSelected]    = useState('');
  const [adding,      setAdding]      = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  // Load source list when type changes
  useEffect(() => {
    setSelected('');
    setPickerError(null);
    setLoadingList(true);
    const fetch = itemType === 'COURSE'
      ? listCourses({ limit: 200 }).then((r) => { setCourses(r.courses); })
      : getLmLiveSessions('upcoming').then((r) => setSessions(r));
    fetch
      .catch((err) => setPickerError(err instanceof Error ? err.message : 'Failed to load items.'))
      .finally(() => setLoadingList(false));
  }, [itemType]);

  // Escape closes picker
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleAdd() {
    if (!selected) return;
    setAdding(true);
    setPickerError(null);
    try {
      const item = await addItem(pathId, { itemType, itemId: selected });
      invalidateFor(appQueryClient, 'learningPath.item.add');
      onAdded(item);
    } catch (err) {
      if (err instanceof LearningPathApiError && err.status === 401) { navigate('/login'); return; }
      // Show exact backend message verbatim (covers duplicate, ref-not-found, unknown type)
      setPickerError(err instanceof Error ? err.message : 'Failed to add item.');
      setAdding(false);
    }
  }

  const courseOptions  = courses.filter((c) => c.status !== 'Archived');
  const sessionOptions = sessions;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div aria-label="modal backdrop"
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose} />

      <div role="dialog" aria-modal="true" aria-label="Add item to learning path"
        className="tw:relative tw:w-full tw:max-w-md tw:rounded-xl tw:bg-white tw:shadow-2xl tw:flex tw:flex-col">
        {/* Header */}
        <div className="tw:flex tw:flex-shrink-0 tw:items-center tw:justify-between tw:border-b tw:border-slate-200 tw:px-5 tw:py-4">
          <h3 className="tw:m-0 tw:text-[15px] tw:font-semibold tw:text-slate-900">Add Item</h3>
          <button type="button" onClick={onClose} aria-label="Close picker"
            className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-slate-100">
            <X className="tw:h-4 tw:w-4" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="tw:flex-1 tw:overflow-y-auto tw:px-5 tw:py-4 tw:flex tw:flex-col tw:gap-4">
          {/* Type selector */}
          <div>
            <p className="tw:m-0 tw:mb-2 tw:text-[12px] tw:font-semibold tw:text-slate-700">Item type</p>
            <div className="tw:flex tw:gap-2">
              {(['COURSE', 'LIVE_SESSION'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setItemType(t)}
                  aria-pressed={itemType === t}
                  className={
                    'tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:border tw:px-3 tw:py-2 tw:text-[12px] tw:font-medium tw:transition-colors' +
                    (itemType === t
                      ? ' tw:border-blue-500 tw:bg-blue-50 tw:text-blue-700'
                      : ' tw:border-slate-200 tw:text-slate-600 tw:hover:bg-slate-50')
                  }
                >
                  {t === 'COURSE' ? (
                    <BookOpen className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
                  ) : (
                    <Video className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
                  )}
                  {t === 'COURSE' ? 'Course' : 'Live Session'}
                </button>
              ))}
            </div>
          </div>

          {/* Item select */}
          <div>
            <label className="tw:mb-1.5 tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700">
              {itemType === 'COURSE' ? 'Select course' : 'Select live session'}
            </label>
            {loadingList ? (
              <div className="tw:h-9 tw:w-full tw:animate-pulse tw:rounded-lg tw:bg-slate-100" />
            ) : (
              <select
                value={selected}
                onChange={(e) => { setSelected(e.target.value); setPickerError(null); }}
                aria-label={itemType === 'COURSE' ? 'Select course' : 'Select live session'}
                className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
              >
                <option value="">
                  {itemType === 'COURSE'
                    ? courseOptions.length ? '— Select a course —' : 'No published/draft courses available'
                    : sessionOptions.length ? '— Select a live session —' : 'No upcoming sessions available'}
                </option>
                {itemType === 'COURSE'
                  ? courseOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.title} ({c.status})</option>
                  ))
                  : sessionOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))
                }
              </select>
            )}
          </div>

          {/* Inline error (exact backend message) */}
          {pickerError && (
            <div role="alert" className="tw:rounded-lg tw:border tw:border-red-100 tw:bg-red-50 tw:px-3 tw:py-2 tw:text-[12px] tw:text-red-600">
              {pickerError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="tw:flex tw:justify-end tw:gap-2 tw:border-t tw:border-slate-100 tw:px-5 tw:py-3.5">
          <button type="button" onClick={onClose} disabled={adding}
            className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50 tw:disabled:opacity-40">
            Cancel
          </button>
          <button type="button" onClick={handleAdd}
            disabled={adding || !selected}
            aria-label="Add item to path"
            className="tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700 tw:disabled:opacity-40">
            {adding ? 'Adding…' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Item row ──────────────────────────────────────────────────────────────────

interface ItemRowProps {
  item:       LearningPathItem;
  index:      number;
  total:      number;
  busy:       boolean;
  onMoveUp:   () => void;
  onMoveDown: () => void;
  onRemove:   () => void;
}

function PathItemRow({ item, index, total, busy, onMoveUp, onMoveDown, onRemove }: ItemRowProps) {
  if (item.missing) {
    return (
      <div className="tw:flex tw:items-center tw:gap-3 tw:rounded-lg tw:border tw:border-amber-100 tw:bg-amber-50 tw:px-3 tw:py-2.5 tw:opacity-75">
        <AlertTriangle className="tw:h-4 tw:w-4 tw:flex-shrink-0 tw:text-amber-500" strokeWidth={2} />
        <div className="tw:flex tw:flex-1 tw:items-center tw:gap-2">
          <span className="tw:text-[13px] tw:text-slate-500 tw:italic">Unavailable item</span>
          <span className="tw:rounded-full tw:bg-amber-100 tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-semibold tw:text-amber-700">
            Unavailable
          </span>
        </div>
        <button type="button" onClick={onRemove} disabled={busy}
          aria-label="Remove unavailable item"
          title="Remove"
          className="tw:flex-shrink-0 tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-red-50 tw:hover:text-red-500 tw:disabled:opacity-40">
          <Trash2 className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
        </button>
      </div>
    );
  }

  const isSession = item.itemType === 'LIVE_SESSION';
  const statusBadgeClass = isSession
    ? (SESSION_STATUS_BADGE[item.status ?? ''] ?? 'tw:bg-slate-100 tw:text-slate-600')
    : (COURSE_STATUS_BADGE[item.status ?? ''] ?? 'tw:bg-slate-100 tw:text-slate-600');

  return (
    <div className="tw:flex tw:items-center tw:gap-3 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-white tw:px-3 tw:py-2.5">
      {/* Reorder controls */}
      <div className="tw:flex tw:flex-col tw:gap-0.5">
        <button type="button" onClick={onMoveUp} disabled={busy || index === 0}
          aria-label="Move item up"
          className="tw:rounded tw:p-0.5 tw:text-slate-300 tw:hover:bg-slate-100 tw:hover:text-slate-600 tw:disabled:opacity-30">
          <ChevronUp className="tw:h-3.5 tw:w-3.5" strokeWidth={2.5} />
        </button>
        <button type="button" onClick={onMoveDown} disabled={busy || index === total - 1}
          aria-label="Move item down"
          className="tw:rounded tw:p-0.5 tw:text-slate-300 tw:hover:bg-slate-100 tw:hover:text-slate-600 tw:disabled:opacity-30">
          <ChevronDown className="tw:h-3.5 tw:w-3.5" strokeWidth={2.5} />
        </button>
      </div>

      {/* Type icon */}
      {isSession ? (
        <Video className="tw:h-4 tw:w-4 tw:flex-shrink-0 tw:text-sky-500" strokeWidth={2} />
      ) : (
        <BookOpen className="tw:h-4 tw:w-4 tw:flex-shrink-0 tw:text-violet-500" strokeWidth={2} />
      )}

      {/* Title + meta */}
      <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-0.5">
        <span className="tw:truncate tw:text-[13px] tw:font-medium tw:text-slate-800">
          {item.title ?? '—'}
        </span>
        {isSession && item.startTime && (
          <span className="tw:text-[11px] tw:text-slate-400">
            {new Date(item.startTime).toLocaleString()}
          </span>
        )}
      </div>

      {/* Status badge */}
      {item.status && (
        <span className={`tw:flex-shrink-0 tw:rounded-full tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-semibold ${statusBadgeClass}`}>
          {item.status}
        </span>
      )}

      {/* Remove */}
      <button type="button" onClick={onRemove} disabled={busy}
        aria-label={`Remove ${item.title ?? 'item'}`}
        title="Remove"
        className="tw:flex-shrink-0 tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-red-50 tw:hover:text-red-500 tw:disabled:opacity-40">
        <Trash2 className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

// ── Detail view ───────────────────────────────────────────────────────────────

interface DetailViewProps {
  pathId:  string;
  onBack:  () => void;
  onEdit:  (path: LearningPath) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

function DetailView({ pathId, onBack, onEdit, showToast }: DetailViewProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [detail,  setDetail]  = useState<LearningPathDetail | null>(null);
  const [busy,    setBusy]    = useState(false);
  const [picker,  setPicker]  = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await getPath(pathId);
      setDetail(d);
    } catch (err) {
      if (err instanceof LearningPathApiError && err.status === 401) { navigate('/login'); return; }
      setError(err instanceof Error ? err.message : 'Failed to load path.');
    } finally {
      setLoading(false);
    }
  }, [pathId, navigate]);

  useEffect(() => { load(); }, [load]);

  async function handleRemoveItem(item: LearningPathItem) {
    if (!window.confirm(`Remove "${item.title ?? 'this item'}" from the path?`)) return;
    setBusy(true);
    try {
      // Pass item.id (path-item id), NOT item.itemId (course/session id)
      await removeItem(pathId, item.id);
      invalidateFor(appQueryClient, 'learningPath.item.remove');
      setDetail((d) => d ? { ...d, items: d.items.filter((i) => i.id !== item.id) } : d);
      showToast('success', 'Item removed.');
    } catch (err) {
      if (err instanceof LearningPathApiError && err.status === 401) { navigate('/login'); return; }
      showToast('error', err instanceof Error ? err.message : 'Remove failed.');
    } finally {
      setBusy(false);
    }
  }

  async function sendReorder(newItems: LearningPathItem[]) {
    const payload = { items: newItems.map((it, i) => ({ id: it.id, order: i })) };
    setBusy(true);
    try {
      const updated = await reorderItems(pathId, payload);
      invalidateFor(appQueryClient, 'learningPath.item.reorder');
      // Replace local state from full response (never merge/patch manually)
      setDetail(updated);
    } catch (err) {
      if (err instanceof LearningPathApiError && err.status === 401) { navigate('/login'); return; }
      showToast('error', err instanceof Error ? err.message : 'Reorder failed.');
      await load(); // restore from server on error
    } finally {
      setBusy(false);
    }
  }

  function moveItem(idx: number, dir: 'up' | 'down') {
    if (!detail) return;
    const target = dir === 'up' ? idx - 1 : idx + 1;
    if (target < 0 || target >= detail.items.length) return;
    const next = [...detail.items];
    [next[idx], next[target]] = [next[target], next[idx]];
    setDetail({ ...detail, items: next });
    sendReorder(next);
  }

  function handleItemAdded(item: LearningPathItem) {
    // Append resolved item directly — no refetch needed
    setDetail((d) => d ? { ...d, items: [...d.items, item] } : d);
    setPicker(false);
    showToast('success', 'Item added.');
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
      {/* Header */}
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-3">
        <div className="tw:flex tw:items-center tw:gap-3">
          <button type="button" onClick={onBack}
            className="tw:flex tw:items-center tw:gap-1 tw:text-[13px] tw:font-medium tw:text-slate-500 tw:hover:text-slate-700">
            <ChevronLeft className="tw:h-4 tw:w-4" strokeWidth={2} /> Back
          </button>
          <div>
            <h2 className="tw:m-0 tw:text-[17px] tw:font-semibold tw:text-slate-900">{detail.title}</h2>
            <div className="tw:flex tw:items-center tw:gap-2 tw:mt-0.5">
              <SequentialBadge sequential={detail.sequential} />
              <span className="tw:text-[11px] tw:text-slate-400">
                {detail.itemCount} item{detail.itemCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
        <div className="tw:flex tw:items-center tw:gap-2">
          <button type="button" onClick={() => onEdit(detail)}
            className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-1.5 tw:text-[12px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50">
            <Pencil className="tw:h-3.5 tw:w-3.5" strokeWidth={2} /> Edit
          </button>
          <button type="button" onClick={() => setPicker(true)}
            className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-3 tw:py-1.5 tw:text-[12px] tw:font-semibold tw:text-white tw:hover:bg-blue-700">
            <Plus className="tw:h-3.5 tw:w-3.5" strokeWidth={2.5} /> Add Item
          </button>
        </div>
      </div>

      {/* Description */}
      {detail.description && (
        <p className="tw:m-0 tw:text-[13px] tw:leading-relaxed tw:text-slate-600">{detail.description}</p>
      )}

      {/* Items */}
      <div className="tw:flex tw:flex-col tw:gap-2">
        {detail.items.length === 0 && (
          <div className="tw:rounded-xl tw:border tw:border-dashed tw:border-slate-300 tw:bg-white tw:py-12 tw:text-center">
            <p className="tw:m-0 tw:text-[13px] tw:text-slate-400">No items yet. Add a course or live session.</p>
          </div>
        )}
        {detail.items.map((item, idx) => (
          <PathItemRow
            key={item.id}
            item={item}
            index={idx}
            total={detail.items.length}
            busy={busy}
            onMoveUp={() => moveItem(idx, 'up')}
            onMoveDown={() => moveItem(idx, 'down')}
            onRemove={() => handleRemoveItem(item)}
          />
        ))}
      </div>

      {picker && (
        <ItemPicker
          pathId={pathId}
          onAdded={handleItemAdded}
          onClose={() => setPicker(false)}
        />
      )}
    </div>
  );
}

// ── List view ─────────────────────────────────────────────────────────────────

interface ListViewProps {
  paths:     LearningPath[];
  loading:   boolean;
  error:     string | null;
  onRetry:   () => void;
  onCreate:  () => void;
  onEdit:    (path: LearningPath) => void;
  onView:    (path: LearningPath) => void;
  onDelete:  (path: LearningPath) => void;
}

function ListView({ paths, loading, error, onRetry, onCreate, onEdit, onView, onDelete }: ListViewProps) {
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

  if (paths.length === 0) {
    return (
      <div className="tw:flex tw:flex-col tw:items-center tw:justify-center tw:rounded-xl tw:border tw:border-dashed tw:border-slate-300 tw:bg-white tw:py-20 tw:gap-3">
        <p className="tw:m-0 tw:text-[14px] tw:text-slate-500">No learning paths yet.</p>
        <button type="button" onClick={onCreate}
          className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700">
          <Plus className="tw:h-4 tw:w-4" strokeWidth={2.5} /> Create Learning Path
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
            <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Items</th>
            <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Order</th>
            <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Updated</th>
            <th className="tw:px-4 tw:py-3" />
          </tr>
        </thead>
        <tbody>
          {paths.map((p) => (
            <tr key={p.id} className="tw:border-b tw:border-slate-50 tw:last:border-0 tw:hover:bg-slate-50">
              <td className="tw:px-4 tw:py-3">
                <div>
                  <button type="button" onClick={() => onView(p)}
                    className="tw:text-[13px] tw:font-semibold tw:text-slate-900 tw:hover:text-blue-600 tw:text-left">
                    {p.title}
                  </button>
                  {p.description && (
                    <p className="tw:m-0 tw:mt-0.5 tw:max-w-xs tw:truncate tw:text-[12px] tw:text-slate-400">{p.description}</p>
                  )}
                </div>
              </td>
              <td className="tw:px-4 tw:py-3 tw:text-[13px] tw:text-slate-700">
                {p.itemCount}
              </td>
              <td className="tw:px-4 tw:py-3">
                <SequentialBadge sequential={p.sequential} />
              </td>
              <td className="tw:px-4 tw:py-3 tw:text-[12px] tw:text-slate-400">
                {new Date(p.updatedAt).toLocaleDateString()}
              </td>
              <td className="tw:px-4 tw:py-3">
                <div className="tw:flex tw:items-center tw:justify-end tw:gap-1 tw:text-slate-400">
                  <button type="button" onClick={() => onEdit(p)}
                    aria-label={`Edit ${p.title}`}
                    className="tw:rounded tw:p-1 tw:hover:bg-slate-100 tw:hover:text-blue-600">
                    <Pencil className="tw:h-4 tw:w-4" strokeWidth={2} />
                  </button>
                  <button type="button" onClick={() => onDelete(p)}
                    aria-label={`Delete ${p.title}`}
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

interface LearningPathsTabProps {
  /** When true, mount directly into the create form (used by LmGuide's "Create Learning Path" shortcut). */
  openCreateOnMount?: boolean;
}

export default function LearningPathsTab({ openCreateOnMount }: LearningPathsTabProps) {
  const navigate = useNavigate();

  const [view,    setView]    = useState<View>(openCreateOnMount ? { kind: 'create' } : { kind: 'list' });
  const [paths,   setPaths]   = useState<LearningPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [toast,   setToast]   = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  const loadPaths = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listPaths();
      setPaths(rows);
    } catch (err) {
      if (err instanceof LearningPathApiError && err.status === 401) { navigate('/login'); return; }
      setError(err instanceof Error ? err.message : 'Failed to load learning paths.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { loadPaths(); }, [loadPaths]);

  async function handleCreate(values: { title: string; description: string; sequential: boolean }) {
    const payload = {
      title: values.title,
      description: values.description.trim() || null,
      sequential: values.sequential,
    };
    const created = await createPath(payload);
    invalidateFor(appQueryClient, 'learningPath.create');
    setPaths((prev) => [created, ...prev]);
    setView({ kind: 'list' });
    showToast('success', 'Learning path created.');
  }

  async function handleEdit(path: LearningPath, values: { title: string; description: string; sequential: boolean }) {
    // Build diff patch — only changed fields. Guard: empty patch is a backend 400.
    const patch: Record<string, unknown> = {};
    if (values.title.trim() !== path.title)                      patch.title       = values.title.trim();
    if ((values.description.trim() || null) !== path.description) patch.description = values.description.trim() || null;
    if (values.sequential !== path.sequential)                    patch.sequential  = values.sequential;

    if (Object.keys(patch).length === 0) {
      // Nothing changed — skip PATCH
      setView({ kind: 'list' });
      return;
    }

    const updated = await updatePath(path.id, patch);
    invalidateFor(appQueryClient, 'learningPath.update');
    setPaths((prev) => prev.map((p) => p.id === path.id ? updated : p));
    setView({ kind: 'list' });
    showToast('success', 'Learning path updated.');
  }

  async function handleDelete(path: LearningPath) {
    if (!window.confirm(
      `Delete "${path.title}"?\n\nThis will permanently delete the path and remove all its items. This cannot be undone.`
    )) return;
    try {
      await deletePath(path.id);
      invalidateFor(appQueryClient, 'learningPath.delete');
      setPaths((prev) => prev.filter((p) => p.id !== path.id));
      showToast('success', 'Learning path deleted.');
    } catch (err) {
      if (err instanceof LearningPathApiError && err.status === 401) { navigate('/login'); return; }
      showToast('error', err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (view.kind === 'create') {
    return (
      <>
        <PathForm
          mode="create"
          initial={{ title: '', description: '', sequential: false }}
          onSave={handleCreate}
          onBack={() => setView({ kind: 'list' })}
        />
        {toast && <ToastBanner {...toast} />}
      </>
    );
  }

  if (view.kind === 'edit') {
    const path = view.path;
    return (
      <>
        <PathForm
          mode="edit"
          initial={{ title: path.title, description: path.description ?? '', sequential: path.sequential }}
          onSave={(values) => handleEdit(path, values)}
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
          pathId={view.pathId}
          onBack={() => { setView({ kind: 'list' }); loadPaths(); }}
          onEdit={(path) => setView({ kind: 'edit', path })}
          showToast={showToast}
        />
        {toast && <ToastBanner {...toast} />}
      </>
    );
  }

  // List view
  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      {/* Top bar */}
      <div className="tw:flex tw:items-center tw:justify-between">
        <h2 className="tw:m-0 tw:text-[17px] tw:font-semibold tw:text-slate-900">Learning Paths</h2>
        <button type="button" onClick={() => setView({ kind: 'create' })}
          aria-label="Create learning path"
          className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700">
          <Plus className="tw:h-4 tw:w-4" strokeWidth={2.5} />
          Create Learning Path
        </button>
      </div>

      <ListView
        paths={paths}
        loading={loading}
        error={error}
        onRetry={loadPaths}
        onCreate={() => setView({ kind: 'create' })}
        onEdit={(p) => setView({ kind: 'edit', path: p })}
        onView={(p) => setView({ kind: 'detail', pathId: p.id })}
        onDelete={handleDelete}
      />

      {toast && <ToastBanner {...toast} />}
    </div>
  );
}
