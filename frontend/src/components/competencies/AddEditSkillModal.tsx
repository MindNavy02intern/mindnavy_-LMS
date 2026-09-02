import { useEffect, useState } from 'react';
import { createSkill, listSkillCategories, updateSkill } from '../../services/competenciesApi';
import { CompetenciesApiError, SKILL_LEVELS } from '../../types/competencies';
import type { Skill, SkillCategory, SkillLevel } from '../../types/competencies';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  mode:    'create' | 'edit';
  skill?:  Skill;
  onClose:   () => void;
  onSuccess: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  border: '1px solid #d1d5db', borderRadius: 6, color: '#374151', background: '#fff',
};
const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
const ERR: React.CSSProperties = { fontSize: 11, color: '#ef4444', marginTop: 3 };

// Flatten the 2-level category tree into a single option list — parent then
// its children indented, same R2 rule as every other dropdown in the app
// (reads the real ['competencies','categories'] source, never hardcoded).
function flattenCategories(tree: SkillCategory[]): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const root of tree) {
    out.push({ id: root.id, label: root.name });
    for (const child of root.children ?? []) out.push({ id: child.id, label: `— ${child.name}` });
  }
  return out;
}

export default function AddEditSkillModal({ mode, skill, onClose, onSuccess, showToast }: Props) {
  const [name,        setName]        = useState(skill?.name ?? '');
  const [description, setDescription] = useState(skill?.description ?? '');
  const [categoryId,  setCategoryId]  = useState(skill?.categoryId ?? '');
  const [level,       setLevel]       = useState<SkillLevel>(skill?.level ?? 'BEGINNER');
  const [status,      setStatus]      = useState<'ACTIVE' | 'ARCHIVED'>(skill?.status ?? 'ACTIVE');

  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);

  useEffect(() => {
    listSkillCategories().then(tree => setCategories(flattenCategories(tree))).catch(err => console.error(err));
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = 'Name must be at least 2 characters.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (mode === 'create') {
        const created = await createSkill({
          name: name.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(categoryId ? { categoryId } : {}),
          level,
          status,
        });
        invalidateFor(appQueryClient, 'skill.create', { id: created.id });
        showToast('success', `"${created.name}" created.`);
      } else if (skill) {
        await updateSkill(skill.id, {
          name: name.trim(),
          description: description.trim(),
          categoryId: categoryId || undefined,
          level,
          status,
        });
        invalidateFor(appQueryClient, 'skill.update', { id: skill.id });
        showToast('success', 'Competency updated.');
      }
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
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>
            {mode === 'create' ? 'Create Competency' : `Edit ${skill?.name ?? 'Competency'}`}
          </h3>
          <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {serverError && (
            <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#b91c1c' }}>{serverError}</div>
          )}

          <div>
            <label style={LABEL}>Name *</label>
            <input style={INPUT} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. React Development" />
            {errors.name && <div style={ERR}>{errors.name}</div>}
          </div>

          <div>
            <label style={LABEL}>Description</label>
            <textarea style={{ ...INPUT, minHeight: 70, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL}>Category</label>
              <select style={INPUT} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                <option value="">No category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>Level</label>
              <select style={INPUT} value={level} onChange={e => setLevel(e.target.value as SkillLevel)}>
                {SKILL_LEVELS.map(l => <option key={l} value={l}>{l[0] + l.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
          </div>

          {mode === 'edit' && (
            <div>
              <label style={LABEL}>Status</label>
              <select style={INPUT} value={status} onChange={e => setStatus(e.target.value as 'ACTIVE' | 'ARCHIVED')}>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} disabled={submitting} style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Saving…' : mode === 'create' ? 'Create Competency' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
