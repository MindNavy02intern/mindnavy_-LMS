import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Pencil, MoreVertical } from 'lucide-react';
import { getLmCourses, getLmFilterOptions } from '../../services/lmApi';
import type { CourseRow, LmFilterOptions } from '../../types/lm';

const LIMIT_OPTIONS = [10, 25, 50];

const STATUS_BADGE: Record<CourseRow['status'], string> = {
  Published: 'tw:bg-green-50 tw:text-green-700',
  Draft:     'tw:bg-amber-50 tw:text-amber-700',
};

const GRADIENTS = [
  'tw:from-blue-500 tw:to-blue-700',
  'tw:from-violet-500 tw:to-violet-700',
  'tw:from-pink-500 tw:to-pink-700',
  'tw:from-teal-500 tw:to-teal-700',
  'tw:from-amber-500 tw:to-amber-700',
  'tw:from-slate-400 tw:to-slate-600',
];

function initials(name: string): string {
  return name.split(' ').map((w) => w[0] ?? '').slice(0, 2).join('').toUpperCase();
}

function pageNumbers(current: number, total: number): number[] {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(1, Math.min(current - 2, total - 4));
  return Array.from({ length: 5 }, (_, i) => start + i);
}

export default function CoursesTable() {
  const [filterOptions, setFilterOptions] = useState<LmFilterOptions | null>(null);

  const [rows, setRows] = useState<CourseRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [category, setCategory] = useState('');
  const [instructor, setInstructor] = useState('');

  useEffect(() => {
    getLmFilterOptions()
      .then(setFilterOptions)
      .catch(() => setFilterOptions(null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (() => { setLoading(true); setError(false); })();
    getLmCourses({ page, limit, category: category || undefined, instructor: instructor || undefined })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setTotal(res.pagination.total);
        setPages(res.pagination.pages);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, limit, category, instructor]);

  const rowStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rowEnd = Math.min(page * limit, total);
  const pnums = pageNumbers(page, pages);

  return (
    <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5">
      <div className="tw:flex tw:items-center tw:justify-between">
        <h3 className="tw:m-0 tw:text-[14px] tw:font-semibold tw:text-slate-900">Recent Courses</h3>
        <div className="tw:flex tw:items-center tw:gap-2.5">
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="tw:rounded-md tw:border tw:border-slate-200 tw:px-2.5 tw:py-1.5 tw:text-[12px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50"
          >
            <option value="">All Categories</option>
            {filterOptions?.categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            aria-label="Filter by instructor"
            value={instructor}
            onChange={(e) => { setInstructor(e.target.value); setPage(1); }}
            className="tw:rounded-md tw:border tw:border-slate-200 tw:px-2.5 tw:py-1.5 tw:text-[12px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50"
          >
            <option value="">All Instructors</option>
            {filterOptions?.instructors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          <button type="button" className="tw:text-[12px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">
            View All
          </button>
        </div>
      </div>

      <div className="tw:mt-3 tw:overflow-x-auto">
        <table className="tw:w-full tw:border-collapse">
          <thead>
            <tr className="tw:border-b tw:border-slate-200 tw:text-left">
              {['Course Title', 'Instructor', 'Category', 'Level', 'Enrolled Students', 'Progress', 'Status', 'Actions'].map((h) => (
                <th key={h} className="tw:px-3 tw:py-2.5 tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-400">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: limit > 10 ? 10 : limit }).map((_, i) => (
              <tr key={i} className="tw:border-b tw:border-slate-100">
                {Array.from({ length: 8 }).map((__, j) => (
                  <td key={j} className="tw:px-3 tw:py-3">
                    <div className="tw:h-3 tw:w-full tw:animate-pulse tw:rounded tw:bg-slate-100" />
                  </td>
                ))}
              </tr>
            ))}

            {!loading && error && (
              <tr>
                <td colSpan={8} className="tw:px-3 tw:py-8 tw:text-center tw:text-[13px] tw:text-red-500">
                  Failed to load courses
                </td>
              </tr>
            )}

            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="tw:px-3 tw:py-8 tw:text-center tw:text-[13px] tw:text-slate-400">
                  No courses found
                </td>
              </tr>
            )}

            {!loading && !error && rows.map((r, i) => (
              <tr key={r.id} className="tw:border-b tw:border-slate-100 tw:hover:bg-slate-50">
                <td className="tw:px-3 tw:py-3">
                  <div className="tw:flex tw:items-center tw:gap-2.5">
                    <div className={`tw:h-8 tw:w-8 tw:shrink-0 tw:rounded-lg tw:bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]}`} />
                    <span className="tw:whitespace-nowrap tw:text-[13px] tw:font-medium tw:text-slate-900">{r.title}</span>
                  </div>
                </td>
                <td className="tw:px-3 tw:py-3">
                  <div className="tw:flex tw:items-center tw:gap-2">
                    <div className="tw:flex tw:h-6 tw:w-6 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-full tw:bg-slate-200 tw:text-[10px] tw:font-semibold tw:text-slate-600">
                      {initials(r.instructor)}
                    </div>
                    <span className="tw:whitespace-nowrap tw:text-[13px] tw:text-slate-700">{r.instructor}</span>
                  </div>
                </td>
                <td className="tw:px-3 tw:py-3 tw:text-[13px] tw:text-slate-700">{r.category}</td>
                <td className="tw:px-3 tw:py-3">
                  <span className="tw:rounded-full tw:bg-slate-100 tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-medium tw:text-slate-600">
                    {r.level}
                  </span>
                </td>
                <td className="tw:px-3 tw:py-3 tw:whitespace-nowrap tw:text-[13px] tw:text-slate-700">{r.enrolled.toLocaleString()}</td>
                <td className="tw:px-3 tw:py-3">
                  <div className="tw:flex tw:items-center tw:gap-2">
                    <div className="tw:h-1.5 tw:w-20 tw:overflow-hidden tw:rounded-full tw:bg-slate-100">
                      <div className="tw:h-full tw:rounded-full tw:bg-green-500" style={{ width: `${r.progress}%` }} />
                    </div>
                    <span className="tw:text-[12px] tw:text-slate-500">{r.progress}%</span>
                  </div>
                </td>
                <td className="tw:px-3 tw:py-3">
                  <span className={`tw:rounded-full tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-medium ${STATUS_BADGE[r.status]}`}>
                    {r.status}
                  </span>
                </td>
                <td className="tw:px-3 tw:py-3">
                  <div className="tw:flex tw:items-center tw:gap-1.5 tw:text-slate-400">
                    <button type="button" className="tw:rounded tw:p-1 tw:hover:bg-slate-100 tw:hover:text-blue-600">
                      <Eye className="tw:h-4 tw:w-4" strokeWidth={2} />
                    </button>
                    <button type="button" className="tw:rounded tw:p-1 tw:hover:bg-slate-100 tw:hover:text-blue-600">
                      <Pencil className="tw:h-4 tw:w-4" strokeWidth={2} />
                    </button>
                    <button type="button" className="tw:rounded tw:p-1 tw:hover:bg-slate-100 tw:hover:text-blue-600">
                      <MoreVertical className="tw:h-4 tw:w-4" strokeWidth={2} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="tw:mt-4 tw:flex tw:items-center tw:justify-between">
        <span className="tw:text-[12px] tw:text-slate-500">
          {loading ? 'Loading…' : `Showing ${rowStart} to ${rowEnd} of ${total} courses`}
        </span>

        <div className="tw:flex tw:items-center tw:gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="tw:flex tw:h-7 tw:w-7 tw:items-center tw:justify-center tw:rounded-md tw:border tw:border-slate-200 tw:text-slate-400 tw:hover:bg-slate-50 tw:disabled:cursor-not-allowed tw:disabled:opacity-50"
          >
            <ChevronLeft className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
          </button>
          {pnums.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={
                'tw:flex tw:h-7 tw:w-7 tw:items-center tw:justify-center tw:rounded-md tw:text-[12px] tw:font-medium' +
                (p === page ? ' tw:bg-blue-600 tw:text-white' : ' tw:text-slate-600 tw:hover:bg-slate-50')
              }
            >
              {p}
            </button>
          ))}
          {pages > 5 && pnums[pnums.length - 1] < pages && (
            <>
              <span className="tw:px-1 tw:text-[12px] tw:text-slate-400">…</span>
              <button
                type="button"
                onClick={() => setPage(pages)}
                className="tw:flex tw:h-7 tw:w-7 tw:items-center tw:justify-center tw:rounded-md tw:text-[12px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50"
              >
                {pages}
              </button>
            </>
          )}
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="tw:flex tw:h-7 tw:w-7 tw:items-center tw:justify-center tw:rounded-md tw:border tw:border-slate-200 tw:text-slate-400 tw:hover:bg-slate-50 tw:disabled:cursor-not-allowed tw:disabled:opacity-50"
          >
            <ChevronRight className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
          </button>
        </div>

        <select
          aria-label="Rows per page"
          value={limit}
          onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
          className="tw:rounded-md tw:border tw:border-slate-200 tw:px-2.5 tw:py-1.5 tw:text-[12px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50"
        >
          {LIMIT_OPTIONS.map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
      </div>
    </div>
  );
}
