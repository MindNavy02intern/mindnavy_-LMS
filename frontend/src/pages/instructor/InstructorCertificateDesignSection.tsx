// Certificate Design section of the Instructor Settings step — shown only
// when certificateEnabled is checked. Same sign->XHR PUT->confirm upload
// pipeline as admin's CertificateLogoUpload.tsx, plus a click-to-place name
// position (stored as a 0-1 fraction of the image's rendered size, which is
// the same fraction certificatePdf.service.js multiplies against the PDF
// page's actual pixel size at issue time — so the pin position the
// instructor sees here matches where the name lands on the real PDF
// regardless of the image's native resolution).
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, ImageIcon, AlertCircle } from 'lucide-react';
import {
  signMyCertificateDesign, confirmMyCertificateDesign, setMyCertificateDesignPosition,
} from '../../api/instructorCoursesApi';
import { CourseApiError, type CertificateDesignSignResponse } from '../../types/courses';
import { LABEL, BTN_PRIMARY, BTN_SECONDARY, ERROR_BANNER, disabledStyle } from './instructorUiKit';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
const ALLOWED_EXT = '.jpg, .jpeg, .png, .webp';
const CLIENT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB — backend enforces the same limit
const DEFAULT_FONT_SIZE = 28;
const DEFAULT_COLOR = '#000000';

type UploadPhase = 'idle' | 'uploading' | 'error';
type UploadStep = 'signing' | 'transferring' | 'confirming';

function fmtBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function stepLabel(step: UploadStep | null): string {
  if (step === 'signing') return 'Preparing upload…';
  if (step === 'transferring') return 'Uploading…';
  if (step === 'confirming') return 'Finishing…';
  return 'Uploading…';
}

function getErrorMessage(err: unknown): string {
  if (err instanceof CourseApiError) {
    switch (err.status) {
      case 400: return err.message;
      case 404: return 'File not found on server. Please try again.';
      case 429: return 'Too many uploads — slow down and retry.';
      case 503: return 'File storage is not available yet. Contact your administrator.';
      case 502:
      case 500: return 'Storage service error. Please try again.';
      default: return err.message || 'Upload failed. Please try again.';
    }
  }
  return 'Upload failed. Please try again.';
}

interface Props {
  courseId: string;
  initialImageUrl: string | null;
  initialNameX: number | null;
  initialNameY: number | null;
  initialFontSize: number | null;
  initialColor: string | null;
}

