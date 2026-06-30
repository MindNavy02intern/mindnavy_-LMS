import type { RolePageStats } from '../../types/rolesPage';

const ROWS: { key: keyof RolePageStats; label: string }[] = [
  { key: 'usersWithRoles',   label: 'Total Users with Roles' },
  { key: 'activeRoles',      label: 'Active Roles' },
  { key: 'totalRoles',       label: 'Total Roles' },
  { key: 'totalPermissions', label: 'Total Permissions' },
];

interface Props {
  stats:     RolePageStats | null;
  loading:   boolean;
  onViewAll: () => void;
}

// Reuses the RolePageStats already fetched at the top of
// RolesPermissionsStandalonePage (getRolesPageStats) — no separate fetch here,
// so this preview can never drift from the page's own KPI cards.
export default function UserRoleAssignmentsPreviewCard({ stats, loading, onViewAll }: Props) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>User Role Assignments</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Oversee user role distribution</div>
        </div>
        <button
          onClick={onViewAll}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#3b82f6', fontFamily: 'inherit', padding: 0 }}
        >
          View All
        </button>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 130, justifyContent: 'center' }}>
        {ROWS.map(row => (
          <div key={row.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: '#6b7280' }}>{row.label}</span>
            {loading ? (
              <div style={{ width: 36, height: 13, borderRadius: 3, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite' }} />
            ) : (
              <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{(stats?.[row.key] ?? 0).toLocaleString()}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
