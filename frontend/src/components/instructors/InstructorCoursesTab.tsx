// Instructor Courses tab (blueprint 05 §6) — per COURSES_API.md §4.1:
// "there is deliberately no /api/admin/instructors/:id/courses" — this is
// GET /courses?instructor=<id>&status=… (existing listCourses()), filtered.
// Same mutation IDs as the Courses module (course.approve/.reject/.unpublish/
// .archive) — never instructor-scoped forks.
//
// Note: CourseListRow has no `createdAt` (only CourseDetail does) — the date
// column below reads `updatedAt` and is labeled "Updated", not "Created".

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, Eye, Archive as ArchiveIcon, CloudOff } from 'lucide-react';
import { listCourses, archiveCourse } from '../../services/coursesApi';
import { approveCourse, rejectCourse, unpublishCourse } from '../../services/courseWizardApi';
import { CourseApiError } from '../../types/courses';
import type { CourseListRow, CourseStatusFilter } from '../../types/courses';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import CourseQuickViewModal from '../learningManagement/CourseQuickViewModal';

interface Props {
  instructorId: string;
  onChanged:    () => void; // a course mutation changed this instructor's coursesCount/publishedCoursesCount
  showToast:    (type: 'success' | 'error', message: string) => void;
}

const SUB_TABS: { key: CourseStatusFilter; label: string }[] = [
  { key: 'All',       label: 'All' },
  { key: 'Draft',     label: 'Draft' },
  { key: 'Pending',   label: 'Pending Approval' },
  { key: 'Published', label: 'Published' },
  { key: 'Archived',  label: 'Archived' },
  { key: 'Rejected',  label: 'Rejected' },
];

