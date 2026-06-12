import { useState } from 'react';
import DepartmentsTab    from './DepartmentsTab';
import BranchesTab       from './BranchesTab';
import TeamsTab          from './TeamsTab';
import OrganizationChart from './OrganizationChart';
import HierarchySettings from './HierarchySettings';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

type SubTab = 'departments' | 'branches' | 'teams' | 'chart' | 'settings';

const SUB_TABS: Array<{ key: SubTab; label: string }> = [
  { key: 'departments', label: 'Departments' },
  { key: 'branches',    label: 'Branches'    },
  { key: 'teams',       label: 'Teams'       },
  { key: 'chart',       label: 'Org Chart'   },
  { key: 'settings',    label: 'Hierarchy Settings' },
];

export default function OrganizationTab({ showToast }: Props) {
  const [active, setActive] = useState<SubTab>('departments');

  return (
    <div>
      {/* Sub-tab navigation */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid #e5e7eb', marginBottom: 20, overflowX: 'auto' }}>
        {SUB_TABS.map(tab => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontFamily: 'inherit',
                fontWeight: isActive ? 600 : 400,
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
                color: isActive ? '#2563eb' : '#6b7280',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                marginBottom: -1,
                transition: 'color 0.15s',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active tab content */}
      {active === 'departments' && <DepartmentsTab showToast={showToast} />}
      {active === 'branches'    && <BranchesTab    showToast={showToast} />}
      {active === 'teams'       && <TeamsTab        showToast={showToast} />}
      {active === 'chart'       && <OrganizationChart showToast={showToast} />}
      {active === 'settings'    && <HierarchySettings showToast={showToast} />}
    </div>
  );
}
