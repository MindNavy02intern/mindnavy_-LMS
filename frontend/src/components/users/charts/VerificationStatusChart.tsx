import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { VerificationStatusItem } from '../../../types/users';

interface Props {
  data:    VerificationStatusItem[];
  loading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  verified: '#16a34a',
  pending:  '#f59e0b',
  rejected: '#dc2626',
  expired:  '#9ca3af',
};

const STATUS_LABELS: Record<string, string> = {
  verified: 'Verified',
  pending:  'Pending',
  rejected: 'Rejected',
  expired:  'Expired',
};

function Skeleton() {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '8px 0' }}>
      <div style={{ width: 120, height: 120, borderRadius: '50%', background: '#e5e7eb', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: 14, borderRadius: 4, background: '#e5e7eb', width: `${55 + i * 8}%` }} />
        ))}
      </div>
    </div>
  );
}

export default function VerificationStatusChart({ data, loading }: Props) {
  if (loading) return <Skeleton />;

  const total    = data.reduce((s, d) => s + d.count, 0);
  const verified = data.find(d => d.status === 'verified')?.count ?? 0;

  if (total === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>
        No verification data
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
                <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#d1d5db'} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value) => [(value as number).toLocaleString(), 'Users']}
              labelFormatter={(label) => STATUS_LABELS[String(label)] ?? String(label)}
            />
          </PieChart>
        </ResponsiveContainer>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{verified.toLocaleString()}</span>
          <span style={{ fontSize: 10, color: '#6b7280' }}>Verified</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {data.map(entry => (
          <div key={entry.status} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_COLORS[entry.status] ?? '#d1d5db', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>{STATUS_LABELS[entry.status] ?? entry.status}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{entry.count.toLocaleString()}</span>
            <span style={{ fontSize: 11, color: '#6b7280', minWidth: 32, textAlign: 'right' }}>{entry.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
