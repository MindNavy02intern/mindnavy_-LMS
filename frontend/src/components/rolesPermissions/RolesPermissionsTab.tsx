import { useState } from 'react';
import RolesTab from './RolesTab';
import PermissionsTab from './PermissionsTab';

const RolesPermissionsTab: React.FC = () => {
  const [active, setActive] = useState<0 | 1>(0);

  const pillBtn = (idx: 0 | 1, label: string, icon: string): React.ReactElement => (
    <button
      onClick={() => setActive(idx)}
      style={{
        padding: '7px 18px',
        border: 'none',
        borderRadius: '20px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: active === idx ? 600 : 400,
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        backgroundColor: active === idx ? '#2563eb' : 'transparent',
        color: active === idx ? 'white' : '#6b7280',
        transition: 'all 0.15s',
        boxShadow: active === idx ? '0 1px 4px rgba(37,99,235,0.25)' : 'none',
      }}
    >
      <span>{icon}</span>
      {label}
    </button>
  );

  return (
    <div style={{ width: '100%' }}>
      {/* Pill-style subtab bar */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', padding: '4px', backgroundColor: '#f1f5f9', borderRadius: '24px', width: 'fit-content' }}>
        {pillBtn(0, 'Roles', '🔑')}
        {pillBtn(1, 'Permissions', '🔐')}
      </div>

      {active === 0 && <RolesTab />}
      {active === 1 && <PermissionsTab />}
    </div>
  );
};

export default RolesPermissionsTab;
