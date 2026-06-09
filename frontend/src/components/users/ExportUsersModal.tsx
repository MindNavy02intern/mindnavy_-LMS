import { useState } from 'react';
import { getUsers } from '../../api/users';
import type { UsersParams } from '../../api/users';
import type { User } from '../../types/users';

interface Props {
  onClose:       () => void;
  totalUsers?:   number;
  filterParams?: UsersParams;
}

const FORMATS = [
  { value: 'csv',   label: 'CSV',   desc: 'Comma-separated — opens in Excel or any spreadsheet' },
  { value: 'excel', label: 'Excel', desc: 'Tab-separated .xlsx — native Excel format' },
] as const;

const FIELDS: { key: keyof User; label: string }[] = [
  { key: 'fullName',         label: 'Full Name'          },
  { key: 'email',            label: 'Email'              },
  { key: 'role',             label: 'Role'               },
  { key: 'department',       label: 'Department'         },
  { key: 'status',           label: 'Status'             },
  { key: 'verificationState',label: 'Verification State' },
  { key: 'phone',            label: 'Phone'              },
  { key: 'lastActivityAt',   label: 'Last Activity'      },
  { key: 'createdAt',        label: 'Created Date'       },
];

type FormatKey = typeof FORMATS[number]['value'];
type FieldKey  = keyof User;

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCSV(users: User[], fields: FieldKey[]): string {
  const header = fields.map(f => FIELDS.find(d => d.key === f)?.label ?? f).join(',');
  const rows   = users.map(u => fields.map(f => csvEscape(u[f])).join(','));
  return [header, ...rows].join('\r\n');
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ExportUsersModal({ onClose, totalUsers, filterParams = {} }: Props) {
  const [format,         setFormat]         = useState<FormatKey>('csv');
  const [selectedFields, setSelectedFields] = useState<Set<FieldKey>>(
    new Set(FIELDS.slice(0, 7).map(f => f.key))
  );
  const [exporting, setExporting] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  function toggleField(key: FieldKey) {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev;
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const result = await getUsers({ ...filterParams, limit: 1000, page: 1 });
      const users  = result.users;
      const fields = FIELDS.filter(f => selectedFields.has(f.key)).map(f => f.key);

      const csv     = buildCSV(users, fields);
      const date    = new Date().toISOString().slice(0, 10);
      const ext     = format === 'excel' ? 'xlsx' : 'csv';
      const mime    = format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv;charset=utf-8;';

      triggerDownload(csv, `users-export-${date}.${ext}`, mime);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Export Users</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              {totalUsers !== undefined
                ? `Up to ${Math.min(totalUsers, 1000).toLocaleString()} user${totalUsers !== 1 ? 's' : ''} will be exported`
                : 'Configure export settings'}
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 18, overflowY: 'auto', maxHeight: 460 }}>

          {error && (
            <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#b91c1c' }}>{error}</div>
          )}

          {/* Format */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Format</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {FORMATS.map(f => (
                <label key={f.value} style={{
                  flex: 1, display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer',
                  padding: '9px 12px', borderRadius: 7,
                  border: `1px solid ${format === f.value ? '#2563eb' : '#e5e7eb'}`,
                  background: format === f.value ? '#eff6ff' : '#fff',
                }}>
                  <input type="radio" name="format" value={f.value} checked={format === f.value} onChange={() => setFormat(f.value)} style={{ marginTop: 2, accentColor: '#2563eb' }} />
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
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Fields to include</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {FIELDS.map(f => (
                <label key={String(f.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  padding: '7px 10px', borderRadius: 6,
                  border: `1px solid ${selectedFields.has(f.key) ? '#c7d2fe' : '#e5e7eb'}`,
                  background: selectedFields.has(f.key) ? '#eef2ff' : '#fff',
                  fontSize: 13, color: '#374151',
                }}>
                  <input type="checkbox" checked={selectedFields.has(f.key)} onChange={() => toggleField(f.key)} style={{ accentColor: '#2563eb' }} />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} disabled={exporting} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || selectedFields.size === 0}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: exporting ? '#9ca3af' : '#2563eb', border: 'none', borderRadius: 7, cursor: exporting ? 'not-allowed' : 'pointer', color: '#fff', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {exporting ? (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><polyline points="23 4 23 10 17 10"/><path d="M20.5 15a9 9 0 1 1-1.4-4.8"/></svg>
                Exporting…
              </>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Download {format.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
