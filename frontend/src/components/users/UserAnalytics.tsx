import { useCallback, useEffect, useState } from 'react';
import { getAnalytics } from '../../api/users';
import type { AnalyticsResponse } from '../../types/users';
import UsersByRoleChart         from './charts/UsersByRoleChart';
import UsersByDepartmentChart   from './charts/UsersByDepartmentChart';
import NewUsersCard             from './charts/NewUsersCard';
import UserActivityChart        from './charts/UserActivityChart';
import VerificationStatusChart  from './charts/VerificationStatusChart';

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: '16px 20px',
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 14 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function UserAnalytics() {
  const [data,    setData]    = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetch = useCallback(() => {
    setLoading(true);
    setError(null);
    getAnalytics()
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    const handler = () => fetch();
    window.addEventListener('analyticsUpdated', handler);
    return () => window.removeEventListener('analyticsUpdated', handler);
  }, [fetch]);

  if (error) {
    return (
      <div style={{
        background: '#fef2f2', border: '1px solid #fecaca',
        borderRadius: 8, padding: '12px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontSize: 13, color: '#b91c1c', marginTop: 8,
      }}>
        <span>{error}</span>
        <button
          onClick={fetch}
          style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, color: '#b91c1c', fontSize: 12, fontWeight: 600, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 12 }}>
      {/* Row 1: Role + Verification */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 14 }}>
        <ChartCard title="Users by Role">
          <UsersByRoleChart
            data={data?.usersByRole ?? []}
            loading={loading}
          />
        </ChartCard>
        <ChartCard title="Verification Status">
          <VerificationStatusChart
            data={data?.verificationStatus ?? []}
            loading={loading}
          />
        </ChartCard>
      </div>

      {/* Row 2: Department + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 14 }}>
        <ChartCard title="Users by Department">
          <UsersByDepartmentChart
            data={data?.usersByDepartment ?? []}
            loading={loading}
          />
        </ChartCard>
        <ChartCard title="User Activity (Last 30 Days)">
          <UserActivityChart
            data={data?.userActivity ?? null}
            loading={loading}
          />
        </ChartCard>
      </div>

      {/* Row 3: New Users full width */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
        <ChartCard title="New Users This Month">
          <NewUsersCard
            data={data?.newUsersThisMonth ?? null}
            loading={loading}
          />
        </ChartCard>
        <div style={{
          background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10,
          padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', color: '#9ca3af' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" />
            </svg>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>More Charts Coming Soon</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Risk distribution, engagement trends & more</div>
          </div>
        </div>
      </div>
    </div>
  );
}
