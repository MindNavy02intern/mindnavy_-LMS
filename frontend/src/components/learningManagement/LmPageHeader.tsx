import { Plus, Download, ChevronDown } from 'lucide-react';

export default function LmPageHeader() {
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
          className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2.5 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700"
        >
          <Plus className="tw:h-4 tw:w-4" strokeWidth={2.25} />
          Create Course
        </button>
        <button
          type="button"
          className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-white tw:px-4 tw:py-2.5 tw:text-[13px] tw:font-semibold tw:text-slate-700 tw:hover:bg-slate-50"
        >
          <Download className="tw:h-4 tw:w-4" strokeWidth={2} />
          Import Content
        </button>
        <button
          type="button"
          className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-white tw:px-4 tw:py-2.5 tw:text-[13px] tw:font-semibold tw:text-slate-700 tw:hover:bg-slate-50"
        >
          More Actions
          <ChevronDown className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
