import { useEffect, useRef, useState } from 'react';

interface Props {
  selectedCount: number;
  onClearSelection: () => void;
}

const ACTIONS = [
  { key: 'suspend',  label: 'Suspend Users',    icon: '🚫', danger: false },
  { key: 'assign',   label: 'Assign Role',       icon: '🔑', danger: false },
  { key: 'enroll',   label: 'Bulk Enroll',       icon: '📚', danger: false },
  { key: 'notify',   label: 'Send Notification', icon: '✉️', danger: false },
  { key: 'export',   label: 'Export Selected',   icon: '📤', danger: false },
  { key: 'delete',   label: 'Delete Users',       icon: '🗑️', danger: true  },
] as const;

export default function BulkActionsMenu({ selectedCount, onClearSelection }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (selectedCount === 0) return null;

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {/* Selection badge */}
      <span style={{
        fontSize: 12, fontWeight: 600, color: '#2563eb',
        background: '#eff6ff', border: '1px solid #bfdbfe',
        borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap',
      }}>
        {selectedCount} selected
      </span>

      {/* Bulk actions dropdown trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', fontSize: 13, fontWeight: 600,
          background: open ? '#1d4ed8' : '#2563eb', color: '#fff',
          border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Bulk Actions
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* Clear selection */}
      <button
        onClick={onClearSelection}
        style={{
          fontSize: 12, color: '#9ca3af', background: 'none', border: 'none',
          cursor: 'pointer', padding: '4px 6px', borderRadius: 5,
        }}
        title="Clear selection"
        onMouseEnter={e => { e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = '#f3f4f6'; }}
        onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.background = 'none'; }}
      >
        ✕
      </button>

      {/* Dropdown menu */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
          background: '#fff', border: '1px solid #e5e7eb', borderRadius: 9,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 200, overflow: 'hidden',
        }}>
          <div style={{ padding: '6px 12px 4px', fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {selectedCount} user{selectedCount !== 1 ? 's' : ''} selected
          </div>
          <div style={{ height: 1, background: '#f3f4f6', margin: '2px 0' }} />

          {ACTIONS.map(a => (
            <button
              key={a.key}
              disabled
              title="Coming soon"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 8, padding: '9px 14px', fontSize: 13, fontFamily: 'inherit',
                background: 'none', border: 'none', cursor: 'not-allowed',
                color: a.danger ? '#dc2626' : '#374151',
                opacity: 0.55, textAlign: 'left',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>{a.icon}</span>
                {a.label}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 700, color: '#9ca3af', background: '#f3f4f6',
                border: '1px solid #e5e7eb', borderRadius: 4, padding: '1px 5px',
                textTransform: 'uppercase', letterSpacing: '0.4px',
              }}>
                Soon
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
