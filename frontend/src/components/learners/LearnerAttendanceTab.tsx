// Learner Attendance tab (side panel → More) — GET /learners/:id/attendance
// (Part 5). Real SessionAttendance rows only — read-only, no correction
// endpoint exists (manual correction is [phase-later] per the model comment).

import { useCallback, useEffect, useState } from 'react';
import { getLearnerAttendance } from '../../services/learnersApi';
import { LearnerApiError } from '../../types/learners';
import type { LearnerAttendanceRecord } from '../../types/learners';

interface Props {
  learnerId: string;
}

const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  PRESENT: { bg: '#dcfce7', fg: '#15803d' },
  LATE:    { bg: '#fef9c3', fg: '#a16207' },
  ABSENT:  { bg: '#fee2e2', fg: '#b91c1c' },
  EXCUSED: { bg: '#f1f5f9', fg: '#475569' },
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const SUMMARY_ITEMS: { key: 'present' | 'late' | 'absent' | 'excused'; label: string; color: string }[] = [
  { key: 'present', label: 'Present', color: '#16a34a' },
  { key: 'late',    label: 'Late',    color: '#ca8a04' },
  { key: 'absent',  label: 'Absent',  color: '#dc2626' },
  { key: 'excused', label: 'Excused', color: '#64748b' },
];

export default function LearnerAttendanceTab({ learnerId }: Props) {
  const [records, setRecords] = useState<LearnerAttendanceRecord[] | null>(null);
  const [summary, setSummary] = useState<{ present: number; late: number; absent: number; excused: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(() => {
    setLoading(true);
    setError(null);
    getLearnerAttendance(learnerId, { limit: 50 })
      .then(res => { setRecords(res.records); setSummary(res.summary); })
      .catch(err => setError(err instanceof LearnerApiError ? err.message : 'Failed to load attendance.'))
      .finally(() => setLoading(false));
  }, [learnerId]);

  useEffect(() => { fetchList(); }, [fetchList]);

  return (
    <div>
      {error && <div style={{ fontSize: 12, color: '#b91c1c', marginBottom: 10 }}>{error}</div>}
      {loading && <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>Loading…</div>}

      {!loading && summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
          {SUMMARY_ITEMS.map(s => (
            <div key={s.key} style={{ textAlign: 'center', padding: '8px 4px', background: '#f8fafc', borderRadius: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: s.color }}>{summary[s.key]}</div>
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && records && records.length === 0 && (
        <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '20px 0' }}>No session attendance on file.</div>
      )}

      {!loading && records && records.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {records.map(r => {
            const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.ABSENT;
            return (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 10px', border: '1px solid #f1f5f9', borderRadius: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.sessionTitle ?? undefined}>
                    {r.sessionTitle ?? 'Untitled session'}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{formatDateTime(r.sessionStartTime)}</div>
                </div>
                <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.fg, flexShrink: 0 }}>
                  {r.status}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
