import { useEffect, useState } from 'react';
import { Layers, Video, FileText, File, FileQuestion, Package, ArrowRight } from 'lucide-react';
import { getLmContentStats } from '../../services/lmApi';
import type { LmContentStats } from '../../types/lm';

interface StatMeta {
  key:   keyof LmContentStats;
  label: string;
  Icon:  typeof Layers;
}

const ITEMS: StatMeta[] = [
  { key: 'totalContentItems', label: 'Total Content Items', Icon: Layers },
  { key: 'videoLessons',      label: 'Video Lessons',       Icon: Video },
  { key: 'documents',         label: 'Documents',           Icon: FileText },
  { key: 'pdfFiles',          label: 'PDF Files',           Icon: File },
  { key: 'quizzes',           label: 'Quizzes',              Icon: FileQuestion },
  { key: 'scormPackages',     label: 'SCORM Packages',      Icon: Package },
];

function ContentStatsSkeleton() {
  return (
    <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5">
      <div className="tw:h-4 tw:w-36 tw:animate-pulse tw:rounded tw:bg-slate-100" />
      <div className="tw:mt-3 tw:flex tw:flex-col tw:gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="tw:h-4 tw:w-full tw:animate-pulse tw:rounded tw:bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export default function ContentStats() {
  const [stats, setStats] = useState<LmContentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (() => { setLoading(true); setError(false); })();
    getLmContentStats()
      .then((data) => { if (!cancelled) setStats(data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <ContentStatsSkeleton />;

  if (error || !stats) {
    return (
      <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5 tw:text-center tw:text-[13px] tw:text-red-500">
        Failed to load content statistics
      </div>
    );
  }

  return (
    <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5">
      <h3 className="tw:m-0 tw:text-[14px] tw:font-semibold tw:text-slate-900">Content Statistics</h3>

      <div className="tw:mt-3 tw:flex tw:flex-col tw:gap-3">
        {ITEMS.map(({ key, label, Icon }) => (
          <div key={key} className="tw:flex tw:items-center tw:gap-2.5">
            <Icon className="tw:h-4 tw:w-4 tw:shrink-0 tw:text-slate-400" strokeWidth={2} />
            <span className="tw:flex-1 tw:truncate tw:text-[13px] tw:text-slate-600">{label}</span>
            <span className="tw:text-[13px] tw:font-semibold tw:text-slate-900">{stats[key].toLocaleString()}</span>
          </div>
        ))}
      </div>

      <button type="button" className="tw:mt-4 tw:flex tw:items-center tw:gap-1 tw:text-[13px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">
        View All Content
        <ArrowRight className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}
