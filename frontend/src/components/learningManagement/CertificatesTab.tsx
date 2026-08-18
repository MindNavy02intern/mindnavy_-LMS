// Certificates Tab — Part A (Templates) + Part B (Issued Certificates).
// No CERTIFICATES_CONTRACT.md exists in the repo — shapes reverse-engineered
// from backend/src/{controllers,services,validators}/certificates.*.js and
// verified live against a running server (same process as Quizzes).
//
// Key invariants:
//  - Template edit ALWAYS sends the full `layout` object on PATCH — the
//    backend REPLACES the whole thing (missing keys reset to defaults), so a
//    diff-patch here would silently blank out unedited fields. This is the
//    one PATCH in this app that intentionally does NOT follow the diff habit.
//  - studentName/courseTitle are issue-time snapshots — rendered exactly as
//    received, never re-fetched/joined against the live user/course record.
//  - certificateCount/total are server-derived — never computed client-side.
//  - PDF download always goes through the blob+Bearer fetch in
//    certificatesApi.ts — never a plain <a href> (would 401, no token).
//  - Revoke is disabled once a cert is already revoked (never lets the UI
//    hit the backend's "already revoked" 400).
//  - Reissue's confirm dialog always states the old QR/PDF stops verifying —
//    this is a real risk to a student holding the old file, not boilerplate.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Download, RotateCcw, Ban, X, Award, CalendarClock,
} from 'lucide-react';
import {
  listTemplates, createTemplate, updateTemplate, deleteTemplate,
  CertificateTemplateApiError,
} from '../../services/certificateTemplatesApi';
import CertificateLogoUpload from './CertificateLogoUpload';
import {
  listCertificates, issueCertificate, revokeCertificate, reissueCertificate, setCertificateExpiry,
  downloadCertificatePdf, triggerPdfDownload,
  CertificateApiError,
} from '../../services/certificatesApi';
import { listCourses } from '../../services/coursesApi';
import { getUsers } from '../../api/users';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { CertificateTemplate, CertificateLayout, Certificate, CertificateListFilter } from '../../types/certificates';
import type { CourseListRow } from '../../types/courses';
import type { User } from '../../types/users';

// ── Toast ─────────────────────────────────────────────────────────────────────

interface Toast { type: 'success' | 'error'; message: string }

function ToastBanner({ type, message }: Toast) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9000,
      background: type === 'success' ? '#16a34a' : '#dc2626',
      color: '#fff', padding: '10px 18px', borderRadius: 8,
      fontSize: 13, fontWeight: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
    }}>
      {message}
    </div>
  );
}

// ── Shared constants ─────────────────────────────────────────────────────────

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const PLACEHOLDER_CHIPS: { token: string; label: string }[] = [
  { token: '{{studentName}}', label: 'Student Name' },
  { token: '{{courseTitle}}', label: 'Course Title' },
  { token: '{{date}}',        label: 'Date' },
];

const KNOWN_PLACEHOLDER_TOKENS = new Set(PLACEHOLDER_CHIPS.map((c) => c.token));

// Anything {{shaped}} in the body that isn't one of the 3 tokens the PDF
// renderer substitutes — the backend strips these before printing, but the
// editor should tell the admin now rather than let it silently vanish.
function findUnrecognizedPlaceholders(body: string): string[] {
  const matches = body.match(/\{\{[^{}]*\}\}/g) ?? [];
  return [...new Set(matches.filter((m) => !KNOWN_PLACEHOLDER_TOKENS.has(m)))];
}

const DEFAULT_LAYOUT: CertificateLayout = {
  title: 'Certificate of Completion',
  body: 'This certifies that {{studentName}} has successfully completed {{courseTitle}} on {{date}}.',
  primaryColor: '#1E3A8A',
  accentColor: '#B8860B',
  signatureName: null,
  signatureTitle: null,
};

const STATUS_BADGE: Record<Certificate['status'], string> = {
  active:  'tw:bg-green-50 tw:text-green-700',
  revoked: 'tw:bg-red-50 tw:text-red-600',
  expired: 'tw:bg-amber-50 tw:text-amber-700',
};

// ── Layout editor (shared by create + edit template forms) ─────────────────────

interface ColorFieldProps { label: string; value: string; onChange: (v: string) => void }

