// Video upload component — Part C of the Course Builder + Uploads contract.
// Mirrors ThumbnailUpload.tsx exactly: same XHR pattern, same phase machine,
// same sign → PUT → confirm pipeline. Video-specific differences:
//   - kind: 'video' throughout
//   - MIME allowlist: mp4 / webm / quicktime
//   - Client max: 50 MB
//   - lessonId is REQUIRED for confirm — only works in Edit Lesson flow
//   - deleteUpload passes kind='video' explicitly
//
// Contract sequence:
//   1. Client-side validation (type + size) — block early, no request.
//   2. POST /uploads/sign  { fileName, fileType, kind:'video', courseId }
//   3. PUT file to uploadUrl via XMLHttpRequest for progress events.
//   4. POST /uploads/confirm { courseId, path, kind:'video', lessonId }
//   5. DELETE old path with kind=video if replacing.

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, Video, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { signUpload, confirmUpload, deleteUpload } from '../../api/uploadsApi';
import { UploadApiError } from '../../types/uploads';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { UploadSignResponse } from '../../types/uploads';

// ── Constants ──────────────────────────────────────────────────────────────────

const ALLOWED_MIME = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
const ALLOWED_EXT  = '.mp4, .webm, .mov';
const CLIENT_MAX_BYTES = 52428800; // 50 MB — contract §C

type Phase = 'idle' | 'uploading' | 'done' | 'error';
type Step  = 'signing' | 'transferring' | 'confirming';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function stepLabel(step: Step | null): string {
  if (step === 'signing')      return 'Preparing upload…';
  if (step === 'transferring') return 'Uploading video…';
  if (step === 'confirming')   return 'Finishing…';
  return 'Uploading…';
}

function getErrorMessage(err: unknown): string {
  if (err instanceof UploadApiError) {
    // Surface server message verbatim for 400 — covers all contract error cases.
    if (err.status === 400) return err.message;
    if (err.status === 404) return 'Lesson or course not found. Please refresh.';
    if (err.status === 429) return 'Too many uploads — slow down and retry.';
    if (err.status === 503) return 'File storage is not configured. Contact your administrator.';
    return err.message || 'Upload failed. Please try again.';
  }
  return 'Upload failed. Please try again.';
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  courseId:  string;
  /** undefined in create mode — upload disabled until lesson is saved */
  lessonId?: string;
  /**
   * When truthy, shows the disabled state with this message instead of the
   * drop zone. Used in edit mode when the lesson type hasn't been saved as
   * VIDEO_URL yet — prevents an upload attempt that the backend would reject.
   */
  disabled?: string;
  onChange:  (url: string) => void;
  /** Notifies parent whether an upload is actively in progress */
  onUploadingChange?: (uploading: boolean) => void;
}

