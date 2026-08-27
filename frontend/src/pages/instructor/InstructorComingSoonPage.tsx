import InstructorLayout from './InstructorLayout';

interface Props {
  title: string;
}

// Generic stub for the 10 nav items not yet built this phase (see
// InstructorLayout.tsx's NAV_ITEMS). One component, one route each in
// App.tsx — avoids 10 near-identical placeholder files for pages that will
// each get replaced by a real implementation in a later phase.
export default function InstructorComingSoonPage({ title }: Props) {
  return (
    <InstructorLayout>
      <div style={{
        minHeight: '60vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 12, color: '#94a3b8',
      }}>
        <div style={{ fontSize: 32 }}>🚧</div>
        <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#334155' }}>{title}</h2>
        <p style={{ margin: 0, fontSize: 12 }}>Coming soon.</p>
      </div>
    </InstructorLayout>
  );
}