const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  PUBLISHED: { bg: '#dcfce7', fg: '#15803d' },
  DRAFT:     { bg: '#f1f5f9', fg: '#475569' },
  PENDING:   { bg: '#fef9c3', fg: '#a16207' },
  ARCHIVED:  { bg: '#f1f5f9', fg: '#94a3b8' },
  REJECTED:  { bg: '#fee2e2', fg: '#b91c1c' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const TH: React.CSSProperties = { padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left', whiteSpace: 'nowrap' };
const TD: React.CSSProperties = { padding: '8px 10px', fontSize: 12, color: '#374151', borderTop: '1px solid #f1f5f9', verticalAlign: 'middle' };
const ICON_BTN: React.CSSProperties = { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' };

export default function InstructorCoursesTab({ instructorId, onChanged, showToast }: Props) {
  const [subTab, setSubTab] = useState<CourseStatusFilter>('All');
  const [rows, setRows] = useState<CourseListRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const limit = 8;

  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewCourseId, setViewCourseId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<CourseListRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectErr, setRejectErr] = useState<string | null>(null);
  const [rejectBusy, setRejectBusy] = useState(false);

  const requestIdRef = useRef(0);

  const fetchList = useCallback(() => {
    const myRequestId = ++requestIdRef.current;
    setLoading(true);
    setListError(null);
    listCourses({ instructor: instructorId, status: subTab, page, limit })
      .then(res => {
        if (requestIdRef.current !== myRequestId) return;
        setRows(res.courses);
        setCounts(res.statusCounts as unknown as Record<string, number>);
        setTotal(res.pagination.total);
        setPages(res.pagination.pages);
      })
      .catch(err => {
        if (requestIdRef.current !== myRequestId) return;
        setListError(err instanceof CourseApiError ? err.message : 'Failed to load courses.');
      })
      .finally(() => { if (requestIdRef.current === myRequestId) setLoading(false); });
  }, [instructorId, subTab, page, limit]);

  useEffect(() => { fetchList(); }, [fetchList]);
  useEffect(() => { setPage(1); }, [subTab]);

  function badgeFor(row: CourseListRow): { label: string; bg: string; fg: string } {
    const key = row.isRejected ? 'REJECTED' : row.status.toUpperCase();
    const c = STATUS_BADGE[key] ?? STATUS_BADGE.DRAFT;
    return { label: key, ...c };
  }

  async function handleApprove(row: CourseListRow) {
    if (!window.confirm(`Approve "${row.title}"? It will be published immediately.`)) return;
    setBusyId(row.id);
    try {
      await approveCourse(row.id, { instructorId });
      showToast('success', `"${row.title}" approved and published.`);
      fetchList();
      onChanged();
    } catch (err) {
      showToast('error', err instanceof CourseApiError ? err.message : 'Approval failed.');
      fetchList();
    } finally {
      setBusyId(null);
    }
  }

  function openReject(row: CourseListRow) {
    setRejectTarget(row);
    setRejectReason('');
    setRejectErr(null);
  }

  async function submitReject() {
    if (!rejectTarget) return;
    const trimmed = rejectReason.trim();
    if (trimmed.length < 3) { setRejectErr('Required — at least 3 characters.'); return; }
    setRejectBusy(true);
    try {
      await rejectCourse(rejectTarget.id, trimmed, { instructorId });
      showToast('success', `"${rejectTarget.title}" returned to Draft with feedback.`);
      setRejectTarget(null);
      fetchList();
      onChanged();
    } catch (err) {
      showToast('error', err instanceof CourseApiError ? err.message : 'Rejection failed.');
    } finally {
      setRejectBusy(false);
    }
  }

  async function handleUnpublish(row: CourseListRow) {
    if (!window.confirm(`Unpublish "${row.title}"? It returns to Draft and comes off the catalogue.`)) return;
    setBusyId(row.id);
    try {
      await unpublishCourse(row.id, { instructorId });
      showToast('success', `"${row.title}" unpublished.`);
      fetchList();
      onChanged();
    } catch (err) {
      showToast('error', err instanceof CourseApiError ? err.message : 'Unpublish failed.');
      fetchList();
    } finally {
      setBusyId(null);
    }
  }

  async function handleArchive(row: CourseListRow) {
    if (!window.confirm(`Archive "${row.title}"? It will move to the Archived tab.`)) return;
    setBusyId(row.id);
    try {
      await archiveCourse(row.id);
      invalidateFor(appQueryClient, 'course.archive', { id: row.id, instructorId });
      showToast('success', `"${row.title}" archived.`);
      fetchList();
      onChanged();
    } catch (err) {
      showToast('error', err instanceof CourseApiError ? err.message : 'Archive failed.');
    } finally {
      setBusyId(null);
    }
  }

  const countKey: Record<CourseStatusFilter, string> = {
    All: 'all', Draft: 'draft', Pending: 'pending', Published: 'published', Archived: 'archived', Rejected: 'rejected',
  };

  return (
    <div style={{ padding: '16px 20px' }}>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #f1f5f9', marginBottom: 12, overflowX: 'auto' }}>
        {SUB_TABS.map(t => {
          const active = subTab === t.key;
          const count = counts?.[countKey[t.key]];
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setSubTab(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 8px', fontSize: 11, fontWeight: 600,
                fontFamily: 'inherit', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                border: 'none', borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                color: active ? '#2563eb' : '#64748b', marginBottom: -1,
              }}
            >
              {t.label}
              {count !== undefined && (
                <span style={{ padding: '1px 6px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: active ? '#dbeafe' : '#f1f5f9', color: active ? '#1d4ed8' : '#64748b' }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {listError && (
        <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#b91c1c', marginBottom: 10 }}>
          {listError}
        </div>
      )}

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={TH}>Title</th>
                <th style={TH}>Category</th>
                <th style={TH}>Students</th>
                <th style={TH}>Status</th>
                <th style={TH}>Updated</th>
                <th style={TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} style={TD}><div style={{ height: 10, background: '#f1f5f9', borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))}

              {!loading && !listError && rows.length === 0 && (
                <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', color: '#94a3b8', padding: '24px 12px' }}>No courses in this tab.</td></tr>
              )}

              {!loading && rows.map(row => {
                const badge = badgeFor(row);
                const busy = busyId === row.id;
                return (
                  <tr key={row.id} style={busy ? { opacity: 0.5 } : undefined}>
                    <td style={{ ...TD, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.title}>{row.title}</td>
                    <td style={TD}>{row.category ?? '—'}</td>
                    <td style={TD}>{row.enrolledCount.toLocaleString()}</td>
                    <td style={TD}>
                      <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.fg }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={TD}>{formatDate(row.updatedAt)}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" title="Open course" aria-label={`View ${row.title}`} onClick={() => setViewCourseId(row.id)} style={ICON_BTN}>
                          <Eye size={13} color="#64748b" strokeWidth={2} />
                        </button>
                        {row.status === 'Pending' && (
                          <>
                            <button type="button" title="Approve" aria-label={`Approve ${row.title}`} disabled={busy} onClick={() => handleApprove(row)} style={ICON_BTN}>
                              <CheckCircle size={13} color="#16a34a" strokeWidth={2} />
                            </button>
                            <button type="button" title="Reject" aria-label={`Reject ${row.title}`} disabled={busy} onClick={() => openReject(row)} style={ICON_BTN}>
                              <XCircle size={13} color="#dc2626" strokeWidth={2} />
                            </button>
                          </>
                        )}
                        {row.status === 'Published' && (
                          <button type="button" title="Unpublish" aria-label={`Unpublish ${row.title}`} disabled={busy} onClick={() => handleUnpublish(row)} style={ICON_BTN}>
                            <CloudOff size={13} color="#ea580c" strokeWidth={2} />
                          </button>
                        )}
                        {row.status === 'Draft' && (
                          <button type="button" title="Archive" aria-label={`Archive ${row.title}`} disabled={busy} onClick={() => handleArchive(row)} style={ICON_BTN}>
                            <ArchiveIcon size={13} color="#64748b" strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 11, color: '#94a3b8' }}>{loading ? 'Loading…' : `${total} course${total === 1 ? '' : 's'}`}</span>
          {pages > 1 && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ ...ICON_BTN, width: 'auto', padding: '0 8px', opacity: page <= 1 ? 0.4 : 1 }}>‹</button>
              <span style={{ fontSize: 11, color: '#64748b', padding: '0 4px', display: 'flex', alignItems: 'center' }}>{page} / {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={{ ...ICON_BTN, width: 'auto', padding: '0 8px', opacity: page >= pages ? 0.4 : 1 }}>›</button>
            </div>
          )}
        </div>
      </div>

      {viewCourseId && <CourseQuickViewModal courseId={viewCourseId} onClose={() => setViewCourseId(null)} />}

      {rejectTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!rejectBusy ? () => setRejectTarget(null) : undefined} />
          <div role="dialog" aria-label="Reject Course" style={{ position: 'relative', width: '100%', maxWidth: 380, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Reject Course</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                Rejecting <strong>{rejectTarget.title}</strong> — returns it to Draft with your feedback.
              </p>
            </div>
            <div style={{ padding: '14px 18px' }}>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #f1f5f9' }}>
              <button type="button" onClick={() => setRejectTarget(null)} disabled={rejectBusy} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
                Cancel
              </button>
              <button type="button" onClick={submitReject} disabled={rejectBusy} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, background: rejectBusy ? '#9ca3af' : '#dc2626', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#fff' }}>
                {rejectBusy ? 'Submitting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
