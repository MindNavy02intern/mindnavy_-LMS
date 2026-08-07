import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
import {
  deleteInstructor, getInstructor, reactivateInstructor, verifyInstructor,
} from '../../services/instructorsApi';
import { approveCourse, rejectCourse } from '../../services/courseWizardApi';
import { CourseApiError } from '../../types/courses';
import { InstructorApiError } from '../../types/instructors';
import type { InstructorDetail, InstructorPendingApproval } from '../../types/instructors';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import SendMessageModal from '../users/SendMessageModal';
import SuspendInstructorDialog from './SuspendInstructorDialog';
import InstructorCoursesTab from './InstructorCoursesTab';
import InstructorSuspensionHistory from './InstructorSuspensionHistory';
import InstructorDocumentsTab from './InstructorDocumentsTab';
import InstructorReviewsTab from './InstructorReviewsTab';
import InstructorCertificationsTab from './InstructorCertificationsTab';

interface Props {
  instructorId: string;
  onClose:      () => void;
  onEdit:       (instructor: InstructorDetail) => void;
  onChanged:    () => void; // parent list should refetch (status/verification changed)
  onDeleted:    () => void; // instructor archived — close panel + refetch parent
  showToast:    (type: 'success' | 'error', message: string) => void;
}

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  active:    { bg: '#dcfce7', fg: '#15803d' },
  suspended: { bg: '#fee2e2', fg: '#b91c1c' },
  pending:   { bg: '#fef9c3', fg: '#a16207' },
  invited:   { bg: '#f1f5f9', fg: '#475569' },
  archived:  { bg: '#f1f5f9', fg: '#64748b' },
};

const COURSE_STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  PUBLISHED: { bg: '#dcfce7', fg: '#15803d' },
  DRAFT:     { bg: '#f1f5f9', fg: '#475569' },
  PENDING:   { bg: '#dbeafe', fg: '#1d4ed8' },
  ARCHIVED:  { bg: '#f1f5f9', fg: '#94a3b8' },
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

export interface InstructorSidePanelHandle { refetch: () => void }

type PanelTab = 'overview' | 'courses' | 'documents' | 'reviews' | 'certifications';
const PANEL_TABS: { key: PanelTab; label: string }[] = [
  { key: 'overview',       label: 'Overview' },
  { key: 'courses',        label: 'Courses' },
  { key: 'documents',      label: 'Documents' },
  { key: 'reviews',        label: 'Reviews' },
  { key: 'certifications', label: 'Certifications' },
];

