import { useEffect, useState } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { listIntegrations } from '../../services/integrationsApi';
import type { Integration } from '../../types/integrations';
import { CARD, CARD_PAD, CARD_TITLE, EMPTY, BTN_SECONDARY, StatusBadge } from './shared';

interface Props { showToast: (type: 'success' | 'error', message: string) => void; refreshSignal: number }

const ENV_KEYS: Record<string, string[]> = {
  'google-oauth':    ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_URI'],
  'microsoft-azure': ['AZURE_AD_TENANT_ID', 'AZURE_AD_CLIENT_ID', 'AZURE_AD_CLIENT_SECRET'],
  okta:              ['OKTA_DOMAIN', 'OKTA_CLIENT_ID', 'OKTA_CLIENT_SECRET'],
};

function SsoFlowDiagram() {
  const steps = ['User', 'MindNavy', 'Identity Provider', 'Token', 'Session'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 0', flexWrap: 'wrap' }}>
      {steps.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 999, background: '#f1f5f9', color: '#475569', whiteSpace: 'nowrap' }}>{s}</span>
          {i < steps.length - 1 && <ArrowRight size={12} color="#cbd5e1" strokeWidth={2} />}
        </div>
      ))}
    </div>
  );
}

function ConfigureModal({ item, onClose }: { item: Integration; onClose: () => void }) {
  const keys = ENV_KEYS[item.slug] ?? [];
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div style={{ position: 'relative', background: '#fff', borderRadius: 12, width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>Configure {item.name}</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}><X size={16} /></button>
        </div>
        <div style={{ padding: 20, fontSize: 13, color: '#374151' }}>
          <p style={{ margin: '0 0 12px' }}>To activate {item.name} SSO, add these to <code>backend/.env</code>:</p>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {keys.map(k => <li key={k}><code style={{ fontSize: 12, background: '#f1f5f9', padding: '2px 6px', borderRadius: 4 }}>{k}</code></li>)}
          </ul>
          <p style={{ margin: '14px 0 0', fontSize: 12, color: '#94a3b8' }}>Restart the backend after adding credentials, then Connect will become available.</p>
        </div>
      </div>
    </div>
  );
}

export default function AuthSsoTab({ refreshSignal }: Props) {
  const [items, setItems] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [configuring, setConfiguring] = useState<Integration | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listIntegrations()
      .then(rows => { if (!cancelled) setItems(rows.filter(r => r.category === 'AUTH')); })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshSignal]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h3 style={CARD_TITLE}>Authentication & SSO</h3>
      {loading ? <div style={EMPTY}>Loading…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {items.map(i => (
            <div key={i.id} style={CARD_PAD}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>{i.name}</div>
                <StatusBadge status={i.status} />
              </div>
              <SsoFlowDiagram />
              <button type="button" style={{ ...BTN_SECONDARY, width: '100%', marginTop: 6 }} onClick={() => setConfiguring(i)}>
                Configure
              </button>
            </div>
          ))}
        </div>
      )}
      {items.length === 0 && !loading && <div style={{ ...CARD, ...EMPTY }}>No auth providers in the catalog yet</div>}
      {configuring && <ConfigureModal item={configuring} onClose={() => setConfiguring(null)} />}
    </div>
  );
}
