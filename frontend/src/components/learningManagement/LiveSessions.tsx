import { useEffect, useState } from 'react';
import { Radio, Users } from 'lucide-react';
import { getLmLiveSessions } from '../../services/lmApi';
import type { LiveSession } from '../../types/lm';

function formatStart(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function LiveSessionsSkeleton() {
  return (
    <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5">
      <div className="tw:h-4 tw:w-44 tw:animate-pulse tw:rounded tw:bg-slate-100" />
      <div className="tw:mt-3 tw:flex tw:flex-col tw:gap-3.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="tw:flex tw:items-center tw:gap-3">
            <div className="tw:h-9 tw:w-9 tw:shrink-0 tw:animate-pulse tw:rounded-lg tw:bg-slate-100" />
            <div className="tw:min-w-0 tw:flex-1">
              <div className="tw:h-3 tw:w-36 tw:animate-pulse tw:rounded tw:bg-slate-100" />
              <div className="tw:mt-1.5 tw:h-2.5 tw:w-24 tw:animate-pulse tw:rounded tw:bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LiveSessions() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (() => { setLoading(true); setError(false); })();
    getLmLiveSessions('upcoming')
      .then((data) => { if (!cancelled) setSessions(data); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <LiveSessionsSkeleton />;

  return (
    <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5">
      <div className="tw:flex tw:items-center tw:justify-between">
        <h3 className="tw:m-0 tw:text-[14px] tw:font-semibold tw:text-slate-900">Upcoming Live Sessions</h3>
        <button type="button" className="tw:text-[12px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">
          View All
        </button>
      </div>

      {error ? (
        <div className="tw:mt-3 tw:text-center tw:text-[13px] tw:text-red-500">Failed to load live sessions</div>
      ) : sessions.length === 0 ? (
        <div className="tw:mt-3 tw:text-center tw:text-[13px] tw:text-slate-400">No upcoming sessions</div>
      ) : (
        <div className="tw:mt-3 tw:flex tw:flex-col tw:gap-3.5">
          {sessions.map((s) => (
            <div key={s.id} className="tw:flex tw:items-center tw:gap-3">
              <div className="tw:flex tw:h-9 tw:w-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:bg-red-100">
                <Radio className="tw:h-[18px] tw:w-[18px] tw:text-red-600" strokeWidth={2} />
              </div>
              <div className="tw:min-w-0 tw:flex-1">
                <div className="tw:truncate tw:text-[13px] tw:font-medium tw:text-slate-900">{s.title}</div>
                <div className="tw:truncate tw:text-[11px] tw:text-slate-500">
                  {s.relatedCourse ? `${s.relatedCourse} · ` : ''}{formatStart(s.startTime)}
                </div>
              </div>
              <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-1 tw:text-[11px] tw:text-slate-400">
                <Users className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
                {s.enrolledCount}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
