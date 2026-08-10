// Learner Tickets tab (side panel → More) — GET .../tickets (Part 7).
// List + respond/resolve/escalate. NO create action — there is no
// learner-facing app in this system to raise a ticket from (see the backend
// validator's header note); an empty list here is real, not broken.

import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, CheckCircle, ArrowUpCircle } from 'lucide-react';
import { listLearnerTickets, respondToLearnerTicket, resolveLearnerTicket, escalateLearnerTicket } from '../../services/learnersApi';
import { LearnerApiError } from '../../types/learners';
import type { LearnerTicket } from '../../types/learners';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  learnerId: string;
  showToast: (type: 'success' | 'error', message: string) => void;
}

const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  OPEN:        { bg: '#dbeafe', fg: '#1d4ed8' },
  IN_PROGRESS: { bg: '#fef9c3', fg: '#a16207' },
  RESOLVED:    { bg: '#dcfce7', fg: '#15803d' },
  ESCALATED:   { bg: '#fee2e2', fg: '#b91c1c' },
  CLOSED:      { bg: '#f1f5f9', fg: '#64748b' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const ICON_BTN: React.CSSProperties = { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' };
const TA: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151', fontFamily: 'inherit', outline: 'none', resize: 'vertical' as const };

export default function LearnerTicketsTab({ learnerId, showToast }: Props) {
  const [tickets, setTickets] = useState<LearnerTicket[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [respondTarget, setRespondTarget] = useState<LearnerTicket | null>(null);
  const [respondBody, setRespondBody] = useState('');
  const [respondErr, setRespondErr] = useState<string | null>(null);
  const [respondBusy, setRespondBusy] = useState(false);

  const fetchList = useCallback(() => {
    setLoading(true);
    setListError(null);
    listLearnerTickets(learnerId, { limit: 50 })
      .then(res => setTickets(res.tickets))
      .catch(err => setListError(err instanceof LearnerApiError ? err.message : 'Failed to load tickets.'))
      .finally(() => setLoading(false));
  }, [learnerId]);

  useEffect(() => { fetchList(); }, [fetchList]);

  function openRespond(t: LearnerTicket) {
    setRespondTarget(t);
    setRespondBody('');
    setRespondErr(null);
  }

  async function submitRespond() {
    if (!respondTarget) return;
    if (!respondBody.trim()) { setRespondErr('Response cannot be empty.'); return; }
    setRespondBusy(true);
    try {
      await respondToLearnerTicket(learnerId, respondTarget.id, respondBody.trim());
      invalidateFor(appQueryClient, 'ticket.respond');
      showToast('success', 'Response sent.');
      setRespondTarget(null);
      fetchList();
    } catch (err) {
      showToast('error', err instanceof LearnerApiError ? err.message : 'Response failed.');
    } finally {
      setRespondBusy(false);
    }
  }

  async function handleResolve(t: LearnerTicket) {
    if (!window.confirm(`Mark "${t.subject}" as resolved?`)) return;
    setBusyId(t.id);
    try {
      await resolveLearnerTicket(learnerId, t.id);
      invalidateFor(appQueryClient, 'ticket.resolve');
      showToast('success', 'Ticket resolved.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof LearnerApiError ? err.message : 'Resolve failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleEscalate(t: LearnerTicket) {
    if (!window.confirm(`Escalate "${t.subject}"?`)) return;
    setBusyId(t.id);
    try {
      await escalateLearnerTicket(learnerId, t.id);
      invalidateFor(appQueryClient, 'ticket.escalate');
      showToast('success', 'Ticket escalated.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof LearnerApiError ? err.message : 'Escalate failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {listError && <div style={{ fontSize: 12, color: '#b91c1c', marginBottom: 10 }}>{listError}</div>}
      {loading && <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>Loading…</div>}

      {!loading && !listError && tickets && tickets.length === 0 && (
        <div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, background: '#f8fafc', padding: '24px 16px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          No support tickets on file.
        </div>
      )}

      {!loading && tickets && tickets.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tickets.map(t => {
            const busy = busyId === t.id;
            const badge = STATUS_BADGE[t.status] ?? STATUS_BADGE.OPEN;
            const closed = t.status === 'RESOLVED' || t.status === 'CLOSED';
            return (
              <div key={t.id} style={{ border: '1px solid #f1f5f9', borderRadius: 8, padding: '10px 12px', opacity: busy ? 0.5 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.subject}>{t.subject}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{formatDate(t.createdAt)} · {t.messageCount} message{t.messageCount === 1 ? '' : 's'}</div>
                  </div>
                  <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.fg, flexShrink: 0 }}>
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
                {!closed && (
                  <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                    <button type="button" title="Respond" aria-label={`Respond to ${t.subject}`} disabled={busy} onClick={() => openRespond(t)} style={ICON_BTN}>
                      <MessageSquare size={12} color="#2563eb" strokeWidth={2} />
                    </button>
                    <button type="button" title="Resolve" aria-label={`Resolve ${t.subject}`} disabled={busy} onClick={() => handleResolve(t)} style={ICON_BTN}>
                      <CheckCircle size={12} color="#16a34a" strokeWidth={2} />
                    </button>
                    {t.status !== 'ESCALATED' && (
                      <button type="button" title="Escalate" aria-label={`Escalate ${t.subject}`} disabled={busy} onClick={() => handleEscalate(t)} style={ICON_BTN}>
                        <ArrowUpCircle size={12} color="#dc2626" strokeWidth={2} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {respondTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!respondBusy ? () => setRespondTarget(null) : undefined} />
          <div role="dialog" aria-label="Respond to Ticket" style={{ position: 'relative', width: '100%', maxWidth: 380, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Respond</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>{respondTarget.subject}</p>
            </div>
            <div style={{ padding: '14px 18px' }}>
              <textarea
                aria-label="Response"
                value={respondBody}
                onChange={e => { setRespondBody(e.target.value); setRespondErr(null); }}
                placeholder="Your response…"
                rows={4}
                autoFocus
                style={TA}
              />
              {respondErr && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{respondErr}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #f1f5f9' }}>
              <button type="button" onClick={() => setRespondTarget(null)} disabled={respondBusy} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
                Cancel
              </button>
              <button type="button" onClick={submitRespond} disabled={respondBusy} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, background: respondBusy ? '#9ca3af' : '#2563eb', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#fff' }}>
                {respondBusy ? 'Sending…' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
