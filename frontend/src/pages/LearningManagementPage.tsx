import { useEffect, useState } from 'react';
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
import CategoriesTab from '../components/learningManagement/CategoriesTab';
import LearningPathsTab from '../components/learningManagement/LearningPathsTab';
import AssessmentsTab from '../components/learningManagement/AssessmentsTab';
import CertificatesTab from '../components/learningManagement/CertificatesTab';
import LiveSessionsTab from '../components/learningManagement/LiveSessionsTab';
import EnrollmentsTab from '../components/learningManagement/EnrollmentsTab';
import ContentLibraryTab from '../components/learningManagement/ContentLibraryTab';
import { useTabParam } from '../hooks/useTabParam';
import { useFeatureFlags } from '../FeatureFlagsContext';

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
  'Categories':     'categories',
};

const KEY_TO_LM_TAB: Record<string, LmTab> = Object.fromEntries(
  (Object.entries(LM_TAB_KEYS) as [LmTab, string][]).map(([k, v]) => [v, k])
);

export default function LearningManagementPage() {
  const [tabKey, setTabKey] = useTabParam('overview');
  const tab: LmTab = KEY_TO_LM_TAB[tabKey] ?? LM_TABS[0];
  const setTab = (t: LmTab) => setTabKey(LM_TAB_KEYS[t]);

  // System Settings' Feature Toggles (?tab=features) gate these two real
  // modules — everything else on that tab is either always-on or has no
  // gated module behind it yet (see FeatureTogglesTab.tsx's own header note).
  const { flags } = useFeatureFlags();
  const hiddenTabs: LmTab[] = [
    ...(flags.liveSessionsEnabled ? [] : (['Live Sessions'] as LmTab[])),
    ...(flags.certificatesModuleEnabled ? [] : (['Certificates'] as LmTab[])),
  ];
  useEffect(() => {
    if (hiddenTabs.includes(tab)) setTab('Overview');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, flags.liveSessionsEnabled, flags.certificatesModuleEnabled]);

  // When the guide's "Create New Course" is clicked from the Overview tab,
  // switch to Courses and signal CoursesTab to open the create form on mount.
  const [openCreate, setOpenCreate] = useState(false);

  // Clear the flag once CoursesTab has mounted and read it.
  useEffect(() => {
    if (tab === 'Courses' && openCreate) setOpenCreate(false);
  }, [tab, openCreate]);

  function handleGuideCreateCourse() {
    setOpenCreate(true);
    setTab('Courses');
  }

  // When the Overview header's "More Actions > Pending Course Approvals" is
  // clicked, switch to Courses and signal CoursesTab to mount pre-filtered
  // to the Pending status tab.
  const [openPendingApprovals, setOpenPendingApprovals] = useState(false);

  useEffect(() => {
    if (tab === 'Courses' && openPendingApprovals) setOpenPendingApprovals(false);
  }, [tab, openPendingApprovals]);

  function handleViewPendingApprovals() {
    setOpenPendingApprovals(true);
    setTab('Courses');
  }

  // When the guide's remaining 4 shortcuts are clicked from the Overview tab,
  // switch to the matching tab and signal it to mount directly into its
  // create form (same pattern as handleGuideCreateCourse above).
  const [openCreatePath,       setOpenCreatePath]       = useState(false);
  const [openCreateAssessment, setOpenCreateAssessment] = useState(false);
  const [openScheduleSession,  setOpenScheduleSession]  = useState(false);
  const [openUploadContent,    setOpenUploadContent]    = useState(false);

  useEffect(() => {
    if (tab === 'Learning Paths' && openCreatePath) setOpenCreatePath(false);
  }, [tab, openCreatePath]);
  useEffect(() => {
    if (tab === 'Assessments' && openCreateAssessment) setOpenCreateAssessment(false);
  }, [tab, openCreateAssessment]);
  useEffect(() => {
    if (tab === 'Live Sessions' && openScheduleSession) setOpenScheduleSession(false);
  }, [tab, openScheduleSession]);
  useEffect(() => {
    if (tab === 'Content' && openUploadContent) setOpenUploadContent(false);
  }, [tab, openUploadContent]);

  function handleGuideCreateLearningPath() {
    setOpenCreatePath(true);
    setTab('Learning Paths');
  }

  function handleGuideCreateAssessment() {
    setOpenCreateAssessment(true);
    setTab('Assessments');
  }

  function handleGuideScheduleLiveSession() {
    setOpenScheduleSession(true);
    setTab('Live Sessions');
  }

  function handleGuideUploadContent() {
    setOpenUploadContent(true);
    setTab('Content');
  }

  // When the Certificates tab's "certificates disabled" error links to a
  // course's Settings step, carry the courseId across the tab switch and
  // signal CoursesTab to mount directly into Settings for it.
  const [settingsCourseId, setSettingsCourseId] = useState<string | null>(null);

  useEffect(() => {
    if (tab === 'Courses' && settingsCourseId) setSettingsCourseId(null);
  }, [tab, settingsCourseId]);

  function handleGoToCourseSettings(courseId: string) {
    setSettingsCourseId(courseId);
    setTab('Courses');
  }

  return (
    <AdminLayout pageTitle="Learning Management">
      <div className="lm-page-root tw:mx-auto tw:flex tw:max-w-[1440px] tw:flex-col tw:gap-5 tw:font-lm-sans">
        <LmPageHeader onCreateCourse={handleGuideCreateCourse} onViewPendingApprovals={handleViewPendingApprovals} />
        <KpiCards />
        <LmTabs active={tab} onChange={setTab} hiddenTabs={hiddenTabs} />

        {tab === 'Courses' ? (
          <CoursesTab
            openCreateOnMount={openCreate}
            openSettingsForCourseId={settingsCourseId}
            initialStatusFilter={openPendingApprovals ? 'Pending' : undefined}
          />
        ) : tab === 'Learning Paths' ? (
          <LearningPathsTab openCreateOnMount={openCreatePath} />
        ) : tab === 'Assessments' ? (
          <AssessmentsTab openCreateOnMount={openCreateAssessment} />
        ) : tab === 'Certificates' ? (
          <CertificatesTab onGoToCourseSettings={handleGoToCourseSettings} />
        ) : tab === 'Live Sessions' ? (
          <LiveSessionsTab openCreateOnMount={openScheduleSession} />
        ) : tab === 'Enrollments' ? (
          <EnrollmentsTab />
        ) : tab === 'Content' ? (
          <ContentLibraryTab openUploadOnMount={openUploadContent} />
        ) : tab === 'Categories' ? (
          <CategoriesTab />
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
              <LmGuide
                onCreateCourse={handleGuideCreateCourse}
                onCreateLearningPath={handleGuideCreateLearningPath}
                onUploadContent={handleGuideUploadContent}
                onCreateAssessment={handleGuideCreateAssessment}
                onScheduleLiveSession={handleGuideScheduleLiveSession}
              />
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
