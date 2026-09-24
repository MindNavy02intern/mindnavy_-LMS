// Finance dashboard KPI cards — GET /api/admin/finance/stats. 8 cards, 2 rows
// of 4. Same shared-Card-over-one-Metric pattern as CompetenciesStatsCards.

import { useEffect, useState } from 'react';
import {
  DollarSign, TrendingUp, Users, Clock, AlertTriangle, RotateCcw, Wallet, LineChart,
  ArrowUp, ArrowDown,
} from 'lucide-react';
import { getFinanceStats } from '../../services/financeApi';
import type { FinanceStats, Metric, SimpleMetric } from '../../types/finance';
import { money } from './_shared';

interface CardDef {
  key: keyof FinanceStats;
  label: string;
  Icon: typeof DollarSign;
  iconBg: string;
  iconColor: string;
  format: (v: number) => string;
  hasChange: boolean;
}

const CARDS: CardDef[] = [
  { key: 'totalRevenue',        label: 'Total Revenue',        Icon: DollarSign,    iconBg: '#f0fdf4', iconColor: '#16a34a', format: v => money(v), hasChange: true },
  { key: 'monthlyRevenue',      label: 'Monthly Revenue',      Icon: TrendingUp,    iconBg: '#eff6ff', iconColor: '#2563eb', format: v => money(v), hasChange: true },
  { key: 'activeSubscriptions', label: 'Active Subscriptions', Icon: Users,         iconBg: '#eef2ff', iconColor: '#4338ca', format: v => v.toLocaleString(), hasChange: false },
  { key: 'pendingPayments',     label: 'Pending Payments',     Icon: Clock,         iconBg: '#fffbeb', iconColor: '#d97706', format: v => v.toLocaleString(), hasChange: false },
  { key: 'failedTransactions',  label: 'Failed Transactions',  Icon: AlertTriangle, iconBg: '#fef2f2', iconColor: '#dc2626', format: v => v.toLocaleString(), hasChange: false },
  { key: 'refundRequests',      label: 'Refund Requests',      Icon: RotateCcw,     iconBg: '#fdf2f8', iconColor: '#db2777', format: v => v.toLocaleString(), hasChange: false },
  { key: 'instructorPayouts',   label: 'Instructor Payouts',   Icon: Wallet,        iconBg: '#f0fdfa', iconColor: '#0f766e', format: v => money(v), hasChange: false },
  { key: 'revenueGrowth',       label: 'Revenue Growth',       Icon: LineChart,     iconBg: '#f5f3ff', iconColor: '#7c3aed', format: v => `${v}%`, hasChange: false },
];

function ChangeLine({ metric }: { metric: Metric | SimpleMetric }) {
  const changePercent = 'changePercent' in metric ? metric.changePercent : null;
  if (!metric.available) return metric.reason ? <span style={{ color: '#9ca3af', fontSize: 11 }}>{metric.reason}</span> : null;
  if (changePercent === null) return null;
  const isNegative = changePercent < 0;
  const Arrow = isNegative ? ArrowDown : ArrowUp;
  const color = isNegative ? '#dc2626' : '#16a34a';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12 }}>
      <Arrow size={12} color={color} strokeWidth={2.5} />
      <span style={{ color, fontWeight: 600 }}>{Math.abs(changePercent)}%</span>
      <span style={{ color: '#9ca3af' }}>vs last month</span>
    </span>
  );
}

function Card({ def, metric }: { def: CardDef; metric: Metric | SimpleMetric }) {
  const { Icon, iconBg, iconColor, label, format } = def;
  return (
    <div role="group" aria-label={`${label} stat card`} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', minWidth: 0 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={19} strokeWidth={2} />
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: '#64748b', fontWeight: 500 }}>{label}</div>
      <div style={{ marginTop: 2, fontSize: 22, fontWeight: 700, color: '#0f172a', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {metric.available && metric.value !== null ? format(metric.value) : '—'}
      </div>
      <div style={{ marginTop: 8, minHeight: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <ChangeLine metric={metric} />
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0f0f0' }} />
      <div style={{ marginTop: 12, width: 90, height: 10, borderRadius: 3, background: '#f0f0f0' }} />
      <div style={{ marginTop: 8, width: 60, height: 20, borderRadius: 4, background: '#f0f0f0' }} />
      <div style={{ marginTop: 8, width: 70, height: 10, borderRadius: 3, background: '#f0f0f0' }} />
    </div>
  );
}

export default function FinanceStatsCards({ refreshSignal }: { refreshSignal: number }) {
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    function fetchStats() {
      setLoading(true);
      setError(null);
      getFinanceStats()
        .then(data => { if (!cancelled) setStats(data); })
        .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load finance stats'); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    fetchStats();
    window.addEventListener('financeUpdated', fetchStats);
    return () => { cancelled = true; window.removeEventListener('financeUpdated', fetchStats); };
  }, [refreshSignal]);

  if (error) return <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#b91c1c' }}>{error}</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
      {CARDS.map(def => (
        loading || !stats ? <CardSkeleton key={def.key} /> : <Card key={def.key} def={def} metric={stats[def.key]} />
      ))}
    </div>
  );
}
