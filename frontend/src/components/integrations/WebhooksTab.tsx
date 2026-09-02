import { useEffect, useState } from 'react';
import { Pause, Play, Zap, Trash2, X, Pencil } from 'lucide-react';
import { listWebhooks, pauseWebhook, resumeWebhook, testWebhook, deleteWebhook } from '../../services/integrationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { Webhook, WebhookTestResult } from '../../types/integrations';
import { CARD, EMPTY, TH, TD, BTN_SECONDARY, WebhookStatusBadge, fmtDate } from './shared';
import CreateWebhookModal from './CreateWebhookModal';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
  onBumpRefresh: () => void;
  onCreate: () => void;
}

function TestResultModal({ result, onClose }: { result: WebhookTestResult; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: result.success ? '#16a34a' : '#dc2626' }}>{result.success ? 'Test Succeeded' : 'Test Failed'}</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={16} /></button>
        </div>
        <div style={{ padding: 20, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ color: '#374151' }}>{result.message}</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div><span style={{ color: '#94a3b8' }}>Response code:</span> <strong>{result.responseCode ?? '—'}</strong></div>
            <div><span style={{ color: '#94a3b8' }}>Duration:</span> <strong>{result.durationMs}ms</strong></div>
          </div>
          <div>
            <div style={{ color: '#94a3b8', marginBottom: 4 }}>Payload sent</div>
            <pre style={{ fontSize: 11, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10, overflowX: 'auto' }}>{JSON.stringify(result.payload, null, 2)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function WebhooksTab({ showToast, refreshSignal, onBumpRefresh, onCreate }: Props) {
  const [items, setItems] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResult, setTestResult] = useState<WebhookTestResult | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Webhook | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listWebhooks({ limit: 100 })
      .then(res => { if (!cancelled) setItems(res.items); })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshSignal]);

  async function handlePauseResume(w: Webhook) {
    try {
      await (w.status === 'PAUSED' ? resumeWebhook(w.id) : pauseWebhook(w.id));
      invalidateFor(appQueryClient, 'webhook.toggle');
      showToast('success', w.status === 'PAUSED' ? 'Webhook resumed.' : 'Webhook paused.');
      onBumpRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Action failed.');
    }
  }

  async function handleTest(id: string) {
    setTestingId(id);
    try {
      const result = await testWebhook(id);
      setTestResult(result);
      onBumpRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Test failed.');
    } finally {
      setTestingId(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteWebhook(id);
      invalidateFor(appQueryClient, 'webhook.delete');
      showToast('success', 'Webhook deleted.');
      onBumpRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" style={BTN_SECONDARY} onClick={onCreate}>+ Create Webhook</button>
      </div>

      <div style={{ ...CARD, overflow: 'hidden' }}>
        {loading ? <div style={EMPTY}>Loading…</div> : items.length === 0 ? (
          <div style={EMPTY}>No webhooks yet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={TH}>Name</th><th style={TH}>URL</th><th style={TH}>Events</th><th style={TH}>Status</th>
                <th style={TH}>Last Triggered</th><th style={TH}>Response</th><th style={TH}>Actions</th>
              </tr></thead>
              <tbody>
                {items.map(w => (
                  <tr key={w.id}>
                    <td style={{ ...TD, fontWeight: 600, color: '#0f172a' }}>{w.name}</td>
                    <td style={{ ...TD, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={w.url}>{w.url}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 180 }}>
                        {w.events.slice(0, 2).map(e => (
                          <span key={e} style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: '#f1f5f9', color: '#475569' }}>{e}</span>
                        ))}
                        {w.events.length > 2 && <span style={{ fontSize: 10.5, color: '#94a3b8' }}>+{w.events.length - 2}</span>}
                      </div>
                    </td>
                    <td style={TD}><WebhookStatusBadge status={w.status} /></td>
                    <td style={TD}>{fmtDate(w.lastTriggeredAt)}</td>
                    <td style={TD}>{w.lastResponseCode ?? '—'}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button type="button" onClick={() => setEditing(w)} style={{ background: 'none', border: 'none', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center' }} aria-label="Edit">
                          <Pencil size={14} />
                        </button>
                        <button type="button" onClick={() => handleTest(w.id)} disabled={testingId === w.id} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: testingId === w.id ? 0.5 : 1 }} aria-label="Test">
                          <Zap size={14} />
                        </button>
                        <button type="button" onClick={() => handlePauseResume(w)} style={{ background: 'none', border: 'none', color: '#c2410c', cursor: 'pointer', display: 'flex', alignItems: 'center' }} aria-label={w.status === 'PAUSED' ? 'Resume' : 'Pause'}>
                          {w.status === 'PAUSED' ? <Play size={14} /> : <Pause size={14} />}
                        </button>
                        <button type="button" onClick={() => handleDelete(w.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center' }} aria-label="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {testResult && <TestResultModal result={testResult} onClose={() => setTestResult(null)} />}
      {editing && (
        <CreateWebhookModal
          mode="edit"
          webhook={editing}
          onClose={() => setEditing(null)}
          onSuccess={() => { setEditing(null); onBumpRefresh(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
