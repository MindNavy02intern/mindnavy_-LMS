import { useEffect, useState } from 'react';
import { BookOpen, TrendingUp, Users, CheckCircle2, Gauge, Award, ArrowUp, ArrowDown } from 'lucide-react';
import { getLmStats } from '../../services/lmApi';
import type { LmStats, LmStatItem } from '../../types/lm';

interface KpiMeta {
  key:       keyof LmStats;
  label:     string;
  Icon:      typeof BookOpen;
  iconBg:    string;
  iconColor: string;
  format:    (value: number) => string;
}

const KPI_META: KpiMeta[] = [
  { key: 'totalCourses',       label: 'Total Courses',        Icon: BookOpen,     iconBg: 'tw:bg-violet-100', iconColor: 'tw:text-violet-600', format: (v) => v.toLocaleString() },
  { key: 'activeCourses',      label: 'Active Courses',       Icon: TrendingUp,   iconBg: 'tw:bg-green-100',  iconColor: 'tw:text-green-600',  format: (v) => v.toLocaleString() },
  { key: 'totalEnrollments',   label: 'Total Enrollments',    Icon: Users,        iconBg: 'tw:bg-blue-100',   iconColor: 'tw:text-blue-600',   format: (v) => v.toLocaleString() },
  { key: 'coursesCompleted',   label: 'Courses Completed',    Icon: CheckCircle2, iconBg: 'tw:bg-sky-100',    iconColor: 'tw:text-sky-600',    format: (v) => v.toLocaleString() },
  { key: 'avgCompletionRate',  label: 'Avg. Completion Rate', Icon: Gauge,        iconBg: 'tw:bg-teal-100',   iconColor: 'tw:text-teal-600',   format: (v) => `${v}%` },
  { key: 'certificatesIssued', label: 'Certificates Issued',  Icon: Award,        iconBg: 'tw:bg-orange-100', iconColor: 'tw:text-orange-600', format: (v) => v.toLocaleString() },
];

function GrowthBadge({ growth }: { growth: LmStatItem['growth'] }) {
  if (growth === null) {
    return <span className="tw:text-slate-400">— vs last month</span>;
  }
  const isNegative = growth < 0;
  const Arrow = isNegative ? ArrowDown : ArrowUp;
  const colorClass = isNegative ? 'tw:text-red-600' : 'tw:text-green-600';
  return (
    <>
      <Arrow className={`tw:h-3 tw:w-3 ${colorClass}`} strokeWidth={2.5} />
      <span className={`tw:font-medium ${colorClass}`}>{Math.abs(growth)}%</span>
      <span className="tw:text-slate-400">vs last month</span>
    </>
  );
}

function KpiSkeleton() {
  return (
    <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-4">
      <div className="tw:h-10 tw:w-10 tw:animate-pulse tw:rounded-lg tw:bg-slate-100" />
      <div className="tw:mt-3 tw:h-3 tw:w-20 tw:animate-pulse tw:rounded tw:bg-slate-100" />
      <div className="tw:mt-2 tw:h-7 tw:w-16 tw:animate-pulse tw:rounded tw:bg-slate-100" />
      <div className="tw:mt-2.5 tw:h-3 tw:w-24 tw:animate-pulse tw:rounded tw:bg-slate-100" />
    </div>
  );
}

export default function KpiCards() {
  const [stats, setStats] = useState<LmStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (() => { setLoading(true); setError(false); })();
    getLmStats()
      .then((data) => { if (!cancelled) setStats(data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="tw:grid tw:grid-cols-6 tw:gap-4">
        {KPI_META.map((m) => <KpiSkeleton key={m.key} />)}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-4 tw:text-center tw:text-[13px] tw:text-red-500">
        Failed to load stats
      </div>
    );
  }

  return (
    <div className="tw:grid tw:grid-cols-6 tw:gap-4">
      {KPI_META.map(({ key, label, Icon, iconBg, iconColor, format }) => {
        const item = stats[key];
        return (
          <div
            key={key}
            className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-4 tw:transition-shadow tw:hover:shadow-md"
          >
            <div className={`tw:flex tw:h-10 tw:w-10 tw:items-center tw:justify-center tw:rounded-lg ${iconBg}`}>
              <Icon className={`tw:h-5 tw:w-5 ${iconColor}`} strokeWidth={2} />
            </div>
            <div className="tw:mt-3 tw:text-[12px] tw:text-slate-500">{label}</div>
            <div className="tw:mt-0.5 tw:text-[28px] tw:font-semibold tw:leading-none tw:text-slate-900">{format(item.value)}</div>
            <div className="tw:mt-2 tw:flex tw:items-center tw:gap-1 tw:text-[12px]">
              <GrowthBadge growth={item.growth} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
