// Custom Reports tab — real report builder (SavedReport model,
// savedReports.service.js). reportTemplate.save/.update/.delete/.run were
// dead mutation IDs (reserved ahead of time in invalidation.ts) — this tab
// is what makes them real.
//
// The query ENGINE is reused, not forked: running/exporting a saved report
// calls the exact same reports.service.getExportData(dataSource, dateRange)
// the Export Center tab already uses (R4 — one datum, one owner). That means
// the real column set per data source is whatever getExportData already
// returns for that type — COLUMNS below mirrors that exactly, and filtering
// is date-range only (the same filter Export Center supports), not a
// fabricated status/department filter that doesn't actually work server-side.

import { useCallback, useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Database, Filter, BarChart3, Save, Play, Trash2, Pencil, Download,
  ArrowLeft, ArrowRight, Plus, Check,
} from 'lucide-react';
import {
  listSavedReports, createSavedReport, updateSavedReport, deleteSavedReport,
  runSavedReport, exportSavedReportCsv, triggerCsvDownload,
} from '../../services/reportsApi';
import { joinFeatureWaitlist } from '../../services/notificationsApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import { ReportsApiError } from '../../types/reports';
import { NotificationsApiError } from '../../types/notifications';
import {
  SAVED_REPORT_DATA_SOURCES, SAVED_REPORT_VISUALIZATIONS,
} from '../../types/reports';
import type {
  SavedReport, SavedReportDataSource, SavedReportVisualization,
  SavedReportInput, SavedReportRunResult,
} from '../../types/reports';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

