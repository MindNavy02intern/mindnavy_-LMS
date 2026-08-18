// Side panel — GET /api/admin/competencies/skills/:id (?competency=<id>).
//
// Judgment call, flagged rather than silently faked: the task spec's panel
// lists a "Framework" field — no real backend source (a skill can belong to
// MANY frameworks, the FrameworkSkill join has no "primary framework"
// concept) — still rendered as honest "not available". Proficiency
// Distribution now has a real source (GET /skills/:id/distribution, grouped
// UserSkillProfile.currentLevel) and is wired below.

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { X, Pencil, Trash2, Plus, Layers, Users, Download, Upload, ClipboardList } from 'lucide-react';
import { deleteSkill, getSkill, getSkillDistribution, removeCourseFromSkill, listCertifications } from '../../services/competenciesApi';
import type { SkillDistribution } from '../../services/competenciesApi';
import { CompetenciesApiError } from '../../types/competencies';
import type { SkillDetail, CompetencyCertification, CertificationStatus } from '../../types/competencies';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import AssignCertificationModal from './AssignCertificationModal';

const LEVEL_COLOR: Record<string, string> = {
  BEGINNER: '#94a3b8', INTERMEDIATE: '#3b82f6', ADVANCED: '#6366f1', EXPERT: '#f59e0b', CERTIFIED: '#16a34a',
};

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

const CERT_STATUS_COLOR: Record<CertificationStatus, { bg: string; fg: string }> = {
  PENDING:  { bg: '#fef9c3', fg: '#854d0e' },
  VERIFIED: { bg: '#dcfce7', fg: '#15803d' },
  REVOKED:  { bg: '#fee2e2', fg: '#b91c1c' },
  EXPIRED:  { bg: '#f1f5f9', fg: '#64748b' },
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
  const [distribution, setDistribution] = useState<SkillDistribution | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [certs, setCerts] = useState<CompetencyCertification[]>([]);
  const [assignCertOpen, setAssignCertOpen] = useState(false);
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
    getSkillDistribution(skillId).then(setDistribution).catch(() => setDistribution(null));
    listCertifications({ skillId, limit: 5 }).then(res => setCerts(res.certifications)).catch(() => setCerts([]));
  }, [skillId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  async function handleUnlinkCourse(courseId: string) {
    if (!detail) return;
    setUnlinkingId(courseId);
    try {
      await removeCourseFromSkill(detail.id, courseId);
      invalidateFor(appQueryClient, 'skill.removeCourse', { id: detail.id, courseId });
      showToast('success', 'Course unlinked.');
      fetchDetail();
    } catch (err) {
      showToast('error', err instanceof CompetenciesApiError ? err.message : 'Failed to unlink course.');
    } finally {
      setUnlinkingId(null);
    }
  }

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
                  <div key={c.mappingId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12, color: c.missing ? '#cbd5e1' : '#374151' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.missing ? 'Deleted course' : c.title}</span>
                    {!c.missing && (
                      <button
                        type="button" title="Unlink course" disabled={unlinkingId === c.courseId}
                        onClick={() => handleUnlinkCourse(c.courseId)}
                        style={{ flexShrink: 0, background: 'none', border: 'none', color: '#94a3b8', cursor: unlinkingId === c.courseId ? 'default' : 'pointer', padding: 2 }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={SECTION}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ ...SECTION_TITLE, marginBottom: 0 }}>Certifications</div>
              <button type="button" onClick={() => setAssignCertOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <Plus size={12} strokeWidth={2.5} /> Assign
              </button>
            </div>
            {certs.length === 0 ? (
              <div style={{ fontSize: 12, color: '#94a3b8' }}>No certifications assigned yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {certs.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                    <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.userName ?? '—'}</span>
                    <span style={{ flexShrink: 0, padding: '1px 7px', borderRadius: 999, fontSize: 9.5, fontWeight: 700, background: CERT_STATUS_COLOR[c.effectiveStatus].bg, color: CERT_STATUS_COLOR[c.effectiveStatus].fg }}>
                      {c.effectiveStatus.charAt(0) + c.effectiveStatus.slice(1).toLowerCase()}
                    </span>
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
            {(() => {
              const entries = distribution ? Object.entries(distribution).filter(([, v]) => v > 0) : [];
              const total = entries.reduce((s, [, v]) => s + v, 0);
              if (!distribution || total === 0) {
                return (
                  <div style={{ textAlign: 'center', padding: '20px 8px', color: '#9ca3af', fontSize: 11.5 }}>
                    No users have a recorded level for this skill yet.
                  </div>
                );
              }
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 90, height: 90, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={entries.map(([level, count]) => ({ level, count }))} dataKey="count" nameKey="level" innerRadius={26} outerRadius={42} paddingAngle={2}>
                          {entries.map(([level]) => <Cell key={level} fill={LEVEL_COLOR[level] ?? '#94a3b8'} />)}
                        </Pie>
                        <Tooltip formatter={(value: number, name: string) => [`${value}`, levelLabel(name)]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {entries.map(([level, count]) => (
                      <div key={level} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: LEVEL_COLOR[level] ?? '#94a3b8', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: '#374151', flex: 1 }}>{levelLabel(level)}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#0f172a' }}>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      )}

      {assignCertOpen && detail && (
        <AssignCertificationModal
          skillId={detail.id}
          skillName={detail.name}
          onClose={() => setAssignCertOpen(false)}
          onSuccess={() => { setAssignCertOpen(false); fetchDetail(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
