// Notifications stats cards — GET /api/admin/notifications/stats. Same
// shared-Card-over-one-Metric-envelope pattern as CompetenciesStatsCards.

import { useEffect, useState, type ReactNode } from 'react';
import { Send, XCircle, Clock, Eye, MousePointerClick, CalendarClock, Zap, CheckCircle2, ArrowUp, ArrowDown } from 'lucide-react';
import { getNotificationsStats } from '../../services/notificationsApi';
import type { Metric, NotificationsStats } from '../../types/notifications';

interface CardMeta {
  key: keyof NotificationsStats;
  label: string;
  Icon: typeof Send;
  iconBg: string;
  iconColor: string;
  format: (value: number) => string;
}

const CARD_META: CardMeta[] = [
  { key: 'sentTotal',             label: 'Sent (this month)',   Icon: Send,               iconBg: '#eff6ff', iconColor: '#2563eb', format: v => v.toLocaleString() },
  { key: 'failedDeliveries',      label: 'Failed Deliveries',   Icon: XCircle,            iconBg: '#fef2f2', iconColor: '#dc2626', format: v => v.toLocaleString() },
  { key: 'pendingNotifications',  label: 'Pending',             Icon: Clock,              iconBg: '#fff7ed', iconColor: '#c2410c', format: v => v.toLocaleString() },
  { key: 'openRate',              label: 'Open Rate',           Icon: Eye,                iconBg: '#f0fdf4', iconColor: '#16a34a', format: v => `${v}%` },
  { key: 'clickRate',             label: 'Click Rate',          Icon: MousePointerClick,  iconBg: '#eef2ff', iconColor: '#4338ca', format: v => `${v}%` },
  { key: 'scheduledCampaigns',    label: 'Scheduled Campaigns', Icon: CalendarClock,      iconBg: '#fefce8', iconColor: '#a16207', format: v => v.toLocaleString() },
  { key: 'activeAutomations',     label: 'Active Automations',  Icon: Zap,                iconBg: '#f0fdfa', iconColor: '#0f766e', format: v => v.toLocaleString() },
  { key: 'deliverySuccessRate',   label: 'Delivery Success',    Icon: CheckCircle2,       iconBg: '#f0fdf4', iconColor: '#16a34a', format: v => `${v}%` },
];

function Trend({ metric }: { metric: Metric }) {
  if (!metric.available) {
    return metric.reason ? <span style={{ color: '#9ca3af', fontSize: 11 }} title={metric.reason}>{metric.reason}</span> : null;
  }
  if (metric.changePercent === null) return null;
  const isNegative = metric.changePercent < 0;
  const Arrow = isNegative ? ArrowDown : ArrowUp;
  const color = isNegative ? '#dc2626' : '#16a34a';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12 }}>
      <Arrow size={12} color={color} strokeWidth={2.5} />
      <span style={{ color, fontWeight: 600 }}>{Math.abs(metric.changePercent)}%</span>
      <span style={{ color: '#9ca3af' }}>vs last month</span>
    </span>
  );
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
      <div style={{ width: 40, height: 40, borderRadius: 10, background: '#f0f0f0', animation: 'nc-pulse 1.4s ease-in-out infinite' }} />
      <div style={{ marginTop: 12, width: 90, height: 10, borderRadius: 3, background: '#f0f0f0', animation: 'nc-pulse 1.4s ease-in-out infinite' }} />
      <div style={{ marginTop: 8, width: 50, height: 22, borderRadius: 4, background: '#f0f0f0', animation: 'nc-pulse 1.4s ease-in-out infinite' }} />
      <div style={{ marginTop: 8, width: 70, height: 10, borderRadius: 3, background: '#f0f0f0', animation: 'nc-pulse 1.4s ease-in-out infinite' }} />
    </div>
  );
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`@keyframes nc-pulse { 0%,100%{opacity:1} 50%{opacity:.45} }`}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {children}
      </div>
    </>
  );
}

export default function NotificationsStatsCards({ refreshSignal }: { refreshSignal?: number }) {
  const [stats, setStats] = useState<NotificationsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    function fetchStats() {
      setLoading(true);
      setError(null);
      getNotificationsStats()
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
