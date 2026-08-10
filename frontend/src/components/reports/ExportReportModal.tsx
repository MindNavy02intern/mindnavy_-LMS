// Export Report modal — header's quick-access path to the same download
// flow Export Center's tab already offers (GET /reports/export via
// downloadReportExport()). Modal chrome mirrors ExportUsersModal.tsx
// (overlay/header/body/footer); the fields themselves mirror
// ExportCenterTab.tsx's form — one backend call, two entry points.

import { useState } from 'react';
import { X, Download } from 'lucide-react';
import { downloadReportExport } from '../../services/reportsApi';
import { ReportsApiError } from '../../types/reports';
import type { DateRangeKey, ExportFormat, ExportType } from '../../types/reports';

interface Props {
  onClose:   () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

// All 7 types the backend actually supports (matches Export Center tab) —
// not the shorter illustrative list in the task description, which would
// otherwise make this modal quietly offer fewer options than the tab for
// the exact same endpoint.
const EXPORT_TYPES: { key: ExportType; label: string }[] = [
  { key: 'learners', label: 'Learners' }, { key: 'instructors', label: 'Instructors' },
  { key: 'courses', label: 'Courses' }, { key: 'certificates', label: 'Certificates' },
  { key: 'assessments', label: 'Assessments' }, { key: 'attendance', label: 'Attendance' },
  { key: 'audit', label: 'Audit Logs' },
];
const DATE_RANGES: { key: DateRangeKey; label: string }[] = [
  { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' }, { key: 'custom', label: 'Custom' },
];

const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 };
const INPUT: React.CSSProperties = { padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', color: '#374151', background: '#fff' };

export default function ExportReportModal({ onClose, showToast }: Props) {
  const [type, setType] = useState<ExportType>('learners');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [dateRange, setDateRange] = useState<DateRangeKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustomIncomplete = dateRange === 'custom' && (!customFrom || !customTo);

  async function handleDownload() {
    if (isCustomIncomplete) { setError('Pick both a from and to date for a custom range.'); return; }
    setGenerating(true);
    setError(null);
    try {
      await downloadReportExport({ type, format, dateRange, dateFrom: dateRange === 'custom' ? customFrom : undefined, dateTo: dateRange === 'custom' ? customTo : undefined });
      showToast('success', `${EXPORT_TYPES.find(t => t.key === type)?.label} export downloaded.`);
      onClose();
    } catch (err) {
      setError(err instanceof ReportsApiError ? err.message : 'Export failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget && !generating) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Export Report</div>
          <button onClick={onClose} disabled={generating} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: generating ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#b91c1c' }}>{error}</div>
          )}

          <div>
            <label style={LABEL}>Report Type</label>
            <select value={type} onChange={e => setType(e.target.value as ExportType)} style={{ ...INPUT, width: '100%' }}>
              {EXPORT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label style={LABEL}>Format</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['csv', 'json'] as ExportFormat[]).map(f => (
                <label key={f} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '9px 12px', borderRadius: 7, border: `1px solid ${format === f ? '#2563eb' : '#e5e7eb'}`, background: format === f ? '#eff6ff' : '#fff' }}>
                  <input type="radio" name="export-modal-format" checked={format === f} onChange={() => setFormat(f)} style={{ accentColor: '#2563eb' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{f.toUpperCase()}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label style={LABEL}>Date Range</label>
            <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 3, width: 'fit-content', marginBottom: dateRange === 'custom' ? 10 : 0 }}>
              {DATE_RANGES.map(r => (
                <button key={r.key} type="button" onClick={() => setDateRange(r.key)} style={{ padding: '7px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', borderRadius: 6, border: 'none', cursor: 'pointer', background: dateRange === r.key ? '#fff' : 'transparent', color: dateRange === r.key ? '#2563eb' : '#64748b', boxShadow: dateRange === r.key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>{r.label}</button>
              ))}
            </div>
            {dateRange === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} style={INPUT} />
                <span style={{ color: '#9ca3af', fontSize: 12 }}>to</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} style={INPUT} />
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} disabled={generating} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 7, cursor: generating ? 'default' : 'pointer', color: '#374151', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={generating}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: generating ? '#93c5fd' : '#2563eb', border: 'none', borderRadius: 7, cursor: generating ? 'default' : 'pointer', color: '#fff', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={13} /> {generating ? 'Downloading…' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
}
