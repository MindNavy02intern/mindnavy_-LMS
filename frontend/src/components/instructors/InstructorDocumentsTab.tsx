// Instructor Documents tab (blueprint 05 §12) — administrative paperwork only.
// INSTRUCTORS_CONTRACT.md: no CERTIFICATION type here (separate entity, 400 if
// sent). downloadUrl is a signed link that expires in 5 min — never cached,
// refetched fresh on every Download click.

import { useCallback, useEffect, useState } from 'react';
import { Download, Trash2, CheckCircle, XCircle, Upload } from 'lucide-react';
import {
  archiveInstructorDocument, confirmInstructorDocument, listInstructorDocuments,
  rejectInstructorDocument, signInstructorDocument, verifyInstructorDocument,
} from '../../services/instructorsApi';
import { InstructorApiError } from '../../types/instructors';
import type { DocumentType, InstructorDocument } from '../../types/instructors';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';

interface Props {
  instructorId: string;
  showToast:    (type: 'success' | 'error', message: string) => void;
}

const TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'IDENTITY',    label: 'Identity' },
  { value: 'CONTRACT',    label: 'Contract' },
  { value: 'AGREEMENT',   label: 'Agreement' },
  { value: 'TAX',         label: 'Tax' },
  { value: 'COMPLIANCE',  label: 'Compliance' },
];
const TYPE_LABEL: Record<string, string> = Object.fromEntries(TYPE_OPTIONS.map(t => [t.value, t.label]));

const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  PENDING:  { bg: '#fef9c3', fg: '#a16207' },
  VERIFIED: { bg: '#dcfce7', fg: '#15803d' },
  REJECTED: { bg: '#fee2e2', fg: '#b91c1c' },
  ARCHIVED: { bg: '#f1f5f9', fg: '#94a3b8' },
};

