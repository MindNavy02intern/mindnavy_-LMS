import type { NewUsersThisMonth } from '../../../types/users';

interface Props {
  data:    NewUsersThisMonth | null;
  loading: boolean;
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', padding: '12px 0' }}>
      <div style={{ width: 100, height: 44, borderRadius: 6, background: '#e5e7eb' }} />
      <div style={{ width: 70,  height: 24, borderRadius: 12, background: '#e5e7eb' }} />
      <div style={{ width: 140, height: 14, borderRadius: 4,  background: '#e5e7eb' }} />
    </div>
  );
}

export default function NewUsersCard({ data, loading }: Props) {
  if (loading) return <Skeleton />;

  const count            = data?.count ?? 0;
  const changePercentage = data?.changePercentage ?? 0;

  const isPositive = changePercentage > 0;
  const isNegative = changePercentage < 0;

  const badgeColor = isPositive ? '#16a34a' : isNegative ? '#dc2626' : '#6b7280';
  const badgeBg    = isPositive ? '#f0fdf4' : isNegative ? '#fef2f2' : '#f3f4f6';
  const arrow      = isPositive ? '↑' : isNegative ? '↓' : '—';
  const badge      = changePercentage !== 0
    ? `${arrow} ${Math.abs(changePercentage).toFixed(1)}%`
    : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '8px 0' }}>
      <div style={{ fontSize: 44, fontWeight: 800, color: '#111827', lineHeight: 1 }}>
        {count.toLocaleString()}
      </div>

      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 10px', borderRadius: 20,
        background: badgeBg, color: badgeColor,
        fontSize: 13, fontWeight: 700,
      }}>
        {badge}
      </div>

      <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>New Users This Month</div>
      <div style={{ fontSize: 11, color: '#9ca3af' }}>vs last month</div>
    </div>
  );
}
