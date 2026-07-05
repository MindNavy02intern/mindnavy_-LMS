// Thumbnail upload component — Phase 1 of the Course Builder + Uploads contract.
// Replaces the old URL text input in CourseForm with a file-picker / drag-drop zone.
//
// Contract sequence:
//   1. Client-side validation (type + size) — block early, no request.
//   2. POST /uploads/sign  → { uploadUrl, path, maxBytes, expiresIn }
//   3. PUT file to uploadUrl via XMLHttpRequest (NOT fetch) for progress events.
//   4. POST /uploads/confirm → { url } — stored as course.thumbnail in DB.
//   5. If replacing an existing upload, DELETE old path (best-effort, non-blocking).
//
// Video upload is Phase 2 (Cloudflare) — the component accepts only images now.
// The sign/XHR/confirm pipeline is written generically so Phase 2 reuses it.

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, ImageIcon, RefreshCw, AlertCircle } from 'lucide-react';
import { signUpload, confirmUpload, deleteUpload } from '../../api/uploadsApi';
import { UploadApiError } from '../../types/uploads';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { UploadSignResponse } from '../../types/uploads';

// ── Constants ──────────────────────────────────────────────────────────────────

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
const ALLOWED_EXT  = '.jpg, .jpeg, .png, .webp';
const CLIENT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB — backend enforces same limit

type Phase = 'idle' | 'uploading' | 'done' | 'error';
type Step  = 'signing' | 'transferring' | 'confirming';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function stepLabel(step: Step | null): string {
  if (step === 'signing')     return 'Preparing upload…';
  if (step === 'transferring') return 'Uploading…';
  if (step === 'confirming')  return 'Finishing…';
  return 'Uploading…';
}

function getErrorMessage(err: unknown): string {
  if (err instanceof UploadApiError) {
    switch (err.status) {
      case 400:  return err.message;  // read server message directly per contract
      case 404:  return 'File not found on server. Please try again.';
      case 429:  return 'Too many uploads — slow down and retry.';
      case 503:  return 'File storage is not available yet. Contact your administrator.';
      case 502:
      case 500:  return 'Storage service error. Please try again.';
      default:   return err.message || 'Upload failed. Please try again.';
    }
  }
  return 'Upload failed. Please try again.';
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  /** undefined when CourseForm is in create mode — show "save draft first" notice */
  courseId: string | undefined;
  initialUrl?: string;
  onChange: (url: string) => void;
}

