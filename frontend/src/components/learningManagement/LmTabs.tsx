export const LM_TABS = [
  'Overview', 'Courses', 'Learning Paths', 'Content', 'Assessments',
  'Enrollments', 'Live Sessions', 'Certificates', 'Analytics', 'Categories',
] as const;

export type LmTab = typeof LM_TABS[number];

interface Props {
  active:   LmTab;
  onChange: (tab: LmTab) => void;
}

export default function LmTabs({ active, onChange }: Props) {
  return (
    <div className="tw:flex tw:gap-6 tw:border-b tw:border-slate-200">
      {LM_TABS.map((tab) => {
        const isActive = tab === active;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onChange(tab)}
            className={
              'tw:-mb-px tw:border-b-2 tw:px-0.5 tw:py-3 tw:text-[13px] tw:font-medium tw:transition-colors' +
              (isActive
                ? ' tw:border-blue-600 tw:text-blue-600'
                : ' tw:border-transparent tw:text-slate-500 tw:hover:text-slate-700')
            }
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}
