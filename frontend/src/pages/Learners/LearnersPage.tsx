// Learners page. Mirrors pages/Instructors/InstructorsPage.tsx. No Pending-
// Applications-style tab (Learners has no application queue) and no Payouts
// tab (out of scope per the task). Side panel wired in Part 4.

import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { useTabParam } from '../../hooks/useTabParam';
import { useToast, ToastContainer } from '../../components/users/Toast';
import LearnersPageHeader from '../../components/learners/LearnersPageHeader';
import LearnersStatsCards from '../../components/learners/LearnersStatsCards';
import LearnersTable, { type LearnersTableHandle, type ServerTab } from '../../components/learners/LearnersTable';
import LearnerSidePanel, { type LearnerSidePanelHandle } from '../../components/learners/LearnerSidePanel';
import LearnersAnalyticsSection from '../../components/learners/LearnersAnalyticsSection';
import AddEditLearnerModal from '../../components/learners/AddEditLearnerModal';
import BulkEnrollLearnersModal from '../../components/learners/BulkEnrollLearnersModal';
import ImportUsersModal from '../../components/users/ImportUsersModal';
import ExportUsersModal from '../../components/users/ExportUsersModal';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { Learner, LearnerDetail, LearnerTabCounts } from '../../types/learners';

type PageTab = 'all' | 'active' | 'inactive' | 'at-risk' | 'completed' | 'suspended' | 'pending-verification' | 'graduated';

const TABS: { key: PageTab; label: string }[] = [
  { key: 'all',                   label: 'All Learners' },
  { key: 'active',                label: 'Active' },
  { key: 'inactive',              label: 'Inactive' },
  { key: 'at-risk',               label: 'At Risk' },
  { key: 'completed',             label: 'Completed' },
  { key: 'suspended',             label: 'Suspended' },
  { key: 'pending-verification',  label: 'Pending Verification' },
  { key: 'graduated',             label: 'Graduated' },
];

// Every PageTab IS a real GET /learners?tab=… value (unlike Instructors,
// Learners has no client-only tab like 'invitations').
const SERVER_TAB: Record<PageTab, ServerTab> = {
  all: 'all', active: 'active', inactive: 'inactive', suspended: 'suspended',
  'at-risk': 'at-risk', completed: 'completed',
  'pending-verification': 'pending-verification', graduated: 'graduated',
};

export default function LearnersPage() {
  const [tabKey, setTabKey] = useTabParam('all');
  const tab = (TABS.some(t => t.key === tabKey) ? tabKey : 'all') as PageTab;

  const [searchParams, setSearchParams] = useSearchParams();
  const panelLearnerId = searchParams.get('learner');

  const { toasts, showToast, dismiss } = useToast();

  const [tabCounts, setTabCounts] = useState<LearnerTabCounts | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Learner | LearnerDetail | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [bulkEnrollOpen, setBulkEnrollOpen] = useState(false);

  const tableRef = useRef<LearnersTableHandle>(null);
  const panelRef = useRef<LearnerSidePanelHandle>(null);

  function setTab(t: PageTab) { setTabKey(t); }

  function openPanel(id: string) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('learner', id);
      return next;
    });
  }
  function closePanel() {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('learner');
      return next;
    });
  }

  function refetchTable() { tableRef.current?.refetch(); }
  function refetchPanel() { panelRef.current?.refetch(); }
  function refetchTableAndPanel() { refetchTable(); refetchPanel(); }

  function badgeFor(key: PageTab): number | undefined {
    if (key === 'all') return tabCounts?.all;
    if (key === 'active') return tabCounts?.active;
    if (key === 'inactive') return tabCounts?.inactive;
    if (key === 'suspended') return tabCounts?.suspended;
    if (key === 'at-risk') return tabCounts?.['at-risk'];
    if (key === 'completed') return tabCounts?.completed;
    if (key === 'pending-verification') return tabCounts?.['pending-verification'];
    if (key === 'graduated') return tabCounts?.graduated;
    return undefined;
  }

  return (
    <AdminLayout pageTitle="Learners">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1440, margin: '0 auto' }}>
        <LearnersPageHeader
          onAddLearner={() => setAddOpen(true)}
          onImportLearners={() => setImportOpen(true)}
          onExportLearners={() => setExportOpen(true)}
          onBulkEnroll={() => setBulkEnrollOpen(true)}
        />

        <LearnersStatsCards />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
          {TABS.map(t => {
            const active = tab === t.key;
            const badge = badgeFor(t.key);
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
                {badge !== undefined && (
                  <span style={{ padding: '1px 7px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: active ? '#dbeafe' : '#f1f5f9', color: active ? '#1d4ed8' : '#64748b' }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Body: main area + side panel */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <LearnersTable
              ref={tableRef}
              serverTab={SERVER_TAB[tab]}
              onTabCountsChanged={setTabCounts}
              onView={openPanel}
              onEdit={setEditTarget}
              onMutated={id => { if (id === panelLearnerId) refetchPanel(); }}
              showToast={showToast}
            />
          </div>

          {panelLearnerId && (
            <LearnerSidePanel
              ref={panelRef}
              learnerId={panelLearnerId}
              onClose={closePanel}
              onEdit={setEditTarget}
              onChanged={refetchTable}
              onDeleted={() => { closePanel(); refetchTable(); }}
              showToast={showToast}
            />
          )}
        </div>

        <LearnersAnalyticsSection />
      </div>

      {addOpen && (
        <AddEditLearnerModal
          mode="create"
          onClose={() => setAddOpen(false)}
          onSuccess={() => { setAddOpen(false); refetchTable(); }}
          showToast={showToast}
        />
      )}

      {editTarget && (
        <AddEditLearnerModal
          mode="edit"
          learner={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => {
            const editedId = editTarget?.id;
            setEditTarget(null);
            refetchTable();
            if (editedId && editedId === panelLearnerId) refetchPanel();
          }}
          showToast={showToast}
        />
      )}

      {bulkEnrollOpen && (
        <BulkEnrollLearnersModal
          onClose={() => setBulkEnrollOpen(false)}
          onSuccess={() => { setBulkEnrollOpen(false); refetchTableAndPanel(); }}
          showToast={showToast}
        />
      )}

      {importOpen && (
        <ImportUsersModal
          onClose={() => setImportOpen(false)}
          onSuccess={() => {
            setImportOpen(false);
            // ImportUsersModal only dispatches raw DOM events, not
            // invalidateFor — this domain needs the explicit call (same as
            // InstructorsPage). 'user.import' invalidates both instructors
            // and learners lists, since a CSV can contain either role.
            invalidateFor(appQueryClient, 'user.import');
            refetchTableAndPanel();
          }}
          showToast={showToast}
        />
      )}

      {exportOpen && (
        <ExportUsersModal
          onClose={() => setExportOpen(false)}
          filterParams={{ role: 'LEARNER' }}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </AdminLayout>
  );
}
