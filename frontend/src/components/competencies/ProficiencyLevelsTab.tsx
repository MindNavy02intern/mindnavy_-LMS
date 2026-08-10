// Proficiency Levels tab — the SkillLevel ladder is a fixed 5-value backend
// enum (competencies.prisma), not a configurable entity — no
// GET/POST /levels endpoint exists in the contract (task spec never listed
// one for Part 1/2), so this is a read-only reference of the ladder and the
// percent thresholds competencies.service actually applies when an
// assessment is recorded, not an editable config screen (would fabricate a
// "customize levels" feature with nowhere to save it).

const LEVELS: { level: string; range: string; color: string; description: string }[] = [
  { level: 'Beginner',     range: '0–24%',  color: '#94a3b8', description: 'Just starting out — little to no demonstrated proficiency yet.' },
  { level: 'Intermediate', range: '25–49%', color: '#3b82f6', description: 'Can perform core tasks with some guidance.' },
  { level: 'Advanced',     range: '50–74%', color: '#6366f1', description: 'Works independently and reliably in most situations.' },
  { level: 'Expert',       range: '75–89%', color: '#f59e0b', description: 'Deep, consistent mastery — able to guide others.' },
  { level: 'Certified',    range: '90–100%', color: '#16a34a', description: 'Top-tier, verified proficiency.' },
];

export default function ProficiencyLevelsTab() {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Proficiency Level Ladder</div>
      <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 18, maxWidth: 560 }}>
        A skill's current level is derived automatically from the most recent assessment score. This ladder is fixed
        by the backend — there is no per-organization customization yet.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {LEVELS.map((l, i) => (
          <div key={l.level} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', border: '1px solid #f1f5f9', borderRadius: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: l.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{l.level}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{l.description}</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: l.color, flexShrink: 0 }}>{l.range}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
