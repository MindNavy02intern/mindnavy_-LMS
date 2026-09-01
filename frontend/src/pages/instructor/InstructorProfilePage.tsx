import { useEffect, useState } from 'react';
import InstructorLayout from './InstructorLayout';
import {
  getMyProfile, updateMyProfile,
  listMyDocuments, signMyDocumentUpload, confirmMyDocumentUpload, withdrawMyDocument,
  listMyCertifications, signMyCertificationUpload, createMyCertification,
  uploadToSignedUrl,
} from '../../api/instructorSelfApi';
import type { InstructorDetail, InstructorDocument, DocumentType, InstructorCertification, CertificationType } from '../../types/instructors';
import type { UpdateInstructorSelfProfileRequest } from '../../types/instructorSelf';

type Tab = 'overview' | 'documents' | 'certifications';

const DOCUMENT_TYPES: DocumentType[] = ['IDENTITY', 'CONTRACT', 'AGREEMENT', 'TAX', 'COMPLIANCE'];
const CERTIFICATION_TYPES: CertificationType[] = ['TEACHING', 'PROFESSIONAL', 'ACADEMIC', 'TECHNICAL', 'TRAINING'];

// Shared light-mode form/table/button styles — copied verbatim from
// components/instructors/InstructorDocumentsTab.tsx (the admin reference this
// page was told to match). Deliberately NOT .mn-input/.mn-label/.mn-btn-primary:
// those classes are dark-theme-only (body defaults to a dark background,
// color: var(--mn-text-100) = #f1f5f9 near-white text) with no .mn-main-light
// override defined anywhere in brand.css — using them here rendered every
// field's text near-white on this page's white cards, i.e. invisible. Admin's
// own light-mode tab components never use those classes for this exact
// reason; they define local light styles instead, reused here as-is.
const LABEL: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 };
const INPUT: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13, border: '1px solid #e5e7eb', borderRadius: 6, background: '#fff', color: '#374151', fontFamily: 'inherit', outline: 'none' };
const BTN_PRIMARY: React.CSSProperties = { padding: '7px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer' };
const BTN_SECONDARY: React.CSSProperties = { padding: '7px 14px', fontSize: 12, fontFamily: 'inherit', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, cursor: 'pointer', color: '#374151' };
const ERROR_BANNER: React.CSSProperties = { padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#b91c1c' };
const TH: React.CSSProperties = { padding: '8px 10px', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'left', whiteSpace: 'nowrap' };
const TD: React.CSSProperties = { padding: '8px 10px', fontSize: 12, color: '#374151', borderTop: '1px solid #f1f5f9', verticalAlign: 'middle' };

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    PENDING:  { bg: '#fef9c3', fg: '#a16207' },
    VERIFIED: { bg: '#dcfce7', fg: '#15803d' },
    REJECTED: { bg: '#fee2e2', fg: '#b91c1c' },
    ARCHIVED: { bg: '#f1f5f9', fg: '#94a3b8' },
  };
  const c = colors[status] ?? colors.PENDING;
  return (
    <span style={{ padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700, background: c.bg, color: c.fg }}>
      {status}
    </span>
  );
}

