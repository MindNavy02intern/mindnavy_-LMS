import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle, ChevronLeft, ChevronRight, MessageSquare, Search, XCircle } from 'lucide-react';
import {
  approveInstructorApplication, listInstructorApplications,
  rejectInstructorApplication, requestChangesInstructorApplication,
} from '../../services/instructorsApi';
import { InstructorApiError } from '../../types/instructors';
import type { ApplicationStatus, InstructorApplication, InstructorApplicationsStatusCounts } from '../../types/instructors';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
  onCountsChanged?: (counts: InstructorApplicationsStatusCounts) => void;
  /** Fired after an application is approved (a new instructor AppUser was
   *  just created) — lets the page refresh the All/Active tab badge counts,
   *  which this tab has no other way to reach since InstructorsTable (the
   *  only thing that fetches them) isn't mounted while Pending is showing. */
  onInstructorCreated?: () => void;
}

type StatusFilter = 'ALL' | ApplicationStatus;
const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'CHANGES_REQUESTED', label: 'Changes Requested' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

type ReasonModal = { kind: 'reject' | 'request-changes'; app: InstructorApplication } | null;

const TH: React.CSSProperties = { padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left' };
const TD: React.CSSProperties = { padding: '10px 12px', fontSize: 13, color: '#374151', borderTop: '1px solid #f1f5f9' };

export default function ApplicationsTab({ showToast, onCountsChanged, onInstructorCreated }: Props) {
  const [rows, setRows] = useState<InstructorApplication[]>([]);
  const [statusCounts, setStatusCounts] = useState<InstructorApplicationsStatusCounts | null>(null);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<ReasonModal>(null);
  const [reasonText, setReasonText] = useState('');
  const [reasonErr, setReasonErr] = useState<string | null>(null);
  const [reasonBusy, setReasonBusy] = useState(false);

  // Guards against a stale response (e.g. slow request for a filter/page the
  // admin already navigated away from) overwriting a newer one.
  const requestIdRef = useRef(0);

  const fetchList = useCallback(() => {
    const myRequestId = ++requestIdRef.current;
    (() => { setLoading(true); setListError(null); })();
    listInstructorApplications({
      page, limit, search: search || undefined,
      ...(statusFilter !== 'ALL' ? { status: statusFilter.toLowerCase() as 'pending' | 'changes_requested' | 'approved' | 'rejected' } : {}),
    })
      .then(res => {
        if (requestIdRef.current !== myRequestId) return;
        setRows(res.applications);
        setStatusCounts(res.statusCounts);
        onCountsChanged?.(res.statusCounts);
        setTotal(res.pagination.total);
        setPages(res.pagination.pages);
      })
      .catch(err => {
        if (requestIdRef.current !== myRequestId) return;
        setListError(err instanceof InstructorApiError ? err.message : 'Failed to load applications.');
      })
      .finally(() => { if (requestIdRef.current === myRequestId) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, search]);

  useEffect(() => { fetchList(); }, [fetchList]);

  function handleSearchChange(val: string) {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setSearch(val); setPage(1); }, 400);
  }

  async function handleApprove(app: InstructorApplication) {
    if (!window.confirm(`Approve ${app.fullName}'s application? Creates their instructor account immediately.`)) return;
    setBusyId(app.id);
    try {
      await approveInstructorApplication(app.id);
      invalidateFor(appQueryClient, 'instructorApplication.approve');
      showToast('success', `${app.fullName} approved — instructor account created.`);
      fetchList();
      onInstructorCreated?.();
    } catch (err) {
      showToast('error', err instanceof InstructorApiError ? err.message : 'Approval failed.');
    } finally {
      setBusyId(null);
    }
  }

  function openReasonModal(kind: 'reject' | 'request-changes', app: InstructorApplication) {
    setReasonModal({ kind, app });
    setReasonText('');
    setReasonErr(null);
  }

  async function submitReasonModal() {
    if (!reasonModal) return;
    const trimmed = reasonText.trim();
    if (trimmed.length < 3) { setReasonErr('Required — at least 3 characters.'); return; }
    setReasonBusy(true);
    try {
      if (reasonModal.kind === 'reject') {
        await rejectInstructorApplication(reasonModal.app.id, trimmed);
        invalidateFor(appQueryClient, 'instructorApplication.reject');
        showToast('success', `${reasonModal.app.fullName}'s application rejected.`);
      } else {
        await requestChangesInstructorApplication(reasonModal.app.id, trimmed);
        invalidateFor(appQueryClient, 'instructorApplication.requestChanges');
        showToast('success', `Changes requested from ${reasonModal.app.fullName}.`);
      }
      setReasonModal(null);
      fetchList();
    } catch (err) {
      showToast('error', err instanceof InstructorApiError ? err.message : 'Action failed.');
    } finally {
      setReasonBusy(false);
    }
  }

  const rowStart = total === 0 ? 0 : (page - 1) * limit + 1;
  const rowEnd = Math.min(page * limit, total);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0' }}>
        {STATUS_TABS.map(t => {
          // 'total' is the CURRENT filter's pagination.total (defaults to
          // Pending-only on first load) — statusCounts is the true global,
          // filter-independent breakdown, so 'All' must sum it, not reuse
          // whatever the active filter happens to return.
          const count = t.key === 'ALL'
            ? (statusCounts ? Object.values(statusCounts).reduce((a, b) => a + b, 0) : total)
            : statusCounts?.[t.key];
          const active = statusFilter === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => { setStatusFilter(t.key); setPage(1); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 12px', fontSize: 12, fontWeight: 600,
                fontFamily: 'inherit', background: 'none', cursor: 'pointer',
                border: 'none', borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
                color: active ? '#2563eb' : '#64748b', marginBottom: -1,
              }}
            >
              {t.label}
              {count !== undefined && count !== null && (
                <span style={{ padding: '1px 6px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: active ? '#dbeafe' : '#f1f5f9', color: active ? '#1d4ed8' : '#64748b' }}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 280 }}>
        <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: 9 }} />
        <input
          type="text"
          value={searchInput}
          onChange={e => handleSearchChange(e.target.value)}
          placeholder="Search applicants…"
          style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px 7px 30px', fontSize: 12, fontFamily: 'inherit', border: '1px solid #e2e8f0', borderRadius: 8, outline: 'none' }}
        />
      </div>

      {listError && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#b91c1c' }}>{listError}</div>
      )}

      {/* Table */}
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={TH}>Applicant</th>
                <th style={TH}>Specialization</th>
                <th style={TH}>Experience</th>
                <th style={TH}>Status</th>
                <th style={TH}>Submitted</th>
                <th style={TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j} style={TD}><div style={{ height: 12, background: '#f1f5f9', borderRadius: 4 }} /></td>
                  ))}
                </tr>
              ))}
              {!loading && !listError && rows.length === 0 && (
                <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', color: '#94a3b8', padding: '32px 12px' }}>No applications found</td></tr>
              )}
              {!loading && rows.map(app => (
                <tr key={app.id}>
                  <td style={TD}>
                    <div style={{ fontWeight: 600, color: '#0f172a' }}>{app.fullName}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{app.email}</div>
                  </td>
                  <td style={TD}>{app.specialization ?? '—'}</td>
                  <td style={TD}>{app.yearsExperience !== null ? `${app.yearsExperience} yrs` : '—'}</td>
                  <td style={TD}>
                    <span style={{ padding: '3px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#fef9c3', color: '#a16207' }}>
                      {app.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={TD}>{new Date(app.createdAt).toLocaleDateString()}</td>
                  <td style={TD}>
                    {app.status === 'PENDING' || app.status === 'CHANGES_REQUESTED' ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button type="button" title="Approve" disabled={busyId === app.id} onClick={() => handleApprove(app)} style={ICON_BTN}>
                          <CheckCircle size={15} color="#16a34a" strokeWidth={2} />
                        </button>
                        <button type="button" title="Reject" disabled={busyId === app.id} onClick={() => openReasonModal('reject', app)} style={ICON_BTN}>
                          <XCircle size={15} color="#dc2626" strokeWidth={2} />
                        </button>
                        <button type="button" title="Request changes" disabled={busyId === app.id} onClick={() => openReasonModal('request-changes', app)} style={ICON_BTN}>
                          <MessageSquare size={15} color="#2563eb" strokeWidth={2} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 12, color: '#64748b' }}>
            {loading ? 'Loading…' : `Showing ${rowStart} to ${rowEnd} of ${total} applications`}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={PAGE_BTN}><ChevronLeft size={14} /></button>
            <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={PAGE_BTN}><ChevronRight size={14} /></button>
          </div>
        </div>
      </div>

      {/* Reason modal — shared by Reject / Request Changes */}
      {reasonModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!reasonBusy ? () => setReasonModal(null) : undefined} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 420, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>
                {reasonModal.kind === 'reject' ? 'Reject Application' : 'Request Changes'}
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                {reasonModal.kind === 'reject' ? 'Rejecting' : 'Requesting changes from'} <strong>{reasonModal.app.fullName}</strong>
              </p>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <textarea
                aria-label={reasonModal.kind === 'reject' ? 'Rejection reason' : 'Change request'}
                value={reasonText}
                onChange={e => { setReasonText(e.target.value); setReasonErr(null); }}
                placeholder={reasonModal.kind === 'reject' ? 'Reason for rejection…' : 'What needs to change…'}
                rows={4}
                autoFocus
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', border: '1px solid #e5e7eb', borderRadius: 6, resize: 'vertical', outline: 'none' }}
              />
              {reasonErr && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{reasonErr}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid #f1f5f9' }}>
              <button type="button" onClick={() => setReasonModal(null)} disabled={reasonBusy} style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
                Cancel
              </button>
              <button type="button" onClick={submitReasonModal} disabled={reasonBusy} style={{ padding: '8px 16px', fontSize: 13, fontFamily: 'inherit', fontWeight: 600, background: reasonBusy ? '#9ca3af' : '#dc2626', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#fff' }}>
                {reasonBusy ? 'Submitting…' : reasonModal.kind === 'reject' ? 'Reject' : 'Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ICON_BTN: React.CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' };
const PAGE_BTN: React.CSSProperties = { width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#64748b' };
