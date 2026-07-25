// Content Library Tab — v1 (CONTENT_LIBRARY_CONTRACT.md). Extends the EXISTING
// course_contents table — the LM "Content Statistics" tiles read this same
// table and update automatically once items are added/deleted here.
//
// Key invariants (read twice — easy to get wrong):
//  - Upload is sign -> direct PUT -> confirm (3 real steps). An unconfirmed
//    upload is invisible — confirm is only ever called after the PUT genuinely
//    succeeds, never optimistically or on a timer.
//  - type is 100% server-derived from MIME at confirm — there is NO type
//    picker in the upload form. SCORM/QUIZ are FILTER-ONLY values; the upload
//    form's allowed-MIME list structurally cannot produce them.
//  - Size cap comes from the real /sign response's maxBytes every time —
//    never hardcoded here.
//  - Tags are server-normalized (trim/lowercase/dedupe) — whatever the server
//    returns after save is re-rendered as-is, never fought client-side.
//  - Legacy rows with fileUrl:null render without any download/preview action.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, X, Trash2, Pencil, Search, Upload, FileText, Video, Music, Image as ImageIcon,
  File as FileIcon, Download, AlertCircle,
} from 'lucide-react';
import {
  listContent, signContentUpload, confirmContentUpload, updateContent, deleteContent,
  ContentLibraryApiError,
} from '../../services/contentLibraryApi';
import { listCourses } from '../../services/coursesApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { ContentItem, ContentType, ContentTypeCounts } from '../../types/contentLibrary';
import type { CourseListRow } from '../../types/courses';

// ── Allowed MIME families (client-side pre-check, per contract) ────────────────
// type is still server-derived at confirm — this only blocks obviously-wrong
// files before spending a request, per "catch it client-side first if you can".

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'video/mp4', 'video/webm', 'video/quicktime',
  'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
]);

const ALLOWED_EXT_HINT = 'PDF · DOC/DOCX/PPT/PPTX/XLS/XLSX/TXT · MP4/WebM/MOV · MP3/M4A/WAV/OGG · JPEG/PNG/WebP/GIF';

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

// ── Type meta ─────────────────────────────────────────────────────────────────

const TYPE_META: Record<ContentType, { label: string; icon: typeof FileText }> = {
  VIDEO:    { label: 'Video',    icon: Video },
  DOCUMENT: { label: 'Document', icon: FileText },
  PDF:      { label: 'PDF',      icon: FileText },
  AUDIO:    { label: 'Audio',    icon: Music },
  IMAGE:    { label: 'Image',    icon: ImageIcon },
  QUIZ:     { label: 'Quiz',     icon: FileIcon },
  SCORM:    { label: 'SCORM',    icon: FileIcon },
};

const TYPE_CHIPS: { key: ContentType | 'All'; label: string }[] = [
  { key: 'All', label: 'All' }, { key: 'VIDEO', label: 'Video' }, { key: 'DOCUMENT', label: 'Document' },
  { key: 'PDF', label: 'PDF' }, { key: 'AUDIO', label: 'Audio' }, { key: 'IMAGE', label: 'Image' },
  { key: 'QUIZ', label: 'Quiz' }, { key: 'SCORM', label: 'SCORM' },
];

function fmtBytes(b: number | null): string {
  if (b == null) return '—';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// ── Tag input (chip editor — full array is sent on save, server normalizes) ────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState('');

  function addTag() {
    const t = draft.trim();
    if (!t) return;
    if (tags.length >= 20) return;
    onChange([...tags, t]);
    setDraft('');
  }

  return (
    <div>
      <div className="tw:flex tw:flex-wrap tw:gap-1.5">
        {tags.map((t, i) => (
          <span key={`${t}-${i}`} className="tw:flex tw:items-center tw:gap-1 tw:rounded-full tw:bg-slate-100 tw:px-2 tw:py-0.5 tw:text-[11px] tw:font-medium tw:text-slate-600">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((_, idx) => idx !== i))} aria-label={`Remove tag ${t}`}
              className="tw:text-slate-400 tw:hover:text-red-500">
              <X className="tw:h-3 tw:w-3" strokeWidth={2} />
            </button>
          </span>
        ))}
      </div>
      <input
        type="text" value={draft} maxLength={50}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
        onBlur={addTag}
        placeholder="Add a tag and press Enter…"
        aria-label="Add tag"
        className="tw:mt-1.5 tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-1.5 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
      />
    </div>
  );
}

