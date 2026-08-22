import { useCallback, useEffect, useState } from 'react';
import { getAuditReports } from '../../services/reportsApi';
import type { AuditLogRow } from '../../types/reports';
import { ROLE_AUDIT_ACTIONS, ROLE_AUDIT_RANGE, humanizeAuditAction } from '../../constants/roleAuditActions';

const PREVIEW_LIMIT = 4;

function formatRelative(iso?: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function ActivityIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function PreviewSkeleton() {
  return (
    <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ width: '70%', height: 9, borderRadius: 3, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite', marginBottom: 5 }} />
            <div style={{ width: '35%', height: 8, borderRadius: 3, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

interface Props {
  onViewAll: () => void;
}

// Previews the same rows AuditTrackingTab shows in full — same endpoint, same
// ROLE_AUDIT_ACTIONS filter, same window, just the top PREVIEW_LIMIT (R4: one
// datum, one owner). "View All" opens that tab, so the two must never disagree.
//
// `items === null` means the fetch failed — rendered as a skeleton placeholder
// rather than a misleading "no activity" empty state. `items === []` means the
// endpoint answered with zero rows.
export default function RecentRoleActivityPreviewCard({ onViewAll }: Props) {
  const [items,   setItems]   = useState<AuditLogRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAuditReports({
        actions: ROLE_AUDIT_ACTIONS,
        dateRange: ROLE_AUDIT_RANGE,
        page: 1,
        limit: PREVIEW_LIMIT,
      });
      setItems(res.logs);
    } catch {
      setItems(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchActivity(); }, [fetchActivity]);

  useEffect(() => {
    window.addEventListener('rolesUpdated', fetchActivity);
    return () => window.removeEventListener('rolesUpdated', fetchActivity);
  }, [fetchActivity]);

  const unavailable = !loading && items === null;
  const empty        = !loading && items !== null && items.length === 0;
  const list          = !loading && items !== null && items.length > 0 ? items : null;

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>Recent Role Activity</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Latest role related activities</div>
        </div>
        <button
          onClick={onViewAll}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#3b82f6', fontFamily: 'inherit', padding: 0 }}
        >
          View All
        </button>
      </div>

      <div style={{ minHeight: 130 }}>
        {(loading || unavailable) && <PreviewSkeleton />}

        {empty && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 130, color: '#d1d5db' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <div style={{ fontSize: 11, fontWeight: 500, marginTop: 6 }}>No recent activity</div>
          </div>
        )}

        {list && (
          <div style={{ padding: '8px 16px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {list.map((item) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', background: '#eff6ff', color: '#2563eb',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <ActivityIcon />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {humanizeAuditAction(item.action)}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 1 }}>{formatRelative(item.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
