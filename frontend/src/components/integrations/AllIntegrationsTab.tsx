import { useEffect, useMemo, useState } from 'react';
import { Search, Link2, Link2Off } from 'lucide-react';
import { listIntegrations, connectIntegration, disconnectIntegration } from '../../services/integrationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { Integration, IntegrationCategory, IntegrationStatus } from '../../types/integrations';
import { CARD_PAD, EMPTY, INPUT, BTN_SECONDARY, StatusBadge, CategoryBadge, CATEGORY_LABELS } from './shared';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
  onBumpRefresh: () => void;
}

const DESCRIPTIONS: Record<string, string> = {
  zoom:            'Real-time video meetings for Live Sessions.',
  supabase:        'Object storage for uploads, content, and documents.',
  'smtp-email':     'Transactional email for OTP codes and notifications.',
  stripe:          'Card payments and subscription billing.',
  paypal:          'PayPal checkout and payouts.',
  twilio:          'SMS notifications and OTP delivery.',
  sendgrid:        'Transactional and marketing email delivery.',
  'google-oauth':   'Sign in with Google (OAuth 2.0).',
  'microsoft-azure': 'Sign in with Microsoft Azure AD.',
  okta:            'Enterprise SSO via Okta.',
  salesforce:      'Sync leads and contacts with Salesforce.',
  hubspot:         'Sync leads and contacts with HubSpot.',
  sap:             'Sync employees and departments from SAP HR.',
  bamboohr:        'Sync employees and departments from BambooHR.',
  'aws-s3':         'Alternate object storage backend.',
  'google-drive':   'Sync documents with Google Drive.',
};

const CATEGORIES: IntegrationCategory[] = ['PAYMENT', 'VIDEO', 'EMAIL', 'SMS', 'HR_ERP', 'CRM', 'STORAGE', 'AUTH', 'OTHER'];
const STATUSES: IntegrationStatus[] = ['CONNECTED', 'DISCONNECTED', 'ERROR', 'PENDING', 'COMING_SOON'];

function IntegrationCard({ item, showToast, onBumpRefresh }: { item: Integration; showToast: Props['showToast']; onBumpRefresh: () => void }) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      const result = item.status === 'CONNECTED' ? await disconnectIntegration(item.slug) : await connectIntegration(item.slug);
      showToast(result.success ? 'success' : 'error', result.message);
      if (result.success) {
        invalidateFor(appQueryClient, item.status === 'CONNECTED' ? 'integration.disconnect' : 'integration.connect');
        onBumpRefresh();
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={CARD_PAD}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
          {item.name.charAt(0)}
        </div>
        <StatusBadge status={item.status} />
      </div>
      <div style={{ marginTop: 12, fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>{item.name}</div>
      <div style={{ marginTop: 2 }}><CategoryBadge category={item.category} /></div>
      <div style={{ marginTop: 8, fontSize: 12.5, color: '#64748b', lineHeight: 1.5, minHeight: 36 }}>{DESCRIPTIONS[item.slug] ?? `${CATEGORY_LABELS[item.category]} integration.`}</div>
      <button
        type="button"
        disabled={busy || !item.hasProvider}
        onClick={handleClick}
        style={{ ...BTN_SECONDARY, width: '100%', marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: (busy || !item.hasProvider) ? 0.55 : 1 }}
      >
        {item.status === 'CONNECTED' ? <Link2Off size={13} strokeWidth={2} /> : <Link2 size={13} strokeWidth={2} />}
        {!item.hasProvider ? 'Coming Soon' : item.status === 'CONNECTED' ? 'Disconnect' : 'Connect'}
      </button>
    </div>
  );
}

export default function AllIntegrationsTab({ showToast, refreshSignal, onBumpRefresh }: Props) {
  const [items, setItems] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<IntegrationCategory | ''>('');
  const [status, setStatus] = useState<IntegrationStatus | ''>('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listIntegrations()
      .then(rows => { if (!cancelled) setItems(rows); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshSignal]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(i =>
      (!q || i.name.toLowerCase().includes(q)) &&
      (!category || i.category === category) &&
      (!status || i.status === status),
    );
  }, [items, search, category, status]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }} />
          <input style={{ ...INPUT, width: '100%', paddingLeft: 30 }} placeholder="Search integrations…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select style={INPUT} value={category} onChange={e => setCategory(e.target.value as IntegrationCategory | '')}>
          <option value="">All categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <select style={INPUT} value={status} onChange={e => setStatus(e.target.value as IntegrationStatus | '')}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s === 'COMING_SOON' ? 'Coming Soon' : s}</option>)}
        </select>
      </div>

      {loading ? <div style={EMPTY}>Loading…</div> : filtered.length === 0 ? (
        <div style={EMPTY}>No integrations match your filters</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {filtered.map(i => <IntegrationCard key={i.id} item={i} showToast={showToast} onBumpRefresh={onBumpRefresh} />)}
        </div>
      )}
    </div>
  );
}
