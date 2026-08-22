import { useCallback, useEffect, useState } from 'react';
import { getAuditReports } from '../../services/reportsApi';
import type { AuditLogRow } from '../../types/reports';
import {
  ROLE_AUDIT_ACTIONS,
  ROLE_AUDIT_RANGE,
  ROLE_AUDIT_ACTION_LABEL as ACTION_LABEL,
} from '../../constants/roleAuditActions';

const ACTION_BADGE: Record<string, { bg: string; color: string }> = {
  COMPANY_ROLE_CREATED: { bg: '#f0fdf4', color: '#16a34a' },
  COMPANY_ROLE_UPDATED: { bg: '#eff6ff', color: '#2563eb' },
  COMPANY_ROLE_DELETED: { bg: '#fef2f2', color: '#dc2626' },
  DELEGATED_ADMIN_GRANTED: { bg: '#f0fdf4', color: '#16a34a' },
  DELEGATED_ADMIN_REVOKED: { bg: '#fff7ed', color: '#c2410c' },
};

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function SkeletonRow() {
  return (
    <tr>
      {[160, 200, 260, 140].map((w, i) => (
        <td key={i} style={{ padding: '11px 14px' }}>
          <div style={{ width: w, height: 11, borderRadius: 4, background: '#f0f0f0', animation: 'rp-pulse 1.4s ease-in-out infinite' }} />
        </td>
      ))}
    </tr>
  );
}

export default function AuditTrackingTab() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(() => {
    setLoading(true);
    getAuditReports({ actions: ROLE_AUDIT_ACTIONS, dateRange: ROLE_AUDIT_RANGE, page: 1, limit: 50 })
      .then(res => { setLogs(res.logs); setTotal(res.pagination.total); })
      .catch(() => { setLogs([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => {
    const refresh = () => fetchLogs();
    window.addEventListener('rolesUpdated', refresh);
    return () => window.removeEventListener('rolesUpdated', refresh);
  }, [fetchLogs]);

  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Audit & Tracking</div>
        <div style={{ fontSize: 11.5, color: '#6b7280' }}>Company Role and Delegated Admin changes — last 90 days ({total} total)</div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #f0f0f0' }}>
              <th style={{ padding: '9px 12px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>ACTION</th>
              <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>PERFORMED BY</th>
              <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>DETAILS</th>
              <th style={{ padding: '9px 10px', textAlign: 'left', fontWeight: 600, color: '#6b7280', fontSize: 11 }}>DATE</th>
            </tr>
          </thead>
          <tbody>
            {loading && Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
            {!loading && logs.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No role or admin-delegation changes in the last 90 days.</td></tr>
            )}
            {!loading && logs.map(log => {
              const badge = ACTION_BADGE[log.action] ?? { bg: '#f3f4f6', color: '#374151' };
              const meta = log.metadata ?? {};
              return (
                <tr key={log.id} className="rp-table-row" style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ background: badge.bg, color: badge.color, borderRadius: 100, fontSize: 10.5, fontWeight: 600, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                      {ACTION_LABEL[log.action] ?? log.action}
                    </span>
                  </td>
                  <td style={{ padding: '10px 10px', color: '#374151', fontWeight: 500 }}>{log.userName ?? 'System'}</td>
                  <td style={{ padding: '10px 10px', color: '#6b7280', fontSize: 11.5, fontFamily: 'monospace', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {Object.entries(meta).map(([k, v]) => `${k}: ${String(v)}`).join('  ·  ') || '—'}
                  </td>
                  <td style={{ padding: '10px 10px', color: '#6b7280', fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDateTime(log.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
