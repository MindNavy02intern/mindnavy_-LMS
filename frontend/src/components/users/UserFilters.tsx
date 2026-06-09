import { DEPARTMENT_OPTIONS } from '../../constants/userOptions';

interface Props {
  search:       string;
  onSearch:     (v: string) => void;
  role:         string;
  onRole:       (v: string) => void;
  department:   string;
  onDepartment: (v: string) => void;
  status:       string;
  onStatus:     (v: string) => void;
  onAddUser?:   () => void;
}

const INPUT: React.CSSProperties = {
  fontSize: 13, fontFamily: 'inherit', outline: 'none',
  background: '#ffffff', border: '1px solid #d1d5db',
  borderRadius: 6, color: '#374151',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
};

const SELECT: React.CSSProperties = { ...INPUT, padding: '5px 8px', cursor: 'pointer' };

export default function UserFilters({
  search, onSearch, role, onRole, department, onDepartment, status, onStatus, onAddUser,
}: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>

      {/* Left: search + filter dropdowns */}
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

        {/* Role */}
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

        {/* Department */}
        <select
          value={department} onChange={e => onDepartment(e.target.value)} style={{ ...SELECT, width: 160 }}
          onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.15)'; }}
          onBlur={e =>  { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <option value="">All Departments</option>
          {DEPARTMENT_OPTIONS.filter(o => o.value !== '').map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Status */}
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
      </div>

      {/* Right: Add User */}
      <button
        onClick={onAddUser}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '5px 12px', fontSize: 12, fontFamily: 'inherit',
          background: '#16a34a', color: '#fff', border: '1px solid #15803d',
          borderRadius: 6, fontWeight: 600,
          cursor: onAddUser ? 'pointer' : 'default',
        }}
        onMouseEnter={e => { if (onAddUser) e.currentTarget.style.background = '#15803d'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#16a34a'; }}
        title={onAddUser ? 'Add a new user' : undefined}
      >
        + Add User
      </button>
    </div>
  );
}
