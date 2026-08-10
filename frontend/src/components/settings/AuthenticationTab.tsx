// Authentication tab (?tab=authentication).

import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { SystemSettings } from '../../types/settings';
import { Card, BTN_SECONDARY, ToggleRow, ComingSoonBadge } from './_shared';

interface Props {
  settings: SystemSettings;
}

export default function AuthenticationTab({ settings }: Props) {
  const navigate = useNavigate();

  return (
    <div>
      <Card title="Email Login">
        <ToggleRow label="Email & Password Login" description="The default sign-in method — always available." checked disabled onChange={() => {}} disabledHint="Always on" />
      </Card>

      <Card title="Social Login">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ToggleRow label={<>Sign in with Google <ComingSoonBadge /></>} checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
          <ToggleRow label={<>Sign in with Microsoft <ComingSoonBadge /></>} checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
          <ToggleRow label={<>Sign in with Apple <ComingSoonBadge /></>} checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
        </div>
      </Card>

      <Card title="Single Sign-On (SSO)" subtitle="SAML / OAuth enterprise identity providers are configured in Integrations.">
        <button type="button" style={BTN_SECONDARY} onClick={() => navigate('/integrations')}>
          Configure in Integrations
          <ArrowRight size={14} strokeWidth={2} />
        </button>
      </Card>

      <Card title="Session Settings" subtitle="Managed on the Security tab — shown here for reference.">
        <div style={{ fontSize: 13, color: '#374151' }}>
          Session timeout: <strong>{settings.sessionTimeoutMinutes} minutes</strong> · Max login attempts: <strong>{settings.maxLoginAttempts}</strong>
        </div>
      </Card>
    </div>
  );
}
