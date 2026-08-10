// AI & Smart Features tab (?tab=ai) — everything here is coming soon per the
// module note; "Join AI Waitlist" is a toast only, nothing persisted.

import { Sparkles } from 'lucide-react';
import { Card, BTN_PRIMARY, ToggleRow } from './_shared';

const AI_FEATURES = [
  { label: 'AI Recommendations', description: 'Personalized course and content suggestions.' },
  { label: 'Smart Learning Paths', description: 'Auto-generated paths based on skill gaps.' },
  { label: 'AI Analytics', description: 'Predictive engagement and completion insights.' },
  { label: 'AI Notifications', description: 'Smart timing and content for reminders.' },
  { label: 'Behavioral Predictions', description: 'Flag at-risk learners before they drop off.' },
];

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

export default function AiFeaturesTab({ showToast }: Props) {
  return (
    <div>
      <Card title="AI Features" subtitle="All AI features are in development — enabling them here does nothing yet.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {AI_FEATURES.map(f => (
            <ToggleRow key={f.label} label={f.label} description={f.description} checked={false} onChange={() => {}} disabled disabledHint="Coming soon" />
          ))}
        </div>
      </Card>

      <Card title="Get Early Access">
        <button type="button" style={BTN_PRIMARY} onClick={() => showToast('success', "You're on the AI features waitlist — we'll notify you when it's ready.")}>
          <Sparkles size={15} strokeWidth={2} />
          Join AI Waitlist
        </button>
      </Card>
    </div>
  );
}
