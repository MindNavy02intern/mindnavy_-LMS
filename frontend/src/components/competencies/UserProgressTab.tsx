// User Progress tab — search a user, then GET /api/admin/competencies/users/:userId/skills.

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { getUsers } from '../../api/users';
import { getUserSkills } from '../../services/competenciesApi';
import { CompetenciesApiError } from '../../types/competencies';
import type { SkillLevel, UserSkillEntry } from '../../types/competencies';

interface UserOption { id: string; fullName: string; email: string; avatar: string | null }

const LEVEL_COLOR: Record<SkillLevel, { bg: string; fg: string; bar: string }> = {
  BEGINNER:     { bg: '#f1f5f9', fg: '#475569', bar: '#94a3b8' },
  INTERMEDIATE: { bg: '#dbeafe', fg: '#1d4ed8', bar: '#3b82f6' },
  ADVANCED:     { bg: '#e0e7ff', fg: '#4338ca', bar: '#6366f1' },
  EXPERT:       { bg: '#fef3c7', fg: '#b45309', bar: '#f59e0b' },
  CERTIFIED:    { bg: '#dcfce7', fg: '#15803d', bar: '#16a34a' },
};

function initials(name: string): string {
  return (name || '?').split(' ').map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase();
}

export default function UserProgressTab({ refreshSignal }: { refreshSignal: number }) {
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<UserOption[]>([]);
  const [selected, setSelected] = useState<UserOption | null>(null);

  const [skills, setSkills] = useState<UserSkillEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (search.trim().length < 2 || selected) { setOptions([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      getUsers({ search: search.trim(), limit: 8 })
        .then(res => { if (!cancelled) setOptions(res.users.map(u => ({ id: u.id, fullName: u.fullName, email: u.email, avatar: u.avatar }))); })
        .catch(() => {});
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, selected]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    getUserSkills(selected.id)
      .then(setSkills)
      .catch(err => setError(err instanceof CompetenciesApiError ? err.message : 'Failed to load skill profile.'))
      .finally(() => setLoading(false));
  }, [selected, refreshSignal]);

  useEffect(() => {
    if (!selected) return;
    function onUpdate() {
      if (selected) getUserSkills(selected.id).then(setSkills).catch(() => {});
    }
    window.addEventListener('analyticsUpdated', onUpdate);
    return () => window.removeEventListener('analyticsUpdated', onUpdate);
  }, [selected]);

  const tracked = skills.filter(s => !s.missing);
  const missing = skills.filter(s => s.missing);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16 }}>
        <div style={{ position: 'relative', maxWidth: 380 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 10px 9px 30px', fontSize: 13, fontFamily: 'inherit', outline: 'none', border: '1px solid #d1d5db', borderRadius: 6, color: '#374151' }}
            value={selected ? selected.fullName : search}
            onChange={e => { setSelected(null); setSearch(e.target.value); }}
            placeholder="Search a user by name or email…"
          />
          {options.length > 0 && !selected && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, marginTop: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto' }}>
              {options.map(u => (
                <button key={u.id} type="button" onClick={() => { setSelected(u); setOptions([]); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left', padding: '8px 10px', fontSize: 12.5, background: 'none', border: 'none', cursor: 'pointer', color: '#374151' }}>
                  {u.avatar ? <img src={u.avatar} alt="" style={{ width: 22, height: 22, borderRadius: '50%' }} /> : <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#2563eb', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(u.fullName)}</div>}
                  {u.fullName} <span style={{ color: '#94a3b8' }}>({u.email})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!selected ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>Search for a user to view their skill profile.</div>
      ) : error ? (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#b91c1c' }}>{error}</div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
            {tracked.length} assessed · {missing.length} not yet assessed
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {tracked.map(s => {
              const lc = LEVEL_COLOR[s.currentLevel as SkillLevel] ?? LEVEL_COLOR.BEGINNER;
              const pct = s.proficiencyPercent ?? 0;
              return (
                <div key={s.skillId} style={{ padding: '10px 14px', border: '1px solid #f1f5f9', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{s.skillName}</span>
                      {s.category && <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 8 }}>{s.category}</span>}
                    </div>
                    <span style={{ padding: '2px 9px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: lc.bg, color: lc.fg }}>{s.currentLevel ? s.currentLevel[0] + s.currentLevel.slice(1).toLowerCase() : '—'}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: '#f1f5f9', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: lc.bar, borderRadius: 999 }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{pct}% proficiency</span>
                    {s.assessedAt && <span style={{ fontSize: 11, color: '#94a3b8' }}>Assessed {new Date(s.assessedAt).toLocaleDateString()}</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {missing.length > 0 && (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, margin: '20px 0 10px' }}>Not Yet Assessed</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {missing.map(s => (
                  <span key={s.skillId} style={{ padding: '4px 10px', borderRadius: 999, fontSize: 11.5, background: '#f8fafc', color: '#94a3b8', border: '1px dashed #e2e8f0' }}>{s.skillName}</span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
