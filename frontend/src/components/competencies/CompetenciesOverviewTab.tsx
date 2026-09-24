// Overview tab — GET /api/admin/competencies/analytics (drives the 3 charts,
// the Top Competencies table and the Competency Matrix in ONE call) + a
// separate GET /api/admin/competencies/frameworks?limit=5 for the left table.
// Chart style (140x140 donut, center total, legend renders `percentage`
// verbatim) matches InstructorsAnalyticsSection exactly — same design system,
// same rule (server-computed largest-remainder percentages, never recomputed
// client-side, IMPACT_MAP R1).

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { ArrowRight, Plus, MoreVertical, Star } from 'lucide-react';
import { getCompetenciesAnalytics, listFrameworks, deleteFramework } from '../../services/competenciesApi';
import { CompetenciesApiError } from '../../types/competencies';
import type { CompetenciesAnalytics, Framework } from '../../types/competencies';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

// Fixed categorical order — same array InstructorsAnalyticsSection uses for
// its specialization donut (assign by index, never re-derived per render).
const CATEGORY_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#ec4899', '#94a3b8'];

// Severity is a STATUS encoding, not a categorical one — fixed semantic colors
// (red=critical…gray=low), reserved, never reused for "series N".
const GAP_SEVERITY_COLOR: Record<string, string> = {
  Critical: '#dc2626',
  High:     '#f59e0b',
  Medium:   '#eab308',
  Low:      '#94a3b8',
};

const FRAMEWORK_STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  ACTIVE:   { bg: '#dcfce7', fg: '#15803d' },
  DRAFT:    { bg: '#f1f5f9', fg: '#475569' },
  ARCHIVED: { bg: '#f1f5f9', fg: '#94a3b8' },
};

function matrixCellColor(pct: number | null): { bg: string; fg: string } {
  if (pct === null) return { bg: '#f8fafc', fg: '#cbd5e1' };
  if (pct >= 70) return { bg: '#dcfce7', fg: '#15803d' };
  if (pct >= 40) return { bg: '#fef9c3', fg: '#a16207' };
  return { bg: '#fee2e2', fg: '#b91c1c' };
}

function ChartCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '8px 0' }}>
      <div style={{ width: 120, height: 120, borderRadius: '50%', background: '#e5e7eb', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ height: 14, borderRadius: 4, background: '#e5e7eb', width: `${55 + i * 8}%` }} />
        ))}
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>{label}</div>;
}

