import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { UserActivity } from '../../../types/users';

interface Props {
  data:    UserActivity | null;
  loading: boolean;
}

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ flex: 1, height: 56, borderRadius: 8, background: '#e5e7eb' }} />
        ))}
      </div>
      <div style={{ height: 120, borderRadius: 6, background: '#e5e7eb' }} />
    </div>
  );
}

export default function UserActivityChart({ data, loading }: Props) {
  if (loading) return <Skeleton />;

  const activeToday   = data?.activeToday   ?? 0;
  const activeWeek    = data?.activeThisWeek ?? 0;
  const dailyTrend    = data?.dailyTrend     ?? [];

  const hasTrend = dailyTrend.length > 0 && dailyTrend.some(d => d.count > 0);

  const formatDate = (dateStr: string) => {
    const [, m, d] = dateStr.split('-');
    return `${m}/${d}`;
  };

  const statBox = (label: string, value: number, color: string) => (
    <div style={{
      flex: 1, background: '#f9fafb', border: '1px solid #e5e7eb',
      borderRadius: 8, padding: '10px 14px',
      display: 'flex', flexDirection: 'column', gap: 3,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 11, color: '#6b7280' }}>{label}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        {statBox('Active Today',     activeToday, '#2563eb')}
        {statBox('Active This Week', activeWeek,  '#16a34a')}
      </div>

      {hasTrend ? (
        <ResponsiveContainer width="100%" height={130}>
          <AreaChart data={dailyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              interval={4}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              labelFormatter={(label) => `Date: ${String(label)}`}
              formatter={(value) => [(value as number).toLocaleString(), 'Active Users']}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#activityGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px 0', color: '#9ca3af', fontSize: 12 }}>
          No activity data for the last 30 days
        </div>
      )}
    </div>
  );
}
