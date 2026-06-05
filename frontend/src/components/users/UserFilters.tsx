interface Props {
  search:       string;
  onSearch:     (v: string) => void;
  role:         string;
  onRole:       (v: string) => void;
  department:   string;
  onDepartment: (v: string) => void;
  status:       string;
  onStatus:     (v: string) => void;
}

const INPUT: React.CSSProperties = {
  fontSize: 13, fontFamily: 'inherit', outline: 'none',
  background: '#ffffff', border: '1px solid #d1d5db',
  borderRadius: 6, color: '#374151',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
};

const SELECT: React.CSSProperties = {
  ...INPUT,
  padding: '5px 8px',
  cursor: 'pointer',
};

const ICON_BTN: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 5,
  padding: '5px 10px', fontSize: 12, fontFamily: 'inherit',
  background: '#f9fafb', border: '1px solid #d1d5db',
  borderRadius: 6, color: '#6b7280',
  cursor: 'not-allowed', opacity: 0.65, whiteSpace: 'nowrap',
};

const ACTION_BTN: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '5px 10px', fontSize: 12, fontFamily: 'inherit',
  background: '#ffffff', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 6,
  cursor: 'not-allowed', opacity: 0.6, whiteSpace: 'nowrap',
};

export default function UserFilters({
  search, onSearch, role, onRole, department, onDepartment, status, onStatus,
}: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>

      {/* ── Left group: search + filter dropdowns ─────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <svg
            style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}
            width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={e => onSearch(e.target.value)}
            style={{ ...INPUT, paddingLeft: 28, paddingRight: 10, paddingTop: 5, paddingBottom: 5, width: 220 }}
            onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.15)'; }}
            onBlur={e =>  { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
          />
        </div>

        {/* All Roles */}
        <select
          value={role} onChange={e => onRole(e.target.value)} style={{ ...SELECT, width: 130 }}
          onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.15)'; }}
          onBlur={e =>  { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <option value="">All Roles</option>
          <option value="Student">Student</option>
          <option value="Instructor">Instructor</option>
          <option value="Administrator">Administrator</option>
          <option value="Manager">Manager</option>
          <option value="HR Manager">HR Manager</option>
          <option value="Finance Manager">Finance Manager</option>
          <option value="Branch Manager">Branch Manager</option>
        </select>

        {/* All Departments */}
        <select
          value={department} onChange={e => onDepartment(e.target.value)} style={{ ...SELECT, width: 140 }}
          onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.15)'; }}
          onBlur={e =>  { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <option value="">All Departments</option>
          <option value="Engineering">Engineering</option>
          <option value="Product">Product</option>
          <option value="Design">Design</option>
          <option value="Marketing">Marketing</option>
          <option value="Operations">Operations</option>
          <option value="Finance">Finance</option>
          <option value="HR">HR</option>
          <option value="Sales">Sales</option>
        </select>

        {/* All Status */}
        <select
          value={status} onChange={e => onStatus(e.target.value)} style={{ ...SELECT, width: 120 }}
          onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.15)'; }}
          onBlur={e =>  { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="pending">Pending</option>
          <option value="archived">Archived</option>
          <option value="invited">Invited</option>
        </select>

        {/* Filters */}
        <button disabled style={ICON_BTN} title="Coming soon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          Filters
        </button>

        {/* Columns */}
        <button disabled style={ICON_BTN} title="Coming soon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
          </svg>
          Columns
        </button>
      </div>

      {/* ── Right group: action buttons ───────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          disabled
          style={{ ...ACTION_BTN, background: '#16a34a', color: '#fff', border: '1px solid #15803d', fontWeight: 600 }}
          title="Coming soon"
        >
          + Add User
        </button>
        <button disabled style={ACTION_BTN} title="Coming soon">Import Users</button>
        <button disabled style={ACTION_BTN} title="Coming soon">Export Users</button>
        <button disabled style={{ ...ACTION_BTN, gap: 4 }} title="Coming soon">
          Bulk Actions
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