// ── Upload dialog (sign -> XHR PUT -> confirm) ──────────────────────────────────

type UploadPhase = 'idle' | 'uploading' | 'error';
type UploadStep = 'signing' | 'transferring' | 'confirming';

interface UploadDialogProps {
  courses:    CourseListRow[];
  onClose:    () => void;
  onUploaded: (item: ContentItem) => void;
}

function UploadDialog({ courses, onClose, onUploaded }: UploadDialogProps) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const cancelledRef = useRef(false);

  const [file, setFile]         = useState<File | null>(null);
  const [title, setTitle]       = useState('');
  const [tags, setTags]         = useState<string[]>([]);
  const [courseId, setCourseId] = useState('');

  const [phase, setPhase]       = useState<UploadPhase>('idle');
  const [step, setStep]         = useState<UploadStep | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && phase !== 'uploading') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, phase]);

  function pickFile(f: File) {
    setError(null);
    if (!ALLOWED_MIME.has(f.type)) {
      setError(`File type not supported. Allowed: ${ALLOWED_EXT_HINT}`);
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name);
  }

  function doXhrUpload(f: File, uploadUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        xhrRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Storage PUT failed (HTTP ${xhr.status})`));
      };
      xhr.onerror = () => { xhrRef.current = null; reject(new Error('Network error during file transfer')); };
      xhr.onabort = () => {
        xhrRef.current = null;
        const e: Error & { cancelled?: boolean } = new Error('Cancelled');
        e.cancelled = true;
        reject(e);
      };
      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', f.type);
      xhr.send(f);
    });
  }

  async function handleUpload() {
    if (!file) return;
    cancelledRef.current = false;
    setError(null);
    setProgress(0);
    setPhase('uploading');

    // Step 1: sign
    setStep('signing');
    let signResp;
    try {
      signResp = await signContentUpload({ fileName: file.name, fileType: file.type });
    } catch (err) {
      if (err instanceof ContentLibraryApiError && err.status === 401) { navigate('/login'); return; }
      setError(err instanceof Error ? err.message : 'Could not start upload.');
      setPhase('error'); setStep(null);
      return;
    }
    if (cancelledRef.current) return;

    // Respect the server's real maxBytes — never a hardcoded client cap.
    if (file.size > signResp.maxBytes) {
      setError(`File exceeds the server's ${fmtBytes(signResp.maxBytes)} size limit.`);
      setPhase('error'); setStep(null);
      return;
    }

    // Step 2: direct PUT via XHR for real progress events
    setStep('transferring');
    try {
      await doXhrUpload(file, signResp.uploadUrl);
    } catch (err) {
      if ((err as { cancelled?: boolean }).cancelled || cancelledRef.current) {
        setPhase('idle'); setStep(null); setProgress(0);
        return;
      }
      setError(err instanceof Error ? err.message : 'File transfer failed.');
      setPhase('error'); setStep(null);
      return;
    }
    if (cancelledRef.current) return;

    // Step 3: confirm — only now does the row exist. Never called optimistically.
    setStep('confirming');
    try {
      const item = await confirmContentUpload({
        path: signResp.path,
        title: title.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        courseId: courseId || null,
      });
      onUploaded(item);
    } catch (err) {
      if (err instanceof ContentLibraryApiError && err.status === 401) { navigate('/login'); return; }
      setError(err instanceof Error ? err.message : 'Could not finish upload.');
      setPhase('error'); setStep(null);
      return;
    }
  }

  function handleCancel() {
    cancelledRef.current = true;
    xhrRef.current?.abort();
    setPhase('idle'); setStep(null); setProgress(0);
  }

  function stepLabel(): string {
    if (step === 'signing') return 'Preparing upload…';
    if (step === 'transferring') return 'Uploading…';
    if (step === 'confirming') return 'Finishing…';
    return 'Uploading…';
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div aria-label="modal backdrop" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
        onClick={() => phase !== 'uploading' && onClose()} />
      <div role="dialog" aria-modal="true" aria-label="Upload content"
        className="tw:relative tw:flex tw:w-full tw:max-w-md tw:flex-col tw:rounded-xl tw:bg-white tw:shadow-2xl">
        <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-slate-200 tw:px-5 tw:py-4">
          <h3 className="tw:m-0 tw:text-[15px] tw:font-semibold tw:text-slate-900">Upload Content</h3>
          <button type="button" onClick={onClose} disabled={phase === 'uploading'} aria-label="Close"
            className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-slate-100 tw:disabled:opacity-30">
            <X className="tw:h-4 tw:w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="tw:flex tw:flex-col tw:gap-4 tw:px-5 tw:py-4">
          {!file ? (
            <div
              role="button" tabIndex={0} aria-label="Choose file to upload"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) pickFile(f); }}
              data-testid="content-drop-zone"
              className="tw:flex tw:cursor-pointer tw:flex-col tw:items-center tw:gap-2 tw:rounded-lg tw:border-2 tw:border-dashed tw:border-slate-200 tw:bg-slate-50 tw:px-4 tw:py-8 tw:text-center tw:hover:border-blue-300 tw:hover:bg-blue-50/40"
            >
              <Upload className="tw:h-6 tw:w-6 tw:text-slate-300" strokeWidth={1.5} />
              <p className="tw:m-0 tw:text-[13px] tw:font-medium tw:text-slate-600">
                Drop a file here or <span className="tw:text-blue-600">browse</span>
              </p>
              <p className="tw:m-0 tw:text-[11px] tw:text-slate-400">{ALLOWED_EXT_HINT}</p>
              <input
                ref={fileInputRef} type="file" className="tw:hidden" aria-label="Choose file"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pickFile(f); }}
              />
            </div>
          ) : phase === 'uploading' ? (
            <div className="tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:px-4 tw:py-3" data-testid="content-uploading">
              <p className="tw:mb-2 tw:text-[12px] tw:font-medium tw:text-slate-600">{stepLabel()}</p>
              <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
                className="tw:h-1.5 tw:w-full tw:overflow-hidden tw:rounded-full tw:bg-slate-200">
                <div className="tw:h-full tw:rounded-full tw:bg-blue-500 tw:transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="tw:mt-1.5 tw:flex tw:items-center tw:justify-between">
                <span className="tw:text-[11px] tw:text-slate-400">{progress}%</span>
                <button type="button" onClick={handleCancel}
                  className="tw:text-[11px] tw:font-medium tw:text-slate-500 tw:hover:text-red-500">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="tw:flex tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:px-3 tw:py-2">
                <FileIcon className="tw:h-4 tw:w-4 tw:shrink-0 tw:text-slate-400" strokeWidth={2} />
                <span className="tw:min-w-0 tw:flex-1 tw:truncate tw:text-[12px] tw:text-slate-600">{file.name}</span>
                <span className="tw:shrink-0 tw:text-[11px] tw:text-slate-400">{fmtBytes(file.size)}</span>
                <button type="button" onClick={() => setFile(null)} aria-label="Remove selected file"
                  className="tw:shrink-0 tw:text-slate-400 tw:hover:text-red-500">
                  <X className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
                </button>
              </div>

              <div className="tw:flex tw:flex-col tw:gap-1.5">
                <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Title</label>
                <input type="text" value={title} maxLength={200} aria-label="Title" onChange={(e) => setTitle(e.target.value)}
                  className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400" />
              </div>

              <div className="tw:flex tw:flex-col tw:gap-1.5">
                <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Tags (optional)</label>
                <TagInput tags={tags} onChange={setTags} />
              </div>

              <div className="tw:flex tw:flex-col tw:gap-1.5">
                <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Course (optional)</label>
                <select value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Course"
                  className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400">
                  <option value="">— Library-wide (no course) —</option>
                  {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
              </div>
            </>
          )}

          {error && (
            <div role="alert" className="tw:flex tw:items-start tw:gap-2 tw:rounded-lg tw:border tw:border-red-100 tw:bg-red-50 tw:px-3 tw:py-2.5 tw:text-[12px] tw:text-red-600">
              <AlertCircle className="tw:mt-0.5 tw:h-3.5 tw:w-3.5 tw:shrink-0" strokeWidth={2} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="tw:flex tw:justify-end tw:gap-2 tw:border-t tw:border-slate-100 tw:px-5 tw:py-3.5">
          <button type="button" onClick={onClose} disabled={phase === 'uploading'}
            className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50 tw:disabled:opacity-40">
            Cancel
          </button>
          <button type="button" onClick={handleUpload} disabled={!file || phase === 'uploading'}
            className="tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700 tw:disabled:opacity-40">
            {phase === 'uploading' ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit metadata dialog ─────────────────────────────────────────────────────

interface EditDialogProps {
  item:     ContentItem;
  courses:  CourseListRow[];
  onClose:  () => void;
  onSaved:  (item: ContentItem) => void;
}

function EditDialog({ item, courses, onClose, onSaved }: EditDialogProps) {
  const navigate = useNavigate();
  const [title, setTitle]       = useState(item.title);
  const [tags, setTags]         = useState<string[]>(item.tags);
  const [courseId, setCourseId] = useState(item.courseId ?? '');
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSave() {
    const patch: Record<string, unknown> = {};
    if (title !== item.title) patch.title = title;
    const nextCourseId = courseId || null;
    if (nextCourseId !== item.courseId) patch.courseId = nextCourseId;
    if (JSON.stringify(tags) !== JSON.stringify(item.tags)) patch.tags = tags;

    if (Object.keys(patch).length === 0) { onClose(); return; }

    setSaving(true);
    setError(null);
    try {
      const updated = await updateContent(item.id, patch);
      onSaved(updated);
    } catch (err) {
      if (err instanceof ContentLibraryApiError && err.status === 401) { navigate('/login'); return; }
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div aria-label="modal backdrop" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Edit content"
        className="tw:relative tw:flex tw:w-full tw:max-w-md tw:flex-col tw:rounded-xl tw:bg-white tw:shadow-2xl">
        <div className="tw:flex tw:items-center tw:justify-between tw:border-b tw:border-slate-200 tw:px-5 tw:py-4">
          <h3 className="tw:m-0 tw:text-[15px] tw:font-semibold tw:text-slate-900">Edit Content</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="tw:rounded tw:p-1 tw:text-slate-400 tw:hover:bg-slate-100">
            <X className="tw:h-4 tw:w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="tw:flex tw:flex-col tw:gap-4 tw:px-5 tw:py-4">
          <div className="tw:flex tw:flex-col tw:gap-1.5">
            <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Title</label>
            <input type="text" value={title} maxLength={200} aria-label="Title" onChange={(e) => setTitle(e.target.value)}
              className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400" />
          </div>
          <div className="tw:flex tw:flex-col tw:gap-1.5">
            <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Tags</label>
            <TagInput tags={tags} onChange={setTags} />
          </div>
          <div className="tw:flex tw:flex-col tw:gap-1.5">
            <label className="tw:text-[12px] tw:font-semibold tw:text-slate-700">Course</label>
            <select value={courseId} onChange={(e) => setCourseId(e.target.value)} aria-label="Course"
              className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:px-3 tw:py-2 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400">
              <option value="">— Library-wide (no course) —</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          {error && (
            <div role="alert" className="tw:rounded-lg tw:border tw:border-red-100 tw:bg-red-50 tw:px-3 tw:py-2.5 tw:text-[12px] tw:text-red-600">
              {error}
            </div>
          )}
        </div>

        <div className="tw:flex tw:justify-end tw:gap-2 tw:border-t tw:border-slate-100 tw:px-5 tw:py-3.5">
          <button type="button" onClick={onClose} disabled={saving}
            className="tw:rounded-lg tw:border tw:border-slate-200 tw:px-4 tw:py-2 tw:text-[13px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50 tw:disabled:opacity-40">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700 tw:disabled:opacity-40">
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Item card ─────────────────────────────────────────────────────────────────

interface ItemCardProps {
  item:      ContentItem;
  onEdit:    () => void;
  onDelete:  () => void;
}

function ItemCard({ item, onEdit, onDelete }: ItemCardProps) {
  const Icon = TYPE_META[item.type].icon;
  return (
    <div className="tw:flex tw:flex-col tw:gap-2 tw:rounded-xl tw:border tw:border-slate-200 tw:bg-white tw:p-4">
      <div className="tw:flex tw:items-start tw:justify-between tw:gap-2">
        <div className="tw:flex tw:items-center tw:gap-2 tw:min-w-0">
          <Icon className="tw:h-4 tw:w-4 tw:shrink-0 tw:text-blue-500" strokeWidth={2} />
          <p className="tw:m-0 tw:truncate tw:text-[13px] tw:font-semibold tw:text-slate-900">{item.title}</p>
        </div>
        <span className="tw:shrink-0 tw:rounded-full tw:bg-slate-100 tw:px-2 tw:py-0.5 tw:text-[10px] tw:font-semibold tw:text-slate-600">
          {TYPE_META[item.type].label}
        </span>
      </div>

      <p className="tw:m-0 tw:text-[12px] tw:text-slate-400">
        {item.courseTitle ?? 'Library-wide'} · {fmtBytes(item.sizeBytes)}
      </p>

      {item.tags.length > 0 && (
        <div className="tw:flex tw:flex-wrap tw:gap-1">
          {item.tags.map((t) => (
            <span key={t} className="tw:rounded-full tw:bg-slate-50 tw:px-2 tw:py-0.5 tw:text-[10px] tw:text-slate-500">{t}</span>
          ))}
        </div>
      )}

      <div className="tw:mt-1 tw:flex tw:items-center tw:justify-between tw:border-t tw:border-slate-100 tw:pt-2">
        {item.fileUrl ? (
          <a href={item.fileUrl} target="_blank" rel="noopener noreferrer"
            className="tw:flex tw:items-center tw:gap-1 tw:text-[11px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">
            <Download className="tw:h-3 tw:w-3" strokeWidth={2} /> Download
          </a>
        ) : (
          <span className="tw:text-[11px] tw:text-slate-300">No file (legacy)</span>
        )}
        <div className="tw:flex tw:items-center tw:gap-1 tw:text-slate-400">
          <button type="button" onClick={onEdit} aria-label={`Edit ${item.title}`} className="tw:rounded tw:p-1 tw:hover:bg-slate-100 tw:hover:text-blue-600">
            <Pencil className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
          </button>
          <button type="button" onClick={onDelete} aria-label={`Delete ${item.title}`} className="tw:rounded tw:p-1 tw:hover:bg-red-50 tw:hover:text-red-500">
            <Trash2 className="tw:h-3.5 tw:w-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function ContentLibraryTab() {
  const navigate = useNavigate();

  const [content, setContent]       = useState<ContentItem[]>([]);
  const [typeCounts, setTypeCounts] = useState<ContentTypeCounts | null>(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: PAGE_SIZE, pages: 1 });
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<ContentType | 'All'>('All');
  const [search, setSearch]         = useState('');
  const [page, setPage]             = useState(1);

  const [courses, setCourses]       = useState<CourseListRow[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [editing, setEditing]       = useState<ContentItem | null>(null);
  const [toast, setToast]           = useState<Toast | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    listCourses({ limit: 200 }).then((r) => setCourses(r.courses.filter((c) => c.status !== 'Archived'))).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listContent({
        type: typeFilter === 'All' ? undefined : typeFilter,
        search: search || undefined, page, limit: PAGE_SIZE,
      });
      setContent(data.content);
      setTypeCounts(data.typeCounts);
      setPagination(data.pagination);
    } catch (err) {
      if (err instanceof ContentLibraryApiError && err.status === 401) { navigate('/login'); return; }
      setError(err instanceof Error ? err.message : 'Failed to load content library.');
    } finally {
      setLoading(false);
    }
  }, [navigate, typeFilter, search, page]);

  useEffect(() => { load(); }, [load]);

  function handleUploaded(item: ContentItem) {
    invalidateFor(appQueryClient, 'content.confirm', { courseId: item.courseId ?? undefined });
    setShowUpload(false);
    setPage(1);
    load();
    showToast('success', 'Content added to the library.');
  }

  function handleEdited(item: ContentItem) {
    invalidateFor(appQueryClient, 'content.update', { courseId: item.courseId ?? undefined });
    setContent((prev) => prev.map((c) => (c.id === item.id ? item : c)));
    setEditing(null);
    showToast('success', 'Content updated.');
  }

  async function handleDelete(item: ContentItem) {
    if (!window.confirm(`Delete "${item.title}"?\n\nThis removes the stored file, not just the library entry. This cannot be undone.`)) return;
    try {
      await deleteContent(item.id);
      invalidateFor(appQueryClient, 'content.delete', { courseId: item.courseId ?? undefined });
      setContent((prev) => prev.filter((c) => c.id !== item.id));
      showToast('success', 'Content deleted.');
    } catch (err) {
      if (err instanceof ContentLibraryApiError && err.status === 401) { navigate('/login'); return; }
      showToast('error', err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  return (
    <div className="tw:flex tw:flex-col tw:gap-4">
      <div className="tw:flex tw:items-center tw:justify-between">
        <h2 className="tw:m-0 tw:text-[17px] tw:font-semibold tw:text-slate-900">Content Library</h2>
        <button type="button" onClick={() => setShowUpload(true)}
          className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700">
          <Plus className="tw:h-4 tw:w-4" strokeWidth={2.5} /> Upload
        </button>
      </div>

      <div className="tw:relative tw:w-64">
        <Search className="tw:pointer-events-none tw:absolute tw:left-2.5 tw:top-1/2 tw:h-3.5 tw:w-3.5 tw:-translate-y-1/2 tw:text-slate-400" strokeWidth={2} />
        <input
          type="text" value={search} placeholder="Search title…"
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          aria-label="Search content"
          className="tw:w-full tw:rounded-lg tw:border tw:border-slate-200 tw:py-1.5 tw:pl-8 tw:pr-3 tw:text-[13px] tw:text-slate-900 tw:outline-none focus:tw:border-blue-400"
        />
      </div>

      <div className="tw:flex tw:flex-wrap tw:gap-1.5">
        {TYPE_CHIPS.map((c) => (
          <button key={c.key} type="button" onClick={() => { setTypeFilter(c.key); setPage(1); }}
            className={
              'tw:flex tw:items-center tw:gap-1.5 tw:rounded-full tw:px-3 tw:py-1 tw:text-[12px] tw:font-medium tw:transition-colors' +
              (typeFilter === c.key ? ' tw:bg-blue-600 tw:text-white' : ' tw:bg-slate-100 tw:text-slate-600 tw:hover:bg-slate-200')
            }>
            {c.label}
            {typeCounts && <span className="tw:opacity-70">({typeCounts[c.key as keyof ContentTypeCounts] ?? 0})</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="tw:grid tw:grid-cols-3 tw:gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="tw:h-32 tw:w-full tw:animate-pulse tw:rounded-xl tw:bg-slate-100" />)}
        </div>
      ) : error ? (
        <div className="tw:rounded-xl tw:border tw:border-red-100 tw:bg-red-50 tw:p-5 tw:text-center">
          <p className="tw:text-[13px] tw:text-red-500">{error}</p>
          <button type="button" onClick={load} className="tw:mt-2 tw:text-[13px] tw:font-medium tw:text-blue-600 tw:hover:text-blue-700">Retry</button>
        </div>
      ) : content.length === 0 ? (
        <div className="tw:flex tw:flex-col tw:items-center tw:justify-center tw:gap-3 tw:rounded-xl tw:border tw:border-dashed tw:border-slate-300 tw:bg-white tw:py-20">
          <p className="tw:m-0 tw:text-[14px] tw:text-slate-500">No content matches these filters.</p>
          <button type="button" onClick={() => setShowUpload(true)}
            className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-lg tw:bg-blue-600 tw:px-4 tw:py-2 tw:text-[13px] tw:font-semibold tw:text-white tw:hover:bg-blue-700">
            <Plus className="tw:h-4 tw:w-4" strokeWidth={2.5} /> Upload
          </button>
        </div>
      ) : (
        <>
          <div className="tw:grid tw:grid-cols-3 tw:gap-3">
            {content.map((item) => (
              <ItemCard key={item.id} item={item} onEdit={() => setEditing(item)} onDelete={() => handleDelete(item)} />
            ))}
          </div>

          {pagination.pages > 1 && (
            <div className="tw:flex tw:items-center tw:justify-between tw:text-[12px] tw:text-slate-500">
              <span>Page {pagination.page} of {pagination.pages} ({pagination.total} total)</span>
              <div className="tw:flex tw:gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                  className="tw:rounded tw:border tw:border-slate-200 tw:px-3 tw:py-1 tw:font-medium tw:text-slate-600 tw:disabled:opacity-40">Previous</button>
                <button type="button" disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}
                  className="tw:rounded tw:border tw:border-slate-200 tw:px-3 tw:py-1 tw:font-medium tw:text-slate-600 tw:disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </>
      )}

      {showUpload && <UploadDialog courses={courses} onClose={() => setShowUpload(false)} onUploaded={handleUploaded} />}
      {editing && <EditDialog item={editing} courses={courses} onClose={() => setEditing(null)} onSaved={handleEdited} />}
      {toast && <ToastBanner {...toast} />}
    </div>
  );
}
