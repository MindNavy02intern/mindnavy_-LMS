// Create/Edit modal for Scheduled Reports (Export Center tab's "Scheduled
// Reports" section). Chrome mirrors ExportReportModal.tsx; fields extend it
// with name/frequency/recipients since this persists a recurring job instead
// of triggering a one-off download.

import { useState } from 'react';
import { X, Save, Plus } from 'lucide-react';
import { createScheduledReport, updateScheduledReport } from '../../services/reportsApi';
import { ReportsApiError } from '../../types/reports';
import type {
  DateRangeKey, ExportType, ScheduledReport, ScheduledReportFormat, ScheduledReportFrequency,
} from '../../types/reports';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  onClose:   () => void;
  onSaved:   () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
  editing?:  ScheduledReport | null;
}

// Same 7 types as Export Center / the Export Report modal — matches the
// backend's EXPORT_TYPES set (reports.validator.js), which scheduledReports
// reuses as its own source of truth for reportType.
const REPORT_TYPES: { key: ExportType; label: string }[] = [
  { key: 'learners', label: 'Learners' }, { key: 'instructors', label: 'Instructors' },
  { key: 'courses', label: 'Courses' }, { key: 'certificates', label: 'Certificates' },
  { key: 'assessments', label: 'Assessments' }, { key: 'attendance', label: 'Attendance' },
  { key: 'audit', label: 'Audit Logs' },
];
const FREQUENCIES: { key: ScheduledReportFrequency; label: string }[] = [
  { key: 'DAILY', label: 'Daily' }, { key: 'WEEKLY', label: 'Weekly' }, { key: 'MONTHLY', label: 'Monthly' },
];
const DATE_RANGES: { key: DateRangeKey; label: string }[] = [
  { key: 'week', label: 'This Week' }, { key: 'month', label: 'This Month' },
  { key: 'quarter', label: 'This Quarter' }, { key: 'custom', label: 'Custom' },
];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 };
const INPUT: React.CSSProperties = { padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', color: '#374151', background: '#fff' };

export default function ScheduleReportModal({ onClose, onSaved, showToast, editing }: Props) {
  const isEdit = Boolean(editing);

  const [name, setName] = useState(editing?.name ?? '');
  const [reportType, setReportType] = useState<ExportType>(editing?.reportType ?? 'learners');
  const [format, setFormat] = useState<ScheduledReportFormat>(editing?.format ?? 'CSV');
  const [frequency, setFrequency] = useState<ScheduledReportFrequency>(editing?.frequency ?? 'DAILY');
  const [dateRange, setDateRange] = useState<DateRangeKey>(editing?.filters?.dateRange ?? 'month');
  const [customFrom, setCustomFrom] = useState(editing?.filters?.dateFrom ?? '');
  const [customTo, setCustomTo] = useState(editing?.filters?.dateTo ?? '');
  const [recipients, setRecipients] = useState<string[]>(editing?.recipients ?? []);
  const [recipientInput, setRecipientInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCustomIncomplete = dateRange === 'custom' && (!customFrom || !customTo);

  function addRecipient() {
    const email = recipientInput.trim().toLowerCase();
    if (!email) return;
    if (!EMAIL_REGEX.test(email)) { setError(`"${email}" is not a valid email address.`); return; }
    if (recipients.includes(email)) { setRecipientInput(''); return; }
    setRecipients(r => [...r, email]);
    setRecipientInput('');
    setError(null);
  }

  function removeRecipient(email: string) {
    setRecipients(r => r.filter(e => e !== email));
  }

  async function handleSave() {
    if (!name.trim()) { setError('Report name is required.'); return; }
    if (recipients.length === 0) { setError('Add at least one recipient email.'); return; }
    if (isCustomIncomplete) { setError('Pick both a from and to date for a custom range.'); return; }

    setSaving(true);
    setError(null);
    const filters = { dateRange, dateFrom: dateRange === 'custom' ? customFrom : undefined, dateTo: dateRange === 'custom' ? customTo : undefined };
    try {
      if (isEdit && editing) {
        await updateScheduledReport(editing.id, { name: name.trim(), reportType, format, frequency, recipients, filters });
        invalidateFor(appQueryClient, 'reportSchedule.update', { id: editing.id });
        showToast('success', `"${name.trim()}" updated.`);
      } else {
        const created = await createScheduledReport({ name: name.trim(), reportType, format, frequency, recipients, filters });
        invalidateFor(appQueryClient, 'reportSchedule.create', { id: created.id });
        showToast('success', `"${name.trim()}" scheduled.`);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ReportsApiError ? err.message : 'Failed to save scheduled report.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div role="dialog" aria-label={isEdit ? 'Edit Scheduled Report' : 'Schedule Report'} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>

        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>{isEdit ? 'Edit Scheduled Report' : 'Schedule Report'}</div>
          <button onClick={onClose} disabled={saving} style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb', background: '#f9fafb', cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: 12, color: '#b91c1c' }}>{error}</div>
          )}

          <div>
            <label style={LABEL}>Report Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Weekly Learner Progress" style={{ ...INPUT, width: '100%' }} />
          </div>

          <div>
            <label style={LABEL}>Report Type</label>
            <select value={reportType} onChange={e => setReportType(e.target.value as ExportType)} style={{ ...INPUT, width: '100%' }}>
              {REPORT_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </div>

          <div>
            <label style={LABEL}>Format</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['CSV', 'JSON'] as ScheduledReportFormat[]).map(f => (
                <label key={f} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '9px 12px', borderRadius: 7, border: `1px solid ${format === f ? '#2563eb' : '#e5e7eb'}`, background: format === f ? '#eff6ff' : '#fff' }}>
                  <input type="radio" name="schedule-format" checked={format === f} onChange={() => setFormat(f)} style={{ accentColor: '#2563eb' }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{f}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label style={LABEL}>Frequency</label>
            <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: 3, width: 'fit-content' }}>
              {FREQUENCIES.map(f => (
                <button key={f.key} type="button" onClick={() => setFrequency(f.key)} style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', borderRadius: 6, border: 'none', cursor: 'pointer', background: frequency === f.key ? '#fff' : 'transparent', color: frequency === f.key ? '#2563eb' : '#64748b', boxShadow: frequency === f.key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none' }}>{f.label}</button>
              ))}
            </div>
          </div>

          <div>
            <label style={LABEL}>Recipients</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="email" value={recipientInput} placeholder="name@company.com"
                onChange={e => setRecipientInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRecipient(); } }}
                style={{ ...INPUT, flex: 1 }}
              />
              <button type="button" onClick={addRecipient} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer', color: '#374151' }}>
                <Plus size={13} /> Add
              </button>
            </div>
            {recipients.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {recipients.map(email => (
                  <span key={email} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', fontSize: 11, fontWeight: 600, background: '#eff6ff', color: '#2563eb', borderRadius: 5 }}>
                    {email}
                    <button type="button" onClick={() => removeRecipient(email)} style={{ display: 'flex', border: 'none', background: 'none', cursor: 'pointer', color: '#2563eb', padding: 0 }}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label style={LABEL}>Date Range Filter</label>
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
          <button onClick={onClose} disabled={saving} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 7, cursor: saving ? 'default' : 'pointer', color: '#374151', fontFamily: 'inherit' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ padding: '8px 18px', fontSize: 13, fontWeight: 600, background: saving ? '#93c5fd' : '#2563eb', border: 'none', borderRadius: 7, cursor: saving ? 'default' : 'pointer', color: '#fff', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Save size={13} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