export default function InstructorCertificateDesignSection({
  courseId, initialImageUrl, initialNameX, initialNameY, initialFontSize, initialColor,
}: Props) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const cancelledRef = useRef(false);

  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl);
  const [nameX, setNameX] = useState(initialNameX ?? 0.5);
  const [nameY, setNameY] = useState(initialNameY ?? 0.5);
  const [fontSize, setFontSize] = useState(initialFontSize ?? DEFAULT_FONT_SIZE);
  const [color, setColor] = useState(initialColor ?? DEFAULT_COLOR);
  const [hasPin, setHasPin] = useState(initialNameX != null && initialNameY != null);

  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [step, setStep] = useState<UploadStep | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  function doXhrUpload(file: File, signResp: CertificateDesignSignResponse): Promise<void> {
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

  async function handleFile(file: File) {
    cancelledRef.current = false;

    if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) {
      setUploadError('Only JPEG, PNG, and WebP images are accepted.');
      return;
    }
    if (file.size > CLIENT_MAX_BYTES) {
      setUploadError(`File must be smaller than ${fmtBytes(CLIENT_MAX_BYTES)}.`);
      return;
    }

    setUploadError(null);
    setProgress(0);
    setPhase('uploading');

    setStep('signing');
    let signResp: CertificateDesignSignResponse;
    try {
      signResp = await signMyCertificateDesign(courseId, { fileName: file.name, fileType: file.type });
    } catch (err) {
      if (err instanceof CourseApiError && err.status === 401) { navigate('/instructor/login'); return; }
      setUploadError(getErrorMessage(err));
      setPhase('error');
      setStep(null);
      return;
    }
    if (cancelledRef.current) return;

    if (file.size > signResp.maxBytes) {
      setUploadError(`File exceeds the server's ${fmtBytes(signResp.maxBytes)} size limit.`);
      setPhase('error');
      setStep(null);
      return;
    }

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
      setUploadError((err instanceof Error) ? err.message : 'File transfer failed. Please try again.');
      setPhase('error');
      setStep(null);
      return;
    }
    if (cancelledRef.current) return;

    setStep('confirming');
    try {
      const design = await confirmMyCertificateDesign(courseId, signResp.path);
      setImageUrl(design.customCertificateImageUrl);
      // A freshly (re)uploaded image starts with no pin until the instructor
      // clicks one — an old position from a DIFFERENT image would land
      // somewhere meaningless on the new one.
      setHasPin(false);
      setSavedMsg(null);
    } catch (err) {
      if (err instanceof CourseApiError && err.status === 401) { navigate('/instructor/login'); return; }
      setUploadError(getErrorMessage(err));
      setPhase('error');
      setStep(null);
      return;
    }

    setPhase('idle');
    setStep(null);
    setProgress(100);
  }

  function handleCancel() {
    cancelledRef.current = true;
    xhrRef.current?.abort();
    setPhase('idle');
    setStep(null);
    setProgress(0);
    setUploadError(null);
  }

  function onDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragging(true); }
  function onDragLeave() { setIsDragging(false); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleImageClick(e: React.MouseEvent<HTMLImageElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setNameX(x);
    setNameY(y);
    setHasPin(true);
    setSavedMsg(null);
  }

  async function handleSave() {
    if (!hasPin) { setSaveError('Click on the image to place the name first.'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      await setMyCertificateDesignPosition(courseId, { nameX, nameY, fontSize, color });
      setSavedMsg('Certificate design saved.');
    } catch (err) {
      if (err instanceof CourseApiError && err.status === 401) { navigate('/instructor/login'); return; }
      setSaveError(err instanceof Error ? err.message : 'Failed to save certificate design.');
    } finally {
      setSaving(false);
    }
  }

  const uploadErrorBanner = uploadError && (
    <div role="alert" style={{ ...ERROR_BANNER, marginTop: 8, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
      <AlertCircle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{uploadError}</span>
    </div>
  );

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
      <label style={LABEL}>Certificate Design <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional — falls back to the default layout if skipped)</span></label>

      {phase === 'uploading' ? (
        <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', background: '#f8fafc', padding: '12px 14px' }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 500, color: '#475569' }}>{stepLabel(step)}</p>
          <div role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
            style={{ height: 6, width: '100%', borderRadius: 999, background: '#e2e8f0', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, borderRadius: 999, background: '#2563eb', transition: 'width 0.2s' }} />
          </div>
          <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{progress}%</span>
            <button type="button" onClick={handleCancel} style={{ background: 'none', border: 'none', fontSize: 11, fontWeight: 500, color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              <X size={12} strokeWidth={2} /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload certificate design image"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
            borderRadius: 8, border: `2px dashed ${isDragging ? '#60a5fa' : '#e2e8f0'}`,
            background: isDragging ? '#eff6ff' : '#f8fafc',
            padding: '18px 16px', textAlign: 'center', cursor: 'pointer', userSelect: 'none',
          }}
        >
          <Upload size={18} strokeWidth={1.5} color={isDragging ? '#3b82f6' : '#cbd5e1'} />
          <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: '#475569' }}>
            {imageUrl ? 'Replace image' : 'Drop image here or'} <span style={{ color: '#2563eb' }}>browse</span>
          </p>
          <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>JPEG · PNG · WebP &nbsp;·&nbsp; max {fmtBytes(CLIENT_MAX_BYTES)}</p>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_EXT}
        aria-label="Choose certificate design image"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) handleFile(file);
        }}
      />
      {uploadErrorBanner}

      {imageUrl && phase !== 'uploading' && (
        <div style={{ marginTop: 14 }}>
          <p style={{ margin: '0 0 6px', fontSize: 11, color: '#64748b' }}>Click on the image where the student's name should appear:</p>
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
            <img
              src={imageUrl}
              alt="Certificate design"
              onClick={handleImageClick}
              style={{ display: 'block', maxWidth: '100%', maxHeight: 360, borderRadius: 8, border: '1px solid #e5e7eb', cursor: 'crosshair' }}
            />
            {hasPin && (
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute', left: `${nameX * 100}%`, top: `${nameY * 100}%`,
                  transform: 'translate(-50%, -50%)', pointerEvents: 'none',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}
              >
                <span style={{ fontSize: Math.max(10, Math.min(fontSize, 32)), fontWeight: 700, color, textShadow: '0 0 3px #fff, 0 0 3px #fff' }}>
                  {'Student Name'}
                </span>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.2)' }} />
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12, maxWidth: 360 }}>
            <div>
              <label style={LABEL}>Font Size <span style={{ color: '#94a3b8', fontWeight: 400 }}>({fontSize}px)</span></label>
              <input type="range" min={12} max={72} value={fontSize}
                onChange={(e) => { setFontSize(Number(e.target.value)); setSavedMsg(null); }}
                style={{ width: '100%' }} />
            </div>
            <div>
              <label style={LABEL}>Color</label>
              <input type="color" value={color}
                onChange={(e) => { setColor(e.target.value); setSavedMsg(null); }}
                style={{ width: 48, height: 32, padding: 0, border: '1px solid #e5e7eb', borderRadius: 6, cursor: 'pointer' }} />
            </div>
          </div>

          {saveError && <div style={{ ...ERROR_BANNER, marginTop: 10 }}>{saveError}</div>}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" style={disabledStyle(BTN_PRIMARY, saving || !hasPin)} disabled={saving || !hasPin} onClick={handleSave}>
              {saving ? 'Saving…' : 'Save Certificate Design'}
            </button>
            {savedMsg && <span style={{ fontSize: 12, color: '#15803d' }}>{savedMsg}</span>}
          </div>
        </div>
      )}

      {!imageUrl && phase === 'idle' && (
        <p style={{ margin: '8px 0 0', fontSize: 11, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 5 }}>
          <ImageIcon size={12} strokeWidth={1.5} /> No custom design uploaded — certificates for this course use the default layout.
        </p>
      )}
    </div>
  );
}
