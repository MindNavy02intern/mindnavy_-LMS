import '../styles/learningManagement.css';
import AdminLayout from '../layouts/AdminLayout';
import LmPageHeader from '../components/learningManagement/LmPageHeader';
import KpiCards from '../components/learningManagement/KpiCards';
import LmTabs, { LM_TABS } from '../components/learningManagement/LmTabs';
import type { LmTab } from '../components/learningManagement/LmTabs';
import DistributionChart from '../components/learningManagement/DistributionChart';
import ProgressChart from '../components/learningManagement/ProgressChart';
import TopCourses from '../components/learningManagement/TopCourses';
import CoursesTable from '../components/learningManagement/CoursesTable';
import LmGuide from '../components/learningManagement/LmGuide';
import ContentStats from '../components/learningManagement/ContentStats';
import LiveSessions from '../components/learningManagement/LiveSessions';
import RecentActivities from '../components/learningManagement/RecentActivities';
import CoursesTab from '../components/learningManagement/CoursesTab';
import { useTabParam } from '../hooks/useTabParam';

const LM_TAB_KEYS: Record<LmTab, string> = {
  'Overview':       'overview',
  'Courses':        'courses',
  'Learning Paths': 'paths',
  'Content':        'content',
  'Assessments':    'assessments',
  'Enrollments':    'enrollments',
  'Live Sessions':  'live',
  'Certificates':   'certificates',
  'Analytics':      'analytics',
};

const KEY_TO_LM_TAB: Record<string, LmTab> = Object.fromEntries(
  (Object.entries(LM_TAB_KEYS) as [LmTab, string][]).map(([k, v]) => [v, k])
);

export default function LearningManagementPage() {
  const [tabKey, setTabKey] = useTabParam('overview');
  const tab: LmTab = KEY_TO_LM_TAB[tabKey] ?? LM_TABS[0];
  const setTab = (t: LmTab) => setTabKey(LM_TAB_KEYS[t]);

  return (
    <AdminLayout pageTitle="Learning Management">
      <div className="lm-page-root tw:mx-auto tw:flex tw:max-w-[1440px] tw:flex-col tw:gap-5 tw:font-lm-sans">
        <LmPageHeader />
        <KpiCards />
        <LmTabs active={tab} onChange={setTab} />

        {tab === 'Courses' ? (
          <CoursesTab />
        ) : tab === 'Overview' ? (
          <div className="tw:flex tw:gap-5">
            <div className="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-5">
              <div className="tw:grid tw:grid-cols-3 tw:gap-5">
                <DistributionChart />
                <ProgressChart />
                <TopCourses />
              </div>
              <CoursesTable />
            </div>

            <div className="tw:flex tw:w-[340px] tw:shrink-0 tw:flex-col tw:gap-5">
              <LmGuide />
              <ContentStats />
              <LiveSessions />
              <RecentActivities />
            </div>
          </div>
        ) : (
          <div className="tw:flex tw:items-center tw:justify-center tw:rounded-xl tw:border tw:border-dashed tw:border-slate-300 tw:bg-white tw:py-24 tw:text-[14px] tw:text-slate-400">
            {tab} — coming soon
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
