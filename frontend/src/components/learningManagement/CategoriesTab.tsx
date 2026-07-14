// Categories Management Center — 2-level tree, CRUD.
// Backend errors shown VERBATIM (don't paraphrase HAS_CHILDREN_DELETE / HAS_COURSES etc.)
// MAX_DEPTH is client-side guarded by only showing root categories in the parent dropdown.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../services/categoriesApi';
import { CategoryApiError } from '../../types/categories';
import type { CategoryNode } from '../../types/categories';

// ── Toast ─────────────────────────────────────────────────────────────────────

interface ToastState { type: 'success' | 'error'; message: string }

function ToastBanner({ type, message }: ToastState) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9000,
      background: type === 'success' ? '#16a34a' : '#dc2626',
      color: '#fff', padding: '10px 18px', borderRadius: 8,
      fontSize: 13, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
      maxWidth: 420,
    }}>
      {message}
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────

function Modal({
  title, onClose, children, footer,
}: { title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div className="tw:relative tw:w-full tw:max-w-md tw:rounded-xl tw:bg-white tw:shadow-2xl tw:flex tw:flex-col">
        <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-slate-200 tw:px-5 tw:py-4">
          <h3 className="tw:m-0 tw:text-[15px] tw:font-semibold tw:text-slate-900">{title}</h3>
          <button type="button" onClick={onClose}
            className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="tw:h-4 tw:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="tw:px-5 tw:py-4 tw:flex tw:flex-col tw:gap-3">{children}</div>
        <div className="tw:flex tw:justify-end tw:gap-2 tw:border-t tw:border-slate-100 tw:px-5 tw:py-3.5">{footer}</div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CategoriesTab() {
  const navigate = useNavigate();

  const [categories,  setCategories]  = useState<CategoryNode[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadError,   setLoadError]   = useState<string | null>(null);
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [toast,       setToast]       = useState<ToastState | null>(null);

  // ── Create modal
  const [createModal,  setCreateModal]  = useState<{ parentId: string | null } | null>(null);
  const [createName,   setCreateName]   = useState('');
  const [creating,     setCreating]     = useState(false);
  const [createError,  setCreateError]  = useState<string | null>(null);

  // ── Edit modal
  const [editModal,    setEditModal]    = useState<CategoryNode | null>(null);
  const [editName,     setEditName]     = useState('');
  const [editParentId, setEditParentId] = useState('');   // '' = root (null)
  const [editing,      setEditing]      = useState(false);
  const [editError,    setEditError]    = useState<string | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(type: ToastState['type'], message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await listCategories();
      setCategories(data);
    } catch (err) {
      if (err instanceof CategoryApiError && err.status === 401) { navigate('/login'); return; }
      setLoadError(err instanceof Error ? err.message : 'Failed to load categories.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  // ── Expand toggle ─────────────────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── Create ────────────────────────────────────────────────────────────────

  function openCreate(parentId: string | null) {
    setCreateModal({ parentId });
    setCreateName('');
    setCreateError(null);
  }

  async function handleCreate() {
    const name = createName.trim();
    if (!name) { setCreateError('Name is required.'); return; }
    setCreating(true);
    setCreateError(null);
    try {
      await createCategory({ name, parentId: createModal?.parentId ?? undefined });
      showToast('success', `Category "${name}" created.`);
      setCreateModal(null);
      await load();
    } catch (err) {
      if (err instanceof CategoryApiError && err.status === 401) { navigate('/login'); return; }
      setCreateError(err instanceof Error ? err.message : 'Failed to create category.');
    } finally {
      setCreating(false);
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  function openEdit(node: CategoryNode) {
    setEditModal(node);
    setEditName(node.name);
    setEditParentId(node.parentId ?? '');
    setEditError(null);
  }

  async function handleEdit() {
    if (!editModal) return;
    const name = editName.trim();
    if (!name) { setEditError('Name is required.'); return; }

    const payload: { name?: string; parentId?: string | null } = {};
    if (name !== editModal.name) payload.name = name;

    const newParentId = editParentId || null;
    if (newParentId !== editModal.parentId) payload.parentId = newParentId;

    if (Object.keys(payload).length === 0) { setEditModal(null); return; }

    setEditing(true);
    setEditError(null);
    try {
      await updateCategory(editModal.id, payload);
      showToast('success', `Category "${name}" updated.`);
      setEditModal(null);
      await load();
    } catch (err) {
      if (err instanceof CategoryApiError && err.status === 401) { navigate('/login'); return; }
      setEditError(err instanceof Error ? err.message : 'Failed to update category.');
    } finally {
      setEditing(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(node: CategoryNode) {
    if (!window.confirm(`Delete "${node.name}"? This cannot be undone.`)) return;
    setDeletingId(node.id);
    try {
      await deleteCategory(node.id);
      showToast('success', `Category "${node.name}" deleted.`);
      await load();
    } catch (err) {
      if (err instanceof CategoryApiError && err.status === 401) { navigate('/login'); return; }
      // Show EXACT backend message (HAS_CHILDREN_DELETE / HAS_COURSES / etc.)
      showToast('error', err instanceof Error ? err.message : 'Failed to delete category.');
    } finally {
      setDeletingId(null);
    }
  }

  // ── Render: loading / error ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="tw:flex tw:flex-col tw:gap-4">
        <div className="tw:flex tw:items-center tw:justify-between">
          <div className="tw:h-6 tw:w-32 tw:animate-pulse tw:rounded tw:bg-slate-100" />
          <div className="tw:h-8 tw:w-28 tw:animate-pulse tw:rounded tw:bg-slate-100" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="tw:h-12 tw:w-full tw:animate-pulse tw:rounded-xl tw:bg-slate-100" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="tw:rounded-xl tw:border tw:border-red-100 tw:bg-red-50 tw:p-5 tw:text-center">
        <p className="tw:text-[13px] tw:text-red-500">{loadError}</p>
        <button type="button" onClick={load}
          className="tw:mt-2 tw:text-[13px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">
          Retry
        </button>
      </div>
    );
  }

  // Only root categories available as parent options (2-level max)
  const rootCategories = categories.filter(c => !c.parentId);

  const inputCls =
    'tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 ' +
    'tw:outline-none focus:tw:border-blue-400 focus:tw:ring-2 focus:tw:ring-blue-100';

  // ── Render: tree ──────────────────────────────────────────────────────────

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">

      {/* Header */}
      <div className="tw:flex tw:items-center tw:justify-between">
        <h2 className="tw:m-0 tw:text-[16px] tw:font-semibold tw:text-slate-900">Categories</h2>
        <button type="button" onClick={() => openCreate(null)}
          className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-3.5 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700">
          <Plus className="tw:h-4 tw:w-4" strokeWidth={2.5} />
          Add Category
        </button>
      </div>

      {/* Empty state */}
      {categories.length === 0 && (
        <div className="tw:rounded-xl tw:border tw:border-dashed tw:border-slate-300 tw:bg-white tw:p-10 tw:text-center">
          <p className="tw:text-[14px] tw:font-semibold tw:text-slate-500">No categories yet</p>
          <p className="tw:mt-1 tw:text-[13px] tw:text-slate-400">Create a category to organise your courses.</p>
          <button type="button" onClick={() => openCreate(null)}
            className="tw:mt-4 tw:inline-flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700">
            <Plus className="tw:h-4 tw:w-4" strokeWidth={2.5} /> Add Category
          </button>
        </div>
      )}

      {/* Tree */}
      <div className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white">
        {rootCategories.map(root => {
          const isExpanded = expanded.has(root.id);
          const children   = root.children ?? [];
          const isDeleting = deletingId === root.id;

          return (
            <div key={root.id} className="tw:border-b tw:border-slate-100 last:tw:border-b-0">
              {/* Root row */}
              <div className={
                'tw:flex tw:items-center tw:gap-2 tw:px-4 tw:py-3 tw:hover:bg-slate-50 tw:transition-colors' +
                (isDeleting ? ' tw:opacity-50' : '')
              }>
                {/* Expand toggle */}
                <button type="button" onClick={() => toggleExpand(root.id)}
                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                  className="tw:flex-shrink-0 tw:rounded tw:p-0.5 tw:text-slate-400 tw:hover:bg-slate-200 tw:hover:text-slate-700">
                  {children.length > 0
                    ? (isExpanded
                        ? <ChevronDown className="tw:h-4 tw:w-4" strokeWidth={2} />
                        : <ChevronRight className="tw:h-4 tw:w-4" strokeWidth={2} />)
                    : <span className="tw:h-4 tw:w-4 tw:inline-block" />
                  }
                </button>

                <span className="tw:flex-1 tw:text-[14px] tw:font-semibold tw:text-slate-900 tw:truncate">
                  {root.name}
                </span>

                {/* Subcategory count */}
                {children.length > 0 && (
                  <span className="tw:text-[11px] tw:text-slate-400 tw:flex-shrink-0">
                    {children.length} sub
                  </span>
                )}

                {/* Course count badge */}
                <span className="tw:flex-shrink-0 tw:rounded-full tw:bg-slate-100 tw:px-2 tw:py-0.5 tw:text-[11px] tw:font-medium tw:text-slate-600">
                  {root.courseCount} course{root.courseCount !== 1 ? 's' : ''}
                </span>

                {/* Actions */}
                <div className="tw:flex tw:items-center tw:gap-0.5 tw:flex-shrink-0">
                  <button type="button" onClick={() => openCreate(root.id)}
                    aria-label={`Add subcategory to ${root.name}`}
                    title="Add subcategory"
                    className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-blue-50 tw:hover:text-blue-600">
                    <Plus className="tw:h-3.5 tw:w-3.5" strokeWidth={2.5} />
                  </button>
                  <button type="button" onClick={() => openEdit(root)}
                    aria-label={`Edit ${root.name}`}
                    className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-slate-100 tw:hover:text-blue-600">
                    <Pencil className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
                  </button>
                  <button type="button" onClick={() => handleDelete(root)}
                    disabled={isDeleting}
                    aria-label={`Delete ${root.name}`}
                    className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-red-50 tw:hover:text-red-500 tw:disabled:opacity-40">
                    <Trash2 className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Subcategory rows */}
              {isExpanded && children.map(child => {
                const isDel = deletingId === child.id;
                return (
                  <div key={child.id}
                    className={
                      'tw:flex tw:items-center tw:gap-2 tw:border-t tw:border-slate-50 tw:bg-slate-50 tw:px-4 tw:py-2.5 tw:pl-10 tw:hover:bg-slate-100 tw:transition-colors' +
                      (isDel ? ' tw:opacity-50' : '')
                    }>
                    <span className="tw:flex-1 tw:text-[13px] tw:text-slate-800 tw:truncate">{child.name}</span>
                    <span className="tw:flex-shrink-0 tw:rounded-full tw:bg-white tw:px-2 tw:py-0.5 tw:text-[11px] tw:font-medium tw:text-slate-500 tw:border tw:border-slate-200">
                      {child.courseCount} course{child.courseCount !== 1 ? 's' : ''}
                    </span>
                    <div className="tw:flex tw:items-center tw:gap-0.5 tw:flex-shrink-0">
                      <button type="button" onClick={() => openEdit(child)}
                        aria-label={`Edit ${child.name}`}
                        className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-white tw:hover:text-blue-600">
                        <Pencil className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
                      </button>
                      <button type="button" onClick={() => handleDelete(child)}
                        disabled={isDel}
                        aria-label={`Delete ${child.name}`}
                        className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-red-50 tw:hover:text-red-500 tw:disabled:opacity-40">
                        <Trash2 className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Create modal ──────────────────────────────────────────────────── */}
      {createModal && (
        <Modal
          title={createModal.parentId ? 'Add Subcategory' : 'Add Category'}
          onClose={() => !creating && setCreateModal(null)}
          footer={
            <>
              <button type="button" onClick={() => setCreateModal(null)} disabled={creating}
                className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50 tw:disabled:opacity-40">
                Cancel
              </button>
              <button type="button" onClick={handleCreate} disabled={creating}
                aria-label="Create category"
                className="tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700 tw:disabled:opacity-40">
                {creating ? 'Creating…' : 'Create'}
              </button>
            </>
          }
        >
          {createError && (
            <div className="tw:rounded-lg tw:border tw:border-red-100 tw:bg-red-50 tw:px-3 tw:py-2 tw:text-[12px] tw:text-red-600">
              {createError}
            </div>
          )}
          {createModal.parentId && (
            <p className="tw:m-0 tw:text-[12px] tw:text-slate-500">
              Adding subcategory under <strong>{categories.find(c => c.id === createModal.parentId)?.name}</strong>.
            </p>
          )}
          <div>
            <label className="tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700 tw:mb-1">
              Name <span className="tw:text-red-500">*</span>
            </label>
            <input
              aria-label="Category name"
              type="text"
              value={createName}
              onChange={e => { setCreateName(e.target.value); setCreateError(null); }}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreateModal(null); }}
              placeholder="e.g. Web Development"
              autoFocus
              className={inputCls}
            />
          </div>
        </Modal>
      )}

      {/* ── Edit modal ────────────────────────────────────────────────────── */}
      {editModal && (
        <Modal
          title="Edit Category"
          onClose={() => !editing && setEditModal(null)}
          footer={
            <>
              <button type="button" onClick={() => setEditModal(null)} disabled={editing}
                className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50 tw:disabled:opacity-40">
                Cancel
              </button>
              <button type="button" onClick={handleEdit} disabled={editing}
                aria-label="Save category changes"
                className="tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700 tw:disabled:opacity-40">
                {editing ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          }
        >
          {editError && (
            <div className="tw:rounded-lg tw:border tw:border-red-100 tw:bg-red-50 tw:px-3 tw:py-2 tw:text-[12px] tw:text-red-600">
              {editError}
            </div>
          )}
          <div>
            <label className="tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700 tw:mb-1">
              Name <span className="tw:text-red-500">*</span>
            </label>
            <input
              aria-label="Edit category name"
              type="text"
              value={editName}
              onChange={e => { setEditName(e.target.value); setEditError(null); }}
              onKeyDown={e => { if (e.key === 'Enter') handleEdit(); if (e.key === 'Escape') setEditModal(null); }}
              autoFocus
              className={inputCls}
            />
          </div>
          <div>
            <label className="tw:block tw:text-[12px] tw:font-semibold tw:text-slate-700 tw:mb-1">Parent</label>
            <p className="tw:mt-0 tw:mb-1 tw:text-[11px] tw:text-slate-400">
              Select a root category to make this a subcategory, or leave blank to keep/make it a root.
            </p>
            <select
              aria-label="Parent category"
              value={editParentId}
              onChange={e => { setEditParentId(e.target.value); setEditError(null); }}
              className={inputCls}
            >
              <option value="">— Root category (no parent)</option>
              {rootCategories
                .filter(c => c.id !== editModal.id)   // can't be its own parent
                .map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))
              }
            </select>
          </div>
        </Modal>
      )}

      {toast && <ToastBanner {...toast} />}
    </div>
  );
}
