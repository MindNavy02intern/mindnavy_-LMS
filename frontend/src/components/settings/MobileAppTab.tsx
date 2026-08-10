// Mobile App tab (?tab=mobile). No backend mobile app exists yet — every
// control here is inert; "Request Setup" only shows a toast, no persistence.

import { useNavigate } from 'react-router-dom';
import { ArrowRight, Smartphone } from 'lucide-react';
import { Card, BTN_PRIMARY, BTN_SECONDARY, StatusBadge, ToggleRow, ComingSoonBadge } from './_shared';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function MobileAppTab({ showToast }: Props) {
  const navigate = useNavigate();

  return (
    <div>
      <Card title="Mobile App Status" action={<StatusBadge text="NOT CONFIGURED YET" tone="neutral" />}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#64748b' }}>
          <Smartphone size={16} strokeWidth={2} color="#94a3b8" />
          No mobile app has been provisioned for this platform yet.
        </div>
      </Card>

      <Card title="Push Notifications" subtitle="Mobile push providers (FCM/APNs) are configured in Integrations once a mobile app exists.">
        <button type="button" style={BTN_SECONDARY} onClick={() => navigate('/integrations')}>
          Configure in Integrations
          <ArrowRight size={14} strokeWidth={2} />
        </button>
      </Card>

      <Card title="Mobile Features">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ToggleRow label={<>Offline Learning <ComingSoonBadge /></>} checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
          <ToggleRow label={<>App Branding <ComingSoonBadge /></>} checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
        </div>
      </Card>

      <Card title="Request Setup">
        <button type="button" style={BTN_PRIMARY} onClick={() => showToast('success', 'Our team will contact you about mobile app setup.')}>
          Request Mobile App Setup
        </button>
      </Card>
    </div>
  );
}
