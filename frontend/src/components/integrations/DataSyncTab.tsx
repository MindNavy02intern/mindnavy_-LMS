import { useEffect, useState } from 'react';
import { RotateCcw, PlayCircle } from 'lucide-react';
import { listSyncs, listIntegrations, triggerSync } from '../../services/integrationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { SYNC_TYPES } from '../../types/integrations';
import type { DataSync, Integration, SyncType } from '../../types/integrations';
import { CARD, CARD_PAD, EMPTY, INPUT, BTN_PRIMARY, BTN_SECONDARY, SyncStatusBadge, fmtDate } from './shared';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
  onBumpRefresh: () => void;
}

function ProgressBar({ processed, total }: { processed: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  return (
    <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: '#2563eb', transition: 'width 0.3s ease' }} />
    </div>
  );
}

export default function DataSyncTab({ showToast, refreshSignal, onBumpRefresh }: Props) {
  const [syncs, setSyncs] = useState<DataSync[]>([]);
  const [connected, setConnected] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [targetSlug, setTargetSlug] = useState('');
  const [syncType, setSyncType] = useState<SyncType>('users');
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([listSyncs({ limit: 50 }), listIntegrations()])
      .then(([res, ints]) => {
        if (cancelled) return;
        setSyncs(res.items);
        const conn = ints.filter(i => i.status === 'CONNECTED');
        setConnected(conn);
        if (conn.length > 0 && !targetSlug) setTargetSlug(conn[0].slug);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  async function handleTrigger(slug: string, type: SyncType) {
    if (!slug) return;
    setTriggering(true);
    try {
      const result = await triggerSync(slug, type);
      showToast(result.success ? 'success' : 'error', result.message);
      // Even a "no sync target configured" failure writes a real DataSync
      // row (status FAILED) — refresh either way so the history list stays
      // truthful instead of only updating on success.
      invalidateFor(appQueryClient, 'sync.run');
      onBumpRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Sync failed to start.');
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={CARD_PAD}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Force Sync</div>
        {connected.length === 0 ? (
          <div style={{ fontSize: 12.5, color: '#94a3b8' }}>No connected integrations to sync yet.</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <select style={INPUT} value={targetSlug} onChange={e => setTargetSlug(e.target.value)}>
              {connected.map(i => <option key={i.slug} value={i.slug}>{i.name}</option>)}
            </select>
            <select style={INPUT} value={syncType} onChange={e => setSyncType(e.target.value as SyncType)}>
              {SYNC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button type="button" disabled={triggering} style={{ ...BTN_PRIMARY, display: 'flex', alignItems: 'center', gap: 6, opacity: triggering ? 0.6 : 1 }} onClick={() => handleTrigger(targetSlug, syncType)}>
              <PlayCircle size={14} strokeWidth={2} />
              {triggering ? 'Starting…' : 'Force Sync'}
            </button>
          </div>
        )}
      </div>

      <div style={{ ...CARD, overflow: 'hidden' }}>
        {loading ? <div style={EMPTY}>Loading…</div> : syncs.length === 0 ? (
          <div style={EMPTY}>No sync jobs yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {syncs.map(s => (
              <div key={s.id} style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{s.integrationName ?? 'Unknown'}</span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}> · {s.syncType}</span>
                  </div>
                  <SyncStatusBadge status={s.status} />
                </div>
                <ProgressBar processed={s.processedRecords} total={s.totalRecords} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11.5, color: '#94a3b8' }}>
                  <span>{s.processedRecords} / {s.totalRecords} records</span>
                  <span>Started {fmtDate(s.startedAt)}{s.completedAt ? ` · Completed ${fmtDate(s.completedAt)}` : ''}</span>
                </div>
                {s.status === 'FAILED' && (
                  <button type="button" style={{ ...BTN_SECONDARY, marginTop: 8, padding: '5px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
                    onClick={() => {
                      const target = connected.find(i => i.id === s.integrationId);
                      if (target) handleTrigger(target.slug, s.syncType as SyncType);
                      else showToast('error', 'Integration must be connected to retry.');
                    }}>
                    <RotateCcw size={12} strokeWidth={2} />
                    Retry
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
