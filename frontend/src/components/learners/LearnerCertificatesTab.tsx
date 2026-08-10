// Learner Certificates tab (side panel) — GET /learners/:id/certificates
// (Part 5), a thin wrapper over the SAME certificates.service the Learning
// Management CertificatesTab uses (Step 0 audit — reused, not duplicated).
// Download/Reissue reuse the existing generic certificatesApi functions
// directly (same /certificates/:id/pdf and reissue plumbing); Verify opens
// the existing public verify page (/verify/:code) — read-only, no new
// endpoint needed for it.

import { useCallback, useEffect, useState } from 'react';
import { Download, ExternalLink, RefreshCw, Ban } from 'lucide-react';
import { listLearnerCertificates, reissueLearnerCertificate, revokeLearnerCertificate } from '../../services/learnersApi';
import { downloadCertificatePdf, triggerPdfDownload } from '../../services/certificatesApi';
import { LearnerApiError } from '../../types/learners';
import type { Certificate } from '../../types/certificates';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  learnerId: string;
  onChanged: () => void; // a reissue/revoke changes the panel's certificatesCount stat
  showToast: (type: 'success' | 'error', message: string) => void;
}

const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  active:  { bg: '#dcfce7', fg: '#15803d' },
  revoked: { bg: '#fee2e2', fg: '#b91c1c' },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const TH: React.CSSProperties = { padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left', whiteSpace: 'nowrap' };
const TD: React.CSSProperties = { padding: '8px 10px', fontSize: 12, color: '#374151', borderTop: '1px solid #f1f5f9', verticalAlign: 'middle' };
const ICON_BTN: React.CSSProperties = { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' };
const TA: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151', fontFamily: 'inherit', outline: 'none', resize: 'vertical' as const };

export default function LearnerCertificatesTab({ learnerId, onChanged, showToast }: Props) {
  const [certs, setCerts] = useState<Certificate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [revokeTarget, setRevokeTarget] = useState<Certificate | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [revokeBusy, setRevokeBusy] = useState(false);

  const fetchList = useCallback(() => {
    setLoading(true);
    setListError(null);
    listLearnerCertificates(learnerId, { limit: 50 })
      .then(res => setCerts(res.certificates))
      .catch(err => setListError(err instanceof LearnerApiError ? err.message : 'Failed to load certificates.'))
      .finally(() => setLoading(false));
  }, [learnerId]);

  useEffect(() => { fetchList(); }, [fetchList]);

  async function handleDownload(cert: Certificate) {
    setBusyId(cert.id);
    try {
      const blob = await downloadCertificatePdf(cert.id);
      triggerPdfDownload(blob, `certificate-${cert.verificationCode}.pdf`);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setBusyId(null);
    }
  }

  function handleVerify(cert: Certificate) {
    window.open(`/verify/${cert.verificationCode}`, '_blank', 'noopener');
  }

  async function handleReissue(cert: Certificate) {
    if (!window.confirm('Reissue this certificate? The old QR code and any previously downloaded PDFs will stop verifying immediately.')) return;
    setBusyId(cert.id);
    try {
      await reissueLearnerCertificate(learnerId, cert.id);
      invalidateFor(appQueryClient, 'certificate.reissue');
      showToast('success', 'Certificate reissued with a new verification code.');
      fetchList();
      onChanged();
    } catch (err) {
      showToast('error', err instanceof LearnerApiError ? err.message : 'Reissue failed.');
    } finally {
      setBusyId(null);
    }
  }

  function openRevoke(cert: Certificate) {
    setRevokeTarget(cert);
    setRevokeReason('');
  }

  async function submitRevoke() {
    if (!revokeTarget) return;
    setRevokeBusy(true);
    try {
      await revokeLearnerCertificate(learnerId, revokeTarget.id, revokeReason.trim() ? { reason: revokeReason.trim() } : {});
      invalidateFor(appQueryClient, 'certificate.revoke');
      showToast('success', 'Certificate revoked.');
      setRevokeTarget(null);
      fetchList();
      onChanged();
    } catch (err) {
      showToast('error', err instanceof LearnerApiError ? err.message : 'Revoke failed.');
    } finally {
      setRevokeBusy(false);
    }
  }

  return (
    <div style={{ padding: '16px 20px' }}>
      {listError && (
        <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#b91c1c', marginBottom: 10 }}>
          {listError}
        </div>
      )}

      {loading && <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>Loading…</div>}

      {!loading && !listError && certs && certs.length === 0 && (
        <div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, background: '#f8fafc', padding: '32px 16px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          No certificates issued yet.
        </div>
      )}

      {!loading && certs && certs.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={TH}>Course</th>
                  <th style={TH}>Issued</th>
                  <th style={TH}>Status</th>
                  <th style={TH}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {certs.map(cert => {
                  const busy = busyId === cert.id;
                  const badge = STATUS_BADGE[cert.status] ?? STATUS_BADGE.active;
                  return (
                    <tr key={cert.id} style={busy ? { opacity: 0.5 } : undefined}>
                      <td style={{ ...TD, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cert.courseTitle ?? undefined}>{cert.courseTitle ?? '—'}</td>
                      <td style={TD}>{formatDate(cert.issuedAt)}</td>
                      <td style={TD}>
                        <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: badge.bg, color: badge.fg }}>
                          {cert.status}
                        </span>
                      </td>
                      <td style={TD}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button type="button" title="Download PDF" aria-label={`Download PDF for ${cert.courseTitle ?? 'certificate'}`} disabled={busy || cert.status === 'revoked'} onClick={() => handleDownload(cert)} style={{ ...ICON_BTN, opacity: cert.status === 'revoked' ? 0.4 : 1 }}>
                            <Download size={12} color="#64748b" strokeWidth={2} />
                          </button>
                          <button type="button" title="Verify" aria-label={`Verify ${cert.courseTitle ?? 'certificate'}`} disabled={busy} onClick={() => handleVerify(cert)} style={ICON_BTN}>
                            <ExternalLink size={12} color="#2563eb" strokeWidth={2} />
                          </button>
                          <button type="button" title="Reissue" aria-label={`Reissue ${cert.courseTitle ?? 'certificate'}`} disabled={busy} onClick={() => handleReissue(cert)} style={ICON_BTN}>
                            <RefreshCw size={12} color="#ea580c" strokeWidth={2} />
                          </button>
                          {cert.status !== 'revoked' && (
                            <button type="button" title="Revoke" aria-label={`Revoke ${cert.courseTitle ?? 'certificate'}`} disabled={busy} onClick={() => openRevoke(cert)} style={ICON_BTN}>
                              <Ban size={12} color="#dc2626" strokeWidth={2} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {revokeTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!revokeBusy ? () => setRevokeTarget(null) : undefined} />
          <div role="dialog" aria-label="Revoke Certificate" style={{ position: 'relative', width: '100%', maxWidth: 380, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Revoke Certificate</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                It will stop verifying immediately. This can be undone later via Reissue.
              </p>
            </div>
            <div style={{ padding: '14px 18px' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                Reason <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>(optional — kept in the audit log)</span>
              </label>
              <textarea aria-label="Revocation reason" rows={3} value={revokeReason} onChange={e => setRevokeReason(e.target.value)} style={TA} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #f1f5f9' }}>
              <button type="button" onClick={() => setRevokeTarget(null)} disabled={revokeBusy} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
                Cancel
              </button>
              <button type="button" onClick={submitRevoke} disabled={revokeBusy} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, background: revokeBusy ? '#9ca3af' : '#dc2626', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#fff' }}>
                {revokeBusy ? 'Revoking…' : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
