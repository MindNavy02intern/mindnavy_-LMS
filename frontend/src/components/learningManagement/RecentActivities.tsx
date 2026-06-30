import { useEffect, useState } from 'react';
import { BookPlus, Video, UploadCloud, ClipboardCheck, Award } from 'lucide-react';
import { getLmActivities } from '../../services/lmApi';
import type { LmActivity, LmActivityType } from '../../types/lm';

const TYPE_META: Record<LmActivityType, { Icon: typeof BookPlus; iconBg: string; iconColor: string }> = {
  course_created:     { Icon: BookPlus,       iconBg: 'tw:bg-blue-100',   iconColor: 'tw:text-blue-600' },
  session_completed:  { Icon: Video,          iconBg: 'tw:bg-green-100',  iconColor: 'tw:text-green-600' },
  content_uploaded:   { Icon: UploadCloud,    iconBg: 'tw:bg-violet-100', iconColor: 'tw:text-violet-600' },
  assessment_created: { Icon: ClipboardCheck, iconBg: 'tw:bg-orange-100', iconColor: 'tw:text-orange-600' },
  certificate_issued: { Icon: Award,          iconBg: 'tw:bg-pink-100',   iconColor: 'tw:text-pink-600' },
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function RecentActivitiesSkeleton() {
  return (
    <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5">
      <div className="tw:h-4 tw:w-32 tw:animate-pulse tw:rounded tw:bg-slate-100" />
      <div className="tw:mt-3 tw:flex tw:flex-col tw:gap-3.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="tw:flex tw:items-start tw:gap-3">
            <div className="tw:h-8 tw:w-8 tw:shrink-0 tw:animate-pulse tw:rounded-full tw:bg-slate-100" />
            <div className="tw:min-w-0 tw:flex-1">
              <div className="tw:h-3 tw:w-48 tw:animate-pulse tw:rounded tw:bg-slate-100" />
              <div className="tw:mt-1.5 tw:h-2.5 tw:w-24 tw:animate-pulse tw:rounded tw:bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RecentActivities() {
  const [activities, setActivities] = useState<LmActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (() => { setLoading(true); setError(false); })();
    getLmActivities(5)
      .then((data) => { if (!cancelled) setActivities(data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <RecentActivitiesSkeleton />;

  return (
    <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5">
      <div className="tw:flex tw:items-center tw:justify-between">
        <h3 className="tw:m-0 tw:text-[14px] tw:font-semibold tw:text-slate-900">Recent Activities</h3>
        <button type="button" className="tw:text-[12px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">
          View All
        </button>
      </div>

      {error ? (
        <div className="tw:mt-3 tw:text-center tw:text-[13px] tw:text-red-500">Failed to load recent activities</div>
      ) : (
        <div className="tw:mt-3 tw:flex tw:flex-col tw:gap-3.5">
          {activities.map(({ id, type, title, by, createdAt }) => {
            const { Icon, iconBg, iconColor } = TYPE_META[type];
            return (
              <div key={id} className="tw:flex tw:items-start tw:gap-3">
                <div className={`tw:flex tw:h-8 tw:w-8 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full ${iconBg}`}>
                  <Icon className={`tw:h-4 tw:w-4 ${iconColor}`} strokeWidth={2} />
                </div>
                <div className="tw:min-w-0">
                  <div className="tw:text-[13px] tw:font-medium tw:text-slate-900">{title}</div>
                  <div className="tw:text-[11px] tw:text-slate-500">
                    {by && <>by {by} · </>}{timeAgo(createdAt)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
