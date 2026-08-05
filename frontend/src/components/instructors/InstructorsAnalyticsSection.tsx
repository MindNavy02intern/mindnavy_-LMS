// Bottom analytics section — GET /api/admin/instructors/analytics (task 112).
// Same one-fetch-drives-everything shape as UserAnalytics.tsx; chart style
// (140x140 donut, center label, legend list rendering `percentage` verbatim)
// matches VerificationStatusChart.tsx / UsersByRoleChart.tsx exactly.

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowRight } from 'lucide-react';
import { getInstructorsAnalytics } from '../../services/instructorsApi';
import { InstructorApiError } from '../../types/instructors';
import type { InstructorsAnalytics } from '../../types/instructors';

const SPECIALIZATION_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#7c3aed', '#ec4899', '#94a3b8'];
const COURSE_STATUS_COLORS: Record<string, string> = {
  PUBLISHED: '#16a34a',
  DRAFT:     '#94a3b8',
  PENDING:   '#2563eb',
};

function initials(name: string): string {
  return (name || '?').split(' ').map(w => w[0] ?? '').slice(0, 2).join('').toUpperCase();
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

// Renders `children` when available, otherwise the reason text — nothing
// else. Built once so Finance can flip `earningsOverview.available` on
// later without a new component; used only for Earnings today since the
// other three sections have no `reason` field and are always available in v1.
function AvailabilityGate({ available, reason, children }: { available: boolean; reason?: string; children: ReactNode }) {
  if (available) return <>{children}</>;
  return (
    <div style={{ textAlign: 'center', padding: '28px 12px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Not available yet</div>
      {reason && <div style={{ fontSize: 12, color: '#94a3b8', maxWidth: 340, margin: '0 auto' }}>{reason}</div>}
    </div>
  );
}

function SpecializationDonut({ data }: { data: InstructorsAnalytics['distributionBySpecialization'] }) {
  const { items } = data;
  if (items.length === 0) {
    return <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>No specialization data</div>;
  }
  const total = items.reduce((s, d) => s + d.count, 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', flexShrink: 0, width: 140, height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={items} cx="50%" cy="50%" innerRadius={42} outerRadius={65} dataKey="count" strokeWidth={2} stroke="#fff">
              {items.map((d, i) => <Cell key={d.name} fill={SPECIALIZATION_COLORS[i % SPECIALIZATION_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value) => [(value as number).toLocaleString(), 'Instructors']} />
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
            <div style={{ width: 10, height: 10, borderRadius: 2, background: SPECIALIZATION_COLORS[i % SPECIALIZATION_COLORS.length], flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{d.count.toLocaleString()}</span>
            {/* Server-computed, largest-remainder rounded — render verbatim, never recompute from count. */}
            <span style={{ fontSize: 11, color: '#6b7280', minWidth: 34, textAlign: 'right' }}>{d.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoursesByStatusDonut({ data }: { data: InstructorsAnalytics['coursesByStatus'] }) {
  const { items } = data;
  if (items.length === 0) {
    return <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>No course data</div>;
  }
  const total = items.reduce((s, d) => s + d.count, 0);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ position: 'relative', flexShrink: 0, width: 140, height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={items} cx="50%" cy="50%" innerRadius={42} outerRadius={65} dataKey="count" strokeWidth={2} stroke="#fff">
              {items.map(d => <Cell key={d.status} fill={COURSE_STATUS_COLORS[d.status] ?? '#d1d5db'} />)}
            </Pie>
            <Tooltip formatter={(value) => [(value as number).toLocaleString(), 'Courses']} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#111827' }}>{total.toLocaleString()}</span>
          <span style={{ fontSize: 10, color: '#6b7280' }}>Total</span>
        </div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {items.map(d => (
          <div key={d.status} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: COURSE_STATUS_COLORS[d.status] ?? '#d1d5db', flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: '#374151', flex: 1 }}>{d.status[0] + d.status.slice(1).toLowerCase()}</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{d.count.toLocaleString()}</span>
            <span style={{ fontSize: 11, color: '#6b7280', minWidth: 34, textAlign: 'right' }}>{d.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopInstructorsList({ data }: { data: InstructorsAnalytics['topInstructors'] }) {
  const { items, rankedBy } = data;
  const metricLabel = rankedBy[0].toUpperCase() + rankedBy.slice(1);
  if (items.length === 0) {
    return <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>No instructors yet</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it, i) => (
        <div key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 16, fontSize: 12, fontWeight: 700, color: '#94a3b8', flexShrink: 0, textAlign: 'right' }}>{i + 1}</span>
          {it.photo
            ? <img src={it.photo} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#2563eb,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 10, flexShrink: 0 }}>{initials(it.name)}</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>Rating — · Revenue —</div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{it.studentsCount.toLocaleString()}</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>{metricLabel}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InstructorsAnalyticsSection() {
  const navigate = useNavigate();
  const [data,    setData]    = useState<InstructorsAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const fetch = useCallback(() => {
    setLoading(true);
    setError(null);
    getInstructorsAnalytics()
      .then(setData)
      .catch(err => setError(err instanceof InstructorApiError ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  useEffect(() => {
    window.addEventListener('analyticsUpdated', fetch);
    return () => window.removeEventListener('analyticsUpdated', fetch);
  }, [fetch]);

  if (error) {
    return (
      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, color: '#b91c1c' }}>
        <span>{error}</span>
        <button onClick={fetch} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, color: '#b91c1c', fontSize: 12, fontWeight: 600, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
      <ChartCard title="Instructor Distribution by Specialization">
        {loading || !data ? <ChartSkeleton /> : <SpecializationDonut data={data.distributionBySpecialization} />}
      </ChartCard>

      <ChartCard
        title="Top Instructors"
        action={
          <button
            type="button"
            onClick={() => navigate('/instructors?tab=top')}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            View All <ArrowRight size={12} strokeWidth={2} />
          </button>
        }
      >
        {loading || !data ? <ChartSkeleton /> : <TopInstructorsList data={data.topInstructors} />}
      </ChartCard>

      <ChartCard title="Courses by Status">
        {loading || !data ? <ChartSkeleton /> : <CoursesByStatusDonut data={data.coursesByStatus} />}
      </ChartCard>

      <ChartCard title="Earnings Overview">
        {loading || !data ? <ChartSkeleton /> : (
          <AvailabilityGate available={data.earningsOverview.available} reason={data.earningsOverview.reason}>
            {null}
          </AvailabilityGate>
        )}
      </ChartCard>
    </div>
  );
}
