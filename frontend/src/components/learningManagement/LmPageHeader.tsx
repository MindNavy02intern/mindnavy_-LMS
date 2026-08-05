import { useEffect, useRef, useState } from 'react';
import { Plus, Download, ChevronDown, ShieldCheck } from 'lucide-react';

interface LmPageHeaderProps {
  onCreateCourse: () => void;
  onViewPendingApprovals: () => void;
}

export default function LmPageHeader({ onCreateCourse, onViewPendingApprovals }: LmPageHeaderProps) {
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const moreActionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreActionsRef.current && !moreActionsRef.current.contains(e.target as Node)) {
        setMoreActionsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="tw:flex tw:items-start tw:justify-between tw:gap-4">
      <div>
        <h1 className="tw:m-0 tw:text-[24px] tw:font-semibold tw:text-slate-900">Learning Management</h1>
        <p className="tw:mt-1 tw:mb-0 tw:text-[14px] tw:text-slate-500">
          Manage courses, content, learning paths, assessments and track learning performance
        </p>
      </div>

      <div className="tw:flex tw:shrink-0 tw:items-center tw:gap-2.5">
        <button
          type="button"
          onClick={onCreateCourse}
          className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2.5 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700"
        >
          <Plus className="tw:h-4 tw:w-4" strokeWidth={2.25} />
          Create Course
        </button>

        <button
          type="button"
          disabled
          title="Bulk course import is coming soon"
          className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-white tw:px-4 tw:py-2.5 tw:text-[13px] tw:font-semibold tw:text-slate-400 tw:cursor-not-allowed"
        >
          <Download className="tw:h-4 tw:w-4" strokeWidth={2} />
          Import Content
        </button>

        <div ref={moreActionsRef} className="tw:relative">
          <button
            type="button"
            onClick={() => setMoreActionsOpen((o) => !o)}
            className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-white tw:px-4 tw:py-2.5 tw:text-[13px] tw:font-semibold tw:text-slate-700 tw:hover:bg-slate-50"
          >
            More Actions
            <ChevronDown className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
          </button>

          {moreActionsOpen && (
            <div className="tw:absolute tw:right-0 tw:top-[calc(100%+6px)] tw:z-50 tw:w-56 tw:overflow-hidden tw:rounded-lg tw:border tw:border-slate-200 tw:bg-white tw:shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setMoreActionsOpen(false);
                  onViewPendingApprovals();
                }}
                className="tw:flex tw:w-full tw:items-center tw:gap-2 tw:px-3.5 tw:py-2.5 tw:text-left tw:text-[13px] tw:font-medium tw:text-slate-700 tw:hover:bg-slate-50"
              >
                <ShieldCheck className="tw:h-4 tw:w-4 tw:text-slate-400" strokeWidth={2} />
                Pending Course Approvals
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
