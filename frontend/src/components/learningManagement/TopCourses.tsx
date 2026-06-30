import { useEffect, useState } from 'react';
import { getLmTopCourses } from '../../services/lmApi';
import type { TopCourse } from '../../types/lm';

const GRADIENTS = [
  'tw:from-blue-500 tw:to-blue-700',
  'tw:from-violet-500 tw:to-violet-700',
  'tw:from-pink-500 tw:to-pink-700',
  'tw:from-amber-500 tw:to-amber-700',
  'tw:from-teal-500 tw:to-teal-700',
];

function TopCoursesSkeleton() {
  return (
    <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5">
      <div className="tw:h-4 tw:w-40 tw:animate-pulse tw:rounded tw:bg-slate-100" />
      <div className="tw:mt-3 tw:flex tw:flex-col tw:gap-3.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="tw:flex tw:items-center tw:gap-3">
            <div className="tw:h-9 tw:w-9 tw:shrink-0 tw:animate-pulse tw:rounded-lg tw:bg-slate-100" />
            <div className="tw:min-w-0 tw:flex-1">
              <div className="tw:h-3 tw:w-32 tw:animate-pulse tw:rounded tw:bg-slate-100" />
              <div className="tw:mt-1.5 tw:h-2.5 tw:w-20 tw:animate-pulse tw:rounded tw:bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TopCourses() {
  const [courses, setCourses] = useState<TopCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (() => { setLoading(true); setError(false); })();
    getLmTopCourses(5)
      .then((data) => { if (!cancelled) setCourses(data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <TopCoursesSkeleton />;

  return (
    <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5">
      <div className="tw:flex tw:items-center tw:justify-between">
        <h3 className="tw:m-0 tw:text-[14px] tw:font-semibold tw:text-slate-900">Top Performing Courses</h3>
        <button type="button" className="tw:text-[12px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">
          View All
        </button>
      </div>

      {error ? (
        <div className="tw:mt-3 tw:text-center tw:text-[13px] tw:text-red-500">Failed to load top courses</div>
      ) : (
        <div className="tw:mt-3 tw:flex tw:flex-col tw:gap-3.5">
          {courses.map((c, i) => (
            <div key={c.id} className="tw:flex tw:items-center tw:gap-3">
              <div className={`tw:h-9 tw:w-9 tw:shrink-0 tw:rounded-lg tw:bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]}`} />
              <div className="tw:min-w-[44px] tw:flex-1">
                <div className="tw:truncate tw:text-[13px] tw:font-medium tw:text-slate-900">{c.title}</div>
                <div className="tw:truncate tw:text-[11px] tw:text-slate-500">By {c.instructor}</div>
              </div>
              <div className="tw:w-16 tw:shrink-0 tw:text-right">
                <div className="tw:text-[13px] tw:font-semibold tw:text-slate-900">{c.completionRate}%</div>
                <div className="tw:mt-1 tw:h-1.5 tw:w-full tw:overflow-hidden tw:rounded-full tw:bg-slate-100">
                  <div className="tw:h-full tw:rounded-full tw:bg-green-500" style={{ width: `${c.completionRate}%` }} />
                </div>
                <div className="tw:mt-1 tw:text-[10px] tw:text-slate-400">{c.enrolled.toLocaleString()} Enrolled</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