// Mirrors savedReports.service.js's COLUMNS_BY_SOURCE exactly — the real
// columns getExportData returns for each source, not an imagined spec.
const COLUMNS: Record<SavedReportDataSource, { key: string; label: string }[]> = {
  LEARNERS: [
    { key: 'id', label: 'ID' }, { key: 'fullName', label: 'Name' }, { key: 'email', label: 'Email' },
    { key: 'department', label: 'Department' }, { key: 'status', label: 'Status' },
    { key: 'riskScore', label: 'Risk Score' }, { key: 'createdAt', label: 'Created At' },
  ],
  INSTRUCTORS: [
    { key: 'id', label: 'ID' }, { key: 'fullName', label: 'Name' }, { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status' }, { key: 'createdAt', label: 'Created At' },
  ],
  COURSES: [
    { key: 'id', label: 'ID' }, { key: 'title', label: 'Title' }, { key: 'category', label: 'Category' },
    { key: 'status', label: 'Status' }, { key: 'enrollments', label: 'Enrollments' }, { key: 'createdAt', label: 'Created At' },
  ],
  CERTIFICATES: [
    { key: 'id', label: 'ID' }, { key: 'courseTitle', label: 'Course' }, { key: 'userName', label: 'Learner' },
    { key: 'issuedAt', label: 'Issued At' }, { key: 'revoked', label: 'Revoked' }, { key: 'verificationCode', label: 'Verification Code' },
  ],
  ASSESSMENTS: [
    { key: 'id', label: 'ID' }, { key: 'userName', label: 'User' }, { key: 'quizTitle', label: 'Quiz' },
    { key: 'score', label: 'Score' }, { key: 'status', label: 'Status' }, { key: 'submittedAt', label: 'Submitted At' },
  ],
  ATTENDANCE: [
    { key: 'id', label: 'ID' }, { key: 'sessionTitle', label: 'Session' }, { key: 'userName', label: 'User' },
    { key: 'status', label: 'Status' }, { key: 'joinedAt', label: 'Joined At' }, { key: 'leftAt', label: 'Left At' },
  ],
  AUDIT: [
    { key: 'id', label: 'ID' }, { key: 'action', label: 'Action' }, { key: 'adminName', label: 'Admin' },
    { key: 'targetUserId', label: 'Target User ID' }, { key: 'createdAt', label: 'Created At' },
  ],
};

const DATA_SOURCE_META: Record<SavedReportDataSource, { label: string; icon: typeof Database }> = {
  LEARNERS:     { label: 'Learners',     icon: Database },
  INSTRUCTORS:  { label: 'Instructors',  icon: Database },
  COURSES:      { label: 'Courses',      icon: Database },
  CERTIFICATES: { label: 'Certificates', icon: Database },
  ASSESSMENTS:  { label: 'Assessments',  icon: Database },
  ATTENDANCE:   { label: 'Attendance',   icon: Database },
  AUDIT:        { label: 'Audit Logs',   icon: Database },
};

const VIZ_META: Record<SavedReportVisualization, string> = {
  TABLE: 'Table', LINE_CHART: 'Line Chart', BAR_CHART: 'Bar Chart', PIE_CHART: 'Pie Chart', KPI_CARDS: 'KPI Cards',
};

const PIE_COLORS = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#c026d3'];

function isNumeric(v: unknown): v is number { return typeof v === 'number' && Number.isFinite(v); }

// ── Builder wizard ────────────────────────────────────────────────────────

interface BuilderState {
  name: string;
  description: string;
  dataSource: SavedReportDataSource | null;
  selectedColumns: string[];
  dateRange: 'week' | 'month' | 'quarter';
  visualization: SavedReportVisualization;
}

const EMPTY_BUILDER: BuilderState = {
  name: '', description: '', dataSource: null, selectedColumns: [], dateRange: 'month', visualization: 'TABLE',
};

function Builder({ editing, onClose, onSaved, showToast }: {
  editing: SavedReport | null;
  onClose: () => void;
  onSaved: () => void;
  showToast: Props['showToast'];
}) {
  const [step, setStep] = useState(1);
  const [state, setState] = useState<BuilderState>(() => editing ? {
    name: editing.name, description: editing.description ?? '',
    dataSource: editing.dataSource, selectedColumns: editing.selectedColumns,
    dateRange: (editing.filters?.dateRange as BuilderState['dateRange']) ?? 'month',
    visualization: editing.visualization,
  } : EMPTY_BUILDER);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SavedReportRunResult | null>(null);
  const [savedId, setSavedId] = useState<string | null>(editing?.id ?? null);

  const columns = state.dataSource ? COLUMNS[state.dataSource] : [];

  function buildInput(): SavedReportInput {
    return {
      name: state.name.trim(),
      description: state.description.trim() || null,
      dataSource: state.dataSource!,
      selectedColumns: state.selectedColumns,
      filters: { dateRange: state.dateRange },
      visualization: state.visualization,
    };
  }

  async function handleSave(): Promise<string | null> {
    if (!state.name.trim() || !state.dataSource) { showToast('error', 'Name and data source are required.'); return null; }
    setSaving(true);
    try {
      if (savedId) {
        await updateSavedReport(savedId, buildInput());
        invalidateFor(appQueryClient, 'reportTemplate.update');
        showToast('success', 'Report updated.');
        return savedId;
      }
      const created = await createSavedReport(buildInput());
      invalidateFor(appQueryClient, 'reportTemplate.save');
      showToast('success', 'Report saved.');
      setSavedId(created.id);
      return created.id;
    } catch (err) {
      showToast('error', err instanceof ReportsApiError ? err.message : 'Failed to save report.');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleRun() {
    const id = savedId ?? await handleSave();
    if (!id) return;
    setRunning(true);
    try {
      const res = await runSavedReport(id);
      invalidateFor(appQueryClient, 'reportTemplate.run');
      setResult(res);
    } catch (err) {
      showToast('error', err instanceof ReportsApiError ? err.message : 'Failed to run report.');
    } finally {
      setRunning(false);
    }
  }

  async function handleSaveAndClose() {
    const id = await handleSave();
    if (id) onSaved();
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 24 }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        {[1, 2, 3, 4].map(n => (
          <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: n < 4 ? 1 : undefined }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, flexShrink: 0,
              background: step >= n ? '#2563eb' : '#f1f5f9', color: step >= n ? '#fff' : '#94a3b8',
            }}>
              {step > n ? <Check size={13} /> : n}
            </div>
            {n < 4 && <div style={{ flex: 1, height: 2, background: step > n ? '#2563eb' : '#f1f5f9' }} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>1. Choose a Data Source</h3>
          <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#64748b' }}>Every column and filter in later steps comes from this source.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            {SAVED_REPORT_DATA_SOURCES.map(ds => {
              const meta = DATA_SOURCE_META[ds];
              const active = state.dataSource === ds;
              return (
                <button key={ds} type="button"
                  onClick={() => setState(s => ({ ...s, dataSource: ds, selectedColumns: [] }))}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '18px 10px',
                    borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                    border: active ? '2px solid #2563eb' : '1px solid #e5e7eb',
                    background: active ? '#eff6ff' : '#fff',
                  }}>
                  <meta.icon size={20} color={active ? '#2563eb' : '#64748b'} strokeWidth={2} />
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: active ? '#2563eb' : '#374151' }}>{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 2 && state.dataSource && (
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>2. Columns &amp; Filters</h3>
          <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#64748b' }}>Leave columns unchecked to include all of them.</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {columns.map(c => {
              const checked = state.selectedColumns.includes(c.key);
              return (
                <button key={c.key} type="button"
                  onClick={() => setState(s => ({
                    ...s,
                    selectedColumns: checked ? s.selectedColumns.filter(k => k !== c.key) : [...s.selectedColumns, c.key],
                  }))}
                  style={{
                    padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
                    border: checked ? '1px solid #2563eb' : '1px solid #e5e7eb',
                    background: checked ? '#eff6ff' : '#fff', color: checked ? '#2563eb' : '#64748b',
                  }}>
                  {c.label}
                </button>
              );
            })}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Filter size={13} color="#64748b" />
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#374151' }}>Date range</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['week', 'month', 'quarter'] as const).map(r => (
                <button key={r} type="button" onClick={() => setState(s => ({ ...s, dateRange: r }))}
                  style={{
                    padding: '6px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', borderRadius: 8, cursor: 'pointer',
                    border: state.dateRange === r ? '1px solid #2563eb' : '1px solid #e5e7eb',
                    background: state.dateRange === r ? '#eff6ff' : '#fff', color: state.dateRange === r ? '#2563eb' : '#64748b',
                  }}>
                  {r === 'week' ? 'This Week' : r === 'month' ? 'This Month' : 'This Quarter'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>3. Visualization</h3>
          <p style={{ margin: '0 0 16px', fontSize: 12.5, color: '#64748b' }}>How the results render once you run the report.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
            {SAVED_REPORT_VISUALIZATIONS.map(v => {
              const active = state.visualization === v;
              return (
                <button key={v} type="button" onClick={() => setState(s => ({ ...s, visualization: v }))}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '18px 10px',
                    borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                    border: active ? '2px solid #2563eb' : '1px solid #e5e7eb',
                    background: active ? '#eff6ff' : '#fff',
                  }}>
                  <BarChart3 size={18} color={active ? '#2563eb' : '#64748b'} strokeWidth={2} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: active ? '#2563eb' : '#374151' }}>{VIZ_META[v]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>4. Save &amp; Run</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420, marginBottom: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Report name *</label>
              <input value={state.name} onChange={e => setState(s => ({ ...s, name: e.target.value }))} maxLength={150}
                style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Description (optional)</label>
              <textarea value={state.description} onChange={e => setState(s => ({ ...s, description: e.target.value }))} rows={2} maxLength={1000}
                style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            <button type="button" onClick={handleSaveAndClose} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer' }}>
              <Save size={14} /> {saving ? 'Saving…' : 'Save Report'}
            </button>
            <button type="button" onClick={handleRun} disabled={running || saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
              <Play size={14} /> {running ? 'Running…' : 'Run Now'}
            </button>
          </div>

          {result && <ResultView result={result} visualization={state.visualization} />}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
        <button type="button" onClick={onClose}
          style={{ padding: '8px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', background: '#fff', color: '#64748b', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer' }}>
          Cancel
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          {step > 1 && (
            <button type="button" onClick={() => setStep(s => s - 1)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer' }}>
              <ArrowLeft size={13} /> Back
            </button>
          )}
          {step < 4 && (
            <button type="button" onClick={() => setStep(s => s + 1)} disabled={step === 1 && !state.dataSource}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', opacity: (step === 1 && !state.dataSource) ? 0.5 : 1 }}>
              Next <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Result renderer (TABLE / LINE / BAR / PIE / KPI) ────────────────────────
// Results are generic { columns, rows } for ANY of the 7 data sources —
// this is a best-effort generic renderer, not a hand-tuned chart per source.

function ResultView({ result, visualization }: { result: SavedReportRunResult; visualization: SavedReportVisualization }) {
  const { columns, rows } = result;
  if (rows.length === 0) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No rows for this data source in the selected date range.</div>;
  }

  if (visualization === 'TABLE') {
    return (
      <div style={{ overflowX: 'auto', border: '1px solid #f1f5f9', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f1f5f9' }}>
              {columns.map(c => <th key={c.key} style={{ padding: '8px 10px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11 }}>{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 100).map((r, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}>
                {columns.map(c => <td key={c.key} style={{ padding: '8px 10px', color: '#374151' }}>{String(r[c.key] ?? '—')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 100 && <div style={{ padding: 8, textAlign: 'center', fontSize: 11, color: '#94a3b8' }}>Showing first 100 of {rows.length} rows.</div>}
      </div>
    );
  }

  // Charts: first column = label/x-axis, first NUMERIC column = value/y-axis.
  const labelKey = columns[0]?.key;
  const numericCol = columns.find(c => rows.some(r => isNumeric(r[c.key])));
  const valueKey = numericCol?.key;

  if (!valueKey) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>This data source has no numeric column to chart — showing as a table instead.<br /><ResultView result={result} visualization="TABLE" /></div>;
  }

  const chartData = rows.slice(0, 30).map(r => ({ label: String(r[labelKey] ?? ''), value: Number(r[valueKey]) || 0 }));

  if (visualization === 'LINE_CHART') {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={{ r: 2 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (visualization === 'BAR_CHART') {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (visualization === 'PIE_CHART') {
    return (
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={chartData} dataKey="value" nameKey="label" innerRadius={50} outerRadius={90} paddingAngle={2}>
            {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // KPI_CARDS — total row count + sum of every numeric column found.
  const numericCols = columns.filter(c => rows.some(r => isNumeric(r[c.key])));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(4, numericCols.length + 1)}, 1fr)`, gap: 12 }}>
      <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', border: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>Total Rows</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{rows.length}</div>
      </div>
      {numericCols.map(c => {
        const sum = rows.reduce((s, r) => s + (isNumeric(r[c.key]) ? r[c.key] as number : 0), 0);
        return (
          <div key={c.key} style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', border: '1px solid #f1f5f9' }}>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>Sum of {c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{sum.toLocaleString()}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Saved reports list ───────────────────────────────────────────────────────

function SavedReportsList({ onCreate, onEdit, showToast }: {
  onCreate: () => void;
  onEdit: (report: SavedReport) => void;
  showToast: Props['showToast'];
}) {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    listSavedReports().then(setReports).catch(() => showToast('error', 'Failed to load saved reports.')).finally(() => setLoading(false));
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  async function handleRun(report: SavedReport) {
    setBusyId(report.id);
    try {
      await runSavedReport(report.id);
      invalidateFor(appQueryClient, 'reportTemplate.run');
      showToast('success', `"${report.name}" ran successfully.`);
      load();
    } catch (err) {
      showToast('error', err instanceof ReportsApiError ? err.message : 'Failed to run report.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleExport(report: SavedReport) {
    setBusyId(report.id);
    try {
      const blob = await exportSavedReportCsv(report.id);
      triggerCsvDownload(blob, `${report.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`);
    } catch (err) {
      showToast('error', err instanceof ReportsApiError ? err.message : 'Export failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(report: SavedReport) {
    if (!window.confirm(`Delete "${report.name}"? This cannot be undone.`)) return;
    setBusyId(report.id);
    try {
      await deleteSavedReport(report.id);
      invalidateFor(appQueryClient, 'reportTemplate.delete');
      showToast('success', 'Report deleted.');
      load();
    } catch (err) {
      showToast('error', err instanceof ReportsApiError ? err.message : 'Delete failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottom: '1px solid #f1f5f9' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Saved Reports</h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#94a3b8' }}>Build, save, and rerun your own reports.</p>
        </div>
        <button type="button" onClick={onCreate}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>
          <Plus size={15} strokeWidth={2.5} /> Create New Report
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Loading…</div>
      ) : reports.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No saved reports yet — create one to get started.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                {['Name', 'Data Source', 'Visualization', 'Last Run', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: h === 'Name' || h === 'Data Source' || h === 'Visualization' ? 'left' : 'center', padding: '10px 12px', color: '#94a3b8', fontWeight: 600, fontSize: 11.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reports.map(r => {
                const busy = busyId === r.id;
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f8fafc', opacity: busy ? 0.5 : 1 }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{r.name}</td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{DATA_SOURCE_META[r.dataSource].label}</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{VIZ_META[r.visualization]}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>
                      {r.lastRunAt ? new Date(r.lastRunAt).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                        <button type="button" onClick={() => handleRun(r)} disabled={busy} title="Run" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', padding: 4 }}><Play size={14} /></button>
                        <button type="button" onClick={() => onEdit(r)} disabled={busy} title="Edit" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: 4 }}><Pencil size={14} /></button>
                        <button type="button" onClick={() => handleExport(r)} disabled={busy} title="Export CSV" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}><Download size={14} /></button>
                        <button type="button" onClick={() => handleDelete(r)} disabled={busy} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 4 }}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export default function CustomReportsTab({ showToast }: Props) {
  const [view, setView] = useState<'list' | 'builder'>('list');
  const [editing, setEditing] = useState<SavedReport | null>(null);
  const [notified, setNotified] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('waitlist_custom_reports_joined') === '1') setNotified(true);
  }, []);

  async function handleNotify() {
    setJoining(true);
    try {
      const result = await joinFeatureWaitlist('custom_reports');
      setNotified(true);
      localStorage.setItem('waitlist_custom_reports_joined', '1');
      showToast('success', result.alreadyJoined ? "You're already on the list." : "You're on the list — we'll email you when this ships.");
    } catch (err) {
      showToast('error', err instanceof NotificationsApiError ? err.message : 'Failed to join the waitlist.');
    } finally {
      setJoining(false);
    }
  }

  if (view === 'builder') {
    return (
      <Builder
        editing={editing}
        onClose={() => { setView('list'); setEditing(null); }}
        onSaved={() => { setView('list'); setEditing(null); }}
        showToast={showToast}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SavedReportsList
        onCreate={() => { setEditing(null); setView('builder'); }}
        onEdit={(r) => { setEditing(r); setView('builder'); }}
        showToast={showToast}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: 10 }}>
        <span style={{ fontSize: 12, color: '#64748b' }}>Want scheduled auto-reports and recurring email delivery for saved reports?</span>
        <button
          type="button" onClick={handleNotify} disabled={notified || joining}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            background: notified ? '#f0fdf4' : '#fff', color: notified ? '#16a34a' : '#2563eb',
            border: notified ? '1px solid #bbf7d0' : '1px solid #d1d5db', borderRadius: 8, cursor: (notified || joining) ? 'default' : 'pointer',
          }}
        >
          {notified ? <Check size={13} /> : null}
          {notified ? "You're on the list" : joining ? 'Joining…' : 'Notify me'}
        </button>
      </div>
    </div>
  );
}
