import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { useTabParam } from '../../hooks/useTabParam';
import { useToast, ToastContainer } from '../../components/users/Toast';
import CompetenciesPageHeader from '../../components/competencies/CompetenciesPageHeader';
import CompetenciesStatsCards from '../../components/competencies/CompetenciesStatsCards';
import CompetenciesOverviewTab from '../../components/competencies/CompetenciesOverviewTab';
import CompetencySidePanel from '../../components/competencies/CompetencySidePanel';
import AddEditSkillModal from '../../components/competencies/AddEditSkillModal';
import AddEditFrameworkModal from '../../components/competencies/AddEditFrameworkModal';
import RecordAssessmentModal from '../../components/competencies/RecordAssessmentModal';
import CompetencyListTab from '../../components/competencies/CompetencyListTab';
import FrameworksTab from '../../components/competencies/FrameworksTab';
import CategoriesTab from '../../components/competencies/CategoriesTab';
import AssessmentsTab from '../../components/competencies/AssessmentsTab';
import SkillGapsTab from '../../components/competencies/SkillGapsTab';
import UserProgressTab from '../../components/competencies/UserProgressTab';
import ProficiencyLevelsTab from '../../components/competencies/ProficiencyLevelsTab';
import ImportExportTab from '../../components/competencies/ImportExportTab';
import SettingsTab from '../../components/competencies/SettingsTab';
import type { Framework, Skill, SkillDetail } from '../../types/competencies';

type PageTab =
  | 'overview' | 'list' | 'frameworks' | 'categories' | 'assessments'
  | 'gaps' | 'levels' | 'progress' | 'import-export' | 'settings';

const TABS: { key: PageTab; label: string }[] = [
  { key: 'overview',      label: 'Overview' },
  { key: 'list',          label: 'Competency List' },
  { key: 'frameworks',    label: 'Frameworks' },
  { key: 'categories',    label: 'Categories' },
  { key: 'assessments',   label: 'Assessments' },
  { key: 'gaps',          label: 'Skill Gaps' },
  { key: 'levels',        label: 'Proficiency Levels' },
  { key: 'progress',      label: 'User Progress' },
  { key: 'import-export', label: 'Import/Export' },
  { key: 'settings',      label: 'Settings' },
];

