// Mirrors InstructorSuspensionHistory.tsx — same endpoint shape
// (GET /learners/:id/suspension-history, reads the audit log), learner
// violation taxonomy. Wired early (Part 4, inside "More") because the
// backend has existed since Part 1 — Documents/Tickets/Attendance are the
// genuinely new pieces Part 8 adds to this same tab.

import { useEffect, useState } from 'react';
import { getSuspensionHistory } from '../../services/learnersApi';
import { LearnerApiError } from '../../types/learners';
import type { SuspensionHistoryEntry } from '../../types/learners';

interface Props {
  learnerId: string;
  refreshKey?: number;
}

const VIOLATION_LABEL: Record<string, string> = {
  CHEATING: 'Cheating', POLICY: 'Policy Violation', BEHAVIOR: 'Inappropriate Behavior',
  ACCOUNT_ABUSE: 'Account Abuse', PAYMENT_FRAUD: 'Payment Fraud', SECURITY: 'Security',
};

const ACTION_COLOR: Record<string, { bg: string; fg: string }> = {
  suspended:   { bg: '#fee2e2', fg: '#b91c1c' },
  reactivated: { bg: '#dcfce7', fg: '#15803d' },
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function LearnerSuspensionHistory({ learnerId, refreshKey }: Props) {
  const [entries, setEntries] = useState<SuspensionHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSuspensionHistory(learnerId, { limit: 20 })
      .then(res => { if (!cancelled) setEntries(res.history); })
      .catch(err => { if (!cancelled) setError(err instanceof LearnerApiError ? err.message : 'Failed to load suspension history.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [learnerId, refreshKey]);

  if (loading) return <div style={{ fontSize: 12, color: '#94a3b8' }}>Loading…</div>;
  if (error) return <div style={{ fontSize: 12, color: '#b91c1c' }}>{error}</div>;
  if (!entries || entries.length === 0) return <div style={{ fontSize: 12, color: '#94a3b8' }}>No suspension history.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {entries.map(e => {
        const color = ACTION_COLOR[e.action] ?? ACTION_COLOR.suspended;
        return (
          <div key={e.id} style={{ fontSize: 12, color: '#374151', paddingBottom: 8, borderBottom: '1px solid #f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: color.bg, color: color.fg }}>
                {e.action.toUpperCase()}
              </span>
              {e.violationType && (
                <span style={{ padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: '#f1f5f9', color: '#64748b' }}>
                  {VIOLATION_LABEL[e.violationType] ?? e.violationType}
                </span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94a3b8' }}>{formatDateTime(e.createdAt)}</span>
            </div>
            {e.reason && <div style={{ color: '#374151' }}>{e.reason}</div>}
            {e.notes && <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>Note: {e.notes}</div>}
            <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>by {e.adminName ?? '—'}</div>
          </div>
        );
      })}
    </div>
  );
}