function ColorField({ label, value, onChange }: ColorFieldProps) {
  const swatch = HEX_COLOR.test(value.trim()) ? value.trim() : '#000000';
  return (
    <div className="tw:flex tw:flex-col tw:gap-1.5">
      <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">{label}</label>
      <div className="tw:flex tw:items-center tw:gap-2">
        <input
          type="color"
          value={swatch}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${label} swatch`}
          className="tw:h-9 tw:w-9 tw:flex-shrink-0 tw:cursor-pointer tw:rounded tw:border tw:border-slate-200 tw:p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#1E3A8A"
          maxLength={7}
          aria-label={label}
          className="tw:w-28 tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-1.5 tw:text-[13px] tw:font-mono tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
        />
      </div>
    </div>
  );
}

interface LayoutEditorProps {
  value: CertificateLayout;
  onChange: (next: CertificateLayout) => void;
  /** undefined until the template has been saved once (create mode) */
  templateId: string | undefined;
}

function LayoutEditor({ value, onChange, templateId }: LayoutEditorProps) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function insertChip(token: string) {
    const el = bodyRef.current;
    if (!el) { onChange({ ...value, body: value.body + token }); return; }
    const start = el.selectionStart ?? value.body.length;
    const end   = el.selectionEnd   ?? value.body.length;
    const next  = value.body.slice(0, start) + token + value.body.slice(end);
    onChange({ ...value, body: next });
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <div className="tw:flex tw:flex-col tw:gap-1.5">
        <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Certificate title</label>
        <input
          type="text"
          value={value.title}
          onChange={(e) => onChange({ ...value, title: e.target.value })}
          maxLength={120}
          aria-label="Certificate title"
          className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
        />
      </div>

      <div className="tw:flex tw:flex-col tw:gap-1.5">
        <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Body</label>
        <div className="tw:flex tw:flex-wrap tw:gap-1.5">
          {PLACEHOLDER_CHIPS.map((chip) => (
            <button
              key={chip.token}
              type="button"
              onClick={() => insertChip(chip.token)}
              aria-label={`Insert ${chip.label} placeholder`}
              className="tw:rounded-full tw:bg-blue-50 tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-mono tw:font-medium tw:text-blue-700 tw:hover:bg-blue-100"
            >
              {chip.token}
            </button>
          ))}
        </div>
        <textarea
          ref={bodyRef}
          value={value.body}
          onChange={(e) => onChange({ ...value, body: e.target.value })}
          rows={3}
          maxLength={600}
          aria-label="Certificate body"
          className="tw:w-full tw:resize-y tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
        />
        {findUnrecognizedPlaceholders(value.body).map((token) => (
          <p key={token} role="alert" className="tw:text-[12px] tw:font-medium tw:text-amber-700">
            Unrecognized placeholder: <span className="tw:font-mono">{token}</span> — it will not
            print on the certificate. Use a chip above instead:{' '}
            {PLACEHOLDER_CHIPS.map((c) => c.token).join(', ')}.
          </p>
        ))}
      </div>

      <div className="tw:flex tw:gap-6">
        <ColorField label="Primary color" value={value.primaryColor} onChange={(v) => onChange({ ...value, primaryColor: v })} />
        <ColorField label="Accent color"  value={value.accentColor}  onChange={(v) => onChange({ ...value, accentColor: v })} />
      </div>

      <div className="tw:flex tw:flex-col tw:gap-1.5">
        <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Logo (optional)</label>
        <CertificateLogoUpload
          templateId={templateId}
          initialUrl={value.logoUrl}
          onChange={(url) => onChange({ ...value, logoUrl: url })}
        />
      </div>

      <div className="tw:flex tw:gap-4">
        <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-1.5">
          <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Signature name (optional)</label>
          <input
            type="text"
            value={value.signatureName ?? ''}
            onChange={(e) => onChange({ ...value, signatureName: e.target.value || null })}
            maxLength={100}
            aria-label="Signature name"
            className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
          />
        </div>
        <div className="tw:flex tw:flex-1 tw:flex-col tw:gap-1.5">
          <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Signature title (optional)</label>
          <input
            type="text"
            value={value.signatureTitle ?? ''}
            onChange={(e) => onChange({ ...value, signatureTitle: e.target.value || null })}
            maxLength={100}
            aria-label="Signature title"
            className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
          />
        </div>
      </div>
    </div>
  );
}

// ── Template form (create + edit) ───────────────────────────────────────────────

interface TemplateFormProps {
  mode:          'create' | 'edit';
  templateId:    string | undefined; // undefined in create mode until first save
  initialName:   string;
  initialLayout: CertificateLayout;
  onSave:        (name: string, layout: CertificateLayout) => Promise<void>;
  onBack:        () => void;
}

function TemplateForm({ mode, templateId, initialName, initialLayout, onSave, onBack }: TemplateFormProps) {
  const [name,   setName]   = useState(initialName);
  const [layout, setLayout] = useState<CertificateLayout>(initialLayout);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  function validate(): string | null {
    if (!name.trim()) return 'Name is required.';
    if (name.trim().length > 120) return 'Name must be at most 120 characters.';
    if (!layout.title.trim()) return 'Certificate title is required.';
    if (layout.title.trim().length > 120) return 'Certificate title must be at most 120 characters.';
    if (!layout.body.trim()) return 'Body is required.';
    if (layout.body.trim().length > 600) return 'Body must be at most 600 characters.';
    if (!HEX_COLOR.test(layout.primaryColor.trim())) return 'Primary color must be a hex value like #1E3A8A.';
    if (!HEX_COLOR.test(layout.accentColor.trim())) return 'Accent color must be a hex value like #B8860B.';
    if ((layout.signatureName ?? '').length > 100) return 'Signature name must be at most 100 characters.';
    if ((layout.signatureTitle ?? '').length > 100) return 'Signature title must be at most 100 characters.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setSaving(true);
    setError(null);
    try {
      // ALWAYS the complete layout — PATCH replaces the whole object
      // server-side, a partial diff here would silently reset unedited keys.
      await onSave(name.trim(), {
        title: layout.title.trim(),
        body: layout.body.trim(),
        primaryColor: layout.primaryColor.trim().toUpperCase(),
        accentColor: layout.accentColor.trim().toUpperCase(),
        signatureName: layout.signatureName?.trim() || null,
        signatureTitle: layout.signatureTitle?.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="tw:flex tw:flex-col tw:gap-5">
      <div className="tw:flex tw:items-center tw:gap-3">
        <button type="button" onClick={onBack}
          className="tw:flex tw:items-center tw:gap-1 tw:text-[13px] tw:font-medium tw:text-slate-500 tw:hover:text-slate-700">
          <ChevronLeft className="tw:h-4 tw:w-4" strokeWidth={2} /> Back
        </button>
        <h2 className="tw:m-0 tw:text-[17px] tw:font-semibold tw:text-slate-900">
          {mode === 'create' ? 'Create Certificate Template' : 'Edit Certificate Template'}
        </h2>
      </div>

      <form onSubmit={handleSubmit}
        className="tw:flex tw:flex-col tw:gap-4 tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-6">
        {error && (
          <div role="alert" className="tw:rounded-lg tw:border tw:border-red-100 tw:bg-red-50 tw:px-3 tw:py-2.5 tw:text-[13px] tw:text-red-600">
            {error}
          </div>
        )}

        <div className="tw:flex tw:flex-col tw:gap-1.5">
          <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">
            Name <span className="tw:text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Standard Completion Certificate"
            maxLength={120}
            required
            className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
          />
        </div>

        <LayoutEditor value={layout} onChange={setLayout} templateId={templateId} />

        <div className="tw:flex tw:items-center tw:justify-end tw:gap-2 tw:border-t tw:border-slate-100 tw:pt-4">
          <button type="button" onClick={onBack} disabled={saving}
            className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50 tw:disabled:opacity-40">
            Cancel
          </button>
          <button type="submit" disabled={saving || !name.trim()}
            className="tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700 tw:disabled:opacity-40">
            {saving ? 'Saving…' : mode === 'create' ? 'Create Template' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Templates section ────────────────────────────────────────────────────────────

type TemplatesView =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit'; template: CertificateTemplate };

function TemplatesSection({ showToast }: { showToast: (type: 'success' | 'error', message: string) => void }) {
  const navigate = useNavigate();
  const [view,      setView]      = useState<TemplatesView>({ kind: 'list' });
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTemplates(await listTemplates());
    } catch (err) {
      if (err instanceof CertificateTemplateApiError && err.status === 401) { navigate('/login'); return; }
      setError(err instanceof Error ? err.message : 'Failed to load templates.');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(name: string, layout: CertificateLayout) {
    const created = await createTemplate({ name, layout });
    invalidateFor(appQueryClient, 'certificateTemplate.create');
    setTemplates((prev) => [created, ...prev]);
    setView({ kind: 'list' });
    showToast('success', 'Template created.');
  }

  async function handleEdit(template: CertificateTemplate, name: string, layout: CertificateLayout) {
    // Always send BOTH name and the FULL layout — no diffing. A partial
    // layout here would reset every unsent key to its default server-side.
    const updated = await updateTemplate(template.id, { name, layout });
    invalidateFor(appQueryClient, 'certificateTemplate.update');
    setTemplates((prev) => prev.map((t) => (t.id === template.id ? updated : t)));
    setView({ kind: 'list' });
    showToast('success', 'Template updated.');
  }

  async function handleDelete(template: CertificateTemplate) {
    if (!window.confirm(
      `Delete "${template.name}"?\n\nCertificates already issued with this template will keep working with a default layout. This cannot be undone.`
    )) return;
    try {
      await deleteTemplate(template.id);
      invalidateFor(appQueryClient, 'certificateTemplate.delete');
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      showToast('success', 'Template deleted. Issued certificates were kept.');
    } catch (err) {
      if (err instanceof CertificateTemplateApiError && err.status === 401) { navigate('/login'); return; }
      showToast('error', err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  if (view.kind === 'create') {
    return (
      <TemplateForm
        mode="create"
        templateId={undefined}
        initialName=""
        initialLayout={DEFAULT_LAYOUT}
        onSave={handleCreate}
        onBack={() => setView({ kind: 'list' })}
      />
    );
  }

  if (view.kind === 'edit') {
    const t = view.template;
    return (
      <TemplateForm
        mode="edit"
        templateId={t.id}
        initialName={t.name}
        initialLayout={t.layout}
        onSave={(name, layout) => handleEdit(t, name, layout)}
        onBack={() => setView({ kind: 'list' })}
      />
    );
  }

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <div className="tw:flex tw:items-center tw:justify-between">
        <h3 className="tw:m-0 tw:text-[15px] tw:font-semibold tw:text-slate-900">Certificate Templates</h3>
        <button type="button" onClick={() => setView({ kind: 'create' })}
          aria-label="Create Template"
          className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700">
          <Plus className="tw:h-4 tw:w-4" strokeWidth={2.5} /> Create Template
        </button>
      </div>

      {loading ? (
        <div className="tw:flex tw:flex-col tw:gap-3">
          {[1, 2].map((i) => <div key={i} className="tw:h-16 tw:w-full tw:animate-pulse tw:rounded-xl tw:bg-slate-100" />)}
        </div>
      ) : error ? (
        <div className="tw:rounded-xl tw:border tw:border-red-100 tw:bg-red-50 tw:p-5 tw:text-center">
          <p className="tw:text-[13px] tw:text-red-500">{error}</p>
          <button type="button" onClick={load} className="tw:mt-2 tw:text-[13px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">Retry</button>
        </div>
      ) : templates.length === 0 ? (
        <div className="tw:flex tw:flex-col tw:items-center tw:justify-center tw:rounded-xl tw:border tw:border-dashed tw:border-slate-300 tw:bg-white tw:py-14 tw:gap-2">
          <p className="tw:m-0 tw:text-[13px] tw:text-slate-400">No templates yet — new certificates use the default layout.</p>
        </div>
      ) : (
        <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:overflow-hidden">
          <table className="tw:w-full tw:border-collapse">
            <thead>
              <tr className="tw:border-b tw:border-slate-100 tw:bg-slate-50">
                <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Name</th>
                <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Certificates issued</th>
                <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Updated</th>
                <th className="tw:px-4 tw:py-3" />
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="tw:border-b tw:border-slate-50 tw:last:border-0 tw:hover:bg-slate-50">
                  <td className="tw:px-4 tw:py-3 tw:text-[13px] tw:font-semibold tw:text-slate-900">{t.name}</td>
                  <td className="tw:px-4 tw:py-3 tw:text-[13px] tw:text-slate-700">{t.certificateCount}</td>
                  <td className="tw:px-4 tw:py-3 tw:text-[12px] tw:text-slate-400">{new Date(t.updatedAt).toLocaleDateString()}</td>
                  <td className="tw:px-4 tw:py-3">
                    <div className="tw:flex tw:items-center tw:justify-end tw:gap-1 tw:text-slate-400">
                      <button type="button" onClick={() => setView({ kind: 'edit', template: t })}
                        aria-label={`Edit ${t.name}`}
                        className="tw:rounded tw:p-1 tw:hover:bg-slate-100 tw:hover:text-blue-600">
                        <Pencil className="tw:h-4 tw:w-4" strokeWidth={2} />
                      </button>
                      <button type="button" onClick={() => handleDelete(t)}
                        aria-label={`Delete ${t.name}`}
                        className="tw:rounded tw:p-1 tw:hover:bg-red-50 tw:hover:text-red-500">
                        <Trash2 className="tw:h-4 tw:w-4" strokeWidth={2} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Issue dialog ──────────────────────────────────────────────────────────────────

interface IssueDialogProps {
  courses:   CourseListRow[];
  users:     User[];
  templates: CertificateTemplate[];
  onIssued:  (cert: Certificate) => void;
  onClose:   () => void;
  onGoToCourseSettings: (courseId: string) => void;
}

function IssueDialog({ courses, users, templates, onIssued, onClose, onGoToCourseSettings }: IssueDialogProps) {
  const navigate = useNavigate();
  const [userId,     setUserId]     = useState('');
  const [courseId,   setCourseId]   = useState('');
  const [templateId, setTemplateId] = useState('');
  const [issuing,    setIssuing]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [disabledCourseId, setDisabledCourseId] = useState<string | null>(null);
  const [conflictCertId,   setConflictCertId]   = useState<string | null>(null);
  const [findingConflict,  setFindingConflict]  = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleIssue() {
    if (!userId || !courseId) { setError('Select both a user and a course.'); return; }
    setIssuing(true);
    setError(null);
    setDisabledCourseId(null);
    setConflictCertId(null);
    try {
      const cert = await issueCertificate({ userId, courseId, ...(templateId ? { templateId } : {}) });
      invalidateFor(appQueryClient, 'certificate.issue', { studentId: userId });
      onIssued(cert);
      return;
    } catch (err) {
      if (err instanceof CertificateApiError && err.status === 401) { navigate('/login'); return; }
      const message = err instanceof Error ? err.message : 'Issue failed.';
      setError(message);
      setIssuing(false);

      if (/certificates are not enabled/i.test(message)) {
        setDisabledCourseId(courseId);
      } else if (/reissue it instead/i.test(message)) {
        // Look up the existing (course,user) cert so the Reissue shortcut has an id to act on.
        setFindingConflict(true);
        try {
          const page = await listCertificates({ courseId, userId, limit: 1 });
          setConflictCertId(page.items[0]?.id ?? null);
        } catch { /* best effort — shortcut just won't render */ }
        finally { setFindingConflict(false); }
      }
    }
  }

  async function handleReissueShortcut() {
    if (!conflictCertId) return;
    if (!window.confirm(
      'This will generate a new certificate. The old QR code and any previously downloaded PDFs will no longer verify.'
    )) return;
    setIssuing(true);
    try {
      const cert = await reissueCertificate(conflictCertId, templateId ? { templateId } : {});
      invalidateFor(appQueryClient, 'certificate.reissue', { studentId: userId });
      onIssued(cert);
    } catch (err) {
      if (err instanceof CertificateApiError && err.status === 401) { navigate('/login'); return; }
      setError(err instanceof Error ? err.message : 'Reissue failed.');
      setIssuing(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div aria-label="modal backdrop"
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
        onClick={onClose} />

      <div role="dialog" aria-modal="true" aria-label="Issue certificate"
        className="tw:relative tw:w-full tw:max-w-md tw:rounded-xl tw:bg-white tw:shadow-2xl tw:flex tw:flex-col">
        <div className="tw:flex tw:flex-shrink-0 tw:items-center tw:justify-between tw:border-b tw:border-slate-200 tw:px-5 tw:py-4">
          <h3 className="tw:m-0 tw:text-[15px] tw:font-semibold tw:text-slate-900">Issue Certificate</h3>
          <button type="button" onClick={onClose} aria-label="Close issue dialog"
            className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-slate-100">
            <X className="tw:h-4 tw:w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="tw:flex-1 tw:overflow-y-auto tw:px-5 tw:py-4 tw:flex tw:flex-col tw:gap-4">
          <div className="tw:flex tw:flex-col tw:gap-1.5">
            <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">
              User <span className="tw:text-red-500">*</span>
            </label>
            <select value={userId} onChange={(e) => { setUserId(e.target.value); setError(null); }}
              aria-label="Select user"
              className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400">
              <option value="">— Select a user —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>)}
            </select>
          </div>

          <div className="tw:flex tw:flex-col tw:gap-1.5">
            <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">
              Course <span className="tw:text-red-500">*</span>
            </label>
            <select value={courseId} onChange={(e) => { setCourseId(e.target.value); setError(null); }}
              aria-label="Select course"
              className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400">
              <option value="">— Select a course —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.status})</option>)}
            </select>
          </div>

          <div className="tw:flex tw:flex-col tw:gap-1.5">
            <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Template</label>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)}
              aria-label="Select template"
              className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400">
              <option value="">Use default layout</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {error && (
            <div role="alert" className="tw:flex tw:flex-col tw:gap-2 tw:rounded-lg tw:border tw:border-red-100 tw:bg-red-50 tw:px-3 tw:py-2.5 tw:text-[12px] tw:text-red-600">
              <span>{error}</span>
              {disabledCourseId && (
                <button type="button" onClick={() => onGoToCourseSettings(disabledCourseId)}
                  className="tw:w-fit tw:rounded-lg tw:border tw:border-red-200 tw:bg-white tw:px-3 tw:py-1.5 tw:text-[12px] tw:font-semibold tw:text-red-600 tw:hover:bg-red-100">
                  Go to course settings
                </button>
              )}
              {findingConflict && <span className="tw:text-slate-400">Looking up the existing certificate…</span>}
              {conflictCertId && (
                <button type="button" onClick={handleReissueShortcut} disabled={issuing}
                  className="tw:w-fit tw:rounded-lg tw:border tw:border-red-200 tw:bg-white tw:px-3 tw:py-1.5 tw:text-[12px] tw:font-semibold tw:text-red-600 tw:hover:bg-red-100 tw:disabled:opacity-40">
                  Reissue
                </button>
              )}
            </div>
          )}
        </div>

        <div className="tw:flex tw:flex-shrink-0 tw:justify-end tw:gap-2 tw:border-t tw:border-slate-100 tw:px-5 tw:py-3.5">
          <button type="button" onClick={onClose} disabled={issuing}
            className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50 tw:disabled:opacity-40">
            Cancel
          </button>
          <button type="button" onClick={handleIssue} disabled={issuing || !userId || !courseId}
            className="tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700 tw:disabled:opacity-40">
            {issuing ? 'Issuing…' : 'Issue Certificate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Expiry dialog ─────────────────────────────────────────────────────────────

function ExpiryDialog({ cert, onSaved, onClose, showToast }: {
  cert: Certificate;
  onSaved: (updated: Certificate) => void;
  onClose: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}) {
  const [date, setDate] = useState(cert.expiresAt ? cert.expiresAt.slice(0, 10) : '');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await setCertificateExpiry(cert.id, date ? new Date(date).toISOString() : null);
      showToast('success', date ? 'Expiry date set.' : 'Expiry date cleared.');
      onSaved(updated);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to update expiry.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div aria-label="modal backdrop" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Set certificate expiry"
        className="tw:relative tw:w-full tw:max-w-sm tw:rounded-xl tw:bg-white tw:shadow-2xl tw:p-5 tw:flex tw:flex-col tw:gap-4">
        <h3 className="tw:m-0 tw:text-[15px] tw:font-semibold tw:text-slate-900">Set Expiry Date</h3>
        <p className="tw:m-0 tw:text-[12.5px] tw:text-slate-500">
          {cert.studentName ?? 'This certificate'} — leave blank for no expiry.
        </p>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Expiry date"
          className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400" />
        <div className="tw:flex tw:justify-end tw:gap-2">
          <button type="button" onClick={onClose} disabled={saving}
            className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50 tw:disabled:opacity-40">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700 tw:disabled:opacity-40">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Issued certificates section ─────────────────────────────────────────────────

function IssuedCertificatesSection({
  showToast, onGoToCourseSettings,
}: {
  showToast: (type: 'success' | 'error', message: string) => void;
  onGoToCourseSettings: (courseId: string) => void;
}) {
  const navigate = useNavigate();
  const [certs,   setCerts]   = useState<Certificate[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [courses,   setCourses]   = useState<CourseListRow[]>([]);
  const [users,     setUsers]     = useState<User[]>([]);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);

  const [courseFilter, setCourseFilter] = useState('');
  const [userFilter,   setUserFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | CertificateListFilter>('');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const [showIssue, setShowIssue] = useState(false);
  const [busyId,    setBusyId]    = useState<string | null>(null);
  const [expiryCert, setExpiryCert] = useState<Certificate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await listCertificates({
        courseId: courseFilter || undefined,
        userId:   userFilter   || undefined,
        status:   statusFilter || undefined,
        limit, offset,
      });
      setCerts(page.items);
      setTotal(page.total);
    } catch (err) {
      if (err instanceof CertificateApiError && err.status === 401) { navigate('/login'); return; }
      setError(err instanceof Error ? err.message : 'Failed to load certificates.');
    } finally {
      setLoading(false);
    }
  }, [courseFilter, userFilter, statusFilter, offset, navigate]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    listCourses({ limit: 200 }).then((r) => setCourses(r.courses)).catch(() => {});
    getUsers({ limit: 200 }).then((r) => setUsers(r.users)).catch(() => {});
    listTemplates().then(setTemplates).catch(() => {});
  }, []);

  function handleFilterChange(next: { courseId?: string; userId?: string; status?: '' | CertificateListFilter }) {
    if (next.courseId !== undefined) setCourseFilter(next.courseId);
    if (next.userId   !== undefined) setUserFilter(next.userId);
    if (next.status   !== undefined) setStatusFilter(next.status);
    setOffset(0);
  }

  async function handleRevoke(cert: Certificate) {
    if (cert.status === 'revoked') return; // also guarded by the disabled button
    if (!window.confirm(
      `Revoke this certificate for ${cert.studentName ?? 'this student'}?\n\nIt will stop verifying immediately. This can be undone later via Reissue.`
    )) return;
    setBusyId(cert.id);
    try {
      const updated = await revokeCertificate(cert.id);
      invalidateFor(appQueryClient, 'certificate.revoke', { studentId: cert.userId });
      setCerts((prev) => prev.map((c) => (c.id === cert.id ? updated : c)));
      showToast('success', 'Certificate revoked.');
    } catch (err) {
      if (err instanceof CertificateApiError && err.status === 401) { navigate('/login'); return; }
      showToast('error', err instanceof Error ? err.message : 'Revoke failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleReissue(cert: Certificate) {
    if (!window.confirm(
      'This will generate a new certificate. The old QR code and any previously downloaded PDFs will no longer verify.'
    )) return;
    setBusyId(cert.id);
    try {
      const updated = await reissueCertificate(cert.id);
      invalidateFor(appQueryClient, 'certificate.reissue', { studentId: cert.userId });
      setCerts((prev) => prev.map((c) => (c.id === cert.id ? updated : c)));
      showToast('success', 'Certificate reissued with a new verification code.');
    } catch (err) {
      if (err instanceof CertificateApiError && err.status === 401) { navigate('/login'); return; }
      showToast('error', err instanceof Error ? err.message : 'Reissue failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownload(cert: Certificate) {
    setBusyId(cert.id);
    try {
      // blob + Bearer header — a plain <a href> would never carry the token.
      const blob = await downloadCertificatePdf(cert.id);
      triggerPdfDownload(blob, `certificate-${cert.verificationCode}.pdf`);
    } catch (err) {
      if (err instanceof CertificateApiError && err.status === 401) { navigate('/login'); return; }
      // Revoked certs return 400 JSON here, not a broken blob — surfaced as a toast, not a download.
      showToast('error', err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setBusyId(null);
    }
  }

  function handleIssued() {
    setShowIssue(false);
    setOffset(0);
    load();
    showToast('success', 'Certificate issued.');
  }

  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <div className="tw:flex tw:items-center tw:justify-between">
        <h3 className="tw:m-0 tw:text-[15px] tw:font-semibold tw:text-slate-900">Issued Certificates</h3>
        <button type="button" onClick={() => setShowIssue(true)}
          aria-label="Issue Certificate"
          className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700">
          <Award className="tw:h-4 tw:w-4" strokeWidth={2.5} /> Issue Certificate
        </button>
      </div>

      {/* Filters */}
      <div className="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <select value={courseFilter} onChange={(e) => handleFilterChange({ courseId: e.target.value })}
          aria-label="Filter by course"
          className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-1.5 tw:text-[12px] tw:text-slate-700 tw:outline-none focus:tw:border-blue-400">
          <option value="">All courses</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <select value={userFilter} onChange={(e) => handleFilterChange({ userId: e.target.value })}
          aria-label="Filter by user"
          className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-1.5 tw:text-[12px] tw:text-slate-700 tw:outline-none focus:tw:border-blue-400">
          <option value="">All users</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.fullName}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => handleFilterChange({ status: e.target.value as '' | CertificateListFilter })}
          aria-label="Filter by status"
          className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-1.5 tw:text-[12px] tw:text-slate-700 tw:outline-none focus:tw:border-blue-400">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="expiring_soon">Expiring soon</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </select>
      </div>

      {loading ? (
        <div className="tw:flex tw:flex-col tw:gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="tw:h-14 tw:w-full tw:animate-pulse tw:rounded-xl tw:bg-slate-100" />)}
        </div>
      ) : error ? (
        <div className="tw:rounded-xl tw:border tw:border-red-100 tw:bg-red-50 tw:p-5 tw:text-center">
          <p className="tw:text-[13px] tw:text-red-500">{error}</p>
          <button type="button" onClick={load} className="tw:mt-2 tw:text-[13px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">Retry</button>
        </div>
      ) : certs.length === 0 ? (
        <div className="tw:flex tw:flex-col tw:items-center tw:justify-center tw:rounded-xl tw:border tw:border-dashed tw:border-slate-300 tw:bg-white tw:py-14 tw:gap-2">
          <p className="tw:m-0 tw:text-[13px] tw:text-slate-400">No certificates match these filters.</p>
        </div>
      ) : (
        <div className="tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:overflow-hidden">
          <table className="tw:w-full tw:border-collapse">
            <thead>
              <tr className="tw:border-b tw:border-slate-100 tw:bg-slate-50">
                <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Student</th>
                <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Course</th>
                <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Template</th>
                <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Status</th>
                <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Issued</th>
                <th className="tw:px-4 tw:py-3 tw:text-left tw:text-[11px] tw:font-semibold tw:uppercase tw:tracking-wide tw:text-slate-500">Expires</th>
                <th className="tw:px-4 tw:py-3" />
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id} className="tw:border-b tw:border-slate-50 tw:last:border-0 tw:hover:bg-slate-50">
                  <td className="tw:px-4 tw:py-3 tw:text-[13px] tw:font-semibold tw:text-slate-900">{c.studentName ?? '—'}</td>
                  <td className="tw:px-4 tw:py-3 tw:text-[13px] tw:text-slate-700">{c.courseTitle ?? '—'}</td>
                  <td className="tw:px-4 tw:py-3 tw:text-[13px] tw:text-slate-500">{c.templateName ?? 'Default'}</td>
                  <td className="tw:px-4 tw:py-3">
                    <span className={`tw:rounded-full tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-semibold ${STATUS_BADGE[c.status]}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="tw:px-4 tw:py-3 tw:text-[12px] tw:text-slate-400">{new Date(c.issuedAt).toLocaleDateString()}</td>
                  <td className="tw:px-4 tw:py-3 tw:text-[12px] tw:text-slate-400">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : '—'}</td>
                  <td className="tw:px-4 tw:py-3">
                    <div className="tw:flex tw:items-center tw:justify-end tw:gap-1 tw:text-slate-400">
                      <button type="button" onClick={() => handleDownload(c)} disabled={busyId === c.id}
                        aria-label={`Download PDF for ${c.studentName ?? 'certificate'}`} title="Download PDF"
                        className="tw:rounded tw:p-1 tw:hover:bg-slate-100 tw:hover:text-blue-600 tw:disabled:opacity-40">
                        <Download className="tw:h-4 tw:w-4" strokeWidth={2} />
                      </button>
                      <button type="button" onClick={() => setExpiryCert(c)} disabled={busyId === c.id}
                        aria-label={`Set expiry for ${c.studentName ?? 'this student'}`} title="Set Expiry"
                        className="tw:rounded tw:p-1 tw:hover:bg-slate-100 tw:hover:text-blue-600 tw:disabled:opacity-40">
                        <CalendarClock className="tw:h-4 tw:w-4" strokeWidth={2} />
                      </button>
                      <button type="button" onClick={() => handleReissue(c)} disabled={busyId === c.id}
                        aria-label={`Reissue certificate for ${c.studentName ?? 'this student'}`} title="Reissue"
                        className="tw:rounded tw:p-1 tw:hover:bg-amber-50 tw:hover:text-amber-600 tw:disabled:opacity-40">
                        <RotateCcw className="tw:h-4 tw:w-4" strokeWidth={2} />
                      </button>
                      <button type="button" onClick={() => handleRevoke(c)} disabled={busyId === c.id || c.status === 'revoked'}
                        aria-label={`Revoke certificate for ${c.studentName ?? 'this student'}`} title="Revoke"
                        className="tw:rounded tw:p-1 tw:hover:bg-red-50 tw:hover:text-red-500 tw:disabled:opacity-30">
                        <Ban className="tw:h-4 tw:w-4" strokeWidth={2} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="tw:flex tw:items-center tw:justify-between tw:text-[12px] tw:text-slate-500">
          <span>{total} certificate{total !== 1 ? 's' : ''} — page {page} of {totalPages}</span>
          <div className="tw:flex tw:gap-1">
            <button type="button" onClick={() => setOffset((o) => Math.max(0, o - limit))} disabled={offset === 0}
              aria-label="Previous page"
              className="tw:rounded tw:border tw:border-slate-200 tw:p-1.5 tw:text-slate-500 tw:hover:bg-slate-50 tw:disabled:opacity-30">
              <ChevronLeft className="tw:h-4 tw:w-4" strokeWidth={2} />
            </button>
            <button type="button" onClick={() => setOffset((o) => (o + limit < total ? o + limit : o))} disabled={offset + limit >= total}
              aria-label="Next page"
              className="tw:rounded tw:border tw:border-slate-200 tw:p-1.5 tw:text-slate-500 tw:hover:bg-slate-50 tw:disabled:opacity-30">
              <ChevronRight className="tw:h-4 tw:w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}

      {showIssue && (
        <IssueDialog
          courses={courses}
          users={users}
          templates={templates}
          onIssued={handleIssued}
          onClose={() => setShowIssue(false)}
          onGoToCourseSettings={onGoToCourseSettings}
        />
      )}

      {expiryCert && (
        <ExpiryDialog
          cert={expiryCert}
          showToast={showToast}
          onClose={() => setExpiryCert(null)}
          onSaved={(updated) => {
            setCerts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            setExpiryCert(null);
          }}
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface CertificatesTabProps {
  onGoToCourseSettings: (courseId: string) => void;
}

export default function CertificatesTab({ onGoToCourseSettings }: CertificatesTabProps) {
  const [subTab, setSubTab] = useState<'issued' | 'templates'>('issued');
  const [toast,  setToast]  = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, message });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }

  return (
    <div className="tw:flex tw:flex-col tw:gap-5">
      <div className="tw:flex tw:items-center tw:justify-between">
        <h2 className="tw:m-0 tw:text-[17px] tw:font-semibold tw:text-slate-900">Certificates</h2>
        <div className="tw:flex tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:p-1">
          {(['issued', 'templates'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setSubTab(t)}
              aria-pressed={subTab === t}
              className={
                'tw:rounded-md tw:px-3 tw:py-1.5 tw:text-[12px] tw:font-semibold tw:transition-colors' +
                (subTab === t ? ' tw:bg-white tw:text-blue-700 tw:shadow-sm' : ' tw:text-slate-500 tw:hover:text-slate-700')
              }
            >
              {t === 'issued' ? 'Issued Certificates' : 'Templates'}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'issued' ? (
        <IssuedCertificatesSection showToast={showToast} onGoToCourseSettings={onGoToCourseSettings} />
      ) : (
        <TemplatesSection showToast={showToast} />
      )}

      {toast && <ToastBanner {...toast} />}
    </div>
  );
}
