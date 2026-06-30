import { useCallback, useEffect, useState } from 'react';
import { listAccessPolicies } from '../../api/accessPoliciesPage';
import type { AccessPolicy, PolicyEffect, PolicyStatus } from '../../api/accessPoliciesPage';

const EFFECT_BADGE: Record<PolicyEffect, { bg: string; color: string }> = {
  ALLOW: { bg: '#f0fdf4', color: '#16a34a' },
  DENY:  { bg: '#fef2f2', color: '#dc2626' },
};

const STATUS_BADGE: Record<PolicyStatus, { bg: string; color: string }> = {
  ACTIVE:   { bg: '#f0fdf4', color: '#16a34a' },
  INACTIVE: { bg: '#f9fafb', color: '#6b7280' },
};

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
}

export default function AccessPoliciesPreviewCard({ onViewAll }: Props) {
  const [policies, setPolicies] = useState<AccessPolicy[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  const fetchPreview = useCallback(() => {
    (() => setLoading(true))();
    listAccessPolicies({ limit: 4 })
      .then(res => { setPolicies(res.data); setError(null); })
      .catch(() => { setPolicies([]); setError('Failed to load access policies'); })
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
          <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>Access Policies</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Active access control policies</div>
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

        {!loading && !error && policies.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 130, color: '#d1d5db' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <div style={{ fontSize: 11, fontWeight: 500, marginTop: 6 }}>No policies yet</div>
          </div>
        )}

        {!loading && !error && policies.length > 0 && (
          <div style={{ padding: '4px 16px 8px', display: 'flex', flexDirection: 'column' }}>
            {policies.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 1 }}>{p.resource} → {p.action}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <span style={{ background: EFFECT_BADGE[p.effect].bg, color: EFFECT_BADGE[p.effect].color, borderRadius: 100, fontSize: 9.5, fontWeight: 600, padding: '2px 7px' }}>
                    {p.effect}
                  </span>
                  <span style={{ background: STATUS_BADGE[p.status].bg, color: STATUS_BADGE[p.status].color, borderRadius: 100, fontSize: 9.5, fontWeight: 600, padding: '2px 7px' }}>
                    {p.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
