import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { ArrowRight } from 'lucide-react';
import { getLmProgress } from '../../services/lmApi';
import type { ProgressPoint, ProgressRange } from '../../types/lm';

const SERIES = [
  { key: 'completed',  label: 'Completed',   color: '#16a34a' },
  { key: 'inProgress', label: 'In Progress', color: '#2563eb' },
  { key: 'notStarted', label: 'Not Started', color: '#94a3b8' },
  { key: 'overdue',    label: 'Overdue',     color: '#ef4444' },
] as const;

const RANGE_OPTIONS: { value: ProgressRange; label: string }[] = [
  { value: 'week',  label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year',  label: 'This Year' },
];

export default function ProgressChart() {
  const [range, setRange] = useState<ProgressRange>('month');
  const [data, setData] = useState<ProgressPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (() => { setLoading(true); setError(false); })();
    getLmProgress(range)
      .then((points) => { if (!cancelled) setData(points); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [range]);

  return (
    <div className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5">
      <div className="tw:flex tw:items-center tw:justify-between tw:gap-2">
        <h3 className="tw:m-0 tw:min-w-0 tw:flex-1 tw:text-[14px] tw:font-semibold tw:text-slate-900">Learning Progress Overview</h3>
        <select
          aria-label="Progress range"
          value={range}
          onChange={(e) => setRange(e.target.value as ProgressRange)}
          className="tw:rounded-md tw:border tw:border-slate-200 tw:px-2.5 tw:py-1 tw:text-[12px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50"
        >
          {RANGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="tw:mt-3 tw:flex tw:flex-wrap tw:items-center tw:gap-x-3 tw:gap-y-1">
        {SERIES.map((s) => (
          <div key={s.key} className="tw:flex tw:items-center tw:gap-1.5 tw:text-[11px] tw:text-slate-500">
            <span className="tw:h-2 tw:w-2 tw:shrink-0 tw:rounded-sm" style={{ background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>

      <div className="tw:mt-3 tw:h-[180px] tw:w-full">
        {loading ? (
          <div className="tw:h-full tw:w-full tw:animate-pulse tw:rounded-lg tw:bg-slate-100" />
        ) : error ? (
          <div className="tw:flex tw:h-full tw:items-center tw:justify-center tw:text-[13px] tw:text-red-500">
            Failed to load progress data
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => v === 0 ? '0' : `${v / 1000}K`}
              />
              {SERIES.map((s) => (
                <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <button type="button" className="tw:mt-2 tw:flex tw:items-center tw:gap-1 tw:text-[13px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">
        View Full Report
        <ArrowRight className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}
