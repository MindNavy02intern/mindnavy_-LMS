import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { listEmergencyAlerts } from '../../services/notificationsApi';
import EmergencyAlertModal from './EmergencyAlertModal';
import type { Announcement } from '../../types/notifications';
import { CARD, EMPTY, fmtDate } from './shared';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
  onBumpRefresh: () => void;
}

export default function EmergencyAlertsTab({ showToast, refreshSignal, onBumpRefresh }: Props) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listEmergencyAlerts({ limit: 50 })
      .then(res => { if (!cancelled) setItems(res.items); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshSignal]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12 }}>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '16px 32px', fontSize: 16, fontWeight: 700,
            fontFamily: 'inherit', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(220,38,38,0.35)',
          }}
        >
          <AlertTriangle size={20} strokeWidth={2.5} />
          Send Emergency Alert
        </button>
      </div>

      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Recent Emergency Alerts</h3>
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {loading ? <div style={EMPTY}>Loading…</div> : items.length === 0 ? (
            <div style={EMPTY}>No emergency alerts have been sent</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {items.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
                  <AlertTriangle size={16} color="#dc2626" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>{a.title}</div>
                    <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 2 }}>{a.body}</div>
                    <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>{fmtDate(a.sentAt)} · {a.sentCount} recipients</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <EmergencyAlertModal
          onClose={() => setModalOpen(false)}
          onSuccess={() => { setModalOpen(false); onBumpRefresh(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
