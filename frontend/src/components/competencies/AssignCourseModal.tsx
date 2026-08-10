import { useEffect, useState } from 'react';
import { listCourses } from '../../services/coursesApi';
import { assignCourseToSkill } from '../../services/competenciesApi';
import { CompetenciesApiError } from '../../types/competencies';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  skillId:   string;
  skillName: string;
  onClose:   () => void;
  onSuccess: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

interface CourseOption { id: string; title: string }

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  border: '1px solid #d1d5db', borderRadius: 6, color: '#374151', background: '#fff',
};
const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
const ERR: React.CSSProperties = { fontSize: 11, color: '#ef4444', marginTop: 3 };

export default function AssignCourseModal({ skillId, skillName, onClose, onSuccess, showToast }: Props) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<CourseOption[]>([]);
  const [selected, setSelected] = useState<CourseOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      listCourses({ search: search.trim() || undefined, limit: 8 })
        .then(res => { if (!cancelled) setOptions(res.courses.map(c => ({ id: c.id, title: c.title }))); })
        .catch(() => {});
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!selected) { setError('Select a course.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      await assignCourseToSkill(skillId, selected.id);
      invalidateFor(appQueryClient, 'skill.assignToCourse', { id: skillId, courseId: selected.id });
      showToast('success', `"${selected.title}" assigned to "${skillName}".`);
      onSuccess();
    } catch (err) {
      const msg = err instanceof CompetenciesApiError ? err.message : 'Something went wrong. Please try again.';
      setServerError(msg);
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!submitting ? onClose : undefined} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>Assign Course to "{skillName}"</h3>
          <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {serverError && (
            <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#b91c1c' }}>{serverError}</div>
          )}

          <div style={{ position: 'relative' }}>
            <label style={LABEL}>Course *</label>
            {selected ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13 }}>
                <span>{selected.title}</span>
                <button type="button" onClick={() => { setSelected(null); setSearch(''); }} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>Change</button>
              </div>
            ) : (
              <>
                <input style={INPUT} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses…" autoFocus />
                {options.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, marginTop: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 180, overflowY: 'auto' }}>
                    {options.map(c => (
                      <button key={c.id} type="button" onClick={() => { setSelected(c); setOptions([]); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#374151' }}>
                        {c.title}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            {error && <div style={ERR}>{error}</div>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} disabled={submitting} style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Assigning…' : 'Assign Course'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
