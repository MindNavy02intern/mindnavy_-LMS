import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { RoleAnalyticsItem } from '../../../types/users';

interface Props {
  data:    RoleAnalyticsItem[];
  loading: boolean;
}

const ROLE_COLORS: Record<string, string> = {
  LEARNER:         '#3b82f6',
  INSTRUCTOR:      '#16a34a',
  MANAGER:         '#f97316',
  ADMIN_ASSISTANT: '#8b5cf6',
};

const ROLE_LABELS: Record<string, string> = {
  LEARNER:         'Learner',
  INSTRUCTOR:      'Instructor',
  MANAGER:         'Manager',
  ADMIN_ASSISTANT: 'Admin Assistant',
};

function Skeleton() {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '8px 0' }}>
      <div style={{ width: 120, height: 120, borderRadius: '50%', background: '#e5e7eb', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: 14, borderRadius: 4, background: '#e5e7eb', width: `${60 + i * 10}%` }} />
        ))}
      </div>
    </div>
  );
}

export default function UsersByRoleChart({ data, loading }: Props) {
  if (loading) return <Skeleton />;

  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>
        No role data available
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', flexShrink: 0, width: 140, height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={42}
              outerRadius={65}
              dataKey="count"
              strokeWidth={2}
              stroke="#fff"
            >
              {data.map(entry => (
                <Cell key={entry.role} fill={ROLE_COLORS[entry.role] ?? '#9ca3af'} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [(value as number).toLocaleString(), 'Users']}
              labelFormatter={(label) => ROLE_LABELS[String(label)] ?? String(label)}
            />
          </PieChart>
        </ResponsiveContainer>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{total.toLocaleString()}</span>
          <span style={{ fontSize: 10, color: '#6b7280' }}>Total</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {data.map(entry => (
          <div key={entry.role} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: ROLE_COLORS[entry.role] ?? '#9ca3af', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>{ROLE_LABELS[entry.role] ?? entry.role}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{entry.count.toLocaleString()}</span>
            <span style={{ fontSize: 11, color: '#6b7280', minWidth: 32, textAlign: 'right' }}>{entry.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
