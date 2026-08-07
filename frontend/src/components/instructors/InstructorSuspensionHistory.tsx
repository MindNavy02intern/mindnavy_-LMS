// Suspension & Compliance — history section of the instructor side panel.
// GET /instructors/:id/suspension-history — reads the audit log
// (USER_SUSPENDED/USER_REACTIVATED), not a suspensions table.

import { useEffect, useState } from 'react';
import { getSuspensionHistory } from '../../services/instructorsApi';
import { InstructorApiError } from '../../types/instructors';
import type { SuspensionHistoryEntry } from '../../types/instructors';

interface Props {
  instructorId: string;
  refreshKey?: number; // bump to force a refetch after a suspend/reactivate
}

const VIOLATION_LABEL: Record<string, string> = {
  COPYRIGHT: 'Copyright', POLICY: 'Policy Violation', FRAUD: 'Fraud',
  BEHAVIOR: 'Inappropriate Behavior', FAKE_CERT: 'Fake Certification', SECURITY: 'Security',
};

const ACTION_COLOR: Record<string, { bg: string; fg: string }> = {
  suspended:   { bg: '#fee2e2', fg: '#b91c1c' },
  reactivated: { bg: '#dcfce7', fg: '#15803d' },
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function InstructorSuspensionHistory({ instructorId, refreshKey }: Props) {
  const [entries, setEntries] = useState<SuspensionHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getSuspensionHistory(instructorId, { limit: 20 })
      .then(res => { if (!cancelled) setEntries(res.history); })
      .catch(err => { if (!cancelled) setError(err instanceof InstructorApiError ? err.message : 'Failed to load suspension history.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [instructorId, refreshKey]);

  if (loading) {
    return <div style={{ fontSize: 12, color: '#94a3b8' }}>Loading…</div>;
  }
  if (error) {
    return <div style={{ fontSize: 12, color: '#b91c1c' }}>{error}</div>;
  }
  if (!entries || entries.length === 0) {
    return <div style={{ fontSize: 12, color: '#94a3b8' }}>No suspension history.</div>;
  }

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
