// Instructor lesson-video upload — mirrors admin's VideoUpload.tsx
// (components/learningManagement/VideoUpload.tsx) with instructorUiKit inline
// styles. lessonId is required for confirm — disabled until the lesson is
// saved as VIDEO_URL type first, same gating rule as admin.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signMyUpload, confirmMyUpload, deleteMyUpload } from '../../api/instructorUploadsApi';
import { UploadApiError, type UploadSignResponse } from '../../types/uploads';
import { BTN_SECONDARY, ERROR_BANNER } from './instructorUiKit';

const ALLOWED_MIME = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
const ALLOWED_EXT  = '.mp4, .webm, .mov';
const CLIENT_MAX_BYTES = 52428800; // 50 MB

type Phase = 'idle' | 'uploading' | 'done' | 'error';
type Step  = 'signing' | 'transferring' | 'confirming';

function fmtBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function stepLabel(step: Step | null): string {
  if (step === 'signing') return 'Preparing upload…';
  if (step === 'transferring') return 'Uploading video…';
  if (step === 'confirming') return 'Finishing…';
  return 'Uploading…';
}

function getErrorMessage(err: unknown): string {
  if (err instanceof UploadApiError) {
    if (err.status === 400) return err.message;
    if (err.status === 404) return 'Lesson or course not found. Please refresh.';
    if (err.status === 429) return 'Too many uploads — slow down and retry.';
    if (err.status === 503) return 'File storage is not configured. Contact an admin.';
    return err.message || 'Upload failed. Please try again.';
  }
  return 'Upload failed. Please try again.';
}

interface Props {
  courseId: string;
  /** undefined in create mode — upload disabled until the lesson is saved */
  lessonId?: string;
  /** Shows the disabled state with this message instead of the drop zone
   *  (e.g. lesson type hasn't been saved as VIDEO_URL yet). */
  disabled?: string;
  onChange: (url: string) => void;
  onUploadingChange?: (uploading: boolean) => void;
}

