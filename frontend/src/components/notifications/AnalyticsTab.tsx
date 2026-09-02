import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { Eye, MousePointerClick } from 'lucide-react';
import { getNotificationsAnalytics, getNotificationsStats } from '../../services/notificationsApi';
import type { NotificationsAnalytics, NotificationsStats } from '../../types/notifications';
import { CARD_PAD, EMPTY, fmtDate } from './shared';

const CHANNEL_COLORS: Record<string, string> = { EMAIL: '#2563eb', PUSH: '#7c3aed', SMS: '#f59e0b', IN_APP: '#16a34a' };

const CARD_TITLE: React.CSSProperties = { margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#0f172a' };

export default function AnalyticsTab({ refreshSignal }: { refreshSignal: number }) {
  const [analytics, setAnalytics] = useState<NotificationsAnalytics | null>(null);
  const [stats, setStats] = useState<NotificationsStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getNotificationsAnalytics(), getNotificationsStats()])
      .then(([a, s]) => { if (!cancelled) { setAnalytics(a); setStats(s); } })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshSignal]);

  if (loading && !analytics) return <div style={EMPTY}>Loading analytics…</div>;

  const trendRows = (analytics?.deliveryTrend.labels ?? []).map((label, i) => ({
    label: label.slice(5), sent: analytics?.deliveryTrend.sent[i] ?? 0, failed: analytics?.deliveryTrend.failed[i] ?? 0,
  }));
  const channelItems = analytics?.channelBreakdown.items ?? [];
  const automationItems = analytics?.automationPerformance.items ?? [];
  const topCampaigns = analytics?.topCampaigns.items ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={CARD_PAD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Eye size={16} color="#94a3b8" />
            <h3 style={{ ...CARD_TITLE, margin: 0 }}>Open Rate</h3>
          </div>
          {stats?.openRate.available ? (
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginTop: 6 }}>{stats.openRate.value}%</div>
          ) : (
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>{stats?.openRate.reason ?? 'Not available yet'}</div>
          )}
        </div>
        <div style={CARD_PAD}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <MousePointerClick size={16} color="#94a3b8" />
            <h3 style={{ ...CARD_TITLE, margin: 0 }}>Click Rate</h3>
          </div>
          {stats?.clickRate.available ? (
            <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginTop: 6 }}>{stats.clickRate.value}%</div>
          ) : (
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>{stats?.clickRate.reason ?? 'Not available yet'}</div>
          )}
        </div>
      </div>

      <div style={CARD_PAD}>
        <h3 style={CARD_TITLE}>Delivery Trend (Sent vs Failed)</h3>
        {trendRows.length === 0 ? <div style={EMPTY}>No delivery activity yet</div> : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={trendRows} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="sent" name="Sent" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="failed" name="Failed" stroke="#dc2626" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={CARD_PAD}>
          <h3 style={CARD_TITLE}>Channel Breakdown</h3>
          {channelItems.length === 0 ? <div style={EMPTY}>No notifications sent yet</div> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={channelItems} dataKey="count" nameKey="channel" cx="50%" cy="50%" innerRadius={45} outerRadius={75} strokeWidth={2} stroke="#fff">
                  {channelItems.map(c => <Cell key={c.channel} fill={CHANNEL_COLORS[c.channel] ?? '#94a3b8'} />)}
                </Pie>
                <Tooltip formatter={(value) => [(value as number).toLocaleString(), 'Logs']} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={CARD_PAD}>
          <h3 style={CARD_TITLE}>Automation Performance</h3>
          {!analytics?.automationPerformance.available ? (
            <div style={EMPTY}>{analytics?.automationPerformance.reason}</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={automationItems} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="sentCount" name="Sent" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div style={CARD_PAD}>
        <h3 style={CARD_TITLE}>Top Campaigns</h3>
        {!analytics?.topCampaigns.available ? (
          <div style={EMPTY}>{analytics?.topCampaigns.reason}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topCampaigns.map(c => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>{c.title}</span>
                <span style={{ color: '#64748b' }}>{c.sentCount} sent · {fmtDate(c.sentAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
