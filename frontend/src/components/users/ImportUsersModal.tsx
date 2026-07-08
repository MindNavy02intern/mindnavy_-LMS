import { useRef, useState } from 'react';
import { importUsers } from '../../api/users';
import type { ImportResult } from '../../types/users';

interface Props {
  onClose:    () => void;
  onSuccess?: () => void;
  showToast:  (type: 'success' | 'error', message: string) => void;
}

interface CSVPreview {
  headers:   string[];
  rows:      string[][];
  totalRows: number;
}

// Simple CSV parser for client-side preview only (real validation happens on backend)
function parseCSVPreview(content: string): CSVPreview {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [], totalRows: 0 };

  const parseLine = (line: string): string[] => {
    const cols: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (const c of line) {
      if (c === '"') { inQuotes = !inQuotes; }
      else if (c === ',' && !inQuotes) { cols.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    cols.push(cur.trim());
    return cols;
  };

  const headers   = parseLine(lines[0]);
  const dataLines = lines.slice(1);
  const rows      = dataLines.slice(0, 10).map(parseLine);
  return { headers, rows, totalRows: dataLines.length };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const REQUIRED_HEADERS = ['fullName', 'email', 'password', 'role'];
const VALID_IMPORT_ROLES = new Set(['LEARNER', 'INSTRUCTOR', 'MANAGER', 'ADMIN_ASSISTANT']);

export default function ImportUsersModal({ onClose, onSuccess, showToast }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file,      setFile]      = useState<File | null>(null);
  const [preview,   setPreview]   = useState<CSVPreview | null>(null);
  const [dragOver,  setDragOver]  = useState(false);
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState<ImportResult | null>(null);
  const [error,     setError]     = useState<string | null>(null);

  function handleFile(f: File) {
    setResult(null);
    setError(null);

    if (!f.name.toLowerCase().endsWith('.csv')) {
      setError('Only CSV files are allowed.');
      return;
    }
    if (f.size > 1 * 1024 * 1024) {
      setError('File size exceeds the 1 MB limit.');
      return;
    }
    if (f.size === 0) {
      setError('The file is empty.');
      return;
    }

    setFile(f);
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target?.result as string ?? '';
      setPreview(parseCSVPreview(text));
    };
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
      const res = await importUsers(file);
      setResult(res);
      if (res.summary.created > 0) {
        window.dispatchEvent(new CustomEvent('userDataChanged'));
        window.dispatchEvent(new CustomEvent('analyticsUpdated'));
        onSuccess?.();
      }
      showToast('success', `Imported ${res.summary.created} users successfully`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
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
    ? REQUIRED_HEADERS.filter(h => !preview.headers.includes(h))
    : [];

  const roleColIdx = preview?.headers.indexOf('role') ?? -1;
  const invalidRoleRows = (preview && roleColIdx >= 0)
    ? preview.rows
        .map((row, i) => ({ rowNum: i + 2, value: row[roleColIdx]?.trim().toUpperCase() ?? '' }))
        .filter(r => r.value && !VALID_IMPORT_ROLES.has(r.value))
    : [];

  // ── Overlay ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff', borderRadius: 12, width: '100%', maxWidth: 680,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 22px 14px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>Import Users</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              Required columns: <strong>fullName, email, password, role</strong> — password min 12 chars · role must be LEARNER, INSTRUCTOR, MANAGER, or ADMIN_ASSISTANT
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 6, border: '1px solid #e5e7eb',
            background: '#f9fafb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 22px' }}>

          {/* ── Result screen ── */}
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
                    { label: 'Total Rows',    value: result.summary.totalRows, color: '#374151' },
                    { label: 'Created',       value: result.summary.created,   color: '#16a34a' },
                    { label: 'Failed',        value: result.summary.failed,    color: result.summary.failed > 0 ? '#dc2626' : '#374151' },
                    { label: 'Skipped',       value: result.summary.skipped,   color: '#9ca3af' },
                  ].map(s => (
                    <div key={s.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {result.errors.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                    Row errors ({result.errors.length})
                  </div>
                  <div style={{ border: '1px solid #fee2e2', borderRadius: 8, overflow: 'hidden' }}>
                    {result.errors.map((e, i) => (
                      <div key={i} style={{
                        padding: '8px 12px',
                        borderBottom: i < result.errors.length - 1 ? '1px solid #fee2e2' : 'none',
                        background: i % 2 === 0 ? '#fff' : '#fef2f2',
                        fontSize: 12, display: 'flex', gap: 10, alignItems: 'flex-start',
                      }}>
                        <span style={{ color: '#9ca3af', flexShrink: 0, fontWeight: 600 }}>Row {e.row}</span>
                        <span style={{ color: '#6b7280', flexShrink: 0 }}>{e.email ?? '—'}</span>
                        <span style={{ color: '#dc2626' }}>{e.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Error banner ── */}
          {error && !importing && !result && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#b91c1c',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              {error}
            </div>
          )}

          {/* ── File drop zone (no file selected yet) ── */}
          {!file && !result && (
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? '#2563eb' : '#d1d5db'}`,
                borderRadius: 10, padding: '40px 20px', textAlign: 'center',
                cursor: 'pointer', transition: 'border-color 0.15s',
                background: dragOver ? '#eff6ff' : '#fafafa',
              }}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={dragOver ? '#2563eb' : '#9ca3af'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 10px' }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
                {dragOver ? 'Drop the file here' : 'Drag & drop a CSV file, or click to browse'}
              </div>
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                CSV only · Max 1 MB · Max 200 rows
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />
            </div>
          )}

          {/* ── File selected: info + preview ── */}
          {file && !result && (
            <div>
              {/* File info row */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8,
                padding: '10px 14px', marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{file.name}</div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>{formatBytes(file.size)}{preview && preview.totalRows > 0 ? ` · ${preview.totalRows} data row${preview.totalRows !== 1 ? 's' : ''}` : ''}</div>
                  </div>
                </div>
                <button onClick={reset} style={{
                  fontSize: 12, color: '#9ca3af', background: 'none', border: 'none',
                  cursor: 'pointer', padding: '4px 8px', borderRadius: 5,
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9ca3af'; }}
                >
                  Remove
                </button>
              </div>

              {/* Missing headers warning */}
              {missingHeaders.length > 0 && (
                <div style={{
                  background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
                  padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#92400e',
                }}>
                  <strong>Missing required columns:</strong> {missingHeaders.join(', ')}
                </div>
              )}

              {/* Invalid role values warning */}
              {invalidRoleRows.length > 0 && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                  padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#b91c1c',
                }}>
                  <strong>Invalid role values on rows {invalidRoleRows.map(r => r.rowNum).join(', ')}.</strong>
                  {' '}Valid roles: LEARNER, INSTRUCTOR, MANAGER, ADMIN_ASSISTANT.
                </div>
              )}

              {/* CSV Preview table */}
              {preview && preview.headers.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>
                    Preview — first {Math.min(preview.rows.length, 10)} row{preview.rows.length !== 1 ? 's' : ''}
                    {preview.totalRows > 10 ? ` of ${preview.totalRows}` : ''}
                  </div>
                  <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: '#f9fafb' }}>
                          {preview.headers.map(h => (
                            <th key={h} style={{
                              padding: '7px 10px', textAlign: 'left', fontWeight: 600,
                              color: REQUIRED_HEADERS.includes(h) ? '#2563eb' : '#6b7280',
                              borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap',
                            }}>
                              {h}{REQUIRED_HEADERS.includes(h) ? ' *' : ''}
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
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                    * Required columns. Optional: status, verificationState
                  </div>
                </div>
              )}

              {preview && preview.headers.length === 0 && (
                <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>
                  Could not parse file headers.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 22px', borderTop: '1px solid #e5e7eb',
          display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0,
        }}>
          {result ? (
            <>
              <button onClick={reset} style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 600,
                background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 7,
                cursor: 'pointer', color: '#374151', fontFamily: 'inherit',
              }}>
                Import Another
              </button>
              <button onClick={onClose} style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 600,
                background: '#2563eb', border: 'none', borderRadius: 7,
                cursor: 'pointer', color: '#fff', fontFamily: 'inherit',
              }}>
                Done
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} disabled={importing} style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 600,
                background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 7,
                cursor: importing ? 'not-allowed' : 'pointer', color: '#374151', fontFamily: 'inherit',
                opacity: importing ? 0.6 : 1,
              }}>
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!file || importing || missingHeaders.length > 0}
                style={{
                  padding: '8px 18px', fontSize: 13, fontWeight: 600,
                  background: '#2563eb', border: 'none', borderRadius: 7,
                  cursor: (!file || importing || missingHeaders.length > 0) ? 'not-allowed' : 'pointer',
                  color: '#fff', fontFamily: 'inherit',
                  opacity: (!file || importing || missingHeaders.length > 0) ? 0.55 : 1,
                  display: 'flex', alignItems: 'center', gap: 7,
                }}
              >
                {importing && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ animation: 'mn-spin 0.7s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.22-8.56"/>
                  </svg>
                )}
                {importing ? 'Importing…' : 'Import Users'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
