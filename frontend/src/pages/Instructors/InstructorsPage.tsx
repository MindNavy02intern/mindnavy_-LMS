import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import { useTabParam } from '../../hooks/useTabParam';
import { useToast, ToastContainer } from '../../components/users/Toast';
import InstructorsPageHeader from '../../components/instructors/InstructorsPageHeader';
import InstructorsStatsCards from '../../components/instructors/InstructorsStatsCards';
import InstructorsAnalyticsSection from '../../components/instructors/InstructorsAnalyticsSection';
import InstructorsTable, { type InstructorsTableHandle, type ServerTab } from '../../components/instructors/InstructorsTable';
import ApplicationsTab from '../../components/instructors/ApplicationsTab';
import InstructorSidePanel, { type InstructorSidePanelHandle } from '../../components/instructors/InstructorSidePanel';
import AddEditInstructorModal from '../../components/instructors/AddEditInstructorModal';
import ImportUsersModal from '../../components/users/ImportUsersModal';
import ExportUsersModal from '../../components/users/ExportUsersModal';
import { listInstructors } from '../../services/instructorsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { Instructor, InstructorDetail, InstructorTabCounts } from '../../types/instructors';

type PageTab = 'all' | 'pending' | 'active' | 'inactive' | 'suspended' | 'top' | 'invitations' | 'payouts';

const TABS: { key: PageTab; label: string }[] = [
  { key: 'all',         label: 'All Instructors' },
  { key: 'pending',     label: 'Pending Approval' },
  { key: 'active',      label: 'Active' },
  { key: 'inactive',    label: 'Inactive' },
  { key: 'suspended',   label: 'Suspended' },
  { key: 'top',         label: 'Top Performers' },
  { key: 'invitations', label: 'Invitations' },
  { key: 'payouts',     label: 'Payouts' },
];

// Page tabs that hit GET /instructors?tab=… directly (contract §"tab" table).
// 'invitations' reuses the 'inactive' bucket, client-filtered to status==='invited'
// — the contract has no dedicated tab value for it, but 'invited' IS a real status
// on that bucket's rows (inactive = PENDING | INVITED), so this is real data, not
// a client-side fabrication. 'pending' and 'payouts' never call this endpoint.
const SERVER_TAB: Partial<Record<PageTab, ServerTab>> = {
  all: 'all', active: 'active', inactive: 'inactive', suspended: 'suspended',
  top: 'top', invitations: 'inactive',
};

