// "More Actions" -> Bulk Enroll. POST /learners/bulk-enroll shipped in Part 3
// but never got a frontend until now — this is that frontend. Same
// course/path picker as EnrollLearnerModal.tsx; the new part is the learner
// multi-select, which follows the EmailCombo debounced-search pattern from
// InstructorInvitationsTab.tsx (search learners by name/email, click to add,
// chip list to remove).

import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { listCourses } from '../../services/coursesApi';
import { listPaths } from '../../services/learningPathsApi';
import { listLearners, bulkEnrollLearners } from '../../services/learnersApi';
import { LearnerApiError } from '../../types/learners';
import type { Learner } from '../../types/learners';
import type { CourseListRow } from '../../types/courses';
import type { LearningPath } from '../../types/learningPaths';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  onClose:   () => void;
  onSuccess: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

const SELECT: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13,
  border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151',
  fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
};

const INPUT: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13,
  border: '1px solid #e5e7eb', borderRadius: 6, outline: 'none', fontFamily: 'inherit',
};

function LearnerPicker({ selected, onAdd }: { selected: Learner[]; onAdd: (l: Learner) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Learner[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function runSearch(q: string) {
    listLearners({ search: q, limit: 10 })
      .then(res => setResults(res.learners))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }

  function handleChange(val: string) {
    setQuery(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = val.trim();
    if (q.length < 2) { setLoading(false); setResults(null); setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    searchTimer.current = setTimeout(() => runSearch(q), 300);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const selectedIds = new Set(selected.map(l => l.id));
  const visibleResults = (results ?? []).filter(l => !selectedIds.has(l.id));

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        aria-label="Search learners"
        value={query}
        onChange={e => handleChange(e.target.value)}
        onFocus={() => { if (query.trim().length >= 2) setOpen(true); }}
        placeholder="Search learners by name or email…"
        style={INPUT}
        autoComplete="off"
      />
      {loading && (
        <Loader2 size={14} color="#94a3b8" style={{ position: 'absolute', right: 9, top: 9, animation: 'mn-spin 0.65s linear infinite' }} />
      )}
      {open && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 200, overflowY: 'auto', zIndex: 10 }}>
          {loading && <div style={{ padding: '10px 12px', fontSize: 12, color: '#94a3b8' }}>Searching…</div>}
          {!loading && results !== null && visibleResults.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: '#94a3b8' }}>No matching learners</div>
          )}
          {!loading && visibleResults.map(l => (
            <button
              key={l.id}
              type="button"
              onClick={() => { onAdd(l); setQuery(''); setResults(null); setOpen(false); }}
              style={{ display: 'flex', flexDirection: 'column', width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>{l.fullName}</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{l.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BulkEnrollLearnersModal({ onClose, onSuccess, showToast }: Props) {
  const [mode, setMode] = useState<'course' | 'path'>('course');
  const [courses, setCourses] = useState<CourseListRow[] | null>(null);
  const [paths, setPaths] = useState<LearningPath[] | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [learners, setLearners] = useState<Learner[]>([]);
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoadingOptions(true);
    setOptionsError(null);
    if (mode === 'course') {
      listCourses({ limit: 100, status: 'Published' })
        .then(res => setCourses(res.courses))
        .catch(e => setOptionsError(e instanceof Error ? e.message : 'Failed to load courses.'))
        .finally(() => setLoadingOptions(false));
    } else {
      listPaths()
        .then(setPaths)
        .catch(e => setOptionsError(e instanceof Error ? e.message : 'Failed to load learning paths.'))
        .finally(() => setLoadingOptions(false));
    }
  }, [mode]);

  function addLearner(l: Learner) {
    setLearners(prev => (prev.some(x => x.id === l.id) ? prev : [...prev, l]));
    setErr('');
  }
  function removeLearner(id: string) {
    setLearners(prev => prev.filter(l => l.id !== id));
  }

  async function handleSubmit() {
    if (learners.length === 0) { setErr('Add at least one learner.'); return; }
    if (!selectedId) { setErr(mode === 'course' ? 'Select a course.' : 'Select a learning path.'); return; }
    setErr('');
    setSubmitting(true);
    try {
      const body = mode === 'course'
        ? { learnerIds: learners.map(l => l.id), courseId: selectedId }
        : { learnerIds: learners.map(l => l.id), learningPathId: selectedId };
      const result = await bulkEnrollLearners(body);
      invalidateFor(appQueryClient, 'learner.bulkEnroll', {
        courseId: mode === 'course' ? selectedId : undefined,
        learnerIds: learners.map(l => l.id),
      });
      const failed = result.failedCount ?? (learners.length - result.enrolledCount);
      showToast(
        failed > 0 ? 'error' : 'success',
        failed > 0
          ? `${result.enrolledCount} enrolled, ${failed} failed (already enrolled or unavailable).`
          : `${result.enrolledCount} learner(s) enrolled.`,
      );
      onSuccess();
    } catch (e) {
      showToast('error', e instanceof LearnerApiError ? e.message : 'Bulk enroll failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!submitting ? onClose : undefined} />
      <div role="dialog" aria-label="Bulk Enroll Learners" style={{ position: 'relative', width: '100%', maxWidth: 440, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Bulk Enroll Learners</h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>Enroll multiple learners into one course or learning path.</p>
        </div>

        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {optionsError && <div style={{ fontSize: 12, color: '#b91c1c' }}>{optionsError}</div>}

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Learners <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <LearnerPicker selected={learners} onAdd={addLearner} />
            {learners.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {learners.map(l => (
                  <span key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 999, background: '#eff6ff', color: '#1d4ed8', fontSize: 11.5, fontWeight: 600 }}>
                    {l.fullName}
                    <button
                      type="button" aria-label={`Remove ${l.fullName}`} onClick={() => removeLearner(l.id)}
                      style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: '#1d4ed8' }}
                    >
                      <X size={12} strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'flex', gap: 14, fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="radio" name="bulk-enroll-mode" checked={mode === 'course'} onChange={() => { setMode('course'); setSelectedId(''); }} />
                Course
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="radio" name="bulk-enroll-mode" checked={mode === 'path'} onChange={() => { setMode('path'); setSelectedId(''); }} />
                Learning Path
              </span>
            </label>
            <select
              aria-label={mode === 'course' ? 'Course' : 'Learning path'}
              value={selectedId}
              onChange={e => { setSelectedId(e.target.value); setErr(''); }}
              style={SELECT}
              disabled={loadingOptions}
            >
              <option value="">{loadingOptions ? 'Loading…' : `Select a ${mode === 'course' ? 'course' : 'learning path'}…`}</option>
              {mode === 'course'
                ? courses?.map(c => <option key={c.id} value={c.id}>{c.title}</option>)
                : paths?.map(p => <option key={p.id} value={p.id}>{p.title} ({p.itemCount} item{p.itemCount === 1 ? '' : 's'})</option>)}
            </select>
          </div>

          {err && <div style={{ fontSize: 11, color: '#dc2626' }}>{err}</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #f1f5f9' }}>
          <button type="button" onClick={onClose} disabled={submitting} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
            Cancel
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting || loadingOptions} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, background: submitting ? '#9ca3af' : '#2563eb', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#fff' }}>
            {submitting ? 'Enrolling…' : `Enroll ${learners.length || ''}`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}
