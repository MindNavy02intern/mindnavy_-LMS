// Payment Gateways tab (?tab=gateways) — blueprint 09 §12. Static — no
// gateway.connect/.configure/.testMode endpoints exist in v1 (no real
// payment gateway yet, per the module's own scope). Buttons are disabled on
// purpose, not a loading/broken state.

import { CreditCard, Wallet, Info } from 'lucide-react';

const GATEWAYS = [
  { key: 'stripe', name: 'Stripe', Icon: CreditCard, color: '#635bff' },
  { key: 'paypal', name: 'PayPal', Icon: Wallet, color: '#003087' },
];

export default function PaymentGatewaysTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>
        <Info size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 13, color: '#1e40af' }}>Payment gateway integration ships in a future release. Connect buttons are disabled until then.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        {GATEWAYS.map(g => (
          <div key={g.key} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${g.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <g.Icon size={20} color={g.color} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{g.name}</div>
                <span style={{ display: 'inline-block', marginTop: 3, padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: '#f1f5f9', color: '#64748b' }}>Not Connected</span>
              </div>
            </div>
            <button
              type="button" disabled title="Coming soon — Stripe integration"
              style={{ marginTop: 16, width: '100%', padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#f1f5f9', color: '#94a3b8', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'not-allowed' }}
            >
              Connect {g.name}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
