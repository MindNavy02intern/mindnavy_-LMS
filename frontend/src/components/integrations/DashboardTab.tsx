import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { Zap, Link2, Link2Off } from 'lucide-react';
import { getIntegrationsAnalytics, listIntegrations, listLogs, connectIntegration, disconnectIntegration } from '../../services/integrationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { Integration, IntegrationsAnalytics, IntegrationLogEntry } from '../../types/integrations';
import { CARD, CARD_TITLE, EMPTY, BTN_SECONDARY, StatusBadge, LogStatusBadge, fmtDate } from './shared';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
  onBumpRefresh: () => void;
}

function IntegrationRow({ item, showToast, onBumpRefresh }: { item: Integration; showToast: Props['showToast']; onBumpRefresh: () => void }) {
  const [busy, setBusy] = useState(false);

  async function handleToggleConnection() {
    if (busy) return;
    setBusy(true);
    try {
      const result = item.status === 'CONNECTED'
        ? await disconnectIntegration(item.slug)
        : await connectIntegration(item.slug);
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
    <div aria-label={`integration-row-${item.slug}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
        {item.name.charAt(0)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{item.name}</div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>Last sync: {fmtDate(item.lastSyncAt)}</div>
      </div>
      <StatusBadge status={item.status} />
      {item.hasProvider ? (
        <button type="button" disabled={busy} onClick={handleToggleConnection} style={{ ...BTN_SECONDARY, padding: '6px 10px', fontSize: 12, opacity: busy ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 5 }}>
          {item.status === 'CONNECTED' ? <Link2Off size={12} strokeWidth={2} /> : <Link2 size={12} strokeWidth={2} />}
          {item.status === 'CONNECTED' ? 'Disconnect' : 'Connect'}
        </button>
      ) : (
        <span style={{ fontSize: 11, color: '#94a3b8', padding: '6px 4px' }}>—</span>
      )}
    </div>
  );
}

export default function DashboardTab({ showToast, refreshSignal, onBumpRefresh }: Props) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [analytics, setAnalytics] = useState<IntegrationsAnalytics | null>(null);
  const [recentLogs, setRecentLogs] = useState<IntegrationLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    function load() {
      setLoading(true);
      Promise.all([listIntegrations(), getIntegrationsAnalytics(), listLogs({ limit: 8 })])
        .then(([ints, a, logs]) => {
          if (cancelled) return;
          setIntegrations(ints);
          setAnalytics(a);
          setRecentLogs(logs.items);
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    load();
    window.addEventListener('analyticsUpdated', load);
    return () => { cancelled = true; window.removeEventListener('analyticsUpdated', load); };
  }, [refreshSignal]);

  if (loading && integrations.length === 0) {
    return <div style={EMPTY}>Loading dashboard…</div>;
  }

  const connected = integrations.filter(i => i.status === 'CONNECTED' || i.status === 'ERROR' || i.status === 'PENDING');
  const comingSoon = integrations.filter(i => i.status === 'COMING_SOON' || i.status === 'DISCONNECTED');

  const trendRows = (analytics?.apiUsageTrend.labels ?? []).map((label, i) => ({
    label, value: analytics?.apiUsageTrend.values[i] ?? 0,
  }));
  const webhookRows = (analytics?.webhookActivityTrend.labels ?? []).map((label, i) => ({
    label, value: analytics?.webhookActivityTrend.values[i] ?? 0,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ ...CARD_TITLE, margin: 0 }}>Integration Health</h3>
        </div>
        {integrations.length === 0 ? <div style={EMPTY}>No integrations yet</div> : (
          <>
            <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.3 }}>Connected</div>
            {connected.length === 0 ? <div style={{ ...EMPTY, padding: '12px 0' }}>None connected yet</div> :
              connected.map(i => <IntegrationRow key={i.id} item={i} showToast={showToast} onBumpRefresh={onBumpRefresh} />)}
            <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.3, borderTop: '1px solid #f1f5f9' }}>Coming Soon</div>
            {comingSoon.map(i => <IntegrationRow key={i.id} item={i} showToast={showToast} onBumpRefresh={onBumpRefresh} />)}
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={CARD}>
          <div style={{ padding: 18 }}>
            <h3 style={CARD_TITLE}>API Usage Trend (7 days)</h3>
            {trendRows.every(r => r.value === 0) ? <div style={EMPTY}>No API activity yet</div> : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendRows} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="value" name="API calls" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div style={CARD}>
          <div style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ ...CARD_TITLE, margin: 0 }}>Webhook Activity (7 days)</h3>
              {analytics?.webhookSuccessRate.available && (
                <span style={{ fontSize: 11.5, fontWeight: 600, color: '#4338ca' }}>{analytics.webhookSuccessRate.value}% success (30d)</span>
              )}
            </div>
            {(analytics?.webhookActivityTrend.values ?? []).every(v => v === 0) ? (
              <div style={EMPTY}>No webhook activity yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={webhookRows} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" name="Webhook calls" fill="#4338ca" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div style={CARD}>
        <div style={{ padding: 18 }}>
          <h3 style={CARD_TITLE}>Recent Integration Events</h3>
          {recentLogs.length === 0 ? <div style={EMPTY}>No events yet</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentLogs.map(l => (
                <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Zap size={14} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}>{l.integrationName} · {l.type}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{fmtDate(l.createdAt)}{l.endpoint ? ` · ${l.endpoint}` : ''}</div>
                  </div>
                  <LogStatusBadge status={l.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
