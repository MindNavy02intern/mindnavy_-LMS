// Proficiency Levels tab — the SkillLevel ladder ITSELF is still a fixed
// 5-value backend enum (competencies.prisma) — this does not add/remove
// levels. What's now editable is the per-level display config (min/max%,
// color, description) via the new ProficiencyLevel model + GET/PATCH
// /competencies/proficiency-levels, seeded from the values this tab used to
// hardcode.

import { useEffect, useState } from 'react';
import { getProficiencyLevels, updateProficiencyLevels, CompetenciesApiError } from '../../services/competenciesApi';
import type { ProficiencyLevel } from '../../services/competenciesApi';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

const LEVEL_LABEL: Record<ProficiencyLevel['level'], string> = {
  BEGINNER: 'Beginner', INTERMEDIATE: 'Intermediate', ADVANCED: 'Advanced', EXPERT: 'Expert', CERTIFIED: 'Certified',
};

const INPUT: React.CSSProperties = { padding: '5px 8px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', width: 64 };

export default function ProficiencyLevelsTab({ showToast }: Props) {
  const [levels, setLevels] = useState<ProficiencyLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    getProficiencyLevels()
      .then(res => setLevels(res.levels))
      .catch(() => showToast('error', 'Failed to load proficiency levels.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function patch(level: ProficiencyLevel['level'], field: keyof ProficiencyLevel, value: string | number) {
    setLevels(prev => prev.map(l => l.level === level ? { ...l, [field]: value } : l));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await updateProficiencyLevels(levels);
      setLevels(res.levels);
      setDirty(false);
      showToast('success', 'Proficiency levels saved.');
    } catch (err) {
      showToast('error', err instanceof CompetenciesApiError ? err.message : 'Failed to save proficiency levels.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, color: '#94a3b8', fontSize: 12.5 }}>Loading…</div>;
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Proficiency Level Ladder</div>
          <div style={{ fontSize: 12.5, color: '#94a3b8', maxWidth: 560 }}>
            A skill's current level is derived automatically from the most recent assessment score, using the ranges below.
            The 5 level names are fixed by the backend — their ranges, colors and descriptions are editable here.
          </div>
        </div>
        <button
          type="button" onClick={handleSave} disabled={!dirty || saving}
          style={{ padding: '7px 16px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', color: '#fff', background: !dirty || saving ? '#93c5fd' : '#2563eb', border: 'none', borderRadius: 7, cursor: !dirty || saving ? 'default' : 'pointer', flexShrink: 0 }}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {levels.map((l, i) => (
          <div key={l.level} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', border: '1px solid #f1f5f9', borderRadius: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: l.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
            <div style={{ width: 90, flexShrink: 0, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{LEVEL_LABEL[l.level]}</div>
            <input
              style={{ ...INPUT, flex: 1, minWidth: 140 }} value={l.description ?? ''}
              onChange={e => patch(l.level, 'description', e.target.value)}
              placeholder="Description"
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <input type="number" min={0} max={100} style={INPUT} value={l.minPercent} onChange={e => patch(l.level, 'minPercent', Number(e.target.value))} />
              <span style={{ color: '#94a3b8', fontSize: 12 }}>–</span>
              <input type="number" min={0} max={100} style={INPUT} value={l.maxPercent} onChange={e => patch(l.level, 'maxPercent', Number(e.target.value))} />
              <span style={{ color: '#94a3b8', fontSize: 11 }}>%</span>
            </div>
            <input type="color" value={l.color} onChange={e => patch(l.level, 'color', e.target.value)} style={{ width: 32, height: 28, padding: 0, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', flexShrink: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
