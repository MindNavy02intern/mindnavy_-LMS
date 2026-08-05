import { useCallback, useEffect, useState } from 'react';
import {
  deleteInstructor, getInstructor, reactivateInstructor, verifyInstructor,
} from '../../services/instructorsApi';
import { InstructorApiError } from '../../types/instructors';
import type { InstructorDetail } from '../../types/instructors';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import SendMessageModal from '../users/SendMessageModal';
import SuspendInstructorDialog from './SuspendInstructorDialog';

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

export default function InstructorSidePanel({ instructorId, onClose, onEdit, onChanged, onDeleted, showToast }: Props) {
  const [detail,  setDetail]  = useState<InstructorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [verifying,   setVerifying]   = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);

  const fetchDetail = useCallback(() => {
    (() => { setLoading(true); setError(null); })();
    getInstructor(instructorId)
      .then(setDetail)
      .catch(err => setError(err instanceof InstructorApiError ? err.message : 'Failed to load instructor.'))
      .finally(() => setLoading(false));
  }, [instructorId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  async function handleVerify() {
    if (!detail) return;
    setVerifying(true);
    try {
      const updated = await verifyInstructor(detail.id);
      setDetail(updated);
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
    setReactivating(true);
    try {
      const updated = await reactivateInstructor(detail.id);
      setDetail(updated);
      invalidateFor(appQueryClient, 'instructor.reactivate', { id: detail.id });
      showToast('success', `${detail.fullName} reactivated.`);
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
      showToast('error', err instanceof InstructorApiError ? err.message : 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  const maxEnrollment = detail ? Math.max(1, ...detail.performanceChart.enrollments) : 1;

  return (
    <div style={{
      width: 380, flexShrink: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12,
      display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 140px)', position: 'sticky', top: 16,
    }}>
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
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: STATUS_COLOR[detail.status]?.bg, color: STATUS_COLOR[detail.status]?.fg }}>
                  {detail.status}
                </span>
                <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: detail.badges.verified ? '#dbeafe' : '#f1f5f9', color: detail.badges.verified ? '#1d4ed8' : '#64748b' }}>
                  {detail.badges.verified ? 'Verified' : 'Not verified'}
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
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={verifying || detail.badges.verified || detail.status === 'suspended'}
                  title={detail.status === 'suspended' ? 'Reactivate the account before verifying it.' : undefined}
                  style={{ ...ACTION_BTN, opacity: (verifying || detail.badges.verified || detail.status === 'suspended') ? 0.45 : 1 }}
                >
                  {verifying ? 'Verifying…' : 'Verify'}
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
                <button type="button" onClick={() => setMessageOpen(true)} style={ACTION_BTN}>Message</button>
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
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 56 }}>
                {detail.performanceChart.enrollments.map((v, i) => (
                  <div
                    key={i}
                    title={`${detail.performanceChart.labels[i]}: ${v}`}
                    style={{ flex: 1, height: `${Math.max(3, (v / maxEnrollment) * 56)}px`, background: '#3b82f6', borderRadius: 2 }}
                  />
                ))}
              </div>
            </div>

            {/* Pending approvals */}
            {detail.pendingApprovals.length > 0 && (
              <div style={SECTION}>
                <div style={SECTION_TITLE}>Pending Course Approvals</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detail.pendingApprovals.map(c => (
                    <div key={c.id} style={{ fontSize: 12, color: '#374151' }}>
                      <div style={{ fontWeight: 600 }}>{c.title}</div>
                      <div style={{ color: '#94a3b8' }}>{c.category ?? 'Uncategorized'} · waiting since {formatDate(c.submittedAt)}</div>
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
            <div style={{ ...SECTION, borderBottom: 'none' }}>
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
          </>
        )}
      </div>

      {suspendOpen && detail && (
        <SuspendInstructorDialog
          instructorId={detail.id}
          fullName={detail.fullName}
          onClose={() => setSuspendOpen(false)}
          onSuccess={() => { setSuspendOpen(false); fetchDetail(); onChanged(); }}
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
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ padding: '8px 10px', background: '#f8fafc', borderRadius: 8, textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{value}</div>
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
