import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import { Bell, Zap } from 'lucide-react';
import { getNotificationsAnalytics, listLogs, listAutomations } from '../../services/notificationsApi';
import type { NotificationsAnalytics, NotificationLogEntry, NotificationAutomation } from '../../types/notifications';

const CHANNEL_COLORS: Record<string, string> = { EMAIL: '#2563eb', PUSH: '#7c3aed', SMS: '#f59e0b', IN_APP: '#16a34a' };
const STATUS_COLORS: Record<string, string> = {
  SENT: '#16a34a', OPENED: '#2563eb', CLICKED: '#4338ca', PENDING: '#c2410c', FAILED: '#dc2626', BOUNCED: '#dc2626',
};

const CARD: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 18 };
const CARD_TITLE: React.CSSProperties = { margin: '0 0 14px', fontSize: 14, fontWeight: 700, color: '#0f172a' };
const EMPTY: React.CSSProperties = { fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '24px 0' };

function StatusBadge({ status }: { status: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
      background: `${STATUS_COLORS[status] ?? '#94a3b8'}1a`, color: STATUS_COLORS[status] ?? '#64748b',
    }}>
      {status}
    </span>
  );
}

interface Props {
  refreshSignal: number;
  onNavigate: (tab: 'logs' | 'automation') => void;
}

export default function DashboardTab({ refreshSignal, onNavigate }: Props) {
  const [analytics, setAnalytics] = useState<NotificationsAnalytics | null>(null);
  const [recentLogs, setRecentLogs] = useState<NotificationLogEntry[]>([]);
  const [activeAutomations, setActiveAutomations] = useState<NotificationAutomation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    function load() {
      setLoading(true);
      Promise.all([
        getNotificationsAnalytics(),
        listLogs({ limit: 8 }),
        listAutomations({ status: 'ACTIVE', limit: 5 }),
      ])
        .then(([a, logs, autos]) => {
          if (cancelled) return;
          setAnalytics(a);
          setRecentLogs(logs.items);
          setActiveAutomations(autos.items);
        })
        .catch(err => console.error(err))
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    load();
    window.addEventListener('notificationsUpdated', load);
    return () => { cancelled = true; window.removeEventListener('notificationsUpdated', load); };
  }, [refreshSignal]);

  if (loading && !analytics) {
    return <div style={EMPTY}>Loading dashboard…</div>;
  }

  const trendRows = (analytics?.deliveryTrend.labels ?? []).map((label, i) => ({
    label: label.slice(5),
    sent: analytics?.deliveryTrend.sent[i] ?? 0,
    failed: analytics?.deliveryTrend.failed[i] ?? 0,
  }));

  const channelItems = analytics?.channelBreakdown.items ?? [];
  const totalChannelCount = channelItems.reduce((sum, c) => sum + c.count, 0);
  const automationItems = analytics?.automationPerformance.items ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <div style={CARD}>
          <h3 style={CARD_TITLE}>Delivery Trend (Sent vs Failed)</h3>
          {trendRows.length === 0 ? <div style={EMPTY}>No delivery activity yet</div> : (
            <ResponsiveContainer width="100%" height={220}>
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

        <div style={CARD}>
          <h3 style={CARD_TITLE}>Channel Breakdown</h3>
          {channelItems.length === 0 ? <div style={EMPTY}>No notifications sent yet</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ position: 'relative', height: 150 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={channelItems} dataKey="count" nameKey="channel" cx="50%" cy="50%" innerRadius={42} outerRadius={65} strokeWidth={2} stroke="#fff">
                      {channelItems.map(c => <Cell key={c.channel} fill={CHANNEL_COLORS[c.channel] ?? '#94a3b8'} />)}
                    </Pie>
                    <Tooltip formatter={(value) => [(value as number).toLocaleString(), 'Logs']} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{totalChannelCount}</span>
                  <span style={{ fontSize: 10, color: '#94a3b8' }}>Total</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {channelItems.map(c => (
                  <div key={c.channel} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: CHANNEL_COLORS[c.channel] ?? '#94a3b8', flexShrink: 0 }} />
                    <span style={{ flex: 1, color: '#64748b' }}>{c.channel}</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{c.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={CARD}>
        <h3 style={CARD_TITLE}>Automation Performance</h3>
        {!analytics?.automationPerformance.available ? (
          <div style={EMPTY}>{analytics?.automationPerformance.reason ?? 'No automations configured yet'}</div>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ ...CARD_TITLE, margin: 0 }}>Recent Notifications</h3>
            <button type="button" onClick={() => onNavigate('logs')} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              View all →
            </button>
          </div>
          {recentLogs.length === 0 ? <div style={EMPTY}>No notifications yet</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentLogs.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Bell size={14} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.subject ?? '(no subject)'}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{l.channel} · {l.userName ?? 'System'}</div>
                  </div>
                  <StatusBadge status={l.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h3 style={{ ...CARD_TITLE, margin: 0 }}>Active Automations</h3>
            <button type="button" onClick={() => onNavigate('automation')} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              View all →
            </button>
          </div>
          {activeAutomations.length === 0 ? <div style={EMPTY}>No active automations</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {activeAutomations.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: '#f0fdfa', color: '#0f766e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Zap size={14} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{a.trigger.replace(/_/g, ' ')}</div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>{a.sentCount} sent</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
