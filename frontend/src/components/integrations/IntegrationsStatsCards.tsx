// Integrations stats cards — GET /api/admin/integrations/stats. Same
// shared-Card-over-one-Metric-envelope pattern as NotificationsStatsCards.

import { useEffect, useState, type ReactNode } from 'react';
import { Plug, XCircle, Activity, Webhook as WebhookIcon, RefreshCw, HeartPulse } from 'lucide-react';
import { getIntegrationsStats } from '../../services/integrationsApi';
import type { IntegrationsStats, Metric } from '../../types/integrations';

interface CardMeta {
  key: keyof IntegrationsStats;
  label: string;
  Icon: typeof Plug;
  iconBg: string;
  iconColor: string;
  format: (value: number) => string;
}

const CARD_META: CardMeta[] = [
  { key: 'activeIntegrations', label: 'Active Integrations', Icon: Plug,       iconBg: '#eff6ff', iconColor: '#2563eb', format: v => v.toLocaleString() },
  { key: 'failedConnections',  label: 'Failed Connections',  Icon: XCircle,    iconBg: '#fef2f2', iconColor: '#dc2626', format: v => v.toLocaleString() },
  { key: 'apiUsageToday',      label: 'API Usage (Today)',   Icon: Activity,   iconBg: '#f0fdf4', iconColor: '#16a34a', format: v => v.toLocaleString() },
  { key: 'webhookActivity',    label: 'Webhook Activity',    Icon: WebhookIcon, iconBg: '#eef2ff', iconColor: '#4338ca', format: v => v.toLocaleString() },
  { key: 'syncStatus',         label: 'Syncs (Today)',        Icon: RefreshCw,  iconBg: '#fefce8', iconColor: '#a16207', format: v => v.toLocaleString() },
  { key: 'healthScore',        label: 'Health Score',         Icon: HeartPulse, iconBg: '#f0fdfa', iconColor: '#0f766e', format: v => `${v}%` },
];

function Trend({ metric }: { metric: Metric }) {
  if (!metric.available) {
    return metric.reason ? <span style={{ color: '#9ca3af', fontSize: 11 }} title={metric.reason}>{metric.reason}</span> : null;
  }
  return null;
}

function Card({ meta, metric }: { meta: CardMeta; metric: Metric }) {
  const { Icon, iconBg, iconColor, label, format } = meta;
  return (
    <div role="group" aria-label={`${label} stat card`} style={{
      background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)', minWidth: 0,
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={19} strokeWidth={2} />
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: '#64748b', fontWeight: 500 }}>{label}</div>
      <div style={{ marginTop: 2, fontSize: 24, fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
        {metric.available && metric.value !== null ? format(metric.value) : '—'}
      </div>
      <div style={{ marginTop: 8, minHeight: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <Trend metric={metric} />
      </div>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e5e7eb' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0f0f0', animation: 'ic-pulse 1.4s ease-in-out infinite' }} />
      <div style={{ marginTop: 12, width: 90, height: 10, borderRadius: 3, background: '#f0f0f0', animation: 'ic-pulse 1.4s ease-in-out infinite' }} />
      <div style={{ marginTop: 8, width: 50, height: 22, borderRadius: 4, background: '#f0f0f0', animation: 'ic-pulse 1.4s ease-in-out infinite' }} />
      <div style={{ marginTop: 8, width: 70, height: 10, borderRadius: 3, background: '#f0f0f0', animation: 'ic-pulse 1.4s ease-in-out infinite' }} />
    </div>
  );
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`@keyframes ic-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 14 }}>
        {children}
      </div>
    </>
  );
}

export default function IntegrationsStatsCards({ refreshSignal }: { refreshSignal?: number }) {
  const [stats, setStats] = useState<IntegrationsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    function fetchStats() {
      setLoading(true);
      setError(null);
      getIntegrationsStats()
        .then(data => { if (!cancelled) setStats(data); })
        .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load stats'); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    fetchStats();
    window.addEventListener('analyticsUpdated', fetchStats);
    return () => { cancelled = true; window.removeEventListener('analyticsUpdated', fetchStats); };
  }, [refreshSignal]);

  if (error) {
    return (
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#b91c1c' }}>
        {error}
      </div>
    );
  }

  if (loading || !stats) {
    return <Wrapper>{CARD_META.map(m => <CardSkeleton key={m.key} />)}</Wrapper>;
  }

  return <Wrapper>{CARD_META.map(meta => <Card key={meta.key} meta={meta} metric={stats[meta.key]} />)}</Wrapper>;
}
