import { BookPlus, Route, UploadCloud, ClipboardCheck, CalendarPlus } from 'lucide-react';

interface Props {
  onCreateCourse?: () => void;
  onCreateLearningPath?: () => void;
  onUploadContent?: () => void;
  onCreateAssessment?: () => void;
  onScheduleLiveSession?: () => void;
}

export default function LmGuide({
  onCreateCourse,
  onCreateLearningPath,
  onUploadContent,
  onCreateAssessment,
  onScheduleLiveSession,
}: Props) {
  return (
    <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-5">
      <h3 className="tw:m-0 tw:text-[14px] tw:font-semibold tw:text-slate-900">Learning Management Guide</h3>

      <div className="tw:mt-3 tw:flex tw:flex-col tw:gap-3.5">

        {/* Create New Course — wired */}
        <button
          type="button"
          onClick={onCreateCourse}
          className="tw:flex tw:items-start tw:gap-3 tw:text-left tw:hover:opacity-80"
        >
          <div className="tw:flex tw:h-9 tw:w-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:bg-blue-100">
            <BookPlus className="tw:h-[18px] tw:w-[18px] tw:text-blue-600" strokeWidth={2} />
          </div>
          <div className="tw:min-w-0">
            <div className="tw:text-[13px] tw:font-medium tw:text-slate-900">Create New Course</div>
            <div className="tw:text-[11px] tw:text-slate-500">Build a new course from scratch</div>
          </div>
        </button>

        {([
          { title: 'Create Learning Path',  desc: 'Design a structured learning journey',  Icon: Route,          iconBg: 'tw:bg-green-100',  iconColor: 'tw:text-green-600', onClick: onCreateLearningPath },
          { title: 'Upload Content',        desc: 'Add content and learning materials',    Icon: UploadCloud,    iconBg: 'tw:bg-violet-100', iconColor: 'tw:text-violet-600', onClick: onUploadContent },
          { title: 'Create Assessment',     desc: 'Build quizzes, exams and assignments',   Icon: ClipboardCheck, iconBg: 'tw:bg-orange-100', iconColor: 'tw:text-orange-600', onClick: onCreateAssessment },
          { title: 'Schedule Live Session', desc: 'Plan and manage live classes',           Icon: CalendarPlus,   iconBg: 'tw:bg-pink-100',   iconColor: 'tw:text-pink-600', onClick: onScheduleLiveSession },
        ] as const).map(({ title, desc, Icon, iconBg, iconColor, onClick }) => {
          const disabled = !onClick;
          return (
            <button
              key={title}
              type="button"
              onClick={onClick}
              disabled={disabled}
              title={disabled ? 'Coming soon' : undefined}
              className={
                'tw:flex tw:items-start tw:gap-3 tw:text-left' +
                (disabled ? ' tw:cursor-not-allowed tw:opacity-40' : ' tw:cursor-pointer tw:hover:opacity-80')
              }
            >
              <div className={`tw:flex tw:h-9 tw:w-9 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg ${iconBg}`}>
                <Icon className={`tw:h-[18px] tw:w-[18px] ${iconColor}`} strokeWidth={2} />
              </div>
              <div className="tw:min-w-0">
                <div className="tw:text-[13px] tw:font-medium tw:text-slate-900">{title}</div>
                <div className="tw:text-[11px] tw:text-slate-500">{desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
