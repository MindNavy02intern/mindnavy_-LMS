// Categories tab — SkillCategory, 2-level hierarchy. Mirrors the Learning
// Management CategoriesTab's tree/CRUD logic, own model (color/status, no
// legacy Course.category resync).

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2, Archive, ArchiveRestore } from 'lucide-react';
import {
  listSkillCategories, createSkillCategory, updateSkillCategory, deleteSkillCategory,
} from '../../services/competenciesApi';
import { CompetenciesApiError } from '../../types/competencies';
import type { SkillCategory } from '../../types/competencies';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
}

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: 6, color: '#374151', background: '#fff',
};
const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };

interface FormState { name: string; description: string; color: string; parentId: string }
const EMPTY_FORM: FormState = { name: '', description: '', color: '#2563eb', parentId: '' };

function CategoryFormModal({
  title, initial, parentOptions, onClose, onSubmit, submitting, error,
}: {
  title: string; initial: FormState; parentOptions: SkillCategory[];
  onClose: () => void; onSubmit: (form: FormState) => void; submitting: boolean; error: string | null;
}) {
  const [form, setForm] = useState<FormState>(initial);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!submitting ? onClose : undefined} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111827' }}>{title}</h3>
          <button type="button" onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer' }}>×</button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSubmit(form); }} style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#b91c1c' }}>{error}</div>}
          <div>
            <label style={LABEL}>Name *</label>
            <input style={INPUT} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div>
            <label style={LABEL}>Description</label>
            <textarea style={{ ...INPUT, minHeight: 60, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={LABEL}>Color</label>
              <input type="color" style={{ ...INPUT, padding: 3, height: 34 }} value={form.color} onChange={e => setForm(f => ({ ...f, color: e.target.value }))} />
            </div>
            <div>
              <label style={LABEL}>Parent</label>
              <select style={INPUT} value={form.parentId} onChange={e => setForm(f => ({ ...f, parentId: e.target.value }))}>
                <option value="">— Root category</option>
                {parentOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button type="button" onClick={onClose} disabled={submitting} style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={submitting} style={{ padding: '9px 16px', fontSize: 13, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CategoriesTab({ showToast, refreshSignal }: Props) {
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createModal, setCreateModal] = useState<{ parentId: string } | null>(null);
  const [editModal, setEditModal] = useState<SkillCategory | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listSkillCategories()
      .then(setCategories)
      .catch(err => setError(err instanceof CompetenciesApiError ? err.message : 'Failed to load categories.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load, refreshSignal]);
  useEffect(() => {
    window.addEventListener('analyticsUpdated', load);
    return () => window.removeEventListener('analyticsUpdated', load);
  }, [load]);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleCreate(form: FormState) {
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      await createSkillCategory({ name: form.name.trim(), description: form.description.trim() || undefined, color: form.color, parentId: form.parentId || undefined });
      invalidateFor(appQueryClient, 'skillCategory.create');
      showToast('success', `Category "${form.name.trim()}" created.`);
      setCreateModal(null);
      load();
    } catch (err) {
      setFormError(err instanceof CompetenciesApiError ? err.message : 'Failed to create category.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(form: FormState) {
    if (!editModal) return;
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    setSubmitting(true);
    setFormError(null);
    try {
      await updateSkillCategory(editModal.id, {
        name: form.name.trim(),
        description: form.description.trim(),
        color: form.color,
        parentId: form.parentId || null,
      });
      invalidateFor(appQueryClient, 'skillCategory.update');
      showToast('success', 'Category updated.');
      setEditModal(null);
      load();
    } catch (err) {
      setFormError(err instanceof CompetenciesApiError ? err.message : 'Failed to update category.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchiveToggle(cat: SkillCategory) {
    setBusyId(cat.id);
    try {
      const nextStatus = cat.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
      await updateSkillCategory(cat.id, { status: nextStatus });
      invalidateFor(appQueryClient, 'skillCategory.archive');
      showToast('success', nextStatus === 'ARCHIVED' ? 'Category archived.' : 'Category reactivated.');
      load();
    } catch (err) {
      showToast('error', err instanceof CompetenciesApiError ? err.message : 'Failed to update category.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(cat: SkillCategory) {
    if (!window.confirm(`Delete "${cat.name}"? Blocked while it has subcategories or skills.`)) return;
    setBusyId(cat.id);
    try {
      await deleteSkillCategory(cat.id);
      invalidateFor(appQueryClient, 'skillCategory.delete');
      showToast('success', 'Category deleted.');
      load();
    } catch (err) {
      // Backend message is shown verbatim (HAS_CHILDREN_DELETE / HAS_SKILLS) —
      // same rule as the Learning Management CategoriesTab.
      showToast('error', err instanceof CompetenciesApiError ? err.message : 'Failed to delete category.');
    } finally {
      setBusyId(null);
    }
  }

  const roots = categories.filter(c => !c.parentId);

  function Row({ cat, indent }: { cat: SkillCategory; indent: number }) {
    const busy = busyId === cat.id;
    const children = cat.children ?? [];
    const isExpanded = expanded.has(cat.id);
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', paddingLeft: 16 + indent * 24, borderBottom: '1px solid #f8fafc', opacity: busy ? 0.5 : 1 }}>
          {children.length > 0 ? (
            <button type="button" onClick={() => toggleExpand(cat.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0 }}>
              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            </button>
          ) : <span style={{ width: 15 }} />}
          <span style={{ width: 10, height: 10, borderRadius: 3, background: cat.color ?? '#cbd5e1', flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', flex: 1 }}>{cat.name}</span>
          {cat.status === 'ARCHIVED' && <span style={{ padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: '#f1f5f9', color: '#94a3b8' }}>ARCHIVED</span>}
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{cat.skillCount} skill{cat.skillCount !== 1 ? 's' : ''}</span>
          {!cat.parentId && (
            <button type="button" title="Add subcategory" onClick={() => { setFormError(null); setCreateModal({ parentId: cat.id }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
              <Plus size={14} />
            </button>
          )}
          <button type="button" title="Edit" onClick={() => { setFormError(null); setEditModal(cat); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            <Pencil size={14} />
          </button>
          <button type="button" title={cat.status === 'ACTIVE' ? 'Archive' : 'Reactivate'} disabled={busy} onClick={() => handleArchiveToggle(cat)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
            {cat.status === 'ACTIVE' ? <Archive size={14} /> : <ArchiveRestore size={14} />}
          </button>
          <button type="button" title="Delete" disabled={busy} onClick={() => handleDelete(cat)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
            <Trash2 size={14} />
          </button>
        </div>
        {isExpanded && children.map(child => <Row key={child.id} cat={child} indent={indent + 1} />)}
      </>
    );
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottom: '1px solid #f1f5f9' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>Skill Categories</span>
        <button type="button" onClick={() => { setFormError(null); setCreateModal({ parentId: '' }); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, color: '#fff', background: '#2563eb', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          <Plus size={14} strokeWidth={2.5} /> Add Category
        </button>
      </div>

      {error && <div style={{ margin: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#b91c1c' }}>{error}</div>}

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
      ) : roots.length === 0 ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No categories yet.</div>
      ) : (
        roots.map(root => <Row key={root.id} cat={root} indent={0} />)
      )}

      {createModal && (
        <CategoryFormModal
          title={createModal.parentId ? 'Add Subcategory' : 'Add Category'}
          initial={{ ...EMPTY_FORM, parentId: createModal.parentId }}
          parentOptions={roots}
          onClose={() => setCreateModal(null)}
          onSubmit={handleCreate}
          submitting={submitting}
          error={formError}
        />
      )}

      {editModal && (
        <CategoryFormModal
          title="Edit Category"
          initial={{ name: editModal.name, description: editModal.description ?? '', color: editModal.color ?? '#2563eb', parentId: editModal.parentId ?? '' }}
          parentOptions={roots.filter(r => r.id !== editModal.id)}
          onClose={() => setEditModal(null)}
          onSubmit={handleEdit}
          submitting={submitting}
          error={formError}
        />
      )}
    </div>
  );
}
