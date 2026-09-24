// Skill Gaps tab — GET /api/admin/competencies/skill-gaps. See
// competencies.service.computeSkillGaps for the gap definition: only surfaced
// for a (user, skill) pair where the user already has a profile on a
// framework-required skill, ranked below the required level — users with no
// profile row for that skill are not flagged (no "expected to have it"
// population exists in this schema).

import { useCallback, useEffect, useState } from 'react';
import { getSkillGaps, listFrameworks } from '../../services/competenciesApi';
import { CompetenciesApiError } from '../../types/competencies';
import type { Framework, SkillGapItem, SkillLevel } from '../../types/competencies';

const SELECT: React.CSSProperties = {
  padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  border: '1px solid #d1d5db', borderRadius: 6, color: '#374151', background: '#fff',
};
const INPUT: React.CSSProperties = { ...SELECT };

function levelLabel(l: SkillLevel): string { return l[0] + l.slice(1).toLowerCase(); }

function gapColor(size: number): { bg: string; fg: string } {
  if (size >= 4) return { bg: '#fee2e2', fg: '#b91c1c' };
  if (size === 3) return { bg: '#fef3c7', fg: '#b45309' };
  if (size === 2) return { bg: '#fef9c3', fg: '#a16207' };
  return { bg: '#f1f5f9', fg: '#475569' };
}

export default function SkillGapsTab({ refreshSignal }: { refreshSignal: number }) {
  const [gaps, setGaps] = useState<SkillGapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [frameworkId, setFrameworkId] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  useEffect(() => { listFrameworks({ limit: 100 }).then(res => setFrameworks(res.frameworks)).catch(err => console.error(err)); }, [refreshSignal]);

  const fetchGaps = useCallback(() => {
    setLoading(true);
    setError(null);
    getSkillGaps({ frameworkId: frameworkId || undefined, departmentId: departmentId.trim() || undefined })
      .then(res => setGaps(res.gaps))
      .catch(err => setError(err instanceof CompetenciesApiError ? err.message : 'Failed to load skill gaps.'))
      .finally(() => setLoading(false));
  }, [frameworkId, departmentId]);

  useEffect(() => { fetchGaps(); }, [fetchGaps, refreshSignal]);
  useEffect(() => {
    window.addEventListener('competenciesUpdated', fetchGaps);
    return () => window.removeEventListener('competenciesUpdated', fetchGaps);
  }, [fetchGaps]);

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 16, borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
        <select style={SELECT} value={frameworkId} onChange={e => setFrameworkId(e.target.value)}>
          <option value="">All frameworks</option>
          {frameworks.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <input style={{ ...INPUT, width: 180 }} value={departmentId} onChange={e => setDepartmentId(e.target.value)} placeholder="Filter by department…" />
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94a3b8' }}>{gaps.length} gap{gaps.length !== 1 ? 's' : ''} found</span>
      </div>

      {error && <div style={{ margin: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#b91c1c' }}>{error}</div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              {['User', 'Skill', 'Framework', 'Required Level', 'Current Level', 'Gap Size'].map(h => (
                <th key={h} style={{ textAlign: h === 'User' || h === 'Skill' || h === 'Framework' ? 'left' : 'center', padding: '10px 12px', color: '#94a3b8', fontWeight: 600, fontSize: 11.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading…</td></tr>
            ) : gaps.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No skill gaps detected.</td></tr>
            ) : gaps.map((g, i) => {
              const gc = gapColor(g.gapSize);
              return (
                <tr key={`${g.userId}-${g.skillId}-${g.frameworkId}-${i}`} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{g.userName ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{g.skillName ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{g.frameworkName ?? '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#0f172a' }}>{levelLabel(g.requiredLevel)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#0f172a' }}>{levelLabel(g.currentLevel)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: gc.bg, color: gc.fg }}>{g.gapSize}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
