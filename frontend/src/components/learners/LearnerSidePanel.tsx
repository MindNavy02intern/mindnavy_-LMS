// Learner side panel. Mirrors InstructorSidePanel.tsx: opens on ?learner=<id>,
// ONE request to GET /learners/:id for the Overview data; every other inner
// tab fetches on its own tab click, same as InstructorSidePanel's Documents/
// Reviews/Certifications tabs never preload into the base instructor call.
//
// All tabs are real as of Part 8: Assessments/Certificates (Part 6),
// More→Attendance (Part 6), More→Documents/Tickets (Part 8).

import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { CheckCircle2, KeyRound, MessageSquare, Trash2, UserPlus, Route } from 'lucide-react';
import { deleteLearner, getLearner, reactivateLearner, updateLearner, getLearnerActivity } from '../../services/learnersApi';
import { LearnerApiError } from '../../types/learners';
import type { LearnerDetail } from '../../types/learners';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import SendMessageModal from '../users/SendMessageModal';
import SuspendLearnerDialog from './SuspendLearnerDialog';
import ResetLearnerPasswordDialog from './ResetLearnerPasswordDialog';
import LearnerAssessmentsTab from './LearnerAssessmentsTab';
import LearnerCertificatesTab from './LearnerCertificatesTab';
import LearnerAttendanceTab from './LearnerAttendanceTab';
import LearnerDocumentsTab from './LearnerDocumentsTab';
import LearnerTicketsTab from './LearnerTicketsTab';
import EnrollLearnerModal from './EnrollLearnerModal';
import LearnerCoursesTab from './LearnerCoursesTab';
import LearnerActivityTab from './LearnerActivityTab';
import LearnerSuspensionHistory from './LearnerSuspensionHistory';

interface Props {
  learnerId: string;
  onClose:   () => void;
  onEdit:    (learner: LearnerDetail) => void;
  onChanged: () => void; // parent table should refetch
  onDeleted: () => void; // learner archived — close panel + refetch parent
  showToast: (type: 'success' | 'error', message: string) => void;
}

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  active:    { bg: '#dcfce7', fg: '#15803d' },
  suspended: { bg: '#fee2e2', fg: '#b91c1c' },
  pending:   { bg: '#fef9c3', fg: '#a16207' },
  invited:   { bg: '#f1f5f9', fg: '#475569' },
  archived:  { bg: '#f1f5f9', fg: '#64748b' },
};

function initials(name: string): string {
  return (name || '?').split(' ').map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase();
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const SECTION: React.CSSProperties = { padding: '16px 20px', borderBottom: '1px solid #f1f5f9' };
const SECTION_TITLE: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 };

export interface LearnerSidePanelHandle { refetch: () => void }

type PanelTab = 'overview' | 'courses' | 'assessments' | 'activity' | 'certificates' | 'more';
const PANEL_TABS: { key: PanelTab; label: string }[] = [
  { key: 'overview',     label: 'Overview' },
  { key: 'courses',      label: 'Courses' },
  { key: 'assessments',  label: 'Assessments' },
  { key: 'activity',     label: 'Activity' },
  { key: 'certificates', label: 'Certificates' },
  { key: 'more',         label: 'More' },
];

type MoreSubTab = 'attendance' | 'documents' | 'tickets' | 'suspension';
const MORE_SUB_TABS: { key: MoreSubTab; label: string }[] = [
  { key: 'attendance', label: 'Attendance' },
  { key: 'documents',  label: 'Documents' },
  { key: 'tickets',    label: 'Tickets' },
  { key: 'suspension', label: 'Suspension History' },
];

