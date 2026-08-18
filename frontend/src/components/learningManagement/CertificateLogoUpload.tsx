// Certificate template logo upload — sign -> PUT -> confirm, mirrors
// ThumbnailUpload.tsx's pipeline exactly (same reasoning: client validation ->
// POST .../logo/sign -> XHR PUT for progress -> POST .../logo/confirm).
//
// A template must exist before it can have a logo (same "save draft first"
// gate ThumbnailUpload uses for courseId) — the create form disables this
// zone until the template has been saved once.

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, ImageIcon, RefreshCw, AlertCircle } from 'lucide-react';
import { signLogoUpload, confirmLogoUpload, removeLogo, CertificateTemplateApiError } from '../../services/certificateTemplatesApi';
import { appQueryClient, invalidateFor } from '../../lib/invalidation';
import type { LogoSignResponse } from '../../types/certificates';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
const ALLOWED_EXT = '.jpg, .jpeg, .png, .webp';
const CLIENT_MAX_BYTES = 2 * 1024 * 1024; // 2 MB — backend enforces same limit

type Phase = 'idle' | 'uploading' | 'done' | 'error';
type Step = 'signing' | 'transferring' | 'confirming';

function fmtBytes(b: number): string {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function stepLabel(step: Step | null): string {
  if (step === 'signing') return 'Preparing upload…';
  if (step === 'transferring') return 'Uploading…';
  if (step === 'confirming') return 'Finishing…';
  return 'Uploading…';
}

function getErrorMessage(err: unknown): string {
  if (err instanceof CertificateTemplateApiError) {
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
  /** undefined until the template has been saved once (create mode) */
  templateId: string | undefined;
  initialUrl?: string | null;
  onChange: (url: string | null) => void;
}

export default function CertificateLogoUpload({ templateId, initialUrl, onChange }: Props) {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const cancelledRef = useRef(false);

  const [phase, setPhase] = useState<Phase>(initialUrl ? 'done' : 'idle');
  const [step, setStep] = useState<Step | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl ?? null);
  const [isDragging, setIsDragging] = useState(false);
  const [removing, setRemoving] = useState(false);

  function doXhrUpload(file: File, signResp: LogoSignResponse): Promise<void> {
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
      setError('Only JPEG, PNG, and WebP images are accepted.');
      return;
    }
    if (file.size > CLIENT_MAX_BYTES) {
      setError(`File must be smaller than ${fmtBytes(CLIENT_MAX_BYTES)}.`);
      return;
    }
    if (!templateId) {
      setError('Save the template first before uploading a logo.');
      return;
    }

    setError(null);
    setProgress(0);
    setPhase('uploading');

    setStep('signing');
    let signResp: LogoSignResponse;
    try {
      signResp = await signLogoUpload(templateId, { fileName: file.name, fileType: file.type });
    } catch (err) {
      if (err instanceof CertificateTemplateApiError && err.status === 401) { navigate('/login'); return; }
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

    setStep('confirming');
    let url: string | null | undefined;
    try {
      const template = await confirmLogoUpload(templateId, signResp.path);
      url = template.layout.logoUrl;
      invalidateFor(appQueryClient, 'certificateTemplate.update');
    } catch (err) {
      if (err instanceof CertificateTemplateApiError && err.status === 401) { navigate('/login'); return; }
      setError(getErrorMessage(err));
      setPhase('error');
      setStep(null);
      return;
    }
    if (cancelledRef.current) return;

    setPreviewUrl(url ?? null);
    setPhase('done');
    setStep(null);
    setProgress(100);
    onChange(url ?? null);
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

  async function handleRemove() {
    if (!templateId) return;
    setRemoving(true);
    try {
      await removeLogo(templateId);
      invalidateFor(appQueryClient, 'certificateTemplate.update');
      setPreviewUrl(null);
      setPhase('idle');
      setError(null);
      onChange(null);
    } catch (err) {
      if (err instanceof CertificateTemplateApiError && err.status === 401) { navigate('/login'); return; }
      setError(getErrorMessage(err));
    } finally {
      setRemoving(false);
    }
  }

  function onDragOver(e: React.DragEvent) { e.preventDefault(); setIsDragging(true); }
  function onDragLeave() { setIsDragging(false); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  const errorBanner = error && (
    <div role="alert" className="tw:mt-2 tw:flex tw:items-start tw:gap-1.5 tw:rounded-md tw:border tw:border-red-100 tw:bg-red-50 tw:px-3 tw:py-2 tw:text-[12px] tw:text-red-600">
      <AlertCircle className="tw:mt-0.5 tw:h-3.5 tw:w-3.5 tw:shrink-0" strokeWidth={2} />
      <span>{error}</span>
    </div>
  );

  if (phase === 'done' && previewUrl) {
    return (
      <div data-testid="logo-done">
        <div className="tw:flex tw:items-start tw:gap-3">
          <img src={previewUrl} alt="Certificate logo preview"
            className="tw:h-16 tw:w-16 tw:shrink-0 tw:rounded-lg tw:border tw:border-slate-200 tw:object-contain tw:bg-white" />
          <div className="tw:flex tw:flex-col tw:gap-1.5">
            <p className="tw:text-[12px] tw:font-medium tw:text-slate-700">Logo uploaded</p>
            <div className="tw:flex tw:items-center tw:gap-2">
              <button type="button" onClick={handleReplace}
                className="tw:flex tw:items-center tw:gap-1 tw:rounded tw:border tw:border-slate-200 tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-medium tw:text-slate-600 tw:hover:bg-slate-50">
                <RefreshCw className="tw:h-3 tw:w-3" strokeWidth={2} /> Replace
              </button>
              <button type="button" onClick={handleRemove} disabled={removing}
                className="tw:flex tw:items-center tw:gap-1 tw:rounded tw:border tw:border-red-100 tw:px-2.5 tw:py-1 tw:text-[11px] tw:font-medium tw:text-red-500 tw:hover:bg-red-50 tw:disabled:opacity-40">
                <X className="tw:h-3 tw:w-3" strokeWidth={2} /> {removing ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
        {errorBanner}
      </div>
    );
  }

  if (phase === 'uploading') {
    const pct = Math.min(progress, 100);
    return (
      <div data-testid="logo-uploading">
        <div className="tw:rounded-lg tw:border tw:border-slate-200 tw:bg-slate-50 tw:px-4 tw:py-3">
          <p className="tw:mb-2 tw:text-[12px] tw:font-medium tw:text-slate-600">{stepLabel(step)}</p>
          <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
            className="tw:h-1.5 tw:w-full tw:overflow-hidden tw:rounded-full tw:bg-slate-200">
            <div className="tw:h-full tw:rounded-full tw:bg-blue-500 tw:transition-all tw:duration-200" style={{ width: `${pct}%` }} />
          </div>
          <div className="tw:mt-1.5 tw:flex tw:items-center tw:justify-between">
            <span className="tw:text-[11px] tw:text-slate-400">{pct}%</span>
            <button type="button" onClick={handleCancel}
              className="tw:flex tw:items-center tw:gap-1 tw:rounded tw:px-2 tw:py-0.5 tw:text-[11px] tw:font-medium tw:text-slate-500 tw:hover:text-red-500">
              <X className="tw:h-3 tw:w-3" strokeWidth={2} /> Cancel
            </button>
          </div>
        </div>
        {errorBanner}
      </div>
    );
  }

  if (!templateId) {
    return (
      <div className="tw:flex tw:items-center tw:justify-center tw:rounded-lg tw:border tw:border-dashed tw:border-slate-200 tw:bg-slate-50 tw:px-4 tw:py-5 tw:text-center"
        data-testid="logo-drop-zone">
        <div>
          <ImageIcon className="tw:mx-auto tw:mb-1.5 tw:h-5 tw:w-5 tw:text-slate-300" strokeWidth={1.5} />
          <p className="tw:text-[12px] tw:text-slate-400">Save the template first to enable logo upload</p>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="logo-drop-zone">
      {previewUrl && phase !== 'done' && (
        <img src={previewUrl} alt="Current logo"
          className="tw:mb-2 tw:h-14 tw:w-14 tw:rounded-lg tw:border tw:border-slate-200 tw:object-contain tw:bg-white tw:opacity-50" />
      )}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload certificate logo"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={
          'tw:flex tw:cursor-pointer tw:flex-col tw:items-center tw:justify-center tw:gap-1.5 ' +
          'tw:rounded-lg tw:border-2 tw:border-dashed tw:px-4 tw:py-5 tw:text-center ' +
          'tw:transition-colors tw:select-none ' +
          (isDragging ? 'tw:border-blue-400 tw:bg-blue-50' : 'tw:border-slate-200 tw:bg-slate-50 tw:hover:border-blue-300 tw:hover:bg-blue-50/40')
        }
      >
        <Upload className={`tw:h-5 tw:w-5 ${isDragging ? 'tw:text-blue-500' : 'tw:text-slate-300'}`} strokeWidth={1.5} />
        <div>
          <p className="tw:text-[13px] tw:font-medium tw:text-slate-600">
            Drop image here or <span className="tw:text-blue-600">browse</span>
          </p>
          <p className="tw:mt-0.5 tw:text-[11px] tw:text-slate-400">JPEG · PNG · WebP &nbsp;·&nbsp; max {fmtBytes(CLIENT_MAX_BYTES)}</p>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_EXT}
        aria-label="Choose logo image"
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
