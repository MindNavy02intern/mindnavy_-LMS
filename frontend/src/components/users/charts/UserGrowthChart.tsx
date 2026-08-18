import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { UserGrowthWeek } from '../../../types/users';

interface Props {
  data:    UserGrowthWeek[];
  loading: boolean;
}

function Skeleton() {
  return <div style={{ height: 130, borderRadius: 6, background: '#e5e7eb' }} />;
}

function formatWeek(dateStr: string) {
  const [, m, d] = dateStr.split('-');
  return `${m}/${d}`;
}

export default function UserGrowthChart({ data, loading }: Props) {
  if (loading) return <Skeleton />;

  const hasTrend = data.length > 0 && data.some(w => w.count > 0);
  const total = data.reduce((sum, w) => sum + w.count, 0);

  if (!hasTrend) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>
        No new signups in the last 12 weeks
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, color: '#6b7280' }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#0f172a' }}>{total.toLocaleString()}</span>{' '}
        new users over the last 12 weeks
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
          <XAxis
            dataKey="weekStart"
            tickFormatter={formatWeek}
            tick={{ fontSize: 10, fill: '#9ca3af' }}
            axisLine={false}
            tickLine={false}
            interval={1}
          />
          <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            labelFormatter={(label) => `Week of ${String(label)}`}
            formatter={(value) => [(value as number).toLocaleString(), 'New Users']}
          />
          <Line type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
