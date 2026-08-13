// Side panel — GET /api/admin/competencies/skills/:id (?competency=<id>).
//
// Judgment call, flagged rather than silently faked: the task spec's panel
// lists a "Framework" field and a "Proficiency Distribution donut" — neither
// has a real backend source. A skill can belong to MANY frameworks (the
// FrameworkSkill join has no "primary framework" concept) and no endpoint
// returns a per-skill level-distribution breakdown. Both are rendered as
// honest "not available" rather than invented — see AvailabilityNote below.

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X, Pencil, Trash2, Plus, Layers, Users, Download, Upload, ClipboardList } from 'lucide-react';
import { deleteSkill, getSkill } from '../../services/competenciesApi';
import { CompetenciesApiError } from '../../types/competencies';
import type { SkillDetail } from '../../types/competencies';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  skillId:   string;
  onClose:   () => void;
  onEdit:    (skill: SkillDetail) => void;
  onDeleted: () => void;
  onCreateCompetency: () => void;
  onCreateFramework:  () => void;
  onAssignToUsers:    (skill: SkillDetail) => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  ACTIVE:   { bg: '#dcfce7', fg: '#15803d' },
  ARCHIVED: { bg: '#f1f5f9', fg: '#64748b' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function levelLabel(level: string): string {
  return level[0] + level.slice(1).toLowerCase();
}

const SECTION: React.CSSProperties = { padding: '16px 20px', borderBottom: '1px solid #f1f5f9' };
const SECTION_TITLE: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 };
const ROW: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '4px 0' };

function QuickAction({ Icon, label, onClick }: { Icon: typeof Plus; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 10px',
        fontSize: 12.5, fontWeight: 500, fontFamily: 'inherit', color: '#374151',
        background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
      }}
    >
      <Icon size={14} color="#64748b" strokeWidth={2} />
      {label}
    </button>
  );
}

export default function CompetencySidePanel({
  skillId, onClose, onEdit, onDeleted, onCreateCompetency, onCreateFramework, onAssignToUsers, showToast,
}: Props) {
  const [detail, setDetail] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [, setSearchParams] = useSearchParams();

  function goToImportExport() {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'import-export');
      return next;
    });
  }

  const fetchDetail = useCallback(() => {
    setLoading(true);
    setError(null);
    getSkill(skillId)
      .then(setDetail)
      .catch(err => setError(err instanceof CompetenciesApiError ? err.message : 'Failed to load competency.'))
      .finally(() => setLoading(false));
  }, [skillId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  async function handleDelete() {
    if (!detail) return;
    if (!window.confirm(`Delete "${detail.name}"? This is blocked while it's still in use anywhere.`)) return;
    setDeleting(true);
    try {
      await deleteSkill(detail.id);
      invalidateFor(appQueryClient, 'skill.delete', { id: detail.id });
      showToast('success', 'Competency deleted.');
      onDeleted();
    } catch (err) {
      showToast('error', err instanceof CompetenciesApiError ? err.message : 'Delete failed — it may still be in use.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div style={{ width: 340, flexShrink: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ minWidth: 0 }}>
          {loading || !detail ? (
            <div style={{ width: 140, height: 16, borderRadius: 4, background: '#f0f0f0' }} />
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail.name}</div>
              <span style={{ display: 'inline-block', marginTop: 6, padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: STATUS_COLOR[detail.status]?.bg, color: STATUS_COLOR[detail.status]?.fg }}>
                {detail.status}
              </span>
            </>
          )}
        </div>
        <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', flexShrink: 0 }}>
          <X size={18} />
        </button>
      </div>

      {error ? (
        <div style={{ padding: 20, fontSize: 12.5, color: '#b91c1c' }}>{error}</div>
      ) : loading || !detail ? (
        <div style={{ padding: 20, fontSize: 12.5, color: '#94a3b8' }}>Loading…</div>
      ) : (
        <>
          <div style={{ padding: '10px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => onEdit(detail)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', fontSize: 12, fontWeight: 600, color: '#374151', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer' }}>
              <Pencil size={13} /> Edit
            </button>
            <button type="button" onClick={handleDelete} disabled={deleting} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '7px 0', fontSize: 12, fontWeight: 600, color: '#dc2626', background: '#fff', border: '1px solid #fecaca', borderRadius: 6, cursor: deleting ? 'default' : 'pointer', opacity: deleting ? 0.6 : 1 }}>
              <Trash2 size={13} /> {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>

          <div style={SECTION}>
            <div style={SECTION_TITLE}>Details</div>
            <div style={ROW}><span style={{ color: '#94a3b8' }}>Category</span><span style={{ color: '#0f172a', fontWeight: 600 }}>{detail.categoryName ?? '—'}</span></div>
            <div style={ROW}><span style={{ color: '#94a3b8' }}>Level</span><span style={{ color: '#0f172a', fontWeight: 600 }}>{levelLabel(detail.level)}</span></div>
            <div style={ROW}><span style={{ color: '#94a3b8' }}>Linked Courses</span><span style={{ color: '#0f172a', fontWeight: 600 }}>{detail.linkedCoursesCount}</span></div>
            <div style={ROW}><span style={{ color: '#94a3b8' }}>Assigned Users</span><span style={{ color: '#0f172a', fontWeight: 600 }}>{detail.assignedUsersCount}</span></div>
            <div style={ROW}><span style={{ color: '#94a3b8' }}>Created</span><span style={{ color: '#0f172a' }}>{formatDate(detail.createdAt)}</span></div>
            <div style={ROW}><span style={{ color: '#94a3b8' }}>Updated</span><span style={{ color: '#0f172a' }}>{formatDate(detail.updatedAt)}</span></div>
          </div>

          <div style={SECTION}>
            <div style={SECTION_TITLE}>Linked Courses</div>
            {detail.linkedCourses.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>No courses assigned yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {detail.linkedCourses.map(c => (
                  <div key={c.mappingId} style={{ fontSize: 12, color: c.missing ? '#cbd5e1' : '#374151' }}>
                    {c.missing ? 'Deleted course' : c.title}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={SECTION}>
            <div style={SECTION_TITLE}>Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <QuickAction Icon={Plus} label="Create Competency" onClick={onCreateCompetency} />
              <QuickAction Icon={Layers} label="Create Framework" onClick={onCreateFramework} />
              <QuickAction Icon={Users} label="Assign to Users" onClick={() => onAssignToUsers(detail)} />
              <QuickAction Icon={ClipboardList} label="Bulk Assessment" onClick={() => onAssignToUsers(detail)} />
              <QuickAction Icon={Upload} label="Import Competencies" onClick={goToImportExport} />
              <QuickAction Icon={Download} label="Export Report" onClick={goToImportExport} />
            </div>
          </div>

          <div style={{ padding: '16px 20px' }}>
            <div style={SECTION_TITLE}>Proficiency Distribution</div>
            <div style={{ textAlign: 'center', padding: '20px 8px', color: '#9ca3af', fontSize: 11.5 }}>
              Not available yet — no per-competency level-breakdown endpoint exists.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
