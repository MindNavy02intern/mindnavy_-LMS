// Import/Export tab — real implementation (was a "coming soon" stub).
// Export: GET /competencies/skills/export (JSON, filtered/uncapped) → CSV
// built client-side, same architecture as Users' exportAllUsers/
// ExportUsersModal (backend never generates the file). Import: POST
// /competencies/skills/import (multipart CSV → bulk create), same
// drag-drop/preview/result-summary UX as Users' ImportUsersModal, just
// inlined as a tab instead of a modal.

import { useRef, useState } from 'react';
import { Download, Upload, FileText, X } from 'lucide-react';
import { exportSkills, importSkills } from '../../services/competenciesApi';
import { CompetenciesApiError } from '../../types/competencies';
import type { Skill, SkillImportResult } from '../../types/competencies';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

const CARD: React.CSSProperties = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '18px 20px' };
const TITLE: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 };
const SUBTEXT: React.CSSProperties = { fontSize: 12, color: '#6b7280', marginBottom: 14 };

const EXPORT_COLUMNS = ['Name', 'Category', 'Level', 'Status', 'Linked Courses', 'Assigned Users'] as const;
const REQUIRED_IMPORT_HEADERS = ['Name'];

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCSV(skills: Skill[]): string {
  const header = EXPORT_COLUMNS.join(',');
  const rows = skills.map(s => [
    csvEscape(s.name),
    csvEscape(s.categoryName ?? ''),
    csvEscape(s.level),
    csvEscape(s.status),
    csvEscape(s.linkedCoursesCount),
    csvEscape(s.assignedUsersCount),
  ].join(','));
  return [header, ...rows].join('\r\n');
}