export default function VideoUpload({ courseId, lessonId, disabled, onChange, onUploadingChange }: Props) {
  const navigate = useNavigate();
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const xhrRef          = useRef<XMLHttpRequest | null>(null);
  const uploadedPathRef = useRef<string | null>(null);
  const cancelledRef    = useRef(false);

  const [phase, setPhase]       = useState<Phase>('idle');
  const [step,  setStep]        = useState<Step | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes,    setTotalBytes]    = useState(0);
  const [error, setError]       = useState<string | null>(null);
  const [uploadedUrl,   setUploadedUrl]   = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Keep parent in sync with upload state.
  useEffect(() => {
    onUploadingChange?.(phase === 'uploading');
  }, [phase, onUploadingChange]);

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

    // 1. Client-side validation
    if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) {
      setError('Only MP4, WebM, and MOV video files are accepted.');
      return;
    }
    if (file.size > CLIENT_MAX_BYTES) {
      setError(`File must be smaller than ${fmtBytes(CLIENT_MAX_BYTES)}.`);
      return;
    }
    if (!lessonId) {
      setError('Save the lesson first before uploading a video file.');
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
      signResp = await signUpload({ fileName: file.name, fileType: file.type, kind: 'video', courseId });
    } catch (err) {
      if ((err instanceof UploadApiError) && err.status === 401) { navigate('/login'); return; }
      setError(getErrorMessage(err));
      setPhase('error');
      setStep(null);
      return;
    }
    if (cancelledRef.current) return;

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

    // 4. Confirm — lessonId required for video
    setStep('confirming');
    let url: string;
    try {
      const resp = await confirmUpload({ courseId, path: signResp.path, kind: 'video', lessonId });
      url = resp.url;
    } catch (err) {
      if ((err instanceof UploadApiError) && err.status === 401) { navigate('/login'); return; }
      setError(getErrorMessage(err));
      setPhase('error');
      setStep(null);
      return;
    }
    if (cancelledRef.current) return;

    // 5. Delete old storage path if replacing
    const prevPath = uploadedPathRef.current;
    if (prevPath && prevPath !== signResp.path) {
      deleteUpload(prevPath, 'video').catch(() => null);
    }
    uploadedPathRef.current = signResp.path;

    // 6. Update state + notify parent
    setUploadedUrl(url);
    setPhase('done');
    setStep(null);
    setProgress(100);
    onChange(url);

    // 7. Invalidate: confirmUpload updates lesson.content — same key as lesson.update
    invalidateFor(appQueryClient, 'lesson.update', { courseId });
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
  }

  // ── Drag & Drop ──────────────────────────────────────────────────────────────

  function onDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragging(true); }
  function onDragLeave() { setIsDragging(false); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  // ── Render ───────────────────────────────────────────────────────────────────

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
  if (phase === 'done' && uploadedUrl) {
    return (
      <div data-testid="video-upload-done">
        <div className="tw:flex tw:items-start tw:gap-3">
          <div className="tw:flex tw:h-12 tw:w-14 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-violet-200 tw:bg-violet-50">
            <CheckCircle className="tw:h-5 tw:w-5 tw:text-violet-600" strokeWidth={2} />
          </div>
          <div className="tw:flex tw:flex-col tw:gap-1.5">
            <p className="tw:text-[12px] tw:font-medium tw:text-slate-700">Video uploaded</p>
            <p className="tw:max-w-[240px] tw:truncate tw:text-[11px] tw:text-slate-400">{uploadedUrl}</p>
            <button
              type="button"
              onClick={handleReplace}
              className="tw:flex tw:w-fit tw:items-center tw:gap-1 tw:rounded tw:border tw:border-slate-200 tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50"
            >
              <RefreshCw className="tw:h-3 tw:w-3" strokeWidth={2} />
              Replace
            </button>
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
      <div data-testid="video-upload-uploading">
        <div className="tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:px-4 tw:py-3">
          <p className="tw:mb-2 tw:text-[12px] tw:font-medium tw:text-slate-600">{stepLabel(step)}</p>

          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            className="tw:h-1.5 tw:w-full tw:overflow-hidden tw:rounded-full tw:bg-slate-200"
          >
            <div
              className="tw:h-full tw:rounded-full tw:bg-violet-500 tw:transition-all tw:duration-200"
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

  // ── Disabled — no lessonId (create mode) OR explicit gate from parent ────────
  if (!lessonId || disabled) {
    const msg = disabled ?? 'Save lesson first to enable file upload';
    return (
      <div
        className="tw:flex tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-dashed tw:border-slate-200 tw:bg-slate-50 tw:px-4 tw:py-5 tw:text-center"
        data-testid="video-upload-disabled"
      >
        <div>
          <Video className="tw:mx-auto tw:mb-1.5 tw:h-6 tw:w-6 tw:text-slate-300" strokeWidth={1.5} />
          <p className="tw:text-[12px] tw:text-slate-400">{msg}</p>
        </div>
      </div>
    );
  }

  // ── Idle / Error state — drop zone ───────────────────────────────────────────
  return (
    <div data-testid="video-upload-drop-zone">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload video file"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={
          'tw:flex tw:cursor-pointer tw:flex-col tw:items-center tw:justify-center tw:gap-2 ' +
          'tw:rounded-lg tw:border-2 tw:border-dashed tw:px-4 tw:py-5 tw:text-center ' +
          'tw:transition-colors tw:select-none ' +
          (isDragging
            ? 'tw:border-violet-400 tw:bg-violet-50'
            : 'tw:border-slate-200 tw:bg-slate-50 tw:hover:border-violet-300 tw:hover:bg-violet-50/40')
        }
      >
        <Upload
          className={`tw:h-6 tw:w-6 ${isDragging ? 'tw:text-violet-500' : 'tw:text-slate-300'}`}
          strokeWidth={1.5}
        />
        <div>
          <p className="tw:text-[13px] tw:font-medium tw:text-slate-600">
            Drop video here or{' '}
            <span className="tw:text-violet-600">browse</span>
          </p>
          <p className="tw:mt-0.5 tw:text-[11px] tw:text-slate-400">
            MP4 · WebM · MOV &nbsp;·&nbsp; max {fmtBytes(CLIENT_MAX_BYTES)}
          </p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_EXT}
        aria-label="Choose video file"
        className="tw:hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) handleFile(file);
        }}
      />

      {errorBanner}
    </div>
  );
}
