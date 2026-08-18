// Compliance Reports tab — mandatory training / expired certs / department
// compliance are honest em-dashes: this schema has no mandatory-training
// flag, no certificate expiry field, and no compliance-violation tracking
// model (confirmed by a full schema grep, see REPORTS_CONTRACT.md).
// Compliance Violations is a proxy (USER_SUSPENDED audit events in the
// current month — no date-range picker on this tab, unlike other Reports
// tabs, so it's always "this month"). At-risk users reuses learners.service's
// own AT_RISK_THRESHOLD definition, not a bespoke "compliance risk".

import { useCallback, useEffect, useState } from 'react';
import { getComplianceReports } from '../../services/reportsApi';
import { getDepartments } from '../../api/organization';
import { ReportsApiError } from '../../types/reports';
import type { ComplianceReports } from '../../types/reports';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
}

function Skeleton() {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[1, 2, 3].map(i => <div key={i} style={{ height: 14, borderRadius: 4, background: '#e5e7eb', width: `${55 + i * 10}%` }} />)}</div>;
}
function EmptyChart({ label }: { label: string }) {
  return <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', fontSize: 13 }}>{label}</div>;
}
function StatTile({ label, value, reason }: { label: string; value: string | null; reason?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: value === null ? '#cbd5e1' : '#0f172a' }}>{value ?? '—'}</div>
      {value === null && reason && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{reason}</div>}
    </div>
  );
}

export default function ComplianceReportsTab({ showToast }: Props) {
  const [departmentId, setDepartmentId] = useState('');
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [data, setData] = useState<ComplianceReports | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getDepartments({ limit: 100 }).then(res => setDepartments(res.departments.map(d => ({ id: d.id, name: d.name })))).catch(() => {}); }, []);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    getComplianceReports({ departmentId: departmentId || undefined })
      .then(setData)
      .catch(err => setError(err instanceof ReportsApiError ? err.message : 'Failed to load compliance reports.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    window.addEventListener('analyticsUpdated', fetchData);
    return () => window.removeEventListener('analyticsUpdated', fetchData);
  }, [fetchData]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <select value={departmentId} onChange={e => setDepartmentId(e.target.value)} style={{ padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', color: '#374151', background: '#fff', width: 'fit-content' }}>
        <option value="">All Departments</option>
        {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
      </select>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#b91c1c' }}>
          <span>{error}</span>
          <button onClick={() => { showToast('error', error); fetchData(); }} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 5, color: '#b91c1c', fontSize: 12, fontWeight: 600, padding: '3px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Retry</button>
        </div>
      )}

      {loading || !data ? <Skeleton /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          <StatTile label="Mandatory Training Completion" value={data.mandatoryTrainingCompletion.available ? `${data.mandatoryTrainingCompletion.value}%` : null} reason={data.mandatoryTrainingCompletion.reason} />
          <StatTile label="Expired Certifications" value={data.expiredCertifications.available ? String(data.expiredCertifications.value) : null} reason={data.expiredCertifications.reason} />
          <StatTile label="Compliance Violations (this month)" value={data.complianceViolations.available ? String(data.complianceViolations.value) : null} reason={data.complianceViolations.reason} />
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 14 }}>Department Compliance</div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>{data?.departmentCompliance.reason ?? 'Not available yet'}</div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '16px 20px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 14 }}>At-Risk Users</div>
        {loading || !data ? <Skeleton /> : data.atRiskUsers.length === 0 ? <EmptyChart label="No at-risk learners found" /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  {['Name', 'Department', 'Risk Score'].map(h => (
                    <th key={h} style={{ textAlign: h === 'Risk Score' ? 'right' : 'left', padding: '6px 8px', color: '#94a3b8', fontWeight: 600, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.atRiskUsers.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                    <td style={{ padding: '8px', fontWeight: 600, color: '#0f172a' }}>{u.name ?? '—'}</td>
                    <td style={{ padding: '8px', color: '#374151' }}>{u.department ?? '—'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>{u.riskScore ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