const InstructorSidePanel = forwardRef<InstructorSidePanelHandle, Props>(function InstructorSidePanel(
  { instructorId, onClose, onEdit, onChanged, onDeleted, showToast }, ref,
) {
  const [detail,  setDetail]  = useState<InstructorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>('overview');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const [verifying,   setVerifying]   = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);

  const [courseBusyId, setCourseBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<InstructorPendingApproval | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectErr,    setRejectErr]    = useState<string | null>(null);
  const [rejectBusy,   setRejectBusy]   = useState(false);

  // Guards against out-of-order responses: the panel stays mounted across a
  // View→View switch (only `instructorId` changes), so a slow request for a
  // previously-viewed instructor could otherwise resolve after a newer one
  // and silently overwrite the panel with the wrong instructor's data.
  const requestIdRef = useRef(0);

  const fetchDetail = useCallback(() => {
    const myRequestId = ++requestIdRef.current;
    (() => { setLoading(true); setError(null); })();
    getInstructor(instructorId)
      .then(res => { if (requestIdRef.current === myRequestId) setDetail(res); })
      .catch(err => {
        if (requestIdRef.current !== myRequestId) return;
        setError(err instanceof InstructorApiError ? err.message : 'Failed to load instructor.');
      })
      .finally(() => { if (requestIdRef.current === myRequestId) setLoading(false); });
  }, [instructorId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);
  useEffect(() => { setPanelTab('overview'); }, [instructorId]);
  useImperativeHandle(ref, () => ({ refetch: fetchDetail }), [fetchDetail]);

  async function handleVerify() {
    if (!detail) return;
    const myRequestId = ++requestIdRef.current;
    setVerifying(true);
    try {
      const updated = await verifyInstructor(detail.id);
      if (requestIdRef.current === myRequestId) setDetail(updated);
      invalidateFor(appQueryClient, 'instructor.verify', { id: detail.id });
      showToast('success', `${detail.fullName} verified.`);
      onChanged();
    } catch (err) {
      showToast('error', err instanceof InstructorApiError ? err.message : 'Verification failed.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleReactivate() {
    if (!detail) return;
    if (!window.confirm(`Reactivate ${detail.fullName}? They will regain access immediately.`)) return;
    const myRequestId = ++requestIdRef.current;
    setReactivating(true);
    try {
      const updated = await reactivateInstructor(detail.id);
      if (requestIdRef.current === myRequestId) setDetail(updated);
      invalidateFor(appQueryClient, 'instructor.reactivate', { id: detail.id });
      showToast('success', `${detail.fullName} reactivated.`);
      setHistoryRefreshKey(k => k + 1);
      onChanged();
    } catch (err) {
      showToast('error', err instanceof InstructorApiError ? err.message : 'Reactivation failed.');
    } finally {
      setReactivating(false);
    }
  }

  async function handleDelete() {
    if (!detail) return;
    if (!window.confirm(`Archive ${detail.fullName}? This is blocked while they still own courses or live sessions.`)) return;
    setDeleting(true);
    try {
      await deleteInstructor(detail.id);
      invalidateFor(appQueryClient, 'instructor.delete');
      showToast('success', `${detail.fullName} archived.`);
      onDeleted();
    } catch (err) {
      if (err instanceof InstructorApiError && err.status === 409 && err.data) {
        const { courses = 0, liveSessions = 0 } = err.data;
        showToast('error', `${err.message} (${courses} course${courses === 1 ? '' : 's'}, ${liveSessions} live session${liveSessions === 1 ? '' : 's'})`);
      } else {
        showToast('error', err instanceof InstructorApiError ? err.message : 'Delete failed.');
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleApproveCourse(course: InstructorPendingApproval) {
    if (!detail) return;
    if (!window.confirm(`Approve "${course.title}"? It will be published immediately.`)) return;
    setCourseBusyId(course.id);
    try {
      await approveCourse(course.id, { instructorId: detail.id });
      showToast('success', `"${course.title}" approved and published.`);
      fetchDetail();
      onChanged();
    } catch (err) {
      showToast('error', err instanceof CourseApiError ? err.message : 'Approval failed.');
    } finally {
      setCourseBusyId(null);
    }
  }

  function openRejectCourse(course: InstructorPendingApproval) {
    setRejectTarget(course);
    setRejectReason('');
    setRejectErr(null);
  }

  async function submitRejectCourse() {
    if (!detail || !rejectTarget) return;
    const trimmed = rejectReason.trim();
    if (trimmed.length < 3) { setRejectErr('Required — at least 3 characters.'); return; }
    setRejectBusy(true);
    try {
      await rejectCourse(rejectTarget.id, trimmed, { instructorId: detail.id });
      showToast('success', `"${rejectTarget.title}" returned to Draft with feedback.`);
      setRejectTarget(null);
      fetchDetail();
      onChanged();
    } catch (err) {
      showToast('error', err instanceof CourseApiError ? err.message : 'Rejection failed.');
    } finally {
      setRejectBusy(false);
    }
  }

  const maxEnrollment = detail ? Math.max(1, ...detail.performanceChart.enrollments) : 1;

  return (
    <div style={{
      width: 460, flexShrink: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
      display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 140px)', position: 'sticky', top: 16,
      animation: 'mn-panel-in 0.18s ease',
    }}>
      <style>{`@keyframes mn-panel-in { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:none; } }`}</style>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Instructor Details</span>
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
            {/* Panel tabs */}
            <div style={{ display: 'flex', gap: 4, padding: '0 20px', borderBottom: '1px solid #f1f5f9' }}>
              {PANEL_TABS.map(t => {
                const active = panelTab === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setPanelTab(t.key)}
                    style={{
                      padding: '10px 10px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                      background: 'none', cursor: 'pointer', border: 'none',
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
              <InstructorCoursesTab
                instructorId={detail.id}
                onChanged={() => { fetchDetail(); onChanged(); }}
                showToast={showToast}
              />
            )}

            {panelTab === 'documents' && (
              <InstructorDocumentsTab instructorId={detail.id} showToast={showToast} />
            )}

            {panelTab === 'reviews' && (
              <InstructorReviewsTab instructorId={detail.id} showToast={showToast} />
            )}

            {panelTab === 'certifications' && (
              <InstructorCertificationsTab instructorId={detail.id} showToast={showToast} />
            )}

          {panelTab === 'overview' && (
          <>
            {/* Identity */}
            <div style={SECTION}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {detail.avatar
                  ? <img src={detail.avatar} alt="" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover' }} />
                  : <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>{initials(detail.fullName)}</div>
                }
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail.fullName}</span>
                    {detail.badges.topInstructor && <span title="Top Instructor" style={{ fontSize: 11 }}>🏆</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail.email}</div>
                  {detail.phone && <div style={{ fontSize: 12, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail.phone}</div>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: STATUS_COLOR[detail.status]?.bg, color: STATUS_COLOR[detail.status]?.fg }}>
                  {detail.status}
                </span>
                {/* badges.verified drives styling (contract: use badges, don't
                    re-derive from status); the label text uses the raw
                    verificationState so rejected/expired read differently
                    from a plain not-yet-reviewed pending. */}
                <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: detail.badges.verified ? '#dbeafe' : '#f1f5f9', color: detail.badges.verified ? '#1d4ed8' : '#64748b' }}>
                  {detail.badges.verified ? 'Verified' : detail.verificationState[0].toUpperCase() + detail.verificationState.slice(1)}
                </span>
                {!detail.hasProfile && (
                  <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#f1f5f9', color: '#64748b' }}>
                    No profile
                  </span>
                )}
              </div>

              {detail.specialization && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#374151' }}>
                  <strong style={{ color: '#0f172a' }}>Specialization:</strong> {detail.specialization}
                </div>
              )}
              {detail.headline && <div style={{ marginTop: 4, fontSize: 12, color: '#64748b' }}>{detail.headline}</div>}

              {/* Actions */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                <button type="button" onClick={() => onEdit(detail)} style={ACTION_BTN}>Edit</button>
                <button type="button" disabled title="Instructor profile page not built yet" style={{ ...ACTION_BTN, opacity: 0.45, cursor: 'not-allowed' }}>
                  View Profile
                </button>
                <button type="button" onClick={() => setPanelTab('courses')} style={ACTION_BTN}>
                  View Courses
                </button>
                <button type="button" disabled title="Available with Finance module" style={{ ...ACTION_BTN, opacity: 0.45, cursor: 'not-allowed' }}>
                  View Earnings
                </button>
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={verifying || detail.badges.verified || detail.status === 'suspended'}
                  title={detail.status === 'suspended' ? 'Reactivate the account before verifying it.' : undefined}
                  style={{ ...ACTION_BTN, opacity: (verifying || detail.badges.verified || detail.status === 'suspended') ? 0.45 : 1 }}
                >
                  {verifying ? 'Verifying…' : 'Verify'}
                </button>
                <button type="button" onClick={() => setMessageOpen(true)} style={ACTION_BTN}>Send Message</button>
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
                  {deleting ? 'Archiving…' : 'Delete'}
                </button>
              </div>
            </div>

            {/* Quick stats */}
            <div style={{ ...SECTION, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <StatBox label="Courses" value={detail.coursesCount} />
              <StatBox label="Students" value={detail.studentsCount} />
              <StatBox label="Live Sessions" value={detail.liveSessionsCount} />
              <StatBox label="Rating" value="—" />
              <StatBox label="Revenue" value="—" />
              <StatBox label="Published" value={detail.publishedCoursesCount} />
            </div>

            {/* Performance chart — enrollments only (revenue not available) */}
            <div style={SECTION}>
              <div style={SECTION_TITLE}>Enrollments — last 12 months</div>
              <div role="group" aria-label="Enrollments last 12 months" style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 56 }}>
                {detail.performanceChart.enrollments.map((v, i) => (
                  <div
                    key={i}
                    role="img"
                    aria-label={`${detail.performanceChart.labels[i]}: ${v}`}
                    title={`${detail.performanceChart.labels[i]}: ${v}`}
                    style={{ flex: 1, height: `${Math.max(3, (v / maxEnrollment) * 56)}px`, background: '#3b82f6', borderRadius: 2 }}
                  />
                ))}
              </div>
            </div>

            {/* Pending approvals — approve/reject reuse courseWizardApi's
                approveCourse/rejectCourse (same Courses module endpoints;
                contract: never fork instructor-scoped variants). */}
            {detail.pendingApprovals.length > 0 && (
              <div style={SECTION}>
                <div style={SECTION_TITLE}>Pending Course Approvals</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {detail.pendingApprovals.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 12, color: '#374151', minWidth: 0 }}>
                        <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                        <div style={{ color: '#94a3b8' }}>{c.category ?? 'Uncategorized'} · waiting since {formatDate(c.submittedAt)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button
                          type="button" title="Approve" disabled={courseBusyId === c.id}
                          onClick={() => handleApproveCourse(c)}
                          style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
                        >
                          <CheckCircle size={14} color="#16a34a" strokeWidth={2} />
                        </button>
                        <button
                          type="button" title="Reject" disabled={courseBusyId === c.id}
                          onClick={() => openRejectCourse(c)}
                          style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' }}
                        >
                          <XCircle size={14} color="#dc2626" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Courses */}
            <div style={SECTION}>
              <div style={SECTION_TITLE}>Courses ({detail.courses.length})</div>
              {detail.courses.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>No courses yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detail.courses.slice(0, 8).map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                      <span style={{ flexShrink: 0, padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: COURSE_STATUS_COLOR[c.status]?.bg, color: COURSE_STATUS_COLOR[c.status]?.fg }}>
                        {c.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent activity */}
            <div style={SECTION}>
              <div style={SECTION_TITLE}>Recent Activity</div>
              {detail.recentActivities.length === 0 ? (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>No recent activity.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detail.recentActivities.map(a => (
                    <div key={a.id} style={{ fontSize: 12, color: '#374151' }}>
                      {a.title}
                      <div style={{ color: '#94a3b8', fontSize: 11 }}>{formatDate(a.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Suspension & Compliance */}
            <div style={{ ...SECTION, borderBottom: 'none' }}>
              <div style={SECTION_TITLE}>Suspension History</div>
              <InstructorSuspensionHistory instructorId={detail.id} refreshKey={historyRefreshKey} />
            </div>
          </>
          )}
          </>
        )}
      </div>

      {rejectTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!rejectBusy ? () => setRejectTarget(null) : undefined} />
          <div role="dialog" aria-label="Reject Course" style={{ position: 'relative', width: '100%', maxWidth: 420, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>Reject Course</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                Rejecting <strong>{rejectTarget.title}</strong> — returns it to Draft with your feedback.
              </p>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <textarea
                aria-label="Rejection reason"
                value={rejectReason}
                onChange={e => { setRejectReason(e.target.value); setRejectErr(null); }}
                placeholder="What needs to change…"
                rows={4}
                autoFocus
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', border: '1px solid #e5e7eb', borderRadius: 6, resize: 'vertical', outline: 'none' }}
              />
              {rejectErr && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{rejectErr}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid #f1f5f9' }}>
              <button type="button" onClick={() => setRejectTarget(null)} disabled={rejectBusy} style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
                Cancel
              </button>
              <button type="button" onClick={submitRejectCourse} disabled={rejectBusy} style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, background: rejectBusy ? '#9ca3af' : '#dc2626', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#fff' }}>
                {rejectBusy ? 'Submitting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {suspendOpen && detail && (
        <SuspendInstructorDialog
          instructorId={detail.id}
          fullName={detail.fullName}
          onClose={() => setSuspendOpen(false)}
          onSuccess={() => { setSuspendOpen(false); fetchDetail(); setHistoryRefreshKey(k => k + 1); onChanged(); }}
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
    </div>
  );
});

export default InstructorSidePanel;

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div role="group" aria-label={`${label} stat`} style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
      <div data-value style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{label}</div>
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