function CategoryDonut({ data }: { data: CompetenciesAnalytics['competenciesByCategory'] }) {
  const { items } = data;
  if (items.length === 0) return <EmptyChart label="No competency category data" />;
  const total = items.reduce((s, d) => s + d.count, 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', flexShrink: 0, width: 140, height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={items} cx="50%" cy="50%" innerRadius={42} outerRadius={65} dataKey="count" strokeWidth={2} stroke="#fff">
              {items.map((d, i) => <Cell key={d.name} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value) => [(value as number).toLocaleString(), 'Competencies']} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{total.toLocaleString()}</span>
          <span style={{ fontSize: 10, color: '#6b7280' }}>Total</span>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
        {items.map((d, i) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: CATEGORY_COLORS[i % CATEGORY_COLORS.length], flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{d.count.toLocaleString()}</span>
            <span style={{ fontSize: 11, color: '#6b7280', minWidth: 34, textAlign: 'right' }}>{d.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GapOverviewDonut({ data }: { data: CompetenciesAnalytics['skillGapOverview'] }) {
  const { items } = data;
  if (items.length === 0) return <EmptyChart label="No skill gaps detected" />;
  const total = items.reduce((s, d) => s + d.count, 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', flexShrink: 0, width: 140, height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={items} cx="50%" cy="50%" innerRadius={42} outerRadius={65} dataKey="count" strokeWidth={2} stroke="#fff">
              {items.map(d => <Cell key={d.level} fill={GAP_SEVERITY_COLOR[d.level] ?? '#d1d5db'} />)}
            </Pie>
            <Tooltip formatter={(value) => [(value as number).toLocaleString(), 'Gaps']} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{total.toLocaleString()}</span>
          <span style={{ fontSize: 10, color: '#6b7280' }}>Total</span>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map(d => (
          <div key={d.level} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: GAP_SEVERITY_COLOR[d.level] ?? '#d1d5db', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>{d.level}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{d.count.toLocaleString()}</span>
            <span style={{ fontSize: 11, color: '#6b7280', minWidth: 34, textAlign: 'right' }}>{d.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProficiencyTrendChart({ data }: { data: CompetenciesAnalytics['proficiencyTrend'] }) {
  if (!data.available || data.labels.length === 0) return <EmptyChart label="No proficiency trend data" />;
  const rows = data.labels.map((label, i) => ({
    label,
    avg: data.avgProficiency[i] ?? 0,
    target: data.targetProficiency[i],
  }));
  const hasTarget = data.targetProficiency.some(v => v !== null);
  return (
    <div style={{ height: 170 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} />
          <Tooltip formatter={(value: number) => `${value}%`} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Line type="monotone" dataKey="avg" name="Avg. Proficiency" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} connectNulls />
          {hasTarget && (
            <Line type="monotone" dataKey="target" name="Target" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ImportanceStars({ importance }: { importance: string | null }) {
  const RANK: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  if (!importance) return <span style={{ fontSize: 11, color: '#cbd5e1' }}>—</span>;
  const n = RANK[importance] ?? 0;
  return (
    <span style={{ display: 'inline-flex', gap: 1 }} title={importance}>
      {[1, 2, 3, 4].map(i => (
        <Star key={i} size={12} strokeWidth={0} fill={i <= n ? '#f59e0b' : '#e5e7eb'} />
      ))}
    </span>
  );
}

function TopCompetenciesTable({ data, onView }: { data: CompetenciesAnalytics['topCompetencies']; onView: (id: string) => void }) {
  const { items } = data;
  if (items.length === 0) return <EmptyChart label="No competencies assessed yet" />;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
            {['Competency', 'Category', 'Users Assessed', 'Proficiency Avg', 'Importance'].map(h => (
              <th key={h} style={{ textAlign: h === 'Competency' ? 'left' : 'right', padding: '6px 8px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} onClick={() => onView(item.id)} style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}>
              <td style={{ padding: '8px', color: '#0f172a', fontWeight: 600 }}>{item.name}</td>
              <td style={{ padding: '8px', textAlign: 'right', color: '#64748b' }}>{item.category ?? '—'}</td>
              <td style={{ padding: '8px', textAlign: 'right', color: '#0f172a' }}>{item.usersAssessed.toLocaleString()}</td>
              <td style={{ padding: '8px', textAlign: 'right', color: '#0f172a' }}>{item.proficiencyAvg}%</td>
              <td style={{ padding: '8px', textAlign: 'right' }}><ImportanceStars importance={item.importance} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompetencyMatrixTable({ data }: { data: CompetenciesAnalytics['competencyMatrix'] }) {
  if (!data.available || data.competencies.length === 0) {
    return <EmptyChart label="Not enough data yet — add frameworks with required skills to build the matrix" />;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 480 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '8px', color: '#94a3b8', fontWeight: 600, fontSize: 11, borderBottom: '1px solid #f1f5f9' }}>Role</th>
            {data.competencies.map(c => (
              <th key={c} style={{ textAlign: 'center', padding: '8px', color: '#94a3b8', fontWeight: 600, fontSize: 11, borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.data.map(row => (
            <tr key={row.role}>
              <td style={{ padding: '8px', fontWeight: 600, color: '#0f172a', borderBottom: '1px solid #f8fafc' }}>{row.role[0] + row.role.slice(1).toLowerCase()}</td>
              {data.competencies.map(c => {
                const pct = row.values[c] ?? null;
                const { bg, fg } = matrixCellColor(pct);
                return (
                  <td key={c} style={{ padding: '6px', borderBottom: '1px solid #f8fafc', textAlign: 'center' }}>
                    <span style={{ display: 'inline-block', minWidth: 44, padding: '3px 8px', borderRadius: 6, background: bg, color: fg, fontWeight: 700, fontSize: 11 }}>
                      {pct === null ? '—' : `${pct}%`}
                    </span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FrameworksTable({
  frameworks, loading, onAdd, onView, onEdit, onDeleted, showToast,
}: {
  frameworks: Framework[];
  loading: boolean;
  onAdd: () => void;
  onView: (id: string) => void;
  onEdit: (fw: Framework) => void;
  onDeleted: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  async function handleDelete(fw: Framework) {
    setMenuOpenId(null);
    if (!window.confirm(`Delete framework "${fw.name}"? This removes its skill requirements only — the skills themselves are unaffected.`)) return;
    try {
      await deleteFramework(fw.id);
      invalidateFor(appQueryClient, 'framework.delete', { id: fw.id });
      showToast('success', 'Framework deleted.');
      onDeleted();
    } catch (err) {
      showToast('error', err instanceof CompetenciesApiError ? err.message : 'Failed to delete framework.');
    }
  }

  return (
    <ChartCard
      title="Competency Frameworks"
      action={
        <button type="button" onClick={onAdd} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <Plus size={13} strokeWidth={2.5} /> Add Framework
        </button>
      }
    >
      {loading ? <ChartSkeleton /> : frameworks.length === 0 ? <EmptyChart label="No frameworks yet" /> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                {['Framework Name', 'Competencies', 'Users Mapped', 'Status', ''].map(h => (
                  <th key={h} style={{ textAlign: h === 'Framework Name' ? 'left' : h === '' ? 'right' : 'center', padding: '6px 8px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {frameworks.map(fw => {
                const sc = FRAMEWORK_STATUS_COLOR[fw.status] ?? { bg: '#f1f5f9', fg: '#64748b' };
                return (
                  <tr key={fw.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '8px', color: '#0f172a', fontWeight: 600, cursor: 'pointer' }} onClick={() => onView(fw.id)}>
                      {fw.name}
                      {fw.description && <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 400, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fw.description}</div>}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'center', color: '#0f172a' }}>{fw.competenciesCount}</td>
                    <td style={{ padding: '8px', textAlign: 'center', color: '#0f172a' }}>{fw.usersMapped}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: sc.bg, color: sc.fg }}>{fw.status}</span>
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', position: 'relative' }}>
                      <button type="button" onClick={() => onEdit(fw)} style={{ fontSize: 11, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', marginRight: 8 }}>Edit</button>
                      <button type="button" onClick={() => setMenuOpenId(o => o === fw.id ? null : fw.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', verticalAlign: 'middle' }}>
                        <MoreVertical size={14} />
                      </button>
                      {menuOpenId === fw.id && (
                        <div style={{ position: 'absolute', right: 8, top: '100%', zIndex: 10, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 100 }}>
                          <button type="button" onClick={() => handleDelete(fw)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', fontSize: 12, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 10, textAlign: 'right' }}>
        <button type="button" onClick={() => onView('')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          View All Frameworks <ArrowRight size={12} strokeWidth={2} />
        </button>
      </div>
    </ChartCard>
  );
}

interface Props {
  onOpenCompetency:   (id: string) => void;
  onCreateFramework:  () => void;
  onEditFramework:    (fw: Framework) => void;
  onNavigateFrameworks: () => void;
  onNavigateList:       () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
  // Bumped by the "Competency Matrix" header button — scrolls to and briefly
  // highlights the matrix section below, including when it's already mounted
  // (a plain mount-effect wouldn't refire on a second click from the same tab).
  scrollToMatrixToken?: number;
}

export default function CompetenciesOverviewTab({
  onOpenCompetency, onCreateFramework, onEditFramework, onNavigateFrameworks, onNavigateList, showToast, refreshSignal, scrollToMatrixToken,
}: Props) {
  const [analytics, setAnalytics] = useState<CompetenciesAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [frameworksLoading, setFrameworksLoading] = useState(true);

  const matrixRef = useRef<HTMLDivElement>(null);
  const [matrixHighlighted, setMatrixHighlighted] = useState(false);

  const fetchAnalytics = useCallback(() => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    getCompetenciesAnalytics()
      .then(setAnalytics)
      .catch(err => setAnalyticsError(err instanceof CompetenciesApiError ? err.message : 'Failed to load analytics'))
      .finally(() => setAnalyticsLoading(false));
  }, []);

  const fetchFrameworks = useCallback(() => {
    setFrameworksLoading(true);
    listFrameworks({ limit: 5 })
      .then(res => setFrameworks(res.frameworks))
      .catch(err => console.error(err))
      .finally(() => setFrameworksLoading(false));
  }, []);

  useEffect(() => { fetchAnalytics(); fetchFrameworks(); }, [fetchAnalytics, fetchFrameworks, refreshSignal]);

  useEffect(() => {
    window.addEventListener('competenciesUpdated', fetchAnalytics);
    window.addEventListener('competenciesUpdated', fetchFrameworks);
    return () => {
      window.removeEventListener('competenciesUpdated', fetchAnalytics);
      window.removeEventListener('competenciesUpdated', fetchFrameworks);
    };
  }, [fetchAnalytics, fetchFrameworks]);

  // Runs on mount too (not just on change) — covers both "arrived from another
  // tab with the token already set" and "clicked again while already here".
  useEffect(() => {
    if (!scrollToMatrixToken) return;
    const raf = requestAnimationFrame(() => {
      matrixRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    setMatrixHighlighted(true);
    const t = setTimeout(() => setMatrixHighlighted(false), 1600);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [scrollToMatrixToken]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 16, alignItems: 'start' }}>
        <FrameworksTable
          frameworks={frameworks}
          loading={frameworksLoading}
          onAdd={onCreateFramework}
          onView={id => (id ? onOpenCompetency(id) : onNavigateFrameworks())}
          onEdit={onEditFramework}
          onDeleted={() => { fetchFrameworks(); fetchAnalytics(); }}
          showToast={showToast}
        />

        <ChartCard
          title="Top Competencies"
          action={
            <button type="button" onClick={onNavigateList} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              View All <ArrowRight size={12} strokeWidth={2} />
            </button>
          }
        >
          {analyticsLoading || !analytics ? <ChartSkeleton /> : (
            <TopCompetenciesTable data={analytics.topCompetencies} onView={onOpenCompetency} />
          )}
        </ChartCard>
      </div>

      {analyticsError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: '#b91c1c' }}>
          <span>{analyticsError}</span>
          <button onClick={fetchAnalytics} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, color: '#b91c1c', fontSize: 12, fontWeight: 600, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Retry
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <ChartCard title="Competency Categories">
          {analyticsLoading || !analytics ? <ChartSkeleton /> : <CategoryDonut data={analytics.competenciesByCategory} />}
        </ChartCard>
        <ChartCard title="Skill Gap Overview">
          {analyticsLoading || !analytics ? <ChartSkeleton /> : <GapOverviewDonut data={analytics.skillGapOverview} />}
        </ChartCard>
        <ChartCard title="Proficiency Trend">
          {analyticsLoading || !analytics ? <ChartSkeleton /> : <ProficiencyTrendChart data={analytics.proficiencyTrend} />}
        </ChartCard>
      </div>

      <div
        id="matrix"
        ref={matrixRef}
        style={{
          borderRadius: 12,
          boxShadow: matrixHighlighted ? '0 0 0 3px #93c5fd' : '0 0 0 0px transparent',
          transition: 'box-shadow 0.3s ease',
        }}
      >
        <ChartCard
          title="Competency Matrix"
          action={
            <button type="button" onClick={onNavigateFrameworks} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              View Full Competency Matrix <ArrowRight size={12} strokeWidth={2} />
            </button>
          }
        >
          {analyticsLoading || !analytics ? <ChartSkeleton /> : <CompetencyMatrixTable data={analytics.competencyMatrix} />}
        </ChartCard>
      </div>
    </div>
  );
}
