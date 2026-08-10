import { useEffect, useState } from 'react';
import { listIntegrations } from '../../services/integrationsApi';
import type { Integration } from '../../types/integrations';
import { CARD_TITLE, EMPTY, ComingSoonCard } from './shared';

interface Props { showToast: (type: 'success' | 'error', message: string) => void; refreshSignal: number }

const DESCRIPTIONS: Record<string, string> = {
  salesforce: 'Sync leads and contacts with Salesforce CRM.',
  hubspot:    'Sync leads and contacts with HubSpot.',
};

// Decorative — no backend catalog row (see Video tab note).
const DECORATIVE = [{ name: 'Zoho CRM', description: 'Sync leads and contacts with Zoho CRM.' }];

export default function CrmTab({ showToast, refreshSignal }: Props) {
  const [items, setItems] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listIntegrations()
      .then(rows => { if (!cancelled) setItems(rows.filter(r => r.category === 'CRM')); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshSignal]);

  const requestAccess = () => showToast('success', "We'll notify you when this integration ships.");

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h3 style={CARD_TITLE}>CRM Systems</h3>
      {loading ? <div style={EMPTY}>Loading…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {items.map(i => <ComingSoonCard key={i.id} name={i.name} description={DESCRIPTIONS[i.slug] ?? 'CRM sync.'} onRequestAccess={requestAccess} />)}
          {DECORATIVE.map(p => <ComingSoonCard key={p.name} name={p.name} description={p.description} onRequestAccess={requestAccess} />)}
        </div>
      )}
    </div>
  );
}