export default function ThumbnailUpload({ courseId, initialUrl, onChange }: Props) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef       = useRef<XMLHttpRequest | null>(null);
  const uploadedPathRef = useRef<string | null>(null); // path of last completed upload (for delete-on-replace)
  const cancelledRef = useRef(false);

  const [phase, setPhase]       = useState<Phase>(initialUrl ? 'done' : 'idle');
  const [step,  setStep]        = useState<Step | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes,    setTotalBytes]    = useState(0);
  const [error, setError]       = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl ?? null);
  const [isDragging, setIsDragging] = useState(false);

  // ── XHR PUT ─────────────────────────────────────────────────────────────────

  function doXhrUpload(file: File, signResp: UploadSignResponse): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadedBytes(e.loaded);
          setTotalBytes(e.total);
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        xhrRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Storage PUT failed (HTTP ${xhr.status})`));
      };

      xhr.onerror = () => {
        xhrRef.current = null;
        reject(new Error('Network error during file transfer'));
      };

      xhr.onabort = () => {
        xhrRef.current = null;
        const e: Error & { cancelled?: boolean } = new Error('Cancelled');
        e.cancelled = true;
        reject(e);
      };

      xhr.open('PUT', signResp.uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  }

  // ── Main upload flow ─────────────────────────────────────────────────────────

  async function handleFile(file: File) {
    cancelledRef.current = false;

    // 1. Client-side validation — block before any request
    if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) {
      setError('Only JPEG, PNG, and WebP images are accepted.');
      return;
    }
    if (file.size > CLIENT_MAX_BYTES) {
      setError(`File must be smaller than ${fmtBytes(CLIENT_MAX_BYTES)}.`);
      return;
    }
    if (!courseId) {
      setError('Save the draft first before uploading a thumbnail.');
      return;
    }

    setError(null);
    setProgress(0);
    setUploadedBytes(0);
    setTotalBytes(0);
    setPhase('uploading');

    // 2. Sign
    setStep('signing');
    let signResp: UploadSignResponse;
    try {
      signResp = await signUpload({ fileName: file.name, fileType: file.type, kind: 'thumbnail', courseId });
    } catch (err) {
      if ((err instanceof UploadApiError) && err.status === 401) { navigate('/login'); return; }
      setError(getErrorMessage(err));
      setPhase('error');
      setStep(null);
      return;
    }
    if (cancelledRef.current) return;

    // Respect server's maxBytes (in case client-side limit was out of sync)
    if (file.size > signResp.maxBytes) {
      setError(`File exceeds the server's ${fmtBytes(signResp.maxBytes)} size limit.`);
      setPhase('error');
      setStep(null);
      return;
    }

    // 3. PUT via XHR for progress
    setStep('transferring');
    try {
      await doXhrUpload(file, signResp);
    } catch (err) {
      if ((err as { cancelled?: boolean }).cancelled || cancelledRef.current) {
        setPhase('idle');
        setStep(null);
        setProgress(0);
        return;
      }
      setError((err instanceof Error) ? err.message : 'File transfer failed. Please try again.');
      setPhase('error');
      setStep(null);
      return;
    }
    if (cancelledRef.current) return;

    // 4. Confirm
    setStep('confirming');
    let url: string;
    try {
      const resp = await confirmUpload({ courseId, path: signResp.path, kind: 'thumbnail' });
      url = resp.url;
    } catch (err) {
      if ((err instanceof UploadApiError) && err.status === 401) { navigate('/login'); return; }
      setError(getErrorMessage(err));
      setPhase('error');
      setStep(null);
      return;
    }
    if (cancelledRef.current) return;

    // 5. Delete old storage object if we uploaded one previously in this session
    const prevPath = uploadedPathRef.current;
    if (prevPath && prevPath !== signResp.path) {
      deleteUpload(prevPath).catch(() => null); // best-effort, non-blocking
    }
    uploadedPathRef.current = signResp.path;

    // 6. Update preview + notify parent
    setPreviewUrl(url);
    setPhase('done');
    setStep(null);
    setProgress(100);
    onChange(url);

    // 7. Invalidate: confirmUpload does prisma.course.update({ thumbnail }) — same as course.update
    invalidateFor(appQueryClient, 'course.update', { id: courseId });
  }

  function handleCancel() {
    cancelledRef.current = true;
    xhrRef.current?.abort();
    setPhase('idle');
    setStep(null);
    setProgress(0);
    setError(null);
  }

  function handleReplace() {
    setPhase('idle');
    setError(null);
    setProgress(0);
    // Keep previewUrl until the new upload completes
  }

  function handleRemove() {
    const prevPath = uploadedPathRef.current;
    if (prevPath) {
      deleteUpload(prevPath).catch(() => null);
      uploadedPathRef.current = null;
    }
    setPreviewUrl(null);
    setPhase('idle');
    setError(null);
    onChange('');
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────────

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }
  function onDragLeave() { setIsDragging(false); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  // Error display shared across phases
  const errorBanner = error && (
    <div
      role="alert"
      className="tw:mt-2 tw:flex tw:items-start tw:gap-1.5 tw:rounded-md tw:border tw:border-red-100 tw:bg-red-50 tw:px-3 tw:py-2 tw:text-[12px] tw:text-red-600"
    >
      <AlertCircle className="tw:mt-0.5 tw:h-3.5 tw:w-3.5 tw:shrink-0" strokeWidth={2} />
      <span>{error}</span>
    </div>
  );

  // ── Done state ───────────────────────────────────────────────────────────────
  if (phase === 'done' && previewUrl) {
    return (
      <div data-testid="thumbnail-done">
        <div className="tw:flex tw:items-start tw:gap-3">
          <img
            src={previewUrl}
            alt="Thumbnail preview"
            className="tw:h-20 tw:w-28 tw:shrink-0 tw:rounded-lg tw:border tw:border-slate-200 tw:object-cover"
          />
          <div className="tw:flex tw:flex-col tw:gap-1.5">
            <p className="tw:text-[12px] tw:font-medium tw:text-slate-700">Thumbnail uploaded</p>
            <p className="tw:max-w-[220px] tw:truncate tw:text-[11px] tw:text-slate-400">{previewUrl}</p>
            <div className="tw:flex tw:items-center tw:gap-2">
              <button
                type="button"
                onClick={handleReplace}
                className="tw:flex tw:items-center tw:gap-1 tw:rounded tw:border tw:border-slate-200 tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50"
              >
                <RefreshCw className="tw:h-3 tw:w-3" strokeWidth={2} />
                Replace
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="tw:flex tw:items-center tw:gap-1 tw:rounded tw:border tw:border-red-100 tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-medium tw:text-red-500 tw:hover:bg-red-50"
              >
                <X className="tw:h-3 tw:w-3" strokeWidth={2} />
                Remove
              </button>
            </div>
          </div>
        </div>
        {errorBanner}
      </div>
    );
  }

  // ── Uploading state ──────────────────────────────────────────────────────────
  if (phase === 'uploading') {
    const pct = Math.min(progress, 100);
    return (
      <div data-testid="thumbnail-uploading">
        <div className="tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:px-4 tw:py-3">
          <p className="tw:mb-2 tw:text-[12px] tw:font-medium tw:text-slate-600">{stepLabel(step)}</p>

          {/* Progress bar */}
          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="tw:h-1.5 tw:w-full tw:overflow-hidden tw:rounded-full tw:bg-slate-200"
          >
            <div
              className="tw:h-full tw:rounded-full tw:bg-blue-500 tw:transition-all tw:duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="tw:mt-1.5 tw:flex tw:items-center tw:justify-between">
            {step === 'transferring' && totalBytes > 0 ? (
              <span className="tw:text-[11px] tw:text-slate-400">
                {fmtBytes(uploadedBytes)} / {fmtBytes(totalBytes)} ({pct}%)
              </span>
            ) : (
              <span className="tw:text-[11px] tw:text-slate-400">{pct}%</span>
            )}
            <button
              type="button"
              onClick={handleCancel}
              className="tw:flex tw:items-center tw:gap-1 tw:rounded tw:px-2 tw:py-0.5 tw:text-[11px] tw:font-medium tw:text-slate-500 tw:hover:text-red-500"
            >
              <X className="tw:h-3 tw:w-3" strokeWidth={2} />
              Cancel
            </button>
          </div>
        </div>
        {errorBanner}
      </div>
    );
  }

  // ── Error / Idle / Replace state — show drop zone ────────────────────────────

  // In create mode (no courseId yet), disable the zone
  if (!courseId) {
    return (
      <div
        className="tw:flex tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-dashed tw:border-slate-200 tw:bg-slate-50 tw:px-4 tw:py-6 tw:text-center"
        data-testid="thumbnail-drop-zone"
      >
        <div>
          <ImageIcon className="tw:mx-auto tw:mb-1.5 tw:h-6 tw:w-6 tw:text-slate-300" strokeWidth={1.5} />
          <p className="tw:text-[12px] tw:text-slate-400">Save Draft first to enable thumbnail upload</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="thumbnail-drop-zone">
      {/* Current preview (when replacing) */}
      {previewUrl && phase !== 'done' && (
        <img
          src={previewUrl}
          alt="Current thumbnail"
          className="tw:mb-2 tw:h-16 tw:w-24 tw:rounded-lg tw:border tw:border-slate-200 tw:object-cover tw:opacity-50"
        />
      )}

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload thumbnail"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={
          'tw:flex tw:cursor-pointer tw:flex-col tw:items-center tw:justify-center tw:gap-2 ' +
          'tw:rounded-lg tw:border-2 tw:border-dashed tw:px-4 tw:py-6 tw:text-center ' +
          'tw:transition-colors tw:select-none ' +
          (isDragging
            ? 'tw:border-blue-400 tw:bg-blue-50'
            : 'tw:border-slate-200 tw:bg-slate-50 tw:hover:border-blue-300 tw:hover:bg-blue-50/40')
        }
      >
        <Upload
          className={`tw:h-6 tw:w-6 ${isDragging ? 'tw:text-blue-500' : 'tw:text-slate-300'}`}
          strokeWidth={1.5}
        />
        <div>
          <p className="tw:text-[13px] tw:font-medium tw:text-slate-600">
            Drop image here or{' '}
            <span className="tw:text-blue-600">browse</span>
          </p>
          <p className="tw:mt-0.5 tw:text-[11px] tw:text-slate-400">
            JPEG · PNG · WebP &nbsp;·&nbsp; max {fmtBytes(CLIENT_MAX_BYTES)}
          </p>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_EXT}
        aria-label="Choose thumbnail image"
        className="tw:hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // reset so same file can be re-selected
          if (file) handleFile(file);
        }}
      />

      {errorBanner}
    </div>
  );
}
