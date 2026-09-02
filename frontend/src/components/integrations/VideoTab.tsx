import { useEffect, useState } from 'react';
import { Video, CheckCircle2, Link2Off, RefreshCw } from 'lucide-react';
import { listIntegrations, testIntegration, disconnectIntegration } from '../../services/integrationsApi';
import { getSystemSettings, updateSystemSettings } from '../../services/settingsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { Integration } from '../../types/integrations';
import { CARD_PAD, CARD_TITLE, EMPTY, BTN_SECONDARY, BTN_DANGER, StatusBadge, ComingSoonCard, fmtDate } from './shared';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
  onBumpRefresh: () => void;
}

// Decorative only — no backend catalog row exists for these (Part 1's catalog
// seed only lists real video providers under VIDEO: zoom). "Request Early
// Access" is a local toast regardless of provider, so these are safe to show
// without a backend dependency.
const DECORATIVE_VIDEO = [
  { name: 'Microsoft Teams', description: 'Needs Microsoft Graph API credentials (Azure AD app registration) before this can be added — not started yet.' },
  { name: 'Google Meet',     description: 'Needs a Google Workspace API project + OAuth credentials before this can be added — not started yet.' },
];

function ZoomCard({ item, showToast, onBumpRefresh }: { item: Integration; showToast: Props['showToast']; onBumpRefresh: () => void }) {
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [durationMin, setDurationMin] = useState(60);
  const [recordingEnabled, setRecordingEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSystemSettings()
      .then(s => {
        if (cancelled) return;
        setDurationMin(s.zoomDefaultDuration);
        setRecordingEnabled(s.zoomRecordingEnabled);
      })
      .catch(err => console.error(err));
    return () => { cancelled = true; };
  }, []);

  async function saveDuration() {
    const clamped = Math.min(480, Math.max(15, Math.round(durationMin) || 60));
    setDurationMin(clamped);
    setSaving(true);
    try {
      await updateSystemSettings({ zoomDefaultDuration: clamped });
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save meeting duration.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleRecording(checked: boolean) {
    setRecordingEnabled(checked);
    setSaving(true);
    try {
      await updateSystemSettings({ zoomRecordingEnabled: checked });
    } catch (err) {
      setRecordingEnabled(!checked);
      showToast('error', err instanceof Error ? err.message : 'Failed to save recording default.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const result = await testIntegration(item.slug);
      showToast(result.success ? 'success' : 'error', result.message);
      invalidateFor(appQueryClient, 'integration.testMode');
      onBumpRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Test failed.');
    } finally {
      setTesting(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const result = await disconnectIntegration(item.slug);
      showToast(result.success ? 'success' : 'error', result.message);
      if (result.success) { invalidateFor(appQueryClient, 'integration.disconnect'); onBumpRefresh(); }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Disconnect failed.');
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div style={CARD_PAD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Video size={19} strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Zoom</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Live Sessions video provider</div>
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Account ID</span>
          <span style={{ color: '#374151', fontWeight: 500 }}>{item.status === 'CONNECTED' ? '•••••••• (server-side)' : '— not configured —'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Connection status</span>
          <span style={{ color: '#374151', fontWeight: 500 }}>{item.lastError ? item.lastError : (item.status === 'CONNECTED' ? 'Healthy' : 'Not connected')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Last meeting created</span>
          <span style={{ color: '#374151', fontWeight: 500 }}>Tracked in Live Sessions module</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Last checked</span>
          <span style={{ color: '#374151', fontWeight: 500 }}>{fmtDate(item.lastSyncAt)}</span>
        </div>
      </div>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
          Meeting Settings {saving && <span style={{ fontWeight: 400, color: '#94a3b8' }}>· saving…</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <label style={{ fontSize: 12, color: '#64748b', flex: 1 }}>Default meeting duration (min)</label>
          <input type="number" min={15} max={480} value={durationMin} onChange={e => setDurationMin(Number(e.target.value))}
            onBlur={saveDuration}
            style={{ width: 70, padding: '5px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6 }} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b', cursor: 'pointer' }}>
          <input type="checkbox" checked={recordingEnabled} onChange={e => toggleRecording(e.target.checked)} />
          Enable cloud recording by default
        </label>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button type="button" disabled={testing} onClick={handleTest} style={{ ...BTN_SECONDARY, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: testing ? 0.6 : 1 }}>
          <RefreshCw size={13} strokeWidth={2} className={testing ? 'ic-spin' : ''} />
          {testing ? 'Testing…' : 'Test Connection'}
        </button>
        <button type="button" disabled={disconnecting || item.status !== 'CONNECTED'} onClick={handleDisconnect}
          style={{ ...BTN_DANGER, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: (disconnecting || item.status !== 'CONNECTED') ? 0.5 : 1 }}>
          <Link2Off size={13} strokeWidth={2} />
          Disconnect
        </button>
      </div>
    </div>
  );
}

export default function VideoTab({ showToast, refreshSignal, onBumpRefresh }: Props) {
  const [zoom, setZoom] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listIntegrations()
      .then(rows => { if (!cancelled) setZoom(rows.find(r => r.slug === 'zoom') ?? null); })
      .catch(err => console.error(err))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshSignal]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`@keyframes ic-spin { to { transform: rotate(360deg); } } .ic-spin { animation: ic-spin 0.8s linear infinite; }`}</style>
      <h3 style={CARD_TITLE}>Video Conferencing</h3>
      {loading ? <div style={EMPTY}>Loading…</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {zoom && <ZoomCard item={zoom} showToast={showToast} onBumpRefresh={onBumpRefresh} />}
          {DECORATIVE_VIDEO.map(p => (
            <ComingSoonCard key={p.name} name={p.name} description={p.description}
              onRequestAccess={() => showToast('success', "We'll notify you when this integration ships.")} />
          ))}
        </div>
      )}
      {zoom?.status === 'CONNECTED' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px' }}>
          <CheckCircle2 size={15} strokeWidth={2} />
          Zoom is connected and reused by the Live Sessions module — meetings are created there, not here.
        </div>
      )}
    </div>
  );
}
