import { useEffect, useState } from 'react';
import { HardDrive, RefreshCw } from 'lucide-react';
import { listIntegrations, testIntegration } from '../../services/integrationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { Integration } from '../../types/integrations';
import { CARD_PAD, CARD_TITLE, EMPTY, BTN_SECONDARY, StatusBadge, ComingSoonCard, fmtDate } from './shared';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
  onBumpRefresh: () => void;
}

const DECORATIVE_STORAGE = [
  { name: 'AWS S3',       description: 'Use an S3 bucket as an alternate object storage backend.' },
  { name: 'Google Drive', description: 'Sync course materials and documents with Google Drive.' },
];

function SupabaseCard({ item, showToast, onBumpRefresh }: { item: Integration; showToast: Props['showToast']; onBumpRefresh: () => void }) {
  const [testing, setTesting] = useState(false);
  const [buckets, setBuckets] = useState<string[] | null>(null);

  async function handleTest() {
    setTesting(true);
    try {
      const result = await testIntegration(item.slug);
      showToast(result.success ? 'success' : 'error', result.message);
      const data = result.data as { buckets?: string[] } | undefined;
      if (data?.buckets) setBuckets(data.buckets);
      invalidateFor(appQueryClient, 'integration.testMode');
      onBumpRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Test failed.');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div style={CARD_PAD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <HardDrive size={19} strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Supabase Storage</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Uploads, content library, documents</div>
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <div style={{ marginTop: 16, fontSize: 12.5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: '#94a3b8' }}>Last checked</span>
          <span style={{ color: '#374151', fontWeight: 500 }}>{fmtDate(item.lastSyncAt)}</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Buckets</div>
        {buckets === null ? (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>Run "Test Connection" to list buckets.</div>
        ) : buckets.length === 0 ? (
          <div style={{ fontSize: 12, color: '#94a3b8' }}>No buckets found.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {buckets.map(b => (
              <span key={b} style={{ fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: '#f1f5f9', color: '#475569' }}>{b}</span>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <button type="button" disabled={testing} onClick={handleTest} style={{ ...BTN_SECONDARY, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: testing ? 0.6 : 1 }}>
          <RefreshCw size={13} strokeWidth={2} />
          {testing ? 'Testing…' : 'Test Connection'}
        </button>
      </div>
    </div>
  );
}

export default function StorageTab({ showToast, refreshSignal, onBumpRefresh }: Props) {
  const [supabase, setSupabase] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listIntegrations()
      .then(rows => { if (!cancelled) setSupabase(rows.find(r => r.slug === 'supabase') ?? null); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshSignal]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h3 style={CARD_TITLE}>Cloud Storage</h3>
      {loading ? <div style={EMPTY}>Loading…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {supabase && <SupabaseCard item={supabase} showToast={showToast} onBumpRefresh={onBumpRefresh} />}
          {DECORATIVE_STORAGE.map(p => (
            <ComingSoonCard key={p.name} name={p.name} description={p.description}
              onRequestAccess={() => showToast('success', "We'll notify you when this integration ships.")} />
          ))}
        </div>
      )}
    </div>
  );
}
