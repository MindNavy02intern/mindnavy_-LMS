import { useState } from 'react';
import RolesTab from '../components/rolesPermissions/RolesTab';
import PermissionsTab from '../components/rolesPermissions/PermissionsTab';

const TAB_STYLE_BASE: React.CSSProperties = {
  padding: '12px 24px',
  border: 'none',
  backgroundColor: 'transparent',
  cursor: 'pointer',
  fontSize: '15px',
};

const RolesPermissionsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<0 | 1>(0);

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 600, color: '#1a1a2e' }}>Roles &amp; Permissions</h1>
      <p style={{ color: '#666', margin: '6px 0 0' }}>Manage system roles and assign permissions</p>

      <div style={{ borderBottom: '1px solid #ddd', marginTop: '24px' }}>
        <div style={{ display: 'flex' }}>
          {(['Roles', 'Permissions'] as const).map((label, i) => (
            <button
              key={label}
              onClick={() => setActiveTab(i as 0 | 1)}
              style={{
                ...TAB_STYLE_BASE,
                borderBottom: activeTab === i ? '3px solid #1976d2' : '3px solid transparent',
                color: activeTab === i ? '#1976d2' : '#555',
                fontWeight: activeTab === i ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        {activeTab === 0 && <RolesTab />}
        {activeTab === 1 && <PermissionsTab />}
      </div>
    </div>
  );
};

export default RolesPermissionsPage;