export default function InstructorVideoUpload({ courseId, lessonId, disabled, onChange, onUploadingChange }: Props) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const uploadedPathRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);

  const [phase, setPhase] = useState<Phase>('idle');
  const [step, setStep] = useState<Step | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => { onUploadingChange?.(phase === 'uploading'); }, [phase, onUploadingChange]);

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
      xhr.onerror = () => { xhrRef.current = null; reject(new Error('Network error during file transfer')); };
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

  async function handleFile(file: File) {
    cancelledRef.current = false;

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

    setError(null); setProgress(0); setUploadedBytes(0); setTotalBytes(0);
    setPhase('uploading');

    setStep('signing');
    let signResp: UploadSignResponse;
    try {
      signResp = await signMyUpload(courseId, { fileName: file.name, fileType: file.type, kind: 'video' });
    } catch (err) {
      if (err instanceof UploadApiError && err.status === 401) { navigate('/instructor/login'); return; }
      setError(getErrorMessage(err)); setPhase('error'); setStep(null);
      return;
    }
    if (cancelledRef.current) return;

    if (file.size > signResp.maxBytes) {
      setError(`File exceeds the server's ${fmtBytes(signResp.maxBytes)} size limit.`);
      setPhase('error'); setStep(null);
      return;
    }

    setStep('transferring');
    try {
      await doXhrUpload(file, signResp);
    } catch (err) {
      if ((err as { cancelled?: boolean }).cancelled || cancelledRef.current) {
        setPhase('idle'); setStep(null); setProgress(0);
        return;
      }
      setError(err instanceof Error ? err.message : 'File transfer failed. Please try again.');
      setPhase('error'); setStep(null);
      return;
    }
    if (cancelledRef.current) return;

    setStep('confirming');
    let url: string;
    try {
      const resp = await confirmMyUpload(courseId, { path: signResp.path, kind: 'video', lessonId });
      url = resp.url;
    } catch (err) {
      if (err instanceof UploadApiError && err.status === 401) { navigate('/instructor/login'); return; }
      setError(getErrorMessage(err)); setPhase('error'); setStep(null);
      return;
    }
    if (cancelledRef.current) return;

    const prevPath = uploadedPathRef.current;
    if (prevPath && prevPath !== signResp.path) {
      deleteMyUpload(courseId, prevPath, 'video').catch(() => null);
    }
    uploadedPathRef.current = signResp.path;

    setUploadedUrl(url);
    setPhase('done'); setStep(null); setProgress(100);
    onChange(url);
  }

  function handleCancel() {
    cancelledRef.current = true;
    xhrRef.current?.abort();
    setPhase('idle'); setStep(null); setProgress(0); setError(null);
  }

  function handleReplace() { setPhase('idle'); setError(null); setProgress(0); }

  function onDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragging(true); }
  function onDragLeave() { setIsDragging(false); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const errorBanner = error && <div style={{ ...ERROR_BANNER, marginTop: 8 }}>{error}</div>;

  if (phase === 'done' && uploadedUrl) {
    return (
      <div data-testid="instr-video-upload-done">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ display: 'flex', height: 48, width: 56, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px solid #ddd6fe', background: '#f5f3ff', fontSize: 18 }}>✓</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: '#374151', margin: 0 }}>Video uploaded</p>
            <p style={{ maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11, color: '#94a3b8', margin: 0 }}>{uploadedUrl}</p>
            <button type="button" onClick={handleReplace} style={{ ...BTN_SECONDARY, padding: '4px 10px', width: 'fit-content' }}>Replace</button>
          </div>
        </div>
        {errorBanner}
      </div>
    );
  }

  if (phase === 'uploading') {
    const pct = Math.min(progress, 100);
    return (
      <div data-testid="instr-video-upload-uploading">
        <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', background: '#f8fafc', padding: '10px 14px' }}>
          <p style={{ marginBottom: 8, fontSize: 12, fontWeight: 500, color: '#475569' }}>{stepLabel(step)}</p>
          <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
            style={{ height: 6, width: '100%', overflow: 'hidden', borderRadius: 999, background: '#e5e7eb' }}>
            <div style={{ height: '100%', borderRadius: 999, background: '#7c3aed', width: `${pct}%`, transition: 'width 0.2s' }} />
          </div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {step === 'transferring' && totalBytes > 0
              ? <span style={{ fontSize: 11, color: '#94a3b8' }}>{fmtBytes(uploadedBytes)} / {fmtBytes(totalBytes)} ({pct}%)</span>
              : <span style={{ fontSize: 11, color: '#94a3b8' }}>{pct}%</span>}
            <button type="button" onClick={handleCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500, color: '#64748b' }}>Cancel</button>
          </div>
        </div>
        {errorBanner}
      </div>
    );
  }

  if (!lessonId || disabled) {
    const msg = disabled ?? 'Save lesson first to enable file upload';
    return (
      <div data-testid="instr-video-upload-disabled" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: '1px dashed #e5e7eb', background: '#f8fafc', padding: '18px 14px', textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>{msg}</p>
      </div>
    );
  }

  return (
    <div data-testid="instr-video-upload-drop-zone">
      <div
        role="button" tabIndex={0} aria-label="Upload video file"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        style={{
          display: 'flex', cursor: 'pointer', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
          borderRadius: 8, border: `2px dashed ${isDragging ? '#a78bfa' : '#e5e7eb'}`, padding: '18px 14px', textAlign: 'center',
          background: isDragging ? '#f5f3ff' : '#f8fafc', transition: 'background 0.15s, border-color 0.15s', userSelect: 'none',
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 500, color: '#475569', margin: 0 }}>
          Drop video here or <span style={{ color: '#7c3aed' }}>browse</span>
        </p>
        <p style={{ marginTop: 2, fontSize: 11, color: '#94a3b8', margin: 0 }}>
          MP4 · WebM · MOV · max {fmtBytes(CLIENT_MAX_BYTES)}
        </p>
      </div>
      <input
        ref={fileInputRef} type="file" accept={ALLOWED_EXT} aria-label="Choose video file"
        style={{ display: 'none' }}
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
