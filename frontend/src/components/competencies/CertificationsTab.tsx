// Certifications tab — GET /api/admin/competencies/certifications.
// competencyCert.assign/verify/revoke were dead mutation IDs in the v1
// contract (already reserved in invalidation.ts) — this tab is what makes
// them real.

import { useCallback, useEffect, useState } from 'react';
import { Plus, ShieldCheck, ShieldX, Trash2 } from 'lucide-react';
import {
  listCertifications, verifyCertification, revokeCertification, deleteCertification,
} from '../../services/competenciesApi';
import { CERTIFICATION_STATUSES, CompetenciesApiError } from '../../types/competencies';
import type { CompetencyCertification, CertificationStatus } from '../../types/competencies';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import AssignCertificationModal from './AssignCertificationModal';

interface Props {
  showToast: (type: 'success' | 'error', message: string) => void;
  refreshSignal: number;
}

const SELECT: React.CSSProperties = {
  padding: '8px 10px', fontSize: 13, fontFamily: 'inherit', outline: 'none',
  border: '1px solid #d1d5db', borderRadius: 6, color: '#374151', background: '#fff',
};

const STATUS_BADGE: Record<CertificationStatus, { bg: string; color: string }> = {
  PENDING:  { bg: '#fef9c3', color: '#854d0e' },
  VERIFIED: { bg: '#dcfce7', color: '#15803d' },
  REVOKED:  { bg: '#fee2e2', color: '#b91c1c' },
  EXPIRED:  { bg: '#f1f5f9', color: '#64748b' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function CertificationsTab({ showToast, refreshSignal }: Props) {
  const [certs, setCerts] = useState<CompetencyCertification[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, pages: 1 });
  const [loading, setLoading] = useState(true);

  const [status, setStatus] = useState<CertificationStatus | ''>('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchList = useCallback(() => {
    setLoading(true);
    listCertifications({ page, limit: 10, status: status || undefined })
      .then(res => { setCerts(res.certifications); setPagination(res.pagination); })
      .catch(err => showToast('error', err instanceof CompetenciesApiError ? err.message : 'Failed to load certifications.'))
      .finally(() => setLoading(false));
  }, [page, status, showToast]);

  useEffect(() => { fetchList(); }, [fetchList, refreshSignal]);
  useEffect(() => { setPage(1); }, [status]);
  useEffect(() => {
    window.addEventListener('analyticsUpdated', fetchList);
    return () => window.removeEventListener('analyticsUpdated', fetchList);
  }, [fetchList]);

  async function handleVerify(cert: CompetencyCertification) {
    setBusyId(cert.id);
    try {
      await verifyCertification(cert.id);
      invalidateFor(appQueryClient, 'competencyCert.verify', { userId: cert.userId });
      showToast('success', `Certification verified for ${cert.userName ?? 'user'}.`);
      fetchList();
    } catch (err) {
      showToast('error', err instanceof CompetenciesApiError ? err.message : 'Failed to verify certification.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRevoke(cert: CompetencyCertification) {
    const reason = window.prompt(`Reason for revoking ${cert.userName ?? "this user"}'s certification:`);
    if (reason === null) return;
    if (!reason.trim()) { showToast('error', 'A reason is required to revoke.'); return; }
    setBusyId(cert.id);
    try {
      await revokeCertification(cert.id, reason.trim());
      invalidateFor(appQueryClient, 'competencyCert.revoke', { userId: cert.userId });
      showToast('success', 'Certification revoked.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof CompetenciesApiError ? err.message : 'Failed to revoke certification.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(cert: CompetencyCertification) {
    if (!window.confirm(`Delete this certification record for ${cert.userName ?? 'this user'}? This cannot be undone.`)) return;
    setBusyId(cert.id);
    try {
      await deleteCertification(cert.id);
      invalidateFor(appQueryClient, 'competencyCert.delete', { userId: cert.userId });
      showToast('success', 'Certification deleted.');
      fetchList();
    } catch (err) {
      showToast('error', err instanceof CompetenciesApiError ? err.message : 'Failed to delete certification.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: 16, borderBottom: '1px solid #f1f5f9', alignItems: 'center' }}>
        <select style={SELECT} value={status} onChange={e => setStatus(e.target.value as CertificationStatus | '')}>
          <option value="">All statuses</option>
          {CERTIFICATION_STATUSES.map(s => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
        </select>
        <button
          type="button" onClick={() => setCreateOpen(true)}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
        >
          <Plus size={15} strokeWidth={2.5} /> Assign Certification
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              {['User', 'Skill', 'Framework', 'Status', 'Issued', 'Expires', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: h === 'User' || h === 'Skill' || h === 'Framework' ? 'left' : 'center', padding: '10px 12px', color: '#94a3b8', fontWeight: 600, fontSize: 11.5 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>Loading…</td></tr>
            ) : certs.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No competency certifications yet.</td></tr>
            ) : certs.map(c => {
              const badge = STATUS_BADGE[c.effectiveStatus];
              const busy = busyId === c.id;
              return (
                <tr key={c.id} style={{ borderBottom: '1px solid #f8fafc', opacity: busy ? 0.5 : 1 }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#0f172a' }}>{c.userName ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{c.skillName ?? '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#64748b' }}>{c.frameworkName ?? '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, background: badge.bg, color: badge.color }}>
                      {c.effectiveStatus.charAt(0) + c.effectiveStatus.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>{formatDate(c.issuedAt)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', color: '#64748b', fontSize: 12 }}>{formatDate(c.expiresAt)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                      {c.status === 'PENDING' && (
                        <button type="button" onClick={() => handleVerify(c)} disabled={busy} title="Verify"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16a34a', padding: 4, borderRadius: 6 }}>
                          <ShieldCheck size={15} strokeWidth={2} />
                        </button>
                      )}
                      {c.status !== 'REVOKED' && (
                        <button type="button" onClick={() => handleRevoke(c)} disabled={busy} title="Revoke"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d97706', padding: 4, borderRadius: 6 }}>
                          <ShieldX size={15} strokeWidth={2} />
                        </button>
                      )}
                      <button type="button" onClick={() => handleDelete(c)} disabled={busy} title="Delete"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 6 }}>
                        <Trash2 size={15} strokeWidth={2} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pagination.pages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 14, borderTop: '1px solid #f1f5f9' }}>
          <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>Prev</button>
          <span style={{ fontSize: 12, color: '#64748b' }}>Page {pagination.page} of {pagination.pages}</span>
          <button type="button" disabled={page >= pagination.pages} onClick={() => setPage(p => p + 1)} style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: page >= pagination.pages ? 'default' : 'pointer', opacity: page >= pagination.pages ? 0.5 : 1 }}>Next</button>
        </div>
      )}

      {createOpen && (
        <AssignCertificationModal
          onClose={() => setCreateOpen(false)}
          onSuccess={() => { setCreateOpen(false); fetchList(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}
