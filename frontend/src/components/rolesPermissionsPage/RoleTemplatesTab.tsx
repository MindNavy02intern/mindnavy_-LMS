import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToastType } from '../users/Toast';
import {
  getRoleTemplates,
  getRoleTemplateDetails,
  deleteRoleTemplate,
} from '../../api/roleTemplates';
import type { RoleTemplateListItem, RoleTemplateDetails } from '../../api/roleTemplates';
import CreateRoleTemplateModal from './CreateRoleTemplateModal';
import ApplyRoleTemplateModal from './ApplyRoleTemplateModal';

const PAGE_SIZE = 12;

interface Props {
  showToast: (type: ToastType, message: string) => void;
}

export default function RoleTemplatesTab({ showToast }: Props) {
  // ── List ───────────────────────────────────────────────────────────────────
  const [templates,    setTemplates]    = useState<RoleTemplateListItem[]>([]);
  const [listLoading,  setListLoading]  = useState(true);
  const [listError,    setListError]    = useState<string | null>(null);
  const [totalTemplates, setTotalTemplates] = useState(0);
  const [totalPages,     setTotalPages]     = useState(1);

  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [searchInput, setSearchInput] = useState('');

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSearchInput(value: string) {
    setSearchInput(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { setSearch(value); setPage(1); }, 400);
  }

  const fetchList = useCallback(() => {
    (() => setListLoading(true))();
    getRoleTemplates({ page, limit: PAGE_SIZE, search })
      .then(res => {
        setTemplates(res.data);
        setTotalTemplates(res.pagination.total);
        setTotalPages(res.pagination.pages);
        setListError(null);
      })
      .catch(() => { setTemplates([]); setListError('Failed to load role templates.'); })
      .finally(() => setListLoading(false));
  }, [page, search]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // ── Expand / collapse a card's permission bundle ──────────────────────────
  const [expandedId,      setExpandedId]      = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<RoleTemplateDetails | null>(null);
  const [expandedLoading, setExpandedLoading] = useState(false);
  const [expandedError,   setExpandedError]   = useState<string | null>(null);

  function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetails(null);
      setExpandedError(null);
      return;
    }
    setExpandedId(id);
    setExpandedDetails(null);
    setExpandedError(null);
    setExpandedLoading(true);
    getRoleTemplateDetails(id)
      .then(d => setExpandedDetails(d))
      .catch(() => setExpandedError('Failed to load permissions.'))
      .finally(() => setExpandedLoading(false));
  }

  // ── Create modal ───────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const handleCreateSuccess = () => { setCreateOpen(false); fetchList(); };

  // ── Apply modal ────────────────────────────────────────────────────────────
  const [applyTarget, setApplyTarget] = useState<RoleTemplateListItem | null>(null);
  const handleApplySuccess = () => { setApplyTarget(null); };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(template: RoleTemplateListItem) {
    if (!window.confirm(`Delete "${template.name}"? This cannot be undone.`)) return;
    setDeletingId(template.id);
    try {
      await deleteRoleTemplate(template.id);
      showToast('success', 'Template deleted');
      if (expandedId === template.id) { setExpandedId(null); setExpandedDetails(null); }
      fetchList();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setDeletingId(null);
    }
  }

  // ── Pagination helpers ─────────────────────────────────────────────────────
  const rowStart = (page - 1) * PAGE_SIZE + 1;
  const rowEnd   = Math.min(page * PAGE_SIZE, totalTemplates);

  return (
    <div>
      <style>{`@keyframes rp-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }`}</style>

      {/* ── Toolbar ────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search templates..."
            value={searchInput}
            onChange={e => handleSearchInput(e.target.value)}
            style={{ paddingLeft: 28, paddingRight: 10, paddingTop: 7, paddingBottom: 7, border: '1px solid #e5e7eb', borderRadius: 7, fontSize: 12.5, fontFamily: 'inherit', color: '#374151', background: '#fff', width: 220, outline: 'none' }}
            onFocus={e => (e.target.style.borderColor = '#3b82f6')}
            onBlur={e  => (e.target.style.borderColor = '#e5e7eb')}
          />
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          style={{ padding: '7px 14px', fontSize: 12.5, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 5, boxShadow: '0 1px 3px rgba(37,99,235,0.3)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create Template
        </button>
      </div>

      {/* ── Card grid ──────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 16 }}>

        {listLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
                <div style={{ width: '60%', height: 12, borderRadius: 4, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite', marginBottom: 10 }} />
                <div style={{ width: '90%', height: 9, borderRadius: 4, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite', marginBottom: 16 }} />
                <div style={{ width: '40%', height: 9, borderRadius: 4, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite' }} />
              </div>
            ))}
          </div>
        )}

        {!listLoading && listError && (
          <div style={{ textAlign: 'center', color: '#b91c1c', fontSize: 13, padding: 40 }}>{listError}</div>
        )}

        {!listLoading && !listError && templates.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 200, color: '#9ca3af' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600 }}>No role templates found.</span>
            <button
              onClick={() => setCreateOpen(true)}
              style={{ marginTop: 4, padding: '6px 14px', fontSize: 12.5, fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              + Create your first template
            </button>
          </div>
        )}

        {!listLoading && !listError && templates.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            {templates.map(template => {
              const isExpanded   = expandedId === template.id;
              const isDeleting   = deletingId === template.id;
              return (
                <div
                  key={template.id}
                  style={{
                    border: '1px solid #e5e7eb', borderRadius: 10, padding: 14,
                    opacity: isDeleting ? 0.5 : 1, transition: 'opacity 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827', lineHeight: 1.3 }}>{template.name}</div>
                    <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 600, color: '#374151', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 100, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                      {template.permissionCount} perm{template.permissionCount !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {template.description && (
                    <div style={{ fontSize: 11.5, color: '#6b7280', marginTop: 5, lineHeight: 1.4 }}>{template.description}</div>
                  )}

                  <button
                    onClick={() => toggleExpand(template.id)}
                    style={{ marginTop: 8, fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, display: 'flex', alignItems: 'center', gap: 3 }}
                  >
                    {isExpanded ? 'Hide permissions' : 'View permissions'}
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>

                  {isExpanded && (
                    <div style={{ marginTop: 8, padding: '8px 0 0', borderTop: '1px solid #f3f4f6' }}>
                      {expandedLoading && <div style={{ fontSize: 11, color: '#9ca3af' }}>Loading…</div>}
                      {!expandedLoading && expandedError && <div style={{ fontSize: 11, color: '#b91c1c' }}>{expandedError}</div>}
                      {!expandedLoading && !expandedError && expandedDetails && expandedDetails.permissions.length === 0 && (
                        <div style={{ fontSize: 11, color: '#9ca3af' }}>No permissions in this template.</div>
                      )}
                      {!expandedLoading && !expandedError && expandedDetails && expandedDetails.permissions.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {expandedDetails.permissions.map(p => (
                            <span
                              key={p.id}
                              title={p.description ?? undefined}
                              style={{ fontSize: 10.5, color: '#374151', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 4, padding: '2px 6px' }}
                            >
                              {p.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                    <button
                      onClick={() => setApplyTarget(template)}
                      disabled={isDeleting}
                      style={{ flex: 1, padding: '6px 0', fontSize: 11.5, fontWeight: 600, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: 6, cursor: isDeleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                    >
                      Use
                    </button>
                    <button
                      onClick={() => handleDelete(template)}
                      disabled={isDeleting}
                      style={{ flex: 1, padding: '6px 0', fontSize: 11.5, fontWeight: 600, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, cursor: isDeleting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
                    >
                      {isDeleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pagination ─────────────────────────────────────────────────── */}
        {!listLoading && !listError && templates.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTop: '1px solid #f3f4f6' }}>
            <span style={{ color: '#6b7280', fontSize: 11.5 }}>
              Showing {totalTemplates === 0 ? 0 : rowStart} to {rowEnd} of {totalTemplates} templates
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {totalPages > 1 && (
                <>
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ width: 26, height: 26, fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'not-allowed' : 'pointer', color: page <= 1 ? '#d1d5db' : '#374151' }}>‹</button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <button key={p} onClick={() => setPage(p)} style={{ width: 26, height: 26, fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: p === page ? '#2563eb' : '#fff', color: p === page ? '#fff' : '#374151', cursor: 'pointer', fontWeight: p === page ? 600 : 400 }}>{p}</button>
                    );
                  })}
                  {totalPages > 5 && <span style={{ color: '#9ca3af', fontSize: 12 }}>...</span>}
                  <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ width: 26, height: 26, fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page >= totalPages ? 'not-allowed' : 'pointer', color: page >= totalPages ? '#d1d5db' : '#374151' }}>›</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Create Template modal ───────────────────────────────────────────── */}
      {createOpen && (
        <CreateRoleTemplateModal
          onClose={() => setCreateOpen(false)}
          onSuccess={handleCreateSuccess}
          showToast={showToast}
        />
      )}

      {/* ── Apply Template modal ────────────────────────────────────────────── */}
      {applyTarget && (
        <ApplyRoleTemplateModal
          templateId={applyTarget.id}
          templateName={applyTarget.name}
          onClose={() => setApplyTarget(null)}
          onSuccess={handleApplySuccess}
          showToast={showToast}
        />
      )}
    </div>
  );
}