export default function CompetenciesPage() {
  const [tabKey, setTabKey] = useTabParam('overview');
  const tab = (TABS.some(t => t.key === tabKey) ? tabKey : 'overview') as PageTab;

  const [searchParams, setSearchParams] = useSearchParams();
  const panelSkillId = searchParams.get('competency');

  const { toasts, showToast, dismiss } = useToast();

  const [createSkillOpen, setCreateSkillOpen] = useState(false);
  const [editSkillTarget, setEditSkillTarget] = useState<Skill | SkillDetail | null>(null);
  const [createFrameworkOpen, setCreateFrameworkOpen] = useState(false);
  const [editFrameworkTarget, setEditFrameworkTarget] = useState<Framework | null>(null);
  const [assessTarget, setAssessTarget] = useState<{ skillId: string; skillName: string } | null>(null);

  const [refreshSignal, setRefreshSignal] = useState(0);
  function bumpRefresh() { setRefreshSignal(s => s + 1); }

  const [matrixScrollToken, setMatrixScrollToken] = useState(0);

  function setTab(t: PageTab) { setTabKey(t); }

  function openPanel(id: string) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('competency', id);
      return next;
    });
  }
  function closePanel() {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('competency');
      return next;
    });
  }

  return (
    <AdminLayout pageTitle="Competencies">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1440, margin: '0 auto' }}>
        <CompetenciesPageHeader
          onCreateCompetency={() => setCreateSkillOpen(true)}
          onCreateFramework={() => setCreateFrameworkOpen(true)}
          onViewMatrix={() => { setTab('overview'); setMatrixScrollToken(t => t + 1); }}
          onImport={() => setTab('import-export')}
          onExport={() => setTab('import-export')}
        />

        <CompetenciesStatsCards />

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

        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {tab === 'overview' ? (
              <CompetenciesOverviewTab
                onOpenCompetency={openPanel}
                onCreateFramework={() => setCreateFrameworkOpen(true)}
                onEditFramework={setEditFrameworkTarget}
                onNavigateFrameworks={() => setTab('frameworks')}
                onNavigateList={() => setTab('list')}
                showToast={showToast}
                refreshSignal={refreshSignal}
                scrollToMatrixToken={matrixScrollToken}
              />
            ) : tab === 'list' ? (
              <CompetencyListTab
                onOpenCompetency={openPanel}
                onEditSkill={setEditSkillTarget}
                onCreateCompetency={() => setCreateSkillOpen(true)}
                showToast={showToast}
                refreshSignal={refreshSignal}
              />
            ) : tab === 'frameworks' ? (
              <FrameworksTab
                onCreateFramework={() => setCreateFrameworkOpen(true)}
                onEditFramework={setEditFrameworkTarget}
                showToast={showToast}
                refreshSignal={refreshSignal}
              />
            ) : tab === 'categories' ? (
              <CategoriesTab showToast={showToast} refreshSignal={refreshSignal} />
            ) : tab === 'assessments' ? (
              <AssessmentsTab showToast={showToast} refreshSignal={refreshSignal} />
            ) : tab === 'gaps' ? (
              <SkillGapsTab refreshSignal={refreshSignal} />
            ) : tab === 'levels' ? (
              <ProficiencyLevelsTab />
            ) : tab === 'progress' ? (
              <UserProgressTab refreshSignal={refreshSignal} />
            ) : tab === 'import-export' ? (
              <ImportExportTab showToast={showToast} />
            ) : (
              <SettingsTab showToast={showToast} />
            )}
          </div>

          {panelSkillId && (
            <CompetencySidePanel
              skillId={panelSkillId}
              onClose={closePanel}
              onEdit={setEditSkillTarget}
              onDeleted={() => { closePanel(); bumpRefresh(); }}
              onCreateCompetency={() => setCreateSkillOpen(true)}
              onCreateFramework={() => setCreateFrameworkOpen(true)}
              onAssignToUsers={skill => setAssessTarget({ skillId: skill.id, skillName: skill.name })}
              showToast={showToast}
            />
          )}
        </div>
      </div>

      {createSkillOpen && (
        <AddEditSkillModal
          mode="create"
          onClose={() => setCreateSkillOpen(false)}
          onSuccess={() => { setCreateSkillOpen(false); bumpRefresh(); }}
          showToast={showToast}
        />
      )}

      {editSkillTarget && (
        <AddEditSkillModal
          mode="edit"
          skill={editSkillTarget}
          onClose={() => setEditSkillTarget(null)}
          onSuccess={() => { setEditSkillTarget(null); bumpRefresh(); }}
          showToast={showToast}
        />
      )}

      {createFrameworkOpen && (
        <AddEditFrameworkModal
          mode="create"
          onClose={() => setCreateFrameworkOpen(false)}
          onSuccess={() => { setCreateFrameworkOpen(false); bumpRefresh(); }}
          showToast={showToast}
        />
      )}

      {editFrameworkTarget && (
        <AddEditFrameworkModal
          mode="edit"
          framework={editFrameworkTarget}
          onClose={() => setEditFrameworkTarget(null)}
          onSuccess={() => { setEditFrameworkTarget(null); bumpRefresh(); }}
          showToast={showToast}
        />
      )}

      {assessTarget && (
        <RecordAssessmentModal
          skillId={assessTarget.skillId}
          skillName={assessTarget.skillName}
          onClose={() => setAssessTarget(null)}
          onSuccess={() => { setAssessTarget(null); bumpRefresh(); }}
          showToast={showToast}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </AdminLayout>
  );
}
