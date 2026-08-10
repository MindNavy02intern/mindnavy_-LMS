import { useState } from 'react';
import AdminLayout from '../../layouts/AdminLayout';
import { useTabParam } from '../../hooks/useTabParam';
import { useToast, ToastContainer } from '../../components/users/Toast';
import ReportsPageHeader from '../../components/reports/ReportsPageHeader';
import ReportsOverviewTab from '../../components/reports/ReportsOverviewTab';
import LearnerAnalyticsTab from '../../components/reports/LearnerAnalyticsTab';
import InstructorAnalyticsTab from '../../components/reports/InstructorAnalyticsTab';
import CourseAnalyticsTab from '../../components/reports/CourseAnalyticsTab';
import LearningProgressTab from '../../components/reports/LearningProgressTab';
import AssessmentReportsTab from '../../components/reports/AssessmentReportsTab';
import CertificateReportsTab from '../../components/reports/CertificateReportsTab';
import AttendanceReportsTab from '../../components/reports/AttendanceReportsTab';
import EngagementAnalyticsTab from '../../components/reports/EngagementAnalyticsTab';
import ComplianceReportsTab from '../../components/reports/ComplianceReportsTab';
import AuditLogsTab from '../../components/reports/AuditLogsTab';
import ExportCenterTab from '../../components/reports/ExportCenterTab';
import CustomReportsTab from '../../components/reports/CustomReportsTab';
import ExportReportModal from '../../components/reports/ExportReportModal';

type PageTab =
  | 'overview' | 'learners' | 'instructors' | 'courses' | 'progress'
  | 'assessments' | 'certificates' | 'attendance' | 'engagement'
  | 'compliance' | 'audit' | 'export' | 'custom';

const TABS: { key: PageTab; label: string }[] = [
  { key: 'overview',     label: 'Overview' },
  { key: 'learners',     label: 'Learner Analytics' },
  { key: 'instructors',  label: 'Instructor Analytics' },
  { key: 'courses',      label: 'Course Analytics' },
  { key: 'progress',     label: 'Learning Progress' },
  { key: 'assessments',  label: 'Assessments' },
  { key: 'certificates', label: 'Certificates' },
  { key: 'attendance',   label: 'Attendance' },
  { key: 'engagement',   label: 'Engagement' },
  { key: 'compliance',   label: 'Compliance' },
  { key: 'audit',        label: 'Audit Logs' },
  { key: 'export',       label: 'Export Center' },
  { key: 'custom',       label: 'Custom Reports' },
];

export default function ReportsPage() {
  const [tabKey, setTabKey] = useTabParam('overview');
  const tab = (TABS.some(t => t.key === tabKey) ? tabKey : 'overview') as PageTab;

  const { toasts, showToast, dismiss } = useToast();
  const [exportModalOpen, setExportModalOpen] = useState(false);

  function setTab(t: PageTab) { setTabKey(t); }

  return (
    <AdminLayout pageTitle="Reports & Analytics">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1440, margin: '0 auto' }}>
        <ReportsPageHeader
          onExport={() => setExportModalOpen(true)}
          onScheduleReport={() => setTab('export')}
          onCustomReport={() => setTab('custom')}
        />

        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', fontSize: 13, fontWeight: 600,
                  fontFamily: 'inherit', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                  border: 'none', borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                  color: active ? '#2563eb' : '#64748b', marginBottom: -1,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div>
          {tab === 'overview' ? (
            <ReportsOverviewTab showToast={showToast} />
          ) : tab === 'learners' ? (
            <LearnerAnalyticsTab showToast={showToast} />
          ) : tab === 'instructors' ? (
            <InstructorAnalyticsTab showToast={showToast} />
          ) : tab === 'courses' ? (
            <CourseAnalyticsTab showToast={showToast} />
          ) : tab === 'progress' ? (
            <LearningProgressTab showToast={showToast} />
          ) : tab === 'assessments' ? (
            <AssessmentReportsTab showToast={showToast} />
          ) : tab === 'certificates' ? (
            <CertificateReportsTab showToast={showToast} />
          ) : tab === 'attendance' ? (
            <AttendanceReportsTab showToast={showToast} />
          ) : tab === 'engagement' ? (
            <EngagementAnalyticsTab showToast={showToast} />
          ) : tab === 'compliance' ? (
            <ComplianceReportsTab showToast={showToast} />
          ) : tab === 'audit' ? (
            <AuditLogsTab showToast={showToast} />
          ) : tab === 'export' ? (
            <ExportCenterTab showToast={showToast} />
          ) : (
            <CustomReportsTab showToast={showToast} />
          )}
        </div>
      </div>

      {exportModalOpen && (
        <ExportReportModal onClose={() => setExportModalOpen(false)} showToast={showToast} />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </AdminLayout>
  );
}