const ACCEPTED_MIME = 'application/pdf,image/png,image/jpeg,image/webp';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const TH: React.CSSProperties = { padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left', whiteSpace: 'nowrap' };
const TD: React.CSSProperties = { padding: '8px 10px', fontSize: 12, color: '#374151', borderTop: '1px solid #f1f5f9', verticalAlign: 'middle' };
const ICON_BTN: React.CSSProperties = { width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', cursor: 'pointer' };
const TA: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151', fontFamily: 'inherit', outline: 'none' };

export default function InstructorDocumentsTab({ instructorId, showToast }: Props) {
  const [documents, setDocuments] = useState<InstructorDocument[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<DocumentType | ''>('');
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<InstructorDocument | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectErr, setRejectErr] = useState<string | null>(null);
  const [rejectBusy, setRejectBusy] = useState(false);

  const fetchList = useCallback(() => {
    setLoading(true);
    setListError(null);
    listInstructorDocuments(instructorId)
      .then(res => setDocuments(res.documents))
      .catch(err => setListError(err instanceof InstructorApiError ? err.message : 'Failed to load documents.'))
      .finally(() => setLoading(false));
  }, [instructorId]);

  useEffect(() => { fetchList(); }, [fetchList]);

  async function handleDownload(doc: InstructorDocument) {
    setBusyId(doc.id);
    try {
      // downloadUrl expires in 5 min — refetch for a fresh link rather than
      // reusing whatever was in state (contract: never cache it).
      const res = await listInstructorDocuments(instructorId);
      setDocuments(res.documents);
      const fresh = res.documents.find(d => d.id === doc.id);
      if (fresh?.downloadUrl) window.open(fresh.downloadUrl, '_blank', 'noopener');
      else showToast('error', 'Download link unavailable — storage is not configured.');
    } catch (err) {
      showToast('error', err instanceof InstructorApiError ? err.message : 'Download failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleVerify(doc: InstructorDocument) {
    setBusyId(doc.id);
    try {
      await verifyInstructorDocument(instructorId, doc.id);
      invalidateFor(appQueryClient, 'instructorDoc.verify', { id: instructorId });
      showToast('success', `"${doc.fileName}" verified.`);
      fetchList();
    } catch (err) {
      showToast('error', err instanceof InstructorApiError ? err.message : 'Verify failed.');
    } finally {
      setBusyId(null);
    }
  }

  function openReject(doc: InstructorDocument) {
    setRejectTarget(doc);
    setRejectReason('');
    setRejectErr(null);
  }

  async function submitReject() {
    if (!rejectTarget) return;
    const trimmed = rejectReason.trim();
    if (trimmed.length < 3) { setRejectErr('Required — at least 3 characters.'); return; }
    setRejectBusy(true);
    try {
      await rejectInstructorDocument(instructorId, rejectTarget.id, trimmed);
      invalidateFor(appQueryClient, 'instructorDoc.reject', { id: instructorId });
      showToast('success', `"${rejectTarget.fileName}" rejected.`);
      setRejectTarget(null);
      fetchList();
    } catch (err) {
      showToast('error', err instanceof InstructorApiError ? err.message : 'Rejection failed.');
    } finally {
      setRejectBusy(false);
    }
  }

  async function handleDelete(doc: InstructorDocument) {
    if (!window.confirm(`Remove "${doc.fileName}"? The file stays on record for compliance — this just hides it from the list.`)) return;
    setBusyId(doc.id);
    try {
      await archiveInstructorDocument(instructorId, doc.id);
      invalidateFor(appQueryClient, 'instructorDoc.archive', { id: instructorId });
      showToast('success', `"${doc.fileName}" removed.`);
      fetchList();
    } catch (err) {
      showToast('error', err instanceof InstructorApiError ? err.message : 'Delete failed.');
    } finally {
      setBusyId(null);
    }
  }

  function openUpload() {
    setUploadFile(null);
    setUploadType('');
    setUploadErr(null);
    setUploadOpen(true);
  }

  async function submitUpload() {
    if (!uploadFile) { setUploadErr('Choose a file.'); return; }
    if (!uploadType) { setUploadErr('Select a document type.'); return; }
    setUploadErr(null);
    setUploading(true);
    try {
      const sign = await signInstructorDocument(instructorId, {
        fileName: uploadFile.name, fileType: uploadFile.type, type: uploadType,
      });
      const putRes = await fetch(sign.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': uploadFile.type },
        body: uploadFile,
      });
      if (!putRes.ok) {
        showToast('error', 'Upload to storage failed — please try again.');
        return; // do not call confirm — contract: the upload never landed
      }
      await confirmInstructorDocument(instructorId, { path: sign.path, fileName: uploadFile.name, type: uploadType });
      invalidateFor(appQueryClient, 'instructorDoc.upload', { id: instructorId });
      showToast('success', `"${uploadFile.name}" uploaded.`);
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
          <Upload size={13} /> Upload Document
        </button>
      </div>

      {listError && (
        <div style={{ padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#b91c1c', marginBottom: 10 }}>
          {listError}
        </div>
      )}

      {loading && <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0' }}>Loading…</div>}

      {!loading && !listError && documents && documents.length === 0 && (
        <div style={{ border: '1px dashed #cbd5e1', borderRadius: 10, background: '#f8fafc', padding: '32px 16px', textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
          No documents uploaded yet.
        </div>
      )}

      {!loading && documents && documents.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 10, background: '#fff', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  <th style={TH}>File Name</th>
                  <th style={TH}>Type</th>
                  <th style={TH}>Status</th>
                  <th style={TH}>Uploaded</th>
                  <th style={TH}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => {
                  const busy = busyId === doc.id;
                  const status = STATUS_BADGE[doc.status] ?? STATUS_BADGE.PENDING;
                  return (
                    <tr key={doc.id} style={busy ? { opacity: 0.5 } : undefined}>
                      <td style={{ ...TD, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.fileName}>{doc.fileName}</td>
                      <td style={TD}>
                        <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600, background: '#eef2ff', color: '#4338ca' }}>
                          {TYPE_LABEL[doc.type] ?? doc.type}
                        </span>
                      </td>
                      <td style={TD}>
                        <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: status.bg, color: status.fg }}>
                          {doc.status}
                        </span>
                        {doc.status === 'REJECTED' && doc.rejectionReason && (
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }} title={doc.rejectionReason}>
                            {doc.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td style={TD}>{formatDate(doc.uploadedAt)}</td>
                      <td style={TD}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button type="button" title="Download" aria-label={`Download ${doc.fileName}`} disabled={busy || doc.downloadUrl === null} onClick={() => handleDownload(doc)} style={{ ...ICON_BTN, opacity: doc.downloadUrl === null ? 0.4 : 1 }}>
                            <Download size={13} color="#64748b" strokeWidth={2} />
                          </button>
                          {doc.status !== 'VERIFIED' && (
                            <button type="button" title="Verify" aria-label={`Verify ${doc.fileName}`} disabled={busy} onClick={() => handleVerify(doc)} style={ICON_BTN}>
                              <CheckCircle size={13} color="#16a34a" strokeWidth={2} />
                            </button>
                          )}
                          {doc.status !== 'REJECTED' && (
                            <button type="button" title="Reject" aria-label={`Reject ${doc.fileName}`} disabled={busy} onClick={() => openReject(doc)} style={ICON_BTN}>
                              <XCircle size={13} color="#dc2626" strokeWidth={2} />
                            </button>
                          )}
                          <button type="button" title="Delete" aria-label={`Delete ${doc.fileName}`} disabled={busy} onClick={() => handleDelete(doc)} style={ICON_BTN}>
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
          <div role="dialog" aria-label="Upload Document" style={{ position: 'relative', width: '100%', maxWidth: 380, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Upload Document</h3>
            </div>
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  File <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="file"
                  aria-label="Document file"
                  accept={ACCEPTED_MIME}
                  onChange={e => { setUploadFile(e.target.files?.[0] ?? null); setUploadErr(null); }}
                  style={{ fontSize: 12, width: '100%' }}
                />
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>PDF, PNG, JPEG, or WebP.</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  Type <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  aria-label="Document type"
                  value={uploadType}
                  onChange={e => { setUploadType(e.target.value as DocumentType); setUploadErr(null); }}
                  style={TA}
                >
                  <option value="">Select a type…</option>
                  {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
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

      {/* Reject reason modal */}
      {rejectTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={!rejectBusy ? () => setRejectTarget(null) : undefined} />
          <div role="dialog" aria-label="Reject Document" style={{ position: 'relative', width: '100%', maxWidth: 380, background: '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.22)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid #e5e7eb' }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111827' }}>Reject Document</h3>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>Rejecting <strong>{rejectTarget.fileName}</strong>.</p>
            </div>
            <div style={{ padding: '14px 18px' }}>
              <textarea
                aria-label="Rejection reason"
                value={rejectReason}
                onChange={e => { setRejectReason(e.target.value); setRejectErr(null); }}
                placeholder="Why is this document being rejected…"
                rows={4}
                autoFocus
                style={{ ...TA, resize: 'vertical' }}
              />
              {rejectErr && <div style={{ fontSize: 11, color: '#dc2626', marginTop: 4 }}>{rejectErr}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #f1f5f9' }}>
              <button type="button" onClick={() => setRejectTarget(null)} disabled={rejectBusy} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' }}>
                Cancel
              </button>
              <button type="button" onClick={submitReject} disabled={rejectBusy} style={{ padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, background: rejectBusy ? '#9ca3af' : '#dc2626', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#fff' }}>
                {rejectBusy ? 'Submitting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
