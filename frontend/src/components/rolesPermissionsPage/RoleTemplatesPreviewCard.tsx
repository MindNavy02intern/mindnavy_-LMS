import type { ToastType } from '../users/Toast';

// Static predefined templates — no backend endpoint for this preview yet.
// The full "Role Templates" tab (RoleTemplatesTab.tsx) already has real
// CRUD wired to GET/POST /role-templates; this dashboard preview intentionally
// shows a fixed shortlist instead of duplicating that fetch.
const TEMPLATES = [
  { name: 'Instructor Template',      permissionCount: 72  },
  { name: 'HR Manager Template',      permissionCount: 128 },
  { name: 'Finance Manager Template', permissionCount: 162 },
  { name: 'Branch Manager Template',  permissionCount: 98  },
];

interface Props {
  onViewAll: () => void;
  showToast: (type: ToastType, message: string) => void;
}

export default function RoleTemplatesPreviewCard({ onViewAll, showToast }: Props) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>Role Templates</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>Predefined role templates</div>
        </div>
        <button
          onClick={onViewAll}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#3b82f6', fontFamily: 'inherit', padding: 0 }}
        >
          View All
        </button>
      </div>

      <div style={{ padding: '4px 16px 8px', display: 'flex', flexDirection: 'column', minHeight: 130, justifyContent: 'center' }}>
        {TEMPLATES.map(t => (
          <div key={t.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid #f8fafc' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 12, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
              <div style={{ fontSize: 10.5, color: '#9ca3af', marginTop: 1 }}>{t.permissionCount} permissions</div>
            </div>
            <button
              onClick={() => showToast('success', `${t.name} — Coming Soon`)}
              style={{ flexShrink: 0, padding: '4px 10px', fontSize: 11, fontWeight: 600, background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Use
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
