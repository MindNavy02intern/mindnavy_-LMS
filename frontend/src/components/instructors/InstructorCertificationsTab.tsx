// Instructor Certifications tab — teaching certs/licences/degrees.
// NOT in INSTRUCTORS_CONTRACT.md v1 ("Certifications deliberately did NOT ship"
// is documented as a deliberate [planned] gap — separate entity from
// Documents). Shipped anyway at the user's explicit direction 2026-08-07; see
// types/instructors.ts InstructorCertification for the full note.
// Upload is sign -> client PUT -> create, same 3-step pattern as
// InstructorDocumentsTab. fileUrl is a signed link that expires in 5 min —
// never cached client-side.

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Trash2, Upload, XCircle } from 'lucide-react';
import {
  createInstructorCertification, deleteInstructorCertification, listInstructorCertifications,
  rejectInstructorCertification, signInstructorCertification, verifyInstructorCertification,
} from '../../services/instructorsApi';
import { InstructorApiError } from '../../types/instructors';
import type { CertificationType, InstructorCertification } from '../../types/instructors';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  instructorId: string;
  showToast:    (type: 'success' | 'error', message: string) => void;
}

const TYPE_OPTIONS: { value: CertificationType; label: string }[] = [
  { value: 'TEACHING',     label: 'Teaching' },
  { value: 'PROFESSIONAL', label: 'Professional' },
  { value: 'ACADEMIC',     label: 'Academic' },
  { value: 'TECHNICAL',    label: 'Technical' },
  { value: 'TRAINING',     label: 'Training' },
];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map(t => [t.value, t.label]));

const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  PENDING:  { bg: '#fef9c3', fg: '#a16207' },
  VERIFIED: { bg: '#dcfce7', fg: '#15803d' },
  REJECTED: { bg: '#fee2e2', fg: '#b91c1c' },
};

const ACCEPTED_MIME = 'application/pdf,image/png,image/jpeg,image/webp';

