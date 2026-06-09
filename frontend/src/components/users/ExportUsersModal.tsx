import { useState } from 'react';

interface Props {
  onClose:      () => void;
  totalUsers?:  number;
}

const FORMATS = [
  { value: 'csv',   label: 'CSV',   desc: 'Comma-separated values — opens in Excel or any spreadsheet' },
  { value: 'excel', label: 'Excel', desc: 'Native .xlsx file — preserves formatting' },
  { value: 'pdf',   label: 'PDF',   desc: 'Print-ready formatted report' },
] as const;

const FIELDS = [
  { key: 'fullName',       label: 'Full Name'     },
  { key: 'email',          label: 'Email'         },
  { key: 'role',           label: 'Role'          },
  { key: 'department',     label: 'Department'    },
  { key: 'status',         label: 'Status'        },
  { key: 'lastActivityAt', label: 'Last Activity' },
  { key: 'createdAt',      label: 'Created Date'  },
] as const;

type FormatKey = typeof FORMATS[number]['value'];
type FieldKey  = typeof FIELDS[number]['key'];

export default function ExportUsersModal({ onClose, totalUsers }: Props) {
  const [format,         setFormat]         = useState<FormatKey>('csv');
  const [selectedFields, setSelectedFields] = useState<Set<FieldKey>>(
    new Set(FIELDS.map(f => f.key))
  );

  function toggleField(key: FieldKey) {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev; // keep at least one
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 12, width: '100%', maxWidth: 500,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px 14px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Export Users</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              {totalUsers !== undefined ? `${totalUsers.toLocaleString()} user${totalUsers !== 1 ? 's' : ''} will be exported` : 'Configure export settings'}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb',
            background: '#f9fafb', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Coming Soon notice */}
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
            padding: '10px 14px', fontSize: 13, color: '#92400e',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span><strong>Export feature coming soon.</strong> The UI is ready — backend export endpoint is under development.</span>
          </div>

          {/* Format */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Format</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {FORMATS.map(f => (
                <label key={f.value} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer',
                  padding: '9px 12px', borderRadius: 7,
                  border: `1px solid ${format === f.value ? '#2563eb' : '#e5e7eb'}`,
                  background: format === f.value ? '#eff6ff' : '#fff',
                  transition: 'border-color 0.12s, background 0.12s',
                }}>
                  <input
                    type="radio" name="format" value={f.value}
                    checked={format === f.value}
                    onChange={() => setFormat(f.value)}
                    style={{ marginTop: 2, accentColor: '#2563eb' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{f.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Fields */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              Fields to include
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {FIELDS.map(f => (
                <label key={f.key} style={{
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  padding: '7px 10px', borderRadius: 6,
                  border: `1px solid ${selectedFields.has(f.key) ? '#c7d2fe' : '#e5e7eb'}`,
                  background: selectedFields.has(f.key) ? '#eef2ff' : '#fff',
                  fontSize: 13, color: '#374151',
                  transition: 'border-color 0.12s, background 0.12s',
                }}>
                  <input
                    type="checkbox"
                    checked={selectedFields.has(f.key)}
                    onChange={() => toggleField(f.key)}
                    style={{ accentColor: '#2563eb' }}
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px', borderTop: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'flex-end', gap: 10,
        }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 600,
            background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 7,
            cursor: 'pointer', color: '#374151', fontFamily: 'inherit',
          }}>
            Cancel
          </button>
          <button
            disabled
            title="Export feature coming soon"
            style={{
              padding: '8px 18px', fontSize: 13, fontWeight: 600,
              background: '#2563eb', border: 'none', borderRadius: 7,
              cursor: 'not-allowed', color: '#fff', fontFamily: 'inherit',
              opacity: 0.5, display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download {format.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  );
}
