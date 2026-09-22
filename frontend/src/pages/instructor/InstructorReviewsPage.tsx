import { useEffect, useState } from 'react';
import InstructorLayout from './InstructorLayout';
import { INPUT, ERROR_BANNER, TH, TD } from './instructorUiKit';
import { listMyReviews, getMyReviewStats, InstructorReviewsApiError } from '../../api/instructorReviewsApi';
import type { InstructorReviewRow, MyReviewStats, ReviewStatus } from '../../types/instructorReviews';

// Read-only per blueprint 2.6 — no approve/remove/flag (admin-only content
// moderation). Removed reviews never appear (enforced server-side).

const STATUS_OPTIONS: { value: ReviewStatus | ''; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'FLAGGED', label: 'Flagged' },
];

const STATUS_COLOR: Record<ReviewStatus, { bg: string; fg: string }> = {
  APPROVED: { bg: '#dcfce7', fg: '#15803d' },
  PENDING:  { bg: '#fef9c3', fg: '#a16207' },
  FLAGGED:  { bg: '#fee2e2', fg: '#b91c1c' },
};

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ color: '#f59e0b', letterSpacing: 1, fontSize: 13 }}>
      {'★'.repeat(rating)}<span style={{ color: '#e5e7eb' }}>{'★'.repeat(Math.max(0, 5 - rating))}</span>
    </span>
  );
}

export default function InstructorReviewsPage() {
  const [status, setStatus] = useState<ReviewStatus | ''>('');
  const [reviews, setReviews] = useState<InstructorReviewRow[]>([]);
  const [stats, setStats] = useState<MyReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyReviewStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    listMyReviews({ status: status || undefined })
      .then((res) => { setReviews(res.reviews); setError(null); })
      .catch((err: unknown) => setError(err instanceof InstructorReviewsApiError ? err.message : 'Failed to load reviews.'))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <InstructorLayout>
      <div className="mn-db-welcome">
        <div>
          <h1 className="mn-db-welcome-title">My Reviews</h1>
          <p className="mn-db-welcome-sub">Student reviews left on your courses</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 14 }}>
        <div className="mn-db-card">
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Average Rating</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: stats?.avgRating.available ? '#0f172a' : '#cbd5e1' }}>
            {stats?.avgRating.available ? `${stats.avgRating.value} / 5` : '—'}
          </div>
          {stats && !stats.avgRating.available && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{stats.avgRating.reason}</div>}
        </div>
        <div className="mn-db-card">
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>Total Reviews</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{stats?.totalReviews ?? '—'}</div>
        </div>
      </div>

      {error && <div style={{ ...ERROR_BANNER, marginBottom: 14 }}>{error}</div>}

      <div className="mn-db-card">
        <div style={{ marginBottom: 10 }}>
          <select aria-label="Filter by status" style={{ ...INPUT, maxWidth: 200 }} value={status} onChange={(e) => setStatus(e.target.value as ReviewStatus | '')}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><div className="mn-spinner" /></div>
        ) : reviews.length === 0 ? (
          <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>No reviews yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={TH}>Rating</th>
                <th style={TH}>Comment</th>
                <th style={TH}>Course</th>
                <th style={TH}>Student</th>
                <th style={TH}>Date</th>
                <th style={TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td style={TD}><Stars rating={r.rating} /></td>
                  <td style={{ ...TD, maxWidth: 320 }}>{r.comment ?? <span style={{ color: '#cbd5e1' }}>No comment</span>}</td>
                  <td style={TD}>{r.courseTitle ?? '—'}</td>
                  <td style={TD}>{r.studentName ?? '—'}</td>
                  <td style={TD}>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td style={TD}>
                    <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: STATUS_COLOR[r.status].bg, color: STATUS_COLOR[r.status].fg }}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </InstructorLayout>
  );
}
