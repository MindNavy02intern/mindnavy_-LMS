// Scheduled Reports — lives inside Export Center tab (task's own first
// suggested location, avoids a 14th tab on an already-13-tab bar). Lists
// every ScheduledReport row, wires Pause/Resume/Delete + opens
// ScheduleReportModal for Create/Edit. Backend runs an hourly sweep
// (scheduledReports.service.js) that actually sends these — this section
// only manages the schedule definitions themselves.

import { useCallback, useEffect, useState } from 'react';
import { Calendar, Pause, Play, Pencil, Trash2, Plus } from 'lucide-react';
import { getScheduledReports, deleteScheduledReport, pauseScheduledReport, resumeScheduledReport } from '../../services/reportsApi';
import { ReportsApiError } from '../../types/reports';
import type { ScheduledReport, ScheduledReportStatus } from '../../types/reports';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import ScheduleReportModal from './ScheduleReportModal';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

const STATUS_BADGE: Record<ScheduledReportStatus, { bg: string; fg: string; label: string }> = {
  ACTIVE:    { bg: '#dcfce7', fg: '#15803d', label: 'Active' },
  PAUSED:    { bg: '#fef9c3', fg: '#a16207', label: 'Paused' },
  CANCELLED: { bg: '#f1f5f9', fg: '#64748b', label: 'Cancelled' },
};

function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function ScheduledReportsSection({ showToast }: Props) {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduledReport | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    getScheduledReports({ limit: 50 })
      .then(res => setReports(res.reports))
      .catch(err => showToast('error', err instanceof ReportsApiError ? err.message : 'Failed to load scheduled reports.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    window.addEventListener('reportsUpdated', fetchData);
    return () => window.removeEventListener('reportsUpdated', fetchData);
  }, [fetchData]);

  function openCreate() { setEditing(null); setModalOpen(true); }
  function openEdit(r: ScheduledReport) { setEditing(r); setModalOpen(true); }

  async function handleTogglePause(r: ScheduledReport) {
    setBusyId(r.id);
    try {
      if (r.status === 'PAUSED') {
        await resumeScheduledReport(r.id);
        invalidateFor(appQueryClient, 'reportSchedule.resume', { id: r.id });
        showToast('success', `"${r.name}" resumed.`);
      } else {
        await pauseScheduledReport(r.id);
        invalidateFor(appQueryClient, 'reportSchedule.pause', { id: r.id });
        showToast('success', `"${r.name}" paused.`);
      }
      fetchData();
    } catch (err) {
      showToast('error', err instanceof ReportsApiError ? err.message : 'Failed to update schedule.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(r: ScheduledReport) {
    if (!window.confirm(`Delete "${r.name}"? This stops all future runs and cannot be undone.`)) return;
    setBusyId(r.id);
    try {
      await deleteScheduledReport(r.id);
      invalidateFor(appQueryClient, 'reportSchedule.delete', { id: r.id });
      showToast('success', `"${r.name}" deleted.`);
      fetchData();
    } catch (err) {
      showToast('error', err instanceof ReportsApiError ? err.message : 'Failed to delete schedule.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Scheduled Reports</div>
        <button
          type="button" onClick={openCreate}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer' }}
        >
          <Plus size={13} /> New Schedule
        </button>
      </div>

      {loading ? (
        <div style={{ fontSize: 12, color: '#9ca3af' }}>Loading…</div>
      ) : reports.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 0', color: '#9ca3af' }}>
          <Calendar size={22} strokeWidth={1.5} />
          <span style={{ fontSize: 12 }}>No scheduled reports yet — recurring exports get emailed to recipients automatically.</span>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#64748b', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Name</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Type</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Format</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Frequency</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Last Run</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Next Run</th>
                <th style={{ padding: '6px 8px', fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(r => {
                const badge = STATUS_BADGE[r.status];
                const busy = busyId === r.id;
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px', color: '#111827', fontWeight: 600 }}>{r.name}</td>
                    <td style={{ padding: '8px', color: '#374151', textTransform: 'capitalize' }}>{r.reportType}</td>
                    <td style={{ padding: '8px', color: '#374151' }}>{r.format}</td>
                    <td style={{ padding: '8px', color: '#374151', textTransform: 'capitalize' }}>{r.frequency.toLowerCase()}</td>
                    <td style={{ padding: '8px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 5, fontSize: 11, fontWeight: 700, background: badge.bg, color: badge.fg }}>{badge.label}</span>
                    </td>
                    <td style={{ padding: '8px', color: '#64748b' }}>{fmt(r.lastRunAt)}</td>
                    <td style={{ padding: '8px', color: '#64748b' }}>{r.status === 'CANCELLED' ? '—' : fmt(r.nextRunAt)}</td>
                    <td style={{ padding: '8px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button type="button" title="Edit" aria-label="Edit" onClick={() => openEdit(r)} disabled={busy} style={iconBtnStyle}>
                          <Pencil size={13} />
                        </button>
                        {r.status !== 'CANCELLED' && (
                          <button type="button" title={r.status === 'PAUSED' ? 'Resume' : 'Pause'} aria-label={r.status === 'PAUSED' ? 'Resume' : 'Pause'} onClick={() => handleTogglePause(r)} disabled={busy} style={iconBtnStyle}>
                            {r.status === 'PAUSED' ? <Play size={13} /> : <Pause size={13} />}
                          </button>
                        )}
                        <button type="button" title="Delete" aria-label="Delete" onClick={() => handleDelete(r)} disabled={busy} style={{ ...iconBtnStyle, color: '#dc2626' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <ScheduleReportModal
          editing={editing}
          onClose={() => setModalOpen(false)}
          onSaved={fetchData}
          showToast={showToast}
        />
      )}
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 26, height: 26, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff',
  cursor: 'pointer', color: '#6b7280',
};