export default function InstructorProfilePage() {
  const [tab, setTab] = useState<Tab>('overview');
  const [profile, setProfile] = useState<InstructorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editable form state
  const [form, setForm] = useState<UpdateInstructorSelfProfileRequest>({});
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const loadProfile = () => {
    // IIFE — react-hooks/set-state-in-effect follows the call into loadProfile
    // when it's used as an effect body (see the useEffect below), so the
    // direct setState calls need the same wrapping the admin AuthContext uses.
    (() => { setLoading(true); setError(null); })();
    getMyProfile()
      .then((p) => {
        setProfile(p);
        setForm({
          specialization: p.specialization,
          headline: p.headline,
          bio: p.bio,
          yearsExperience: p.yearsExperience,
          websiteUrl: p.websiteUrl,
          linkedinUrl: p.linkedinUrl,
        });
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load profile.'))
      .finally(() => setLoading(false));
  };

  useEffect(loadProfile, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const updated = await updateMyProfile(form);
      setProfile(updated);
      setSaveMsg('Profile updated.');
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <InstructorLayout>
      {/* Same scale as admin's .mn-db-welcome-title (1.125rem), not an ad-hoc size. */}
      <h1 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 10px', color: '#0f172a' }}>My Profile</h1>

      {error && <div style={{ ...ERROR_BANNER, marginBottom: 16 }}>{error}</div>}

      {loading || !profile ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="mn-spinner" /></div>
      ) : (
        <>
          {/* Basic info (read-only) */}
          <div className="mn-db-card" style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', background: '#e0e7ff', color: '#4338ca',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', fontWeight: 700,
              }}>
                {profile.fullName.slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#0f172a' }}>{profile.fullName}</div>
                <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{profile.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <span style={{
                  padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                  background: profile.status === 'active' ? '#dcfce7' : '#fee2e2',
                  color: profile.status === 'active' ? '#15803d' : '#b91c1c',
                }}>
                  {profile.status.toUpperCase()}
                </span>
                <span style={{
                  padding: '3px 8px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                  background: profile.badges.verified ? '#dbeafe' : '#f1f5f9',
                  color: profile.badges.verified ? '#1d4ed8' : '#94a3b8',
                }}>
                  {profile.badges.verified ? 'VERIFIED' : profile.verificationState.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid #e2e8f0' }}>
            {(['overview', 'documents', 'certifications'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  padding: '7px 14px', border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  color: tab === t ? '#2563eb' : '#64748b',
                  borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent',
                  textTransform: 'capitalize',
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === 'overview' && (
            <div className="mn-db-card">
              <div className="mn-db-card-header"><div className="mn-db-card-title">Edit Profile</div></div>
              <div style={{ padding: '4px 4px 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={LABEL}>Specialization</label>
                  <input style={INPUT} value={form.specialization ?? ''} onChange={(e) => setForm((f) => ({ ...f, specialization: e.target.value }))} maxLength={120} />
                </div>
                <div>
                  <label style={LABEL}>Headline</label>
                  <input style={INPUT} value={form.headline ?? ''} onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))} maxLength={200} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={LABEL}>Bio</label>
                  <textarea
                    style={{ ...INPUT, resize: 'vertical' }} rows={4} maxLength={5000}
                    value={form.bio ?? ''} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  />
                </div>
                <div>
                  <label style={LABEL}>Years of Experience</label>
                  <input
                    style={INPUT} type="number" min={0} max={70}
                    value={form.yearsExperience ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, yearsExperience: e.target.value === '' ? null : Number(e.target.value) }))}
                  />
                </div>
                <div />
                <div>
                  <label style={LABEL}>Website URL</label>
                  <input style={INPUT} value={form.websiteUrl ?? ''} onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))} placeholder="https://…" />
                </div>
                <div>
                  <label style={LABEL}>LinkedIn URL</label>
                  <input style={INPUT} value={form.linkedinUrl ?? ''} onChange={(e) => setForm((f) => ({ ...f, linkedinUrl: e.target.value }))} placeholder="https://…" />
                </div>
              </div>

              <div style={{ marginTop: 14, padding: '0 4px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <button type="button" style={{ ...BTN_PRIMARY, opacity: saving ? 0.6 : 1 }} onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                {saveMsg && <span style={{ fontSize: 12, color: saveMsg === 'Profile updated.' ? '#15803d' : '#b91c1c' }}>{saveMsg}</span>}
              </div>
            </div>
          )}

          {tab === 'documents' && <DocumentsTab />}
          {tab === 'certifications' && <CertificationsTab />}
        </>
      )}
    </InstructorLayout>
  );
}

// ── Documents tab ─────────────────────────────────────────────────────────────

