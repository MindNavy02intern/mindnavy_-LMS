import { useCallback, useEffect, useState } from 'react';
import type { ToastType } from '../users/Toast';
import { getRoleTemplates } from '../../api/roleTemplates';
import type { RoleTemplateListItem } from '../../api/roleTemplates';
import ApplyRoleTemplateModal from './ApplyRoleTemplateModal';

function PreviewSkeleton() {
  return (
    <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ width: '60%', height: 10, borderRadius: 3, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite' }} />
          <div style={{ width: '40%', height: 8, borderRadius: 3, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite' }} />
        </div>
      ))}
    </div>
  );
}

interface Props {
  onViewAll: () => void;
  showToast: (type: ToastType, message: string) => void;
}

export default function RoleTemplatesPreviewCard({ onViewAll, showToast }: Props) {
  const [templates, setTemplates] = useState<RoleTemplateListItem[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [applyTarget, setApplyTarget] = useState<RoleTemplateListItem | null>(null);

  const fetchPreview = useCallback(() => {
    (() => setLoading(true))();
    getRoleTemplates({ page: 1, limit: 4 })
      .then(res => { setTemplates(res.data); setError(null); })
      .catch(() => { setTemplates([]); setError('Failed to load role templates'); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchPreview(); }, [fetchPreview]);

  useEffect(() => {
    window.addEventListener('rolesUpdated', fetchPreview);
    return () => window.removeEventListener('rolesUpdated', fetchPreview);
  }, [fetchPreview]);

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>Role Templates</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Predefined role templates</div>
        </div>
        <button
          onClick={onViewAll}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#3b82f6', fontFamily: 'inherit', padding: 0 }}
        >
          View All
        </button>
      </div>

      <div style={{ minHeight: 130 }}>
        {loading && <PreviewSkeleton />}

        {!loading && error && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 130, fontSize: 12, color: '#f87171', padding: 16, textAlign: 'center' }}>
            {error}
          </div>
        )}

        {!loading && !error && templates.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 130, color: '#d1d5db' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <div style={{ fontSize: 11, fontWeight: 500, marginTop: 6 }}>No templates yet</div>
          </div>
        )}

        {!loading && !error && templates.length > 0 && (
          <div style={{ padding: '4px 16px 8px', display: 'flex', flexDirection: 'column' }}>
            {templates.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                  <div style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 1 }}>{t.permissionCount} permissions</div>
                </div>
                <button
                  onClick={() => setApplyTarget(t)}
                  style={{ flexShrink: 0, padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Use
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {applyTarget && (
        <ApplyRoleTemplateModal
          templateId={applyTarget.id}
          templateName={applyTarget.name}
          onClose={() => setApplyTarget(null)}
          onSuccess={() => { setApplyTarget(null); showToast('success', `${applyTarget.name} applied.`); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
