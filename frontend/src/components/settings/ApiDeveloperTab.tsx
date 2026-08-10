// API & Developer tab (?tab=api). API keys themselves live in Integrations —
// this tab is policy/reference only, never duplicates key material.

import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Card, BTN_PRIMARY, BTN_SECONDARY, ToggleRow, ComingSoonBadge } from './_shared';

const LIMITS = [
  { label: 'Admin write actions', value: '60 / 10 min' },
  { label: 'Read/list endpoints', value: '120 / min' },
  { label: 'Analytics endpoints', value: '30 / min' },
  { label: 'Login attempts', value: '20 / 15 min' },
];

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function ApiDeveloperTab({ showToast }: Props) {
  const navigate = useNavigate();

  return (
    <div>
      <Card title="API Keys" subtitle="Generate, view and revoke API keys in Integrations.">
        <button type="button" style={BTN_SECONDARY} onClick={() => navigate('/integrations?tab=api-keys')}>
          Go to API Management
          <ArrowRight size={14} strokeWidth={2} />
        </button>
      </Card>

      <Card title="API Documentation">
        <button type="button" style={BTN_SECONDARY} onClick={() => showToast('success', 'API documentation is not published yet.')}>
          View API Documentation
        </button>
      </Card>

      <Card title="Rate Limiting" subtitle="Applied server-side to every /api/admin/* endpoint. Reference only — not editable here.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {LIMITS.map(l => (
            <div key={l.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#f8fafc', borderRadius: 8, fontSize: 12.5 }}>
              <span style={{ color: '#374151' }}>{l.label}</span>
              <span style={{ color: '#64748b', fontWeight: 600 }}>{l.value}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Sandbox Mode">
        <ToggleRow label={<>Sandbox Mode <ComingSoonBadge /></>} description="Test API calls against fixture data without touching production records." checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
      </Card>

      <Card>
        <button type="button" style={BTN_PRIMARY} onClick={() => navigate('/integrations')}>
          Go to API Management
        </button>
      </Card>
    </div>
  );
}