const TH: React.CSSProperties = { padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left', whiteSpace: 'nowrap' };
const TD: React.CSSProperties = { padding: '8px 10px', fontSize: 12, color: '#374151', borderTop: '1px solid #f1f5f9', verticalAlign: 'middle' };
const ICON_BTN: React.CSSProperties = { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' };
const INPUT: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151', fontFamily: 'inherit', outline: 'none' };

export default function InstructorCertificationsTab({ instructorId, showToast }: Props) {
  const [certs, setCerts] = useState<InstructorCertification[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadIssuer, setUploadIssuer] = useState('');
  const [uploadType, setUploadType] = useState<CertificationType | ''>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchList = useCallback(() => {
    setLoading(true);
    setListError(null);
    listInstructorCertifications(instructorId)
      .then(res => setCerts(res.certifications))
      .catch(err => setListError(err instanceof InstructorApiError ? err.message : 'Failed to load certifications.'))
      .finally(() => setLoading(false));
  }, [instructorId]);

  useEffect(() => { fetchList(); }, [fetchList]);

  async function handleVerify(cert: InstructorCertification) {
    setBusyId(cert.id);
    try {
      await verifyInstructorCertification(instructorId, cert.id);
      invalidateFor(appQueryClient, 'instructorCert.verify', { id: instructorId });
      showToast('success', `"${cert.name}" verified.`);
      fetchList();
    } catch (err) {
      showToast('error', err instanceof InstructorApiError ? err.message : 'Verify failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(cert: InstructorCertification) {
    setBusyId(cert.id);
    try {
      await rejectInstructorCertification(instructorId, cert.id);
      invalidateFor(appQueryClient, 'instructorCert.reject', { id: instructorId });
      showToast('success', `"${cert.name}" rejected.`);
      fetchList();
    } catch (err) {
      showToast('error', err instanceof InstructorApiError ? err.message : 'Reject failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(cert: InstructorCertification) {
    if (!window.confirm(`Delete "${cert.name}"? This cannot be undone.`)) return;
    setBusyId(cert.id);
    try {
      await deleteInstructorCertification(instructorId, cert.id);
      invalidateFor(appQueryClient, 'instructorCert.delete', { id: instructorId });
      showToast('success', `"${cert.name}" deleted.`);
      fetchList();
    } catch (err) {
      showToast('error', err instanceof InstructorApiError ? err.message : 'Delete failed.');
    } finally {
      setBusyId(null);
    }
  }

  function openUpload() {
    setUploadName('');
    setUploadIssuer('');
    setUploadType('');
    setUploadFile(null);
    setUploadErr(null);
    setUploadOpen(true);
  }

  async function submitUpload() {
    if (!uploadName.trim()) { setUploadErr('Name is required.'); return; }
    if (!uploadIssuer.trim()) { setUploadErr('Issuer is required.'); return; }
    if (!uploadType) { setUploadErr('Select a certification type.'); return; }
    setUploadErr(null);
    setUploading(true);
    try {
      let path: string | undefined;
      if (uploadFile) {
        const sign = await signInstructorCertification(instructorId, {
          fileName: uploadFile.name, fileType: uploadFile.type,
        });
        const putRes = await fetch(sign.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': uploadFile.type },
          body: uploadFile,
        });
        if (!putRes.ok) {
          showToast('error', 'Upload to storage failed — please try again.');
          return; // do not create the row — the file never landed
        }
        path = sign.path;
      }
      await createInstructorCertification(instructorId, {
        name: uploadName.trim(), issuer: uploadIssuer.trim(), type: uploadType,
        ...(path ? { path, fileName: uploadFile!.name } : {}),
      });
      invalidateFor(appQueryClient, 'instructorCert.upload', { id: instructorId });
      showToast('success', `"${uploadName.trim()}" added.`);
      setUploadOpen(false);
      fetchList();
    } catch (err) {
      showToast('error', err instanceof InstructorApiError ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={{ padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
        <button
          type="button"
          onClick={openUpload}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer' }}
        >
          <Upload size={13} /> Upload Certification
        </button>
      </div>

      {listError && (
        <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#b91c1c', marginBottom: 10 }}>
          {listError}
        </div>
      )}

      {loading && <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>Loading…</div>}

      {!loading && !listError && certs && certs.length === 0 && (
        <div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, background: '#f8fafc', padding: '32px 16px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          No certifications uploaded yet.
        </div>
      )}

      {!loading && certs && certs.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={TH}>Name</th>
                  <th style={TH}>Type</th>
                  <th style={TH}>Issuer</th>
                  <th style={TH}>Status</th>
                  <th style={TH}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {certs.map(cert => {
                  const busy = busyId === cert.id;
                  const status = STATUS_BADGE[cert.status] ?? STATUS_BADGE.PENDING;
                  return (
                    <tr key={cert.id} style={busy ? { opacity: 0.5 } : undefined}>
                      <td style={{ ...TD, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cert.name}>{cert.name}</td>
                      <td style={TD}>
                        <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: '#eef2ff', color: '#4338ca' }}>
                          {TYPE_LABEL[cert.type] ?? cert.type}
                        </span>
                      </td>
                      <td style={{ ...TD, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cert.issuer}>{cert.issuer}</td>
                      <td style={TD}>
                        <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: status.bg, color: status.fg }}>
                          {cert.status}
                        </span>
                      </td>
                      <td style={TD}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {cert.status !== 'VERIFIED' && (
                            <button type="button" title="Verify" aria-label={`Verify ${cert.name}`} disabled={busy} onClick={() => handleVerify(cert)} style={ICON_BTN}>
                              <CheckCircle size={13} color="#16a34a" strokeWidth={2} />
                            </button>
                          )}
                          {cert.status !== 'REJECTED' && (
                            <button type="button" title="Reject" aria-label={`Reject ${cert.name}`} disabled={busy} onClick={() => handleReject(cert)} style={ICON_BTN}>
                              <XCircle size={13} color="#dc2626" strokeWidth={2} />
                            </button>
                          )}
                          <button type="button" title="Delete" aria-label={`Delete ${cert.name}`} disabled={busy} onClick={() => handleDelete(cert)} style={ICON_BTN}>
                            <Trash2 size={13} color="#64748b" strokeWidth={2} />
                          </button>
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

      {/* Upload modal */}
      {uploadOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!uploading ? () => setUploadOpen(false) : undefined} />
          <div role="dialog" aria-label="Upload Certification" style={{ position: 'relative', width: '100%', maxWidth: 380, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Upload Certification</h3>
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  aria-label="Certification name"
                  value={uploadName}
                  onChange={e => { setUploadName(e.target.value); setUploadErr(null); }}
                  placeholder="e.g. Certified Instructional Designer"
                  style={INPUT}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Type <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  aria-label="Certification type"
                  value={uploadType}
                  onChange={e => { setUploadType(e.target.value as CertificationType); setUploadErr(null); }}
                  style={INPUT}
                >
                  <option value="">Select a type…</option>
                  {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Issuer <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  aria-label="Certification issuer"
                  value={uploadIssuer}
                  onChange={e => { setUploadIssuer(e.target.value); setUploadErr(null); }}
                  placeholder="e.g. ATD"
                  style={INPUT}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  File
                </label>
                <input
                  type="file"
                  aria-label="Certification file"
                  accept={ACCEPTED_MIME}
                  onChange={e => { setUploadFile(e.target.files?.[0] ?? null); setUploadErr(null); }}
                  style={{ fontSize: 12, width: '100%' }}
                />
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>Optional — PDF, PNG, JPEG, or WebP.</div>
              </div>
              {uploadErr && <div style={{ fontSize: 11, color: '#dc2626' }}>{uploadErr}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #f1f5f9' }}>
              <button type="button" onClick={() => setUploadOpen(false)} disabled={uploading} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
                Cancel
              </button>
              <button type="button" onClick={submitUpload} disabled={uploading} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, background: uploading ? '#9ca3af' : '#2563eb', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#fff' }}>
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