const LearnerSidePanel = forwardRef<LearnerSidePanelHandle, Props>(function LearnerSidePanel(
  { learnerId, onClose, onEdit, onChanged, onDeleted, showToast }, ref,
) {
  const [detail,  setDetail]  = useState<LearnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>('overview');
  const [moreSubTab, setMoreSubTab] = useState<MoreSubTab>('suspension');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [monthActivityCount, setMonthActivityCount] = useState<number | null>(null);

  const [verifying,    setVerifying]    = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [deleting,     setDeleting]     = useState(false);
  const [suspendOpen,  setSuspendOpen]  = useState(false);
  const [resetPwOpen,  setResetPwOpen]  = useState(false);
  const [messageOpen,  setMessageOpen]  = useState(false);
  const [enrollOpen,   setEnrollOpen]   = useState<'course' | 'path' | null>(null);

  const fetchDetail = useCallback(() => {
    setLoading(true);
    setError(null);
    getLearner(learnerId)
      .then(res => setDetail(res))
      .catch(err => setError(err instanceof LearnerApiError ? err.message : 'Failed to load learner.'))
      .finally(() => setLoading(false));
  }, [learnerId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);
  useEffect(() => { setPanelTab('overview'); }, [learnerId]);
  useImperativeHandle(ref, () => ({ refetch: fetchDetail }), [fetchDetail]);

  // "Learning Activity this month" — a real count of this-month rows from the
  // already-real activity feed (Part 3), not a server-computed metric, so no
  // extra endpoint needed for one panel widget.
  useEffect(() => {
    if (panelTab !== 'overview') return;
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    getLearnerActivity(learnerId, { limit: 100 })
      .then(res => setMonthActivityCount(res.activities.filter(a => new Date(a.createdAt) >= startOfMonth).length))
      .catch(() => setMonthActivityCount(null));
  }, [learnerId, panelTab, historyRefreshKey]);

  async function handleVerify() {
    if (!detail) return;
    setVerifying(true);
    try {
      const updated = await updateLearner(detail.id, { verificationStatus: 'VERIFIED' });
      invalidateFor(appQueryClient, 'learner.update', { id: detail.id });
      showToast('success', `${updated.fullName} verified.`);
      fetchDetail();
      onChanged();
    } catch (err) {
      showToast('error', err instanceof LearnerApiError ? err.message : 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleReactivate() {
    if (!detail) return;
    if (!window.confirm(`Reactivate ${detail.fullName}? They will regain access immediately.`)) return;
    setReactivating(true);
    try {
      const updated = await reactivateLearner(detail.id);
      setDetail(updated);
      invalidateFor(appQueryClient, 'learner.reactivate', { id: detail.id });
      showToast('success', `${detail.fullName} reactivated.`);
      setHistoryRefreshKey(k => k + 1);
      onChanged();
    } catch (err) {
      showToast('error', err instanceof LearnerApiError ? err.message : 'Reactivation failed.');
    } finally {
      setReactivating(false);
    }
  }

  async function handleDelete() {
    if (!detail) return;
    if (!window.confirm(`Archive ${detail.fullName}? Blocked while they still have active (non-completed) enrollments.`)) return;
    setDeleting(true);
    try {
      await deleteLearner(detail.id);
      invalidateFor(appQueryClient, 'learner.delete');
      showToast('success', `${detail.fullName} archived.`);
      onDeleted();
    } catch (err) {
      if (err instanceof LearnerApiError && err.status === 409 && err.data) {
        const { activeEnrollments = 0 } = err.data;
        showToast('error', `${err.message} (${activeEnrollments} active enrollment${activeEnrollments === 1 ? '' : 's'})`);
      } else {
        showToast('error', err instanceof LearnerApiError ? err.message : 'Delete failed.');
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{
      width: 460, flexShrink: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
      display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 140px)', position: 'sticky', top: 16,
      animation: 'mn-panel-in 0.18s ease',
    }}>
      <style>{`@keyframes mn-panel-in { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:none; } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Learner Details</span>
        <button type="button" onClick={onClose} aria-label="Close panel" style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{ width: 22, height: 22, border: '2px solid #e2e8f0', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'mn-spin 0.65s linear infinite' }} />
          </div>
        )}

        {!loading && error && (
          <div style={{ margin: 16, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#b91c1c' }}>
            {error}
          </div>
        )}

        {!loading && detail && (
          <>
            <div style={{ display: 'flex', gap: 4, padding: '0 20px', borderBottom: '1px solid #f1f5f9', overflowX: 'auto' }}>
              {PANEL_TABS.map(t => {
                const active = panelTab === t.key;
                return (
                  <button
                    key={t.key} type="button" onClick={() => setPanelTab(t.key)}
                    style={{
                      padding: '10px 10px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                      background: 'none', cursor: 'pointer', border: 'none', whiteSpace: 'nowrap',
                      borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                      color: active ? '#2563eb' : '#64748b', marginBottom: -1,
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {panelTab === 'courses' && (
              <LearnerCoursesTab learnerId={detail.id} onChanged={() => { fetchDetail(); onChanged(); }} showToast={showToast} />
            )}

            {panelTab === 'activity' && <LearnerActivityTab learnerId={detail.id} />}

            {panelTab === 'assessments' && (
              <LearnerAssessmentsTab learnerId={detail.id} showToast={showToast} />
            )}

            {panelTab === 'certificates' && (
              <LearnerCertificatesTab learnerId={detail.id} onChanged={() => { fetchDetail(); onChanged(); }} showToast={showToast} />
            )}

            {panelTab === 'more' && (
              <div>
                <div style={{ display: 'flex', gap: 4, padding: '10px 20px 0' }}>
                  {MORE_SUB_TABS.map(t => {
                    const active = moreSubTab === t.key;
                    return (
                      <button
                        key={t.key} type="button" onClick={() => setMoreSubTab(t.key)}
                        style={{
                          padding: '6px 9px', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                          background: active ? '#eff6ff' : 'none', cursor: 'pointer',
                          border: active ? '1px solid #bfdbfe' : '1px solid transparent', borderRadius: 6,
                          color: active ? '#2563eb' : '#64748b',
                        }}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ padding: '14px 20px' }}>
                  {moreSubTab === 'suspension' && <LearnerSuspensionHistory learnerId={detail.id} refreshKey={historyRefreshKey} />}
                  {moreSubTab === 'attendance' && <LearnerAttendanceTab learnerId={detail.id} />}
                  {moreSubTab === 'documents' && <LearnerDocumentsTab learnerId={detail.id} showToast={showToast} />}
                  {moreSubTab === 'tickets' && <LearnerTicketsTab learnerId={detail.id} showToast={showToast} />}
                </div>
              </div>
            )}

            {panelTab === 'overview' && (
              <>
                <div style={SECTION}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {detail.avatar
                      ? <img src={detail.avatar} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
                      : <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>{initials(detail.fullName)}</div>
                    }
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail.fullName}</div>
                      <div style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail.email}</div>
                      {detail.learnerCode && <div style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>{detail.learnerCode}</div>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                    <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: STATUS_COLOR[detail.status]?.bg, color: STATUS_COLOR[detail.status]?.fg }}>
                      {detail.status}
                    </span>
                    <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: detail.badges.verified ? '#dbeafe' : '#f1f5f9', color: detail.badges.verified ? '#1d4ed8' : '#64748b' }}>
                      {detail.badges.verified ? 'Verified' : detail.verificationStatus ? detail.verificationStatus[0] + detail.verificationStatus.slice(1).toLowerCase() : 'Unverified'}
                    </span>
                    {detail.badges.atRisk && (
                      <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#fef2f2', color: '#dc2626' }}>At Risk</span>
                    )}
                    {!detail.hasProfile && (
                      <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#64748b' }}>No profile</span>
                    )}
                  </div>

                  {/* Quick Actions — everything here has a real Part 1/3 endpoint. */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                    <button type="button" onClick={() => onEdit(detail)} style={ACTION_BTN}>Edit</button>
                    <button
                      type="button" onClick={handleVerify}
                      disabled={verifying || detail.badges.verified}
                      style={{ ...ACTION_BTN, opacity: (verifying || detail.badges.verified) ? 0.45 : 1 }}
                    >
                      <CheckCircle2 size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
                      {verifying ? 'Verifying…' : 'Verify'}
                    </button>
                    <button type="button" onClick={() => setEnrollOpen('course')} style={ACTION_BTN}>
                      <UserPlus size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> Enroll
                    </button>
                    <button type="button" onClick={() => setEnrollOpen('path')} style={ACTION_BTN}>
                      <Route size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> Assign Path
                    </button>
                    <button type="button" onClick={() => setMessageOpen(true)} style={ACTION_BTN}>
                      <MessageSquare size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> Message
                    </button>
                    <button type="button" onClick={() => setResetPwOpen(true)} style={ACTION_BTN}>
                      <KeyRound size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> Reset Password
                    </button>
                    {detail.status === 'suspended' ? (
                      <button type="button" onClick={handleReactivate} disabled={reactivating} style={{ ...ACTION_BTN, ...ACTION_BTN_GREEN, opacity: reactivating ? 0.5 : 1 }}>
                        {reactivating ? 'Reactivating…' : 'Reactivate'}
                      </button>
                    ) : (
                      <button type="button" onClick={() => setSuspendOpen(true)} style={{ ...ACTION_BTN, ...ACTION_BTN_ORANGE }}>
                        Suspend
                      </button>
                    )}
                    <button type="button" onClick={handleDelete} disabled={deleting} style={{ ...ACTION_BTN, ...ACTION_BTN_RED, opacity: deleting ? 0.5 : 1 }}>
                      <Trash2 size={13} style={{ marginRight: 4, verticalAlign: -2 }} />
                      {deleting ? 'Archiving…' : 'Delete'}
                    </button>
                  </div>
                </div>

                {/* Stats row */}
                <div style={{ ...SECTION, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                  <StatBox label="Enrolled" value={detail.coursesCount} />
                  <StatBox label="Completed" value={detail.completedCoursesCount} />
                  <StatBox label="Progress" value={detail.avgProgress !== null ? `${detail.avgProgress}%` : '—'} />
                  <StatBox label="Certificates" value={detail.certificatesCount} />
                </div>

                {/* Overview details */}
                <div style={SECTION}>
                  <div style={SECTION_TITLE}>Details</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
                    <DetailField label="Joined" value={formatDate(detail.joinedDate)} />
                    <DetailField label="Last Active" value={formatDate(detail.lastActiveAt)} />
                    <DetailField label="Department" value={detail.department} />
                    <DetailField label="Batch" value={detail.batch} />
                    <DetailField label="Advisor" value={detail.advisorName} />
                    <DetailField label="Program" value={detail.program} />
                  </div>
                </div>

                {/* Learning Activity this month */}
                <div style={{ ...SECTION, borderBottom: 'none' }}>
                  <div style={SECTION_TITLE}>Learning Activity This Month</div>
                  <div style={{ fontSize: 13, color: '#374151' }}>
                    {monthActivityCount === null ? '—' : `${monthActivityCount} recorded event${monthActivityCount === 1 ? '' : 's'} (login, quiz attempts, session attendance)`}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {suspendOpen && detail && (
        <SuspendLearnerDialog
          learnerId={detail.id}
          fullName={detail.fullName}
          onClose={() => setSuspendOpen(false)}
          onSuccess={() => { setSuspendOpen(false); fetchDetail(); setHistoryRefreshKey(k => k + 1); onChanged(); }}
          showToast={showToast}
        />
      )}

      {resetPwOpen && detail && (
        <ResetLearnerPasswordDialog
          learnerId={detail.id}
          fullName={detail.fullName}
          onClose={() => setResetPwOpen(false)}
          onSuccess={() => setResetPwOpen(false)}
          showToast={showToast}
        />
      )}

      {messageOpen && detail && (
        <SendMessageModal
          userId={detail.id}
          userName={detail.fullName}
          onClose={() => setMessageOpen(false)}
          onSuccess={() => setMessageOpen(false)}
          showToast={showToast}
        />
      )}

      {enrollOpen && detail && (
        <EnrollLearnerModal
          mode={enrollOpen}
          learnerId={detail.id}
          fullName={detail.fullName}
          onClose={() => setEnrollOpen(null)}
          onSuccess={() => { setEnrollOpen(null); fetchDetail(); onChanged(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
});

export default LearnerSidePanel;

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div role="group" aria-label={`${label} stat`} style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
      <div data-value style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div style={{ color: '#94a3b8', fontSize: 11 }}>{label}</div>
      <div style={{ color: value ? '#374151' : '#cbd5e1', fontWeight: 500 }}>{value ?? '—'}</div>
    </div>
  );
}

const ACTION_BTN: React.CSSProperties = {
  padding: '6px 11px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
  background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer',
};
const ACTION_BTN_GREEN: React.CSSProperties  = { background: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' };
const ACTION_BTN_ORANGE: React.CSSProperties = { background: '#fff7ed', color: '#ea580c', borderColor: '#fed7aa' };
const ACTION_BTN_RED: React.CSSProperties    = { background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' };
