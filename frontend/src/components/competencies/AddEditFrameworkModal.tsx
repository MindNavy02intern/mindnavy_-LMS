import { useEffect, useState } from 'react';
import { createFramework, updateFramework } from '../../services/competenciesApi';
import { CompetenciesApiError } from '../../types/competencies';
import type { Framework, FrameworkStatus } from '../../types/competencies';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  mode:       'create' | 'edit';
  framework?: Framework;
  onClose:    () => void;
  onSuccess:  () => void;
  showToast:  (type: 'success' | 'error', message: string) => void;
}

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13,
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  border: '1px solid #d1d5db', borderRadius: 6, color: '#374151', background: '#fff',
};
const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
const ERR: React.CSSProperties = { fontSize: 11, color: '#ef4444', marginTop: 3 };

export default function AddEditFrameworkModal({ mode, framework, onClose, onSuccess, showToast }: Props) {
  const [name,        setName]        = useState(framework?.name ?? '');
  const [description, setDescription] = useState(framework?.description ?? '');
  const [status,       setStatus]     = useState<FrameworkStatus>(framework?.status ?? 'DRAFT');

  const [errors,      setErrors]      = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);

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
        const created = await createFramework({
          name: name.trim(),
          ...(description.trim() ? { description: description.trim() } : {}),
          status,
        });
        invalidateFor(appQueryClient, 'framework.create', { id: created.id });
        showToast('success', `"${created.name}" framework created.`);
      } else if (framework) {
        await updateFramework(framework.id, { name: name.trim(), description: description.trim(), status });
        invalidateFor(appQueryClient, 'framework.update', { id: framework.id });
        showToast('success', 'Framework updated.');
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
            {mode === 'create' ? 'Create Framework' : `Edit ${framework?.name ?? 'Framework'}`}
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
            <input style={INPUT} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Frontend Developer" />
            {errors.name && <div style={ERR}>{errors.name}</div>}
          </div>

          <div>
            <label style={LABEL}>Description</label>
            <textarea style={{ ...INPUT, minHeight: 70, resize: 'vertical' }} value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div>
            <label style={LABEL}>Status</label>
            <select style={INPUT} value={status} onChange={e => setStatus(e.target.value as FrameworkStatus)}>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} disabled={submitting} style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Saving…' : mode === 'create' ? 'Create Framework' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
