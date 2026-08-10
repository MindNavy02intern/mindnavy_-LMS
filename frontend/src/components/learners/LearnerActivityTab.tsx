// Learner Activity tab (side panel) — GET /learners/:id/activity (Part 3).
// Real sources only: login, quiz_attempt, session_attended. lesson_viewed /
// video_watched / assignment_upload have no source table anywhere in this
// system (see learners.service comment) — shown as a dimmed notice, never
// silently omitted, so "empty" doesn't get mistaken for "nothing happened".

import { useCallback, useEffect, useState } from 'react';
import { LogIn, HelpCircle, Video, Info } from 'lucide-react';
import { getLearnerActivity } from '../../services/learnersApi';
import { LearnerApiError } from '../../types/learners';
import type { LearnerActivityEntry, LearnerActivityType } from '../../types/learners';

interface Props {
  learnerId: string;
}

const TYPE_ICON: Record<LearnerActivityType, typeof LogIn> = {
  login: LogIn,
  quiz_attempt: HelpCircle,
  session_attended: Video,
  lesson_viewed: Info,
  video_watched: Info,
  assignment_upload: Info,
};

const TYPE_COLOR: Record<LearnerActivityType, string> = {
  login: '#2563eb',
  quiz_attempt: '#8b5cf6',
  session_attended: '#059669',
  lesson_viewed: '#94a3b8',
  video_watched: '#94a3b8',
  assignment_upload: '#94a3b8',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function LearnerActivityTab({ learnerId }: Props) {
  const [entries, setEntries] = useState<LearnerActivityEntry[] | null>(null);
  const [unavailableTypes, setUnavailableTypes] = useState<LearnerActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(() => {
    setLoading(true);
    setError(null);
    getLearnerActivity(learnerId, { limit: 30 })
      .then(res => { setEntries(res.activities); setUnavailableTypes(res.unavailableTypes); })
      .catch(err => setError(err instanceof LearnerApiError ? err.message : 'Failed to load activity.'))
      .finally(() => setLoading(false));
  }, [learnerId]);

  useEffect(() => { fetchList(); }, [fetchList]);

  return (
    <div style={{ padding: '16px 20px' }}>
      {error && (
        <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#b91c1c', marginBottom: 10 }}>
          {error}
        </div>
      )}

      {loading && <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>Loading…</div>}

      {!loading && !error && entries && entries.length === 0 && (
        <div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, background: '#f8fafc', padding: '32px 16px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          No recorded activity yet.
        </div>
      )}

      {!loading && entries && entries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {entries.map(e => {
            const Icon = TYPE_ICON[e.type];
            const color = TYPE_COLOR[e.type];
            return (
              <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: `${color}1a`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={13} color={color} strokeWidth={2} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: '#374151' }}>{e.title}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{formatDateTime(e.createdAt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {unavailableTypes.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 11, color: '#cbd5e1', borderTop: '1px solid #f8fafc', paddingTop: 10 }}>
          Not tracked in this system yet: {unavailableTypes.map(t => t.replace('_', ' ')).join(', ')}.
        </div>
      )}
    </div>
  );
}
