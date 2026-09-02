// Competency List tab — GET /api/admin/competencies/skills.

import { useCallback, useEffect, useState } from 'react';
import { Search, Plus, Link2, Archive, ArchiveRestore, Trash2, Pencil } from 'lucide-react';
import { listSkills, listSkillCategories, updateSkill, deleteSkill } from '../../services/competenciesApi';
import { CompetenciesApiError, SKILL_LEVELS } from '../../types/competencies';
import type { Skill, SkillCategory, SkillLevel, SkillStatus } from '../../types/competencies';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import AssignCourseModal from './AssignCourseModal';

interface Props {
  onOpenCompetency:  (id: string) => void;
  onEditSkill:       (skill: Skill) => void;
  onCreateCompetency: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
}

const INPUT: React.CSSProperties = {
  padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  border: '1px solid #d1d5db', borderRadius: 6, color: '#374151', background: '#fff',
};

const LEVEL_COLOR: Record<SkillLevel, { bg: string; fg: string }> = {
  BEGINNER:     { bg: '#f1f5f9', fg: '#475569' },
  INTERMEDIATE: { bg: '#dbeafe', fg: '#1d4ed8' },
  ADVANCED:     { bg: '#e0e7ff', fg: '#4338ca' },
  EXPERT:       { bg: '#fef3c7', fg: '#b45309' },
  CERTIFIED:    { bg: '#dcfce7', fg: '#15803d' },
};

function flattenCategories(tree: SkillCategory[]): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  for (const root of tree) {
    out.push({ id: root.id, label: root.name });
    for (const child of root.children ?? []) out.push({ id: child.id, label: `— ${child.name}` });
  }
  return out;
}

export default function CompetencyListTab({ onOpenCompetency, onEditSkill, onCreateCompetency, showToast, refreshSignal }: Props) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [level, setLevel] = useState<SkillLevel | ''>('');
  const [status, setStatus] = useState<SkillStatus | ''>('');
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useState<{ id: string; label: string }[]>([]);
  const [assignTarget, setAssignTarget] = useState<Skill | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    listSkillCategories().then(tree => setCategories(flattenCategories(tree))).catch(err => console.error(err));
  }, [refreshSignal]);

  const fetchList = useCallback(() => {
    setLoading(true);
    setError(null);
    listSkills({
      page, limit: 10,
      search: search.trim() || undefined,
      categoryId: categoryId || undefined,
      level: level || undefined,
      status: status || undefined,
    })
      .then(res => { setSkills(res.skills); setPagination(res.pagination); })
      .catch(err => setError(err instanceof CompetenciesApiError ? err.message : 'Failed to load competencies.'))
      .finally(() => setLoading(false));
  }, [page, search, categoryId, level, status]);

  useEffect(() => { fetchList(); }, [fetchList, refreshSignal]);
  useEffect(() => { setPage(1); }, [search, categoryId, level, status]);

  useEffect(() => {
    window.addEventListener('competenciesUpdated', fetchList);
    return () => window.removeEventListener('competenciesUpdated', fetchList);
  }, [fetchList]);

  async function toggleArchive(skill: Skill) {
    setBusyId(skill.id);
    try {
      const next: SkillStatus = skill.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
      await updateSkill(skill.id, { status: next });
      invalidateFor(appQueryClient, 'skill.update', { id: skill.id });
      showToast('success', next === 'ARCHIVED' ? 'Competency archived.' : 'Competency reactivated.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof CompetenciesApiError ? err.message : 'Failed to update status.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(skill: Skill) {
    if (!window.confirm(`Delete "${skill.name}"? Blocked if it's still in use anywhere.`)) return;
    setBusyId(skill.id);
    try {
      await deleteSkill(skill.id);
      invalidateFor(appQueryClient, 'skill.delete', { id: skill.id });
      showToast('success', 'Competency deleted.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof CompetenciesApiError ? err.message : 'Delete failed — it may still be in use.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 16, borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input style={{ ...INPUT, width: '100%', paddingLeft: 30, boxSizing: 'border-box' }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search competencies…" />
        </div>
        <select style={INPUT} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select style={INPUT} value={level} onChange={e => setLevel(e.target.value as SkillLevel | '')}>
          <option value="">All levels</option>
          {SKILL_LEVELS.map(l => <option key={l} value={l}>{l[0] + l.slice(1).toLowerCase()}</option>)}
        </select>
        <select style={INPUT} value={status} onChange={e => setStatus(e.target.value as SkillStatus | '')}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button
          type="button" onClick={onCreateCompetency}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          <Plus size={15} strokeWidth={2.5} /> Create Competency
        </button>
      </div>

      {error && (
        <div style={{ margin: 16, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#b91c1c' }}>{error}</div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              {['Skill Name', 'Category', 'Level', 'Linked Courses', 'Assigned Users', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: h === 'Skill Name' ? 'left' : h === 'Actions' ? 'right' : 'center', padding: '10px 12px', color: '#94a3b8', fontWeight: 600, fontSize: 11.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading…</td></tr>
            ) : skills.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No competencies found.</td></tr>
            ) : skills.map(skill => {
              const busy = busyId === skill.id;
              const lc = LEVEL_COLOR[skill.level];
              return (
                <tr key={skill.id} style={{ borderBottom: '1px solid #f8fafc', opacity: busy ? 0.5 : 1 }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }} onClick={() => onOpenCompetency(skill.id)}>{skill.name}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b' }}>{skill.categoryName ?? '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: lc.bg, color: lc.fg }}>{skill.level[0] + skill.level.slice(1).toLowerCase()}</span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#0f172a' }}>{skill.linkedCoursesCount}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#0f172a' }}>{skill.assignedUsersCount}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: skill.status === 'ACTIVE' ? '#dcfce7' : '#f1f5f9', color: skill.status === 'ACTIVE' ? '#15803d' : '#64748b' }}>{skill.status}</span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button type="button" title="Edit" disabled={busy} onClick={() => onEditSkill(skill)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}><Pencil size={14} /></button>
                    <button type="button" title="Assign to Course" disabled={busy} onClick={() => setAssignTarget(skill)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}><Link2 size={14} /></button>
                    <button type="button" title={skill.status === 'ACTIVE' ? 'Archive' : 'Reactivate'} disabled={busy} onClick={() => toggleArchive(skill)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
                      {skill.status === 'ACTIVE' ? <Archive size={14} /> : <ArchiveRestore size={14} />}
                    </button>
                    <button type="button" title="Delete" disabled={busy} onClick={() => handleDelete(skill)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}><Trash2 size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination.pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 14, borderTop: '1px solid #f1f5f9' }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>Prev</button>
          <span style={{ fontSize: 12, color: '#64748b' }}>Page {pagination.page} of {pagination.pages}</span>
          <button type="button" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page >= pagination.pages ? 'default' : 'pointer', opacity: page >= pagination.pages ? 0.5 : 1 }}>Next</button>
        </div>
      )}

      {assignTarget && (
        <AssignCourseModal
          skillId={assignTarget.id}
          skillName={assignTarget.name}
          onClose={() => setAssignTarget(null)}
          onSuccess={() => { setAssignTarget(null); fetchList(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
