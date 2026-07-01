import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ArrowRight } from 'lucide-react';
import { getLmDistribution } from '../../services/lmApi';
import type { LmDistribution } from '../../types/lm';

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#ec4899', '#94a3b8'];

function DistributionSkeleton() {
  return (
    <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5">
      <div className="tw:h-4 tw:w-48 tw:animate-pulse tw:rounded tw:bg-slate-100" />
      <div className="tw:mt-3 tw:flex tw:flex-col tw:gap-3">
        <div className="tw:mx-auto tw:h-[120px] tw:w-[120px] tw:animate-pulse tw:rounded-full tw:bg-slate-100" />
        <div className="tw:flex tw:flex-col tw:gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="tw:h-3 tw:w-full tw:animate-pulse tw:rounded tw:bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DistributionChart() {
  const [distribution, setDistribution] = useState<LmDistribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (() => { setLoading(true); setError(false); })();
    getLmDistribution()
      .then((data) => { if (!cancelled) setDistribution(data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <DistributionSkeleton />;

  if (error || !distribution) {
    return (
      <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:text-center tw:text-[13px] tw:text-red-500">
        Failed to load course distribution
      </div>
    );
  }

  const { total, items } = distribution;

  return (
    <div className="tw:overflow-hidden tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5">
      <h3 className="tw:m-0 tw:text-[14px] tw:font-semibold tw:text-slate-900">Course Distribution by Category</h3>

      <div className="tw:mt-3 tw:flex tw:flex-col tw:gap-3">
        <div className="tw:relative tw:mx-auto tw:h-[120px] tw:w-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={items} dataKey="count" nameKey="category" cx="50%" cy="50%" innerRadius={38} outerRadius={56} strokeWidth={2} stroke="#fff">
                {items.map((d, i) => <Cell key={d.category} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="tw:pointer-events-none tw:absolute tw:inset-0 tw:flex tw:flex-col tw:items-center tw:justify-center">
            <span className="tw:text-[18px] tw:font-bold tw:text-slate-900">{total}</span>
            <span className="tw:text-[10px] tw:text-slate-500">Total Courses</span>
          </div>
        </div>

        <div className="tw:flex tw:flex-col tw:gap-1.5">
          {items.map((d, i) => (
            <div key={d.category} className="tw:flex tw:items-center tw:gap-2 tw:text-[12px]">
              <span className="tw:h-2 tw:w-2 tw:shrink-0 tw:rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="tw:flex-1 tw:truncate tw:text-slate-600">{d.category}</span>
              <span className="tw:font-medium tw:text-slate-900">{d.count}</span>
              <span className="tw:w-11 tw:shrink-0 tw:text-right tw:text-slate-400">({d.percent}%)</span>
            </div>
          ))}
        </div>
      </div>

      <button type="button" className="tw:mt-4 tw:flex tw:items-center tw:gap-1 tw:text-[13px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">
        View All Categories
        <ArrowRight className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}
