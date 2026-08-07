// Instructor Reviews tab — moderation queue.
// NOT in INSTRUCTORS_CONTRACT.md v1 ("no Review model" is documented as a
// deliberate [planned] gap — decision for Hassan, not a bug). Shipped anyway at
// the user's explicit direction 2026-08-07; see types/instructors.ts
// InstructorReview for the full note.

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Flag, Trash2 } from 'lucide-react';
import {
  approveInstructorReview, flagInstructorReview, listInstructorReviews, removeInstructorReview,
} from '../../services/instructorsApi';
import { InstructorApiError } from '../../types/instructors';
import type { InstructorReview } from '../../types/instructors';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  instructorId: string;
  showToast:    (type: 'success' | 'error', message: string) => void;
}

const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  PENDING:  { bg: '#fef9c3', fg: '#a16207' },
  APPROVED: { bg: '#dcfce7', fg: '#15803d' },
  REMOVED:  { bg: '#fee2e2', fg: '#b91c1c' },
  FLAGGED:  { bg: '#fff7ed', fg: '#ea580c' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ color: '#f59e0b', letterSpacing: 1 }} aria-label={`${rating} out of 5 stars`}>
      {'★'.repeat(Math.max(0, Math.min(5, rating)))}
      <span style={{ color: '#e2e8f0' }}>{'★'.repeat(Math.max(0, 5 - rating))}</span>
    </span>
  );
}

const TH: React.CSSProperties = { padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left', whiteSpace: 'nowrap' };
const TD: React.CSSProperties = { padding: '8px 10px', fontSize: 12, color: '#374151', borderTop: '1px solid #f1f5f9', verticalAlign: 'middle' };
const ICON_BTN: React.CSSProperties = { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' };

export default function InstructorReviewsTab({ instructorId, showToast }: Props) {
  const [reviews, setReviews] = useState<InstructorReview[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchList = useCallback(() => {
    setLoading(true);
    setListError(null);
    listInstructorReviews(instructorId)
      .then(res => setReviews(res.reviews))
      .catch(err => setListError(err instanceof InstructorApiError ? err.message : 'Failed to load reviews.'))
      .finally(() => setLoading(false));
  }, [instructorId]);

  useEffect(() => { fetchList(); }, [fetchList]);

  async function handleApprove(review: InstructorReview) {
    setBusyId(review.id);
    try {
      await approveInstructorReview(instructorId, review.id);
      invalidateFor(appQueryClient, 'review.moderate', { id: instructorId });
      showToast('success', 'Review approved.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof InstructorApiError ? err.message : 'Approve failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(review: InstructorReview) {
    if (!window.confirm('Remove this review? It will no longer be visible.')) return;
    setBusyId(review.id);
    try {
      await removeInstructorReview(instructorId, review.id);
      invalidateFor(appQueryClient, 'review.moderate', { id: instructorId });
      showToast('success', 'Review removed.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof InstructorApiError ? err.message : 'Remove failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleFlag(review: InstructorReview) {
    setBusyId(review.id);
    try {
      await flagInstructorReview(instructorId, review.id);
      invalidateFor(appQueryClient, 'review.moderate', { id: instructorId });
      showToast('success', 'Review flagged.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof InstructorApiError ? err.message : 'Flag failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ padding: '16px 20px' }}>
      {listError && (
        <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#b91c1c', marginBottom: 10 }}>
          {listError}
        </div>
      )}

      {loading && <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>Loading…</div>}

      {!loading && !listError && reviews && reviews.length === 0 && (
        <div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, background: '#f8fafc', padding: '32px 16px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          No reviews yet.
        </div>
      )}

      {!loading && reviews && reviews.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={TH}>Rating</th>
                  <th style={TH}>Comment</th>
                  <th style={TH}>Course</th>
                  <th style={TH}>Student</th>
                  <th style={TH}>Date</th>
                  <th style={TH}>Status</th>
                  <th style={TH}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map(review => {
                  const busy = busyId === review.id;
                  const status = STATUS_BADGE[review.status] ?? STATUS_BADGE.PENDING;
                  return (
                    <tr key={review.id} style={busy ? { opacity: 0.5 } : undefined}>
                      <td style={TD}><Stars rating={review.rating} /></td>
                      <td style={{ ...TD, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={review.comment ?? undefined}>
                        {review.comment ?? <span style={{ color: '#cbd5e1' }}>—</span>}
                      </td>
                      <td style={{ ...TD, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={review.courseTitle ?? undefined}>
                        {review.courseTitle ?? '—'}
                      </td>
                      <td style={TD}>{review.studentName ?? '—'}</td>
                      <td style={TD}>{formatDate(review.createdAt)}</td>
                      <td style={TD}>
                        <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: status.bg, color: status.fg }}>
                          {review.status}
                        </span>
                      </td>
                      <td style={TD}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {review.status !== 'APPROVED' && (
                            <button type="button" title="Approve" aria-label="Approve review" disabled={busy} onClick={() => handleApprove(review)} style={ICON_BTN}>
                              <CheckCircle size={13} color="#16a34a" strokeWidth={2} />
                            </button>
                          )}
                          {review.status !== 'FLAGGED' && (
                            <button type="button" title="Flag" aria-label="Flag review" disabled={busy} onClick={() => handleFlag(review)} style={ICON_BTN}>
                              <Flag size={13} color="#ea580c" strokeWidth={2} />
                            </button>
                          )}
                          {review.status !== 'REMOVED' && (
                            <button type="button" title="Remove" aria-label="Remove review" disabled={busy} onClick={() => handleRemove(review)} style={ICON_BTN}>
                              <Trash2 size={13} color="#dc2626" strokeWidth={2} />
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
        </div>
      )}
    </div>
  );
}