function DocumentsTab() {
  const [documents, setDocuments] = useState<InstructorDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<DocumentType>('IDENTITY');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const load = () => {
    (() => setLoading(true))();
    listMyDocuments().then((r) => setDocuments(r.documents)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const signed = await signMyDocumentUpload({ fileName: file.name, fileType: file.type, type });
      await uploadToSignedUrl(signed.uploadUrl, file);
      await confirmMyDocumentUpload({ path: signed.path, fileName: file.name, type });
      setShowUpload(false);
      setFile(null);
      load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleWithdraw = async (docId: string) => {
    if (!confirm('Withdraw this document?')) return;
    await withdrawMyDocument(docId);
    load();
  };

  return (
    <div className="mn-db-card">
      <div className="mn-db-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="mn-db-card-title">Documents</div>
        <button type="button" style={BTN_PRIMARY} onClick={() => setShowUpload(true)}>Upload Document</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="mn-spinner" /></div>
      ) : documents.length === 0 ? (
        <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '10px 0' }}>No documents uploaded yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={TH}>File Name</th>
              <th style={TH}>Type</th>
              <th style={TH}>Status</th>
              <th style={TH}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.id}>
                <td style={TD}>{d.fileName}</td>
                <td style={TD}>{d.type}</td>
                <td style={TD}><StatusBadge status={d.status} /></td>
                <td style={TD}>
                  {d.downloadUrl && <a href={d.downloadUrl} target="_blank" rel="noreferrer" style={{ marginRight: 10, fontSize: 12 }}>Download</a>}
                  {d.status === 'PENDING' && (
                    <button type="button" onClick={() => handleWithdraw(d.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                      Withdraw
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showUpload && (
        <div style={{ marginTop: 14, padding: 14, border: '1px solid #e2e8f0', borderRadius: 8 }}>
          {uploadError && <div style={{ ...ERROR_BANNER, marginBottom: 10 }}>{uploadError}</div>}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={LABEL}>Type</label>
              <select style={INPUT} value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
                {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>File</label>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12 }} />
            </div>
            <button type="button" style={{ ...BTN_PRIMARY, opacity: !file || uploading ? 0.6 : 1 }} disabled={!file || uploading} onClick={handleUpload}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <button type="button" style={BTN_SECONDARY} onClick={() => { setShowUpload(false); setFile(null); setUploadError(null); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Certifications tab ────────────────────────────────────────────────────────

function CertificationsTab() {
  const [certifications, setCertifications] = useState<InstructorCertification[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [name, setName] = useState('');
  const [issuer, setIssuer] = useState('');
  const [type, setType] = useState<CertificationType>('TEACHING');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const load = () => {
    (() => setLoading(true))();
    listMyCertifications().then((r) => setCertifications(r.certifications)).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleUpload = async () => {
    if (!name.trim() || !issuer.trim()) {
      setUploadError('Name and issuer are required.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      let path: string | undefined;
      if (file) {
        const signed = await signMyCertificationUpload({ fileName: file.name });
        await uploadToSignedUrl(signed.uploadUrl, file);
        path = signed.path;
      }
      await createMyCertification({ name, issuer, type, path, fileName: file?.name });
      setShowUpload(false);
      setName(''); setIssuer(''); setFile(null);
      load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="mn-db-card">
      <div className="mn-db-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="mn-db-card-title">Certifications</div>
        <button type="button" style={BTN_PRIMARY} onClick={() => setShowUpload(true)}>Upload Certification</button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><div className="mn-spinner" /></div>
      ) : certifications.length === 0 ? (
        <p style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '10px 0' }}>No certifications yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              <th style={TH}>Name</th>
              <th style={TH}>Type</th>
              <th style={TH}>Issuer</th>
              <th style={TH}>Status</th>
            </tr>
          </thead>
          <tbody>
            {certifications.map((c) => (
              <tr key={c.id}>
                <td style={TD}>{c.name}</td>
                <td style={TD}>{c.type}</td>
                <td style={TD}>{c.issuer}</td>
                <td style={TD}><StatusBadge status={c.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showUpload && (
        <div style={{ marginTop: 14, padding: 14, border: '1px solid #e2e8f0', borderRadius: 8 }}>
          {uploadError && <div style={{ ...ERROR_BANNER, marginBottom: 10 }}>{uploadError}</div>}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div>
              <label style={LABEL}>Name</label>
              <input style={INPUT} value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
            </div>
            <div>
              <label style={LABEL}>Issuer</label>
              <input style={INPUT} value={issuer} onChange={(e) => setIssuer(e.target.value)} maxLength={200} />
            </div>
            <div>
              <label style={LABEL}>Type</label>
              <select style={INPUT} value={type} onChange={(e) => setType(e.target.value as CertificationType)}>
                {CERTIFICATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={LABEL}>File (optional)</label>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ fontSize: 12 }} />
            </div>
            <button type="button" style={{ ...BTN_PRIMARY, opacity: uploading ? 0.6 : 1 }} disabled={uploading} onClick={handleUpload}>
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <button type="button" style={BTN_SECONDARY} onClick={() => { setShowUpload(false); setUploadError(null); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
