import { useEffect, useState } from 'react';
import { getFinanceStats } from '../../services/financeApi';
import type { FinanceStats } from '../../types/finance';
import { listIntegrations } from '../../services/integrationsApi';
import type { Integration } from '../../types/integrations';
import { CARD_PAD, CARD_TITLE, EMPTY, ComingSoonCard } from './shared';

interface Props { showToast: (type: 'success' | 'error', message: string) => void; refreshSignal: number }

function fmtMoney(v: number | null): string {
  return v === null ? '—' : `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function PaymentTab({ showToast, refreshSignal }: Props) {
  const [items, setItems] = useState<Integration[]>([]);
  const [finance, setFinance] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([listIntegrations(), getFinanceStats()])
      .then(([rows, stats]) => { if (!cancelled) { setItems(rows.filter(r => r.category === 'PAYMENT')); setFinance(stats); } })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshSignal]);

  const requestAccess = () => showToast('success', "We'll notify you when this integration ships.");

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={CARD_PAD}>
        <h3 style={CARD_TITLE}>Finance Module — Payment Stats (real data, not gateway-specific)</h3>
        {loading || !finance ? <div style={EMPTY}>Loading…</div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Total Revenue</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{finance.totalRevenue.available ? fmtMoney(finance.totalRevenue.value) : '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Pending Payments</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{finance.pendingPayments.available ? finance.pendingPayments.value : '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Failed Transactions</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#dc2626' }}>{finance.failedTransactions.available ? finance.failedTransactions.value : '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>Active Subscriptions</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{finance.activeSubscriptions.available ? finance.activeSubscriptions.value : '—'}</div>
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 style={CARD_TITLE}>Payment Gateways</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {items.map(i => (
            <ComingSoonCard key={i.id} name={i.name} description={`Coming soon — add ${i.slug.toUpperCase()}_SECRET_KEY to connect.`} onRequestAccess={requestAccess} />
          ))}
        </div>
      </div>
    </div>
  );
}
