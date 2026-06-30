import { BookPlus, Route, UploadCloud, ClipboardCheck, CalendarPlus } from 'lucide-react';

interface GuideItem {
  title:    string;
  desc:     string;
  Icon:     typeof BookPlus;
  iconBg:   string;
  iconColor: string;
}

const ITEMS: GuideItem[] = [
  { title: 'Create New Course',     desc: 'Build a new course from scratch',        Icon: BookPlus,       iconBg: 'tw:bg-blue-100',   iconColor: 'tw:text-blue-600' },
  { title: 'Create Learning Path',  desc: 'Design a structured learning journey',   Icon: Route,          iconBg: 'tw:bg-green-100',  iconColor: 'tw:text-green-600' },
  { title: 'Upload Content',        desc: 'Add content and learning materials',     Icon: UploadCloud,    iconBg: 'tw:bg-violet-100', iconColor: 'tw:text-violet-600' },
  { title: 'Create Assessment',     desc: 'Build quizzes, exams and assignments',    Icon: ClipboardCheck, iconBg: 'tw:bg-orange-100', iconColor: 'tw:text-orange-600' },
  { title: 'Schedule Live Session', desc: 'Plan and manage live classes',            Icon: CalendarPlus,   iconBg: 'tw:bg-pink-100',   iconColor: 'tw:text-pink-600' },
];

export default function LmGuide() {
  return (
    <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5">
      <h3 className="tw:m-0 tw:text-[14px] tw:font-semibold tw:text-slate-900">Learning Management Guide</h3>

      <div className="tw:mt-3 tw:flex tw:flex-col tw:gap-3.5">
        {ITEMS.map(({ title, desc, Icon, iconBg, iconColor }) => (
          <button key={title} type="button" className="tw:flex tw:items-start tw:gap-3 tw:text-left tw:hover:opacity-80">
            <div className={`tw:flex tw:h-9 tw:w-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg ${iconBg}`}>
              <Icon className={`tw:h-[18px] tw:w-[18px] ${iconColor}`} strokeWidth={2} />
            </div>
            <div className="tw:min-w-0">
              <div className="tw:text-[13px] tw:font-medium tw:text-slate-900">{title}</div>
              <div className="tw:text-[11px] tw:text-slate-500">{desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
