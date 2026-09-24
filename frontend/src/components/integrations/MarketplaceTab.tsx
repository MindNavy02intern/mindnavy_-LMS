import { useEffect, useState } from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { listIntegrations } from '../../services/integrationsApi';
import type { Integration } from '../../types/integrations';
import { CARD_PAD, CARD_TITLE, EMPTY, BTN_SECONDARY, CategoryBadge, CATEGORY_LABELS } from './shared';

interface Props { showToast: (type: 'success' | 'error', message: string) => void; refreshSignal: number; onNavigate: (tab: string) => void }

export default function MarketplaceTab({ showToast, refreshSignal, onNavigate }: Props) {
  const [items, setItems] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listIntegrations()
      .then(rows => { if (!cancelled) setItems(rows); })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshSignal]);

  const groups = items.reduce<Record<string, Integration[]>>((acc, i) => {
    (acc[i.category] ??= []).push(i);
    return acc;
  }, {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '10px 14px' }}>
        <Sparkles size={15} strokeWidth={2} />
        More integrations shipping regularly.
      </div>

      {loading ? <div style={EMPTY}>Loading…</div> : Object.entries(groups).map(([category, rows]) => (
        <div key={category}>
          <h3 style={CARD_TITLE}>{CATEGORY_LABELS[category] ?? category}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {rows.map(i => (
              <div key={i.id} style={CARD_PAD}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                    {i.name.charAt(0)}
                  </div>
                  <CategoryBadge category={i.category} />
                </div>
                <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{i.name}</div>
                {i.hasProvider ? (
                  <button type="button" disabled style={{ ...BTN_SECONDARY, width: '100%', marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#16a34a', cursor: 'default' }}>
                    <CheckCircle2 size={13} strokeWidth={2} />
                    {i.status === 'CONNECTED' ? 'Installed' : 'Available'}
                  </button>
                ) : (
                  <button type="button" style={{ ...BTN_SECONDARY, width: '100%', marginTop: 12 }}
                    onClick={() => showToast('success', "We'll notify you when this integration ships.")}>
                    Coming Soon
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <button type="button" style={{ ...BTN_SECONDARY, alignSelf: 'flex-start' }} onClick={() => onNavigate('all')}>
        Browse full catalog →
      </button>
    </div>
  );
}
