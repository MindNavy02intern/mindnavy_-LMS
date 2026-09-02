// Frameworks tab — full framework management: create/edit/delete a framework,
// add/remove its required skills, set required level + importance per skill.

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, X } from 'lucide-react';
import {
  listFrameworks, getFramework, deleteFramework, addFrameworkSkill, removeFrameworkSkill, listSkills,
} from '../../services/competenciesApi';
import { CompetenciesApiError, SKILL_LEVELS, FRAMEWORK_IMPORTANCE } from '../../types/competencies';
import type { Framework, FrameworkDetail, FrameworkImportance, Skill, SkillLevel } from '../../types/competencies';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  onCreateFramework: () => void;
  onEditFramework:   (fw: Framework) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
}

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  ACTIVE:   { bg: '#dcfce7', fg: '#15803d' },
  DRAFT:    { bg: '#f1f5f9', fg: '#475569' },
  ARCHIVED: { bg: '#f1f5f9', fg: '#94a3b8' },
};

const SELECT: React.CSSProperties = {
  padding: '7px 9px', fontSize: 12.5, fontFamily: 'inherit', outline: 'none',
  border: '1px solid #d1d5db', borderRadius: 6, color: '#374151', background: '#fff',
};

export default function FrameworksTab({ onCreateFramework, onEditFramework, showToast, refreshSignal }: Props) {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [detail, setDetail] = useState<FrameworkDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [addSkillId, setAddSkillId] = useState('');
  const [addLevel, setAddLevel] = useState<SkillLevel>('INTERMEDIATE');
  const [addImportance, setAddImportance] = useState<FrameworkImportance>('MEDIUM');
  const [adding, setAdding] = useState(false);
  const [busySkillId, setBusySkillId] = useState<string | null>(null);
  const [deletingFw, setDeletingFw] = useState(false);

  const fetchList = useCallback(() => {
    setLoading(true);
    setError(null);
    listFrameworks({ limit: 50 })
      .then(res => {
        setFrameworks(res.frameworks);
        setSelectedId(prev => prev && res.frameworks.some(f => f.id === prev) ? prev : (res.frameworks[0]?.id ?? null));
      })
      .catch(err => setError(err instanceof CompetenciesApiError ? err.message : 'Failed to load frameworks.'))
      .finally(() => setLoading(false));
  }, []);

  const fetchDetail = useCallback(() => {
    if (!selectedId) { setDetail(null); return; }
    setDetailLoading(true);
    getFramework(selectedId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  useEffect(() => { fetchList(); }, [fetchList, refreshSignal]);
  useEffect(() => { fetchDetail(); }, [fetchDetail, refreshSignal]);
  // Backend caps limit at 100 (competencies.validator MAX.limit) — matches it.
  useEffect(() => { listSkills({ limit: 100, status: 'ACTIVE' }).then(res => setAllSkills(res.skills)).catch(err => console.error(err)); }, [refreshSignal]);

  useEffect(() => {
    window.addEventListener('competenciesUpdated', fetchList);
    window.addEventListener('competenciesUpdated', fetchDetail);
    return () => {
      window.removeEventListener('competenciesUpdated', fetchList);
      window.removeEventListener('competenciesUpdated', fetchDetail);
    };
  }, [fetchList, fetchDetail]);

  async function handleDeleteFramework(fw: Framework) {
    if (!window.confirm(`Delete framework "${fw.name}"? Removes its skill requirements only — the skills themselves are unaffected.`)) return;
    setDeletingFw(true);
    try {
      await deleteFramework(fw.id);
      invalidateFor(appQueryClient, 'framework.delete', { id: fw.id });
      showToast('success', 'Framework deleted.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof CompetenciesApiError ? err.message : 'Failed to delete framework.');
    } finally {
      setDeletingFw(false);
    }
  }

  async function handleAddSkill() {
    if (!selectedId || !addSkillId) return;
    setAdding(true);
    try {
      await addFrameworkSkill(selectedId, { skillId: addSkillId, requiredLevel: addLevel, importance: addImportance });
      invalidateFor(appQueryClient, 'framework.addSkill', { frameworkId: selectedId });
      showToast('success', 'Skill added to framework.');
      setAddSkillId('');
      fetchDetail();
      fetchList();
    } catch (err) {
      showToast('error', err instanceof CompetenciesApiError ? err.message : 'Failed to add skill.');
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveSkill(skillId: string) {
    if (!selectedId) return;
    setBusySkillId(skillId);
    try {
      await removeFrameworkSkill(selectedId, skillId);
      invalidateFor(appQueryClient, 'framework.removeSkill', { frameworkId: selectedId });
      showToast('success', 'Skill removed from framework.');
      fetchDetail();
      fetchList();
    } catch (err) {
      showToast('error', err instanceof CompetenciesApiError ? err.message : 'Failed to remove skill.');
    } finally {
      setBusySkillId(null);
    }
  }

  const availableSkills = allSkills.filter(s => !detail?.skills.some(fs => fs.skillId === s.id));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Frameworks</span>
          <button type="button" aria-label="Add Framework" onClick={onCreateFramework} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Plus size={13} strokeWidth={2.5} /> Add
          </button>
        </div>
        {error && <div style={{ margin: 12, padding: '8px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#b91c1c' }}>{error}</div>}
        {loading ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>Loading…</div>
        ) : frameworks.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>No frameworks yet.</div>
        ) : (
          <div>
            {frameworks.map(fw => {
              const sc = STATUS_COLOR[fw.status] ?? { bg: '#f1f5f9', fg: '#64748b' };
              return (
                <div
                  key={fw.id}
                  onClick={() => setSelectedId(fw.id)}
                  style={{ padding: '10px 16px', borderBottom: '1px solid #f8fafc', cursor: 'pointer', background: selectedId === fw.id ? '#eff6ff' : '#fff' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fw.name}</span>
                    <span style={{ padding: '1px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: sc.bg, color: sc.fg, flexShrink: 0 }}>{fw.status}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{fw.competenciesCount} skills · {fw.usersMapped} users mapped</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, minHeight: 300 }}>
        {!selectedId || detailLoading ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: 40 }}>{detailLoading ? 'Loading…' : 'Select a framework'}</div>
        ) : detail ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{detail.name}</div>
                {detail.description && <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 4, maxWidth: 480 }}>{detail.description}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button type="button" onClick={() => onEditFramework(detail)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: '#374151', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer' }}>
                  <Pencil size={13} /> Edit
                </button>
                <button type="button" disabled={deletingFw} onClick={() => handleDeleteFramework(detail)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: 12, fontWeight: 600, color: '#dc2626', background: '#fff', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer' }}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>Required Skills</div>

            {detail.skills.length === 0 ? (
              <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 16 }}>No skills required yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginBottom: 16 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    {['Skill', 'Category', 'Required Level', 'Importance', ''].map(h => (
                      <th key={h} style={{ textAlign: h === 'Skill' ? 'left' : h === '' ? 'right' : 'center', padding: '6px 8px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.skills.map(fs => (
                    <tr key={fs.frameworkSkillId} style={{ borderBottom: '1px solid #f8fafc', opacity: busySkillId === fs.skillId ? 0.5 : 1 }}>
                      <td style={{ padding: '7px 8px', fontWeight: 600, color: '#0f172a' }}>{fs.skillName}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'center', color: '#64748b' }}>{fs.category ?? '—'}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'center', color: '#0f172a' }}>{fs.requiredLevel[0] + fs.requiredLevel.slice(1).toLowerCase()}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'center', color: '#0f172a' }}>{fs.importance[0] + fs.importance.slice(1).toLowerCase()}</td>
                      <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                        <button type="button" disabled={busySkillId === fs.skillId} onClick={() => handleRemoveSkill(fs.skillId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>Add skill</div>
                <select style={{ ...SELECT, minWidth: 160 }} value={addSkillId} onChange={e => setAddSkillId(e.target.value)}>
                  <option value="">Select a skill</option>
                  {availableSkills.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>Required level</div>
                <select style={SELECT} value={addLevel} onChange={e => setAddLevel(e.target.value as SkillLevel)}>
                  {SKILL_LEVELS.map(l => <option key={l} value={l}>{l[0] + l.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>Importance</div>
                <select style={SELECT} value={addImportance} onChange={e => setAddImportance(e.target.value as FrameworkImportance)}>
                  {FRAMEWORK_IMPORTANCE.map(i => <option key={i} value={i}>{i[0] + i.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
              <button
                type="button" aria-label="Add skill to framework" disabled={!addSkillId || adding} onClick={handleAddSkill}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, color: '#fff', background: '#2563eb', border: 'none', borderRadius: 6, cursor: !addSkillId || adding ? 'default' : 'pointer', opacity: !addSkillId || adding ? 0.6 : 1 }}
              >
                <Plus size={14} /> {adding ? 'Adding…' : 'Add'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
