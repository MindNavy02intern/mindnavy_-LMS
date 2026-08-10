import { useEffect, useState } from 'react';
import { Mail, RefreshCw, MessageSquare } from 'lucide-react';
import { listIntegrations, testIntegration } from '../../services/integrationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { Integration } from '../../types/integrations';
import { CARD_PAD, CARD_TITLE, EMPTY, BTN_SECONDARY, StatusBadge, ComingSoonCard, fmtDate } from './shared';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
  onBumpRefresh: () => void;
}

const DECORATIVE_EMAIL = [{ name: 'Mailgun', description: 'Transactional email delivery via Mailgun.' }];

function SmtpCard({ item, showToast, onBumpRefresh }: { item: Integration; showToast: Props['showToast']; onBumpRefresh: () => void }) {
  const [testing, setTesting] = useState(false);
  const [host, setHost] = useState<string | null>(null);

  async function handleTest() {
    setTesting(true);
    try {
      const result = await testIntegration(item.slug);
      showToast(result.success ? 'success' : 'error', result.message);
      const data = result.data as { host?: string; port?: number } | undefined;
      if (data?.host) setHost(`${data.host}:${data.port ?? 587}`);
      invalidateFor(appQueryClient, 'integration.testMode');
      onBumpRefresh();
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Test failed.');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div style={CARD_PAD}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Mail size={19} strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Email (SMTP)</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8' }}>OTP codes, notifications, delivery</div>
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>SMTP host:port</span>
          <span style={{ color: '#374151', fontWeight: 500 }}>{host ?? (item.status === 'CONNECTED' ? '•••• (server-side)' : '— not configured —')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Bounce rate</span>
          <span style={{ color: '#374151', fontWeight: 500 }}>Not tracked yet</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Last checked</span>
          <span style={{ color: '#374151', fontWeight: 500 }}>{fmtDate(item.lastSyncAt)}</span>
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <button type="button" disabled={testing} onClick={handleTest} style={{ ...BTN_SECONDARY, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: testing ? 0.6 : 1 }}>
          <RefreshCw size={13} strokeWidth={2} />
          {testing ? 'Testing…' : 'Test Connection'}
        </button>
        <div style={{ marginTop: 6, fontSize: 10.5, color: '#94a3b8', textAlign: 'center' }}>Verifies SMTP login — sends no email.</div>
      </div>
    </div>
  );
}

export default function EmailSmsTab({ showToast, refreshSignal, onBumpRefresh }: Props) {
  const [smtp, setSmtp] = useState<Integration | null>(null);
  const [sendgrid, setSendgrid] = useState<Integration | null>(null);
  const [twilio, setTwilio] = useState<Integration | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listIntegrations()
      .then(rows => {
        if (cancelled) return;
        setSmtp(rows.find(r => r.slug === 'smtp-email') ?? null);
        setSendgrid(rows.find(r => r.slug === 'sendgrid') ?? null);
        setTwilio(rows.find(r => r.slug === 'twilio') ?? null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshSignal]);

  const requestAccess = () => showToast('success', "We'll notify you when this integration ships.");

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {loading ? <div style={EMPTY}>Loading…</div> : (
        <>
          <div>
            <h3 style={CARD_TITLE}>Email Service</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {smtp && <SmtpCard item={smtp} showToast={showToast} onBumpRefresh={onBumpRefresh} />}
              {sendgrid && <ComingSoonCard name={sendgrid.name} description="High-deliverability transactional email via SendGrid." onRequestAccess={requestAccess} />}
              {DECORATIVE_EMAIL.map(p => <ComingSoonCard key={p.name} name={p.name} description={p.description} onRequestAccess={requestAccess} />)}
            </div>
          </div>

          <div>
            <h3 style={CARD_TITLE}>SMS Gateway</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#c2410c', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
              <MessageSquare size={15} strokeWidth={2} />
              SMS requires Twilio — configure to activate.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {twilio && <ComingSoonCard name={twilio.name} description="Send SMS notifications and OTP codes via Twilio." onRequestAccess={requestAccess} />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
