import { useEffect, useState } from 'react';
import { Ban, Trash2 } from 'lucide-react';
import { listApiKeys, revokeApiKey, deleteApiKey } from '../../services/integrationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { ApiKey } from '../../types/integrations';
import { CARD, EMPTY, TH, TD, BTN_SECONDARY, ApiKeyStatusBadge, fmtDate, Pager } from './shared';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
  onBumpRefresh: () => void;
  onGenerate: () => void;
}

export default function ApiKeysTab({ showToast, refreshSignal, onBumpRefresh, onGenerate }: Props) {
  const [items, setItems] = useState<ApiKey[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listApiKeys({ page, limit })
      .then(res => { if (!cancelled) { setItems(res.items); setTotal(res.total); } })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, refreshSignal]);

  async function handleRevoke(id: string) {
    try {
      await revokeApiKey(id);
      invalidateFor(appQueryClient, 'apiKey.revoke');
      showToast('success', 'API key revoked.');
      onBumpRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Revoke failed.');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteApiKey(id);
      invalidateFor(appQueryClient, 'apiKey.revoke');
      showToast('success', 'API key deleted.');
      onBumpRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" style={BTN_SECONDARY} onClick={onGenerate}>+ Generate API Key</button>
      </div>

      <div style={{ ...CARD, overflow: 'hidden' }}>
        {loading ? <div style={EMPTY}>Loading…</div> : items.length === 0 ? (
          <div style={EMPTY}>No API keys yet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={TH}>Name</th><th style={TH}>Prefix</th><th style={TH}>Permissions</th>
                <th style={TH}>Status</th><th style={TH}>Last Used</th><th style={TH}>Expires</th><th style={TH}>Actions</th>
              </tr></thead>
              <tbody>
                {items.map(k => (
                  <tr key={k.id}>
                    <td style={{ ...TD, fontWeight: 600, color: '#0f172a' }}>{k.name}</td>
                    <td style={TD}><code style={{ fontSize: 11.5 }}>{k.keyPrefix}</code></td>
                    <td style={TD}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 220 }}>
                        {k.permissions.slice(0, 3).map(p => (
                          <span key={p} style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: '#f1f5f9', color: '#475569' }}>{p}</span>
                        ))}
                        {k.permissions.length > 3 && <span style={{ fontSize: 10.5, color: '#94a3b8' }}>+{k.permissions.length - 3}</span>}
                      </div>
                    </td>
                    <td style={TD}><ApiKeyStatusBadge status={k.status} /></td>
                    <td style={TD}>{fmtDate(k.lastUsedAt)}</td>
                    <td style={TD}>{k.expiresAt ? fmtDate(k.expiresAt) : 'Never'}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {k.status === 'ACTIVE' && (
                          <button type="button" onClick={() => handleRevoke(k.id)} style={{ background: 'none', border: 'none', color: '#c2410c', cursor: 'pointer', display: 'flex', alignItems: 'center' }} aria-label="Revoke">
                            <Ban size={14} />
                          </button>
                        )}
                        <button type="button" onClick={() => handleDelete(k.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', display: 'flex', alignItems: 'center' }} aria-label="Delete">
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
        <Pager page={page} limit={limit} total={total} onPage={setPage} />
      </div>
    </div>
  );
}