export default function InstructorsPage() {
  const [tabKey, setTabKey] = useTabParam('all');
  const tab = (TABS.some(t => t.key === tabKey) ? tabKey : 'all') as PageTab;

  const [searchParams, setSearchParams] = useSearchParams();
  const panelInstructorId = searchParams.get('instructor');

  const { toasts, showToast, dismiss } = useToast();

  const [tabCounts, setTabCounts] = useState<InstructorTabCounts | null>(null);
  const [pendingAppCount, setPendingAppCount] = useState<number | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Instructor | InstructorDetail | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const tableRef = useRef<InstructorsTableHandle>(null);
  const panelRef = useRef<InstructorSidePanelHandle>(null);

  function setTab(t: PageTab) { setTabKey(t); }

  function openPanel(id: string) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('instructor', id);
      return next;
    });
  }
  function closePanel() {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('instructor');
      return next;
    });
  }

  function refetchTable() { tableRef.current?.refetch(); }
  function refetchPanel() { panelRef.current?.refetch(); }
  // For mutations that could affect whichever instructor the panel is
  // currently showing (edit/import/create) — the panel doesn't know about
  // mutations that happen outside it, so it has to be told explicitly.
  function refetchTableAndPanel() { refetchTable(); refetchPanel(); }

  // instructorApplication.approve creates a new instructor, which should bump
  // the All/Active tab badges — but InstructorsTable (the only thing that
  // normally fetches tabCounts) isn't mounted while the Pending tab is
  // showing, so pull a fresh count directly.
  function refreshTabCountsInBackground() {
    listInstructors({ tab: 'all', limit: 1 }).then(res => setTabCounts(res.tabCounts)).catch(() => {});
  }

  function badgeFor(key: PageTab): number | undefined {
    if (key === 'pending') return pendingAppCount ?? tabCounts?.pending;
    if (key === 'all') return tabCounts?.all;
    if (key === 'active') return tabCounts?.active;
    if (key === 'inactive') return tabCounts?.inactive;
    if (key === 'suspended') return tabCounts?.suspended;
    return undefined;
  }

  return (
    <AdminLayout pageTitle="Instructors">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1440, margin: '0 auto' }}>
        <InstructorsPageHeader
          onAddInstructor={() => setAddOpen(true)}
          onImportInstructors={() => setImportOpen(true)}
          onExportInstructors={() => setExportOpen(true)}
          onViewApplications={() => setTab('pending')}
        />

        <InstructorsStatsCards />

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
            {tab === 'pending' ? (
              <ApplicationsTab
                showToast={showToast}
                // tabCounts.pending counts PENDING + CHANGES_REQUESTED
                // (contract: "cannot drift" from this same list) — summing
                // only PENDING here would under-count once this tab has been
                // visited, silently dropping applicants awaiting resubmission.
                onCountsChanged={counts => setPendingAppCount(counts.PENDING + counts.CHANGES_REQUESTED)}
                onInstructorCreated={refreshTabCountsInBackground}
              />
            ) : tab === 'payouts' ? (
              <div style={{ border: '1px dashed #cbd5e1', borderRadius: 12, background: '#f8fafc', padding: '48px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Payouts not available yet</div>
                <div style={{ fontSize: 12, color: '#94a3b8', maxWidth: 380, margin: '0 auto' }}>
                  No Payment/Transaction model exists yet — ships with the Finance module. Revenue and payout data will
                  appear here once that backend lands.
                </div>
              </div>
            ) : (
              <InstructorsTable
                ref={tableRef}
                serverTab={SERVER_TAB[tab] ?? 'all'}
                filterInvitedOnly={tab === 'invitations'}
                onTabCountsChanged={setTabCounts}
                onView={openPanel}
                onEdit={setEditTarget}
                onMutated={id => { if (id === panelInstructorId) refetchPanel(); }}
                showToast={showToast}
              />
            )}
          </div>

          {panelInstructorId && (
            <InstructorSidePanel
              ref={panelRef}
              instructorId={panelInstructorId}
              onClose={closePanel}
              onEdit={setEditTarget}
              onChanged={refetchTable}
              onDeleted={() => { closePanel(); refetchTable(); }}
              showToast={showToast}
            />
          )}
        </div>

        <InstructorsAnalyticsSection />
      </div>

      {addOpen && (
        <AddEditInstructorModal
          mode="create"
          onClose={() => setAddOpen(false)}
          onSuccess={() => { setAddOpen(false); refetchTable(); }}
          showToast={showToast}
        />
      )}

      {editTarget && (
        <AddEditInstructorModal
          mode="edit"
          instructor={editTarget}
          onClose={() => setEditTarget(null)}
          onSuccess={() => {
            // The instructor being edited may be the same one the side panel
            // is currently showing (its own Edit button routes here too) —
            // refetch both, not just the table, or the panel keeps rendering
            // pre-edit values until manually closed and reopened.
            const editedId = editTarget?.id;
            setEditTarget(null);
            refetchTable();
            if (editedId && editedId === panelInstructorId) refetchPanel();
          }}
          showToast={showToast}
        />
      )}

      {importOpen && (
        <ImportUsersModal
          onClose={() => setImportOpen(false)}
          onSuccess={() => {
            setImportOpen(false);
            // ImportUsersModal only dispatches raw DOM events, not
            // invalidateFor — and a CSV can contain INSTRUCTOR rows, so this
            // domain needs an explicit invalidation the modal doesn't do itself.
            invalidateFor(appQueryClient, 'user.import');
            refetchTableAndPanel();
          }}
          showToast={showToast}
        />
      )}

      {exportOpen && (
        <ExportUsersModal
          onClose={() => setExportOpen(false)}
          filterParams={{ role: 'INSTRUCTOR' }}
        />
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </AdminLayout>
  );
}
