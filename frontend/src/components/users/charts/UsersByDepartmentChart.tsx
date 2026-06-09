import { BarChart, Bar, XAxis, YAxis, Tooltip, LabelList, ResponsiveContainer, Cell } from 'recharts';
import type { DepartmentAnalyticsItem } from '../../../types/users';

interface Props {
  data:    DepartmentAnalyticsItem[];
  loading: boolean;
}

const BAR_COLORS = [
  '#3b82f6', '#4f7ee8', '#647ada', '#7976cc', '#8e73be',
  '#a370b0', '#b86da2', '#cd6a94', '#e26786', '#8b5cf6',
];

function Skeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
      {[80, 65, 55, 45, 35].map((w, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 90, height: 12, borderRadius: 3, background: '#e5e7eb', flexShrink: 0 }} />
          <div style={{ width: `${w}%`, height: 18, borderRadius: 3, background: '#e5e7eb' }} />
        </div>
      ))}
    </div>
  );
}

function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

export default function UsersByDepartmentChart({ data, loading }: Props) {
  if (loading) return <Skeleton />;

  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>
        No department data
      </div>
    );
  }

  const chartData = data.map(d => ({ ...d, shortDept: truncate(d.department, 18) }));
  const maxCount  = Math.max(...data.map(d => d.count));

  return (
    <ResponsiveContainer width="100%" height={Math.max(180, data.length * 34)}>
      <BarChart
        layout="vertical"
        data={chartData}
        margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
      >
        <XAxis
          type="number"
          domain={[0, Math.ceil(maxCount * 1.15)]}
          hide
        />
        <YAxis
          type="category"
          dataKey="shortDept"
          width={120}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value) => [(value as number).toLocaleString(), 'Users']}
          labelFormatter={(_label, payload) => ((payload as unknown) as { payload?: { department?: string } }[])?.[0]?.payload?.department ?? ''}
          cursor={{ fill: '#f3f4f6' }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            style={{ fontSize: 11, fontWeight: 600, fill: '#374151' }}
            formatter={(v: unknown) => typeof v === 'number' ? v.toLocaleString() : String(v)}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