function triggerDownload(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface CSVPreview { headers: string[]; rows: string[][]; totalRows: number }

// Client-side preview only — real validation happens on the backend.
function parseCSVPreview(content: string): CSVPreview {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [], totalRows: 0 };
  const parseLine = (line: string): string[] => {
    const cols: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (const c of line) {
      if (c === '"') inQuotes = !inQuotes;
      else if (c === ',' && !inQuotes) { cols.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    cols.push(cur.trim());
    return cols;
  };
  const headers = parseLine(lines[0]);
  const dataLines = lines.slice(1);
  const rows = dataLines.slice(0, 10).map(parseLine);
  return { headers, rows, totalRows: dataLines.length };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function ExportCard({ showToast }: { showToast: Props['showToast'] }) {
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const { skills } = await exportSkills({});
      const csv = buildCSV(skills);
      const date = new Date().toISOString().slice(0, 10);
      triggerDownload(csv, `competencies-export-${date}.csv`);
      showToast('success', `Exported ${skills.length} competenc${skills.length === 1 ? 'y' : 'ies'}.`);
    } catch (err) {
      showToast('error', err instanceof CompetenciesApiError ? err.message : 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div style={CARD}>
      <div style={TITLE}>Export Competencies</div>
      <div style={SUBTEXT}>Downloads every competency as a CSV — columns: {EXPORT_COLUMNS.join(', ')}.</div>
      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
          background: exporting ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: exporting ? 'default' : 'pointer',
        }}
      >
        <Download size={15} strokeWidth={2} />
        {exporting ? 'Exporting…' : 'Download CSV'}
      </button>
    </div>
  );
}

function ImportCard({ showToast }: { showToast: Props['showToast'] }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CSVPreview | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<SkillImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFile(f: File) {
    setResult(null);
    setError(null);
    if (!f.name.toLowerCase().endsWith('.csv')) { setError('Only CSV files are allowed.'); return; }
    if (f.size > 1 * 1024 * 1024) { setError('File size exceeds the 1 MB limit.'); return; }
    if (f.size === 0) { setError('The file is empty.'); return; }

    setFile(f);
    const reader = new FileReader();
    reader.onload = e => setPreview(parseCSVPreview((e.target?.result as string) ?? ''));
    reader.readAsText(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      const res = await importSkills(file);
      setResult(res);
      if (res.summary.created > 0) {
        invalidateFor(appQueryClient, 'skill.import');
      }
      showToast('success', `Imported ${res.summary.created} competenc${res.summary.created === 1 ? 'y' : 'ies'}.`);
    } catch (err) {
      setError(err instanceof CompetenciesApiError ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const missingHeaders = preview && preview.headers.length > 0
    ? REQUIRED_IMPORT_HEADERS.filter(h => !preview.headers.includes(h))
    : [];

  return (
    <div style={CARD}>
      <div style={TITLE}>Import Competencies</div>
      <div style={SUBTEXT}>
        Required column: <strong>Name</strong> — optional: Category (must match an existing category), Level, Status.
      </div>

      {error && !importing && !result && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#b91c1c' }}>
          {error}
        </div>
      )}

      {result && (
        <div>
          <div style={{
            background: result.summary.failed === 0 ? '#f0fdf4' : '#fffbeb',
            border: `1px solid ${result.summary.failed === 0 ? '#bbf7d0' : '#fde68a'}`,
            borderRadius: 8, padding: '14px 16px', marginBottom: 16,
          }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: result.summary.failed === 0 ? '#16a34a' : '#92400e', marginBottom: 8 }}>
              {result.message}
            </div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Total Rows', value: result.summary.totalRows, color: '#374151' },
                { label: 'Created',    value: result.summary.created,   color: '#16a34a' },
                { label: 'Failed',     value: result.summary.failed,    color: result.summary.failed > 0 ? '#dc2626' : '#374151' },
                { label: 'Skipped',    value: result.summary.skipped,   color: '#9ca3af' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {result.errors.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Row errors ({result.errors.length})</div>
              <div style={{ border: '1px solid #fee2e2', borderRadius: 8, overflow: 'hidden' }}>
                {result.errors.map((e, i) => (
                  <div key={i} style={{
                    padding: '8px 12px', borderBottom: i < result.errors.length - 1 ? '1px solid #fee2e2' : 'none',
                    background: i % 2 === 0 ? '#fff' : '#fef2f2', fontSize: 12, display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}>
                    <span style={{ color: '#9ca3af', flexShrink: 0, fontWeight: 600 }}>Row {e.row}</span>
                    <span style={{ color: '#6b7280', flexShrink: 0 }}>{e.name ?? '—'}</span>
                    <span style={{ color: '#dc2626' }}>{e.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button type="button" onClick={reset} style={{ padding: '8px 16px', fontSize: 13, fontWeight: 600, background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}>
            Import Another File
          </button>
        </div>
      )}

      {!file && !result && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#2563eb' : '#d1d5db'}`, borderRadius: 10, padding: '32px 20px', textAlign: 'center',
            cursor: 'pointer', transition: 'border-color 0.15s', background: dragOver ? '#eff6ff' : '#fafafa',
          }}
        >
          <Upload size={30} strokeWidth={1.5} color={dragOver ? '#2563eb' : '#9ca3af'} style={{ margin: '0 auto 10px' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
            {dragOver ? 'Drop the file here' : 'Drag & drop a CSV file, or click to browse'}
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>CSV only · Max 1 MB · Max 500 rows</div>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}

      {file && !result && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <FileText size={20} color="#16a34a" strokeWidth={2} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{file.name}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{formatBytes(file.size)}{preview && preview.totalRows > 0 ? ` · ${preview.totalRows} data row${preview.totalRows !== 1 ? 's' : ''}` : ''}</div>
              </div>
            </div>
            <button type="button" onClick={reset} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 5 }}>
              <X size={13} /> Remove
            </button>
          </div>

          {missingHeaders.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e' }}>
              <strong>Missing required columns:</strong> {missingHeaders.join(', ')}
            </div>
          )}

          {preview && preview.headers.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>
                Preview — first {Math.min(preview.rows.length, 10)} row{preview.rows.length !== 1 ? 's' : ''}{preview.totalRows > 10 ? ` of ${preview.totalRows}` : ''}
              </div>
              <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f9fafb' }}>
                      {preview.headers.map(h => (
                        <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: REQUIRED_IMPORT_HEADERS.includes(h) ? '#2563eb' : '#6b7280', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>
                          {h}{REQUIRED_IMPORT_HEADERS.includes(h) ? ' *' : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, ri) => (
                      <tr key={ri} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        {row.map((cell, ci) => (
                          <td key={ci} style={{ padding: '6px 10px', color: '#374151', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cell || <span style={{ color: '#d1d5db' }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleImport}
            disabled={importing || missingHeaders.length > 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              background: '#2563eb', border: 'none', borderRadius: 8, color: '#fff',
              cursor: (importing || missingHeaders.length > 0) ? 'not-allowed' : 'pointer',
              opacity: (importing || missingHeaders.length > 0) ? 0.6 : 1,
            }}
          >
            {importing ? 'Importing…' : 'Import Competencies'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ImportExportTab({ showToast }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ExportCard showToast={showToast} />
      <ImportCard showToast={showToast} />
    </div>
  );
}
