// Export Center tab — pick a report type + format + date range, download.
// Unlike Users/Competencies exports (backend returns JSON, client builds the
// CSV), this endpoint returns the actual file — one central place that can
// emit any of the 7 report types in either format (see REPORTS_CONTRACT.md).
// "Recent exports history" has no backing store (nothing persists past
// exports server-side) — shown as a real, honest limitation, not a fake list.

import { useState } from 'react';
import { Download } from 'lucide-react';
import { downloadReportExport } from '../../services/reportsApi';
import { ReportsApiError } from '../../types/reports';
import type { DateRangeKey, ExportFormat, ExportType } from '../../types/reports';
import ScheduledReportsSection from './ScheduledReportsSection';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

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

interface HistoryEntry { type: ExportType; format: ExportFormat; at: string }

export default function ExportCenterTab({ showToast }: Props) {
  const [type, setType] = useState<ExportType>('learners');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [dateRange, setDateRange] = useState<DateRangeKey>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const isCustomIncomplete = dateRange === 'custom' && (!customFrom || !customTo);

  async function handleGenerate() {
    if (isCustomIncomplete) { showToast('error', 'Pick both a from and to date for a custom range.'); return; }
    setGenerating(true);
    try {
      await downloadReportExport({ type, format, dateRange, dateFrom: dateRange === 'custom' ? customFrom : undefined, dateTo: dateRange === 'custom' ? customTo : undefined });
      setHistory(h => [{ type, format, at: new Date().toISOString() }, ...h].slice(0, 10));
      showToast('success', `${EXPORT_TYPES.find(t => t.key === type)?.label} export downloaded.`);
    } catch (err) {
      showToast('error', err instanceof ReportsApiError ? err.message : 'Export failed.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '20px 22px', maxWidth: 520 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Generate Export</div>

        <div style={{ marginBottom: 14 }}>
          <label style={LABEL}>Report Type</label>
          <select value={type} onChange={e => setType(e.target.value as ExportType)} style={{ ...INPUT, width: '100%' }}>
            {EXPORT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={LABEL}>Format</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['csv', 'json'] as ExportFormat[]).map(f => (
              <label key={f} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '9px 12px', borderRadius: 7, border: `1px solid ${format === f ? '#2563eb' : '#e5e7eb'}`, background: format === f ? '#eff6ff' : '#fff' }}>
                <input type="radio" name="format" checked={format === f} onChange={() => setFormat(f)} style={{ accentColor: '#2563eb' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{f.toUpperCase()}</span>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
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

        <button
          type="button" onClick={handleGenerate} disabled={generating}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: generating ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: generating ? 'default' : 'pointer' }}
        >
          <Download size={15} /> {generating ? 'Generating…' : 'Generate & Download'}
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Recent Exports (this session)</div>
        {history.length === 0 ? (
          <div style={{ fontSize: 12, color: '#9ca3af' }}>No exports generated yet this session — exports aren't persisted server-side, so history only covers the current browser session.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map((h, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#374151' }}>{EXPORT_TYPES.find(t => t.key === h.type)?.label} · {h.format.toUpperCase()}</span>
                <span style={{ color: '#9ca3af' }}>{new Date(h.at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ScheduledReportsSection showToast={showToast} />
    </div>
  );
}
