// Public certificate verification page — /verify/:code.
//
// Genuinely public: no auth check, no admin layout/sidebar, no login prompt
// anywhere on this page. This is where a QR code on a printed/downloaded
// certificate PDF sends a logged-out visitor (often on a phone), so it must
// render and work with zero session state. Do not wrap this route in
// ProtectedRoute or AdminLayout.
//
// GET /verify/:code (publicCertificatesApi, no Bearer header) always returns
// HTTP 200 with one of three states — never a 404 from the API itself.

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, AlertTriangle, ShieldQuestion } from 'lucide-react';
import { verifyCertificate } from '../services/publicCertificatesApi';
import type { VerifyResult, VerifiedCertificateInfo } from '../types/certificates';

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh', width: '100%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '24px 16px',
      background: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif',
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: '100%', maxWidth: 420, background: '#ffffff', borderRadius: 20,
        boxShadow: '0 8px 30px rgba(15, 23, 42, 0.10)', padding: '40px 24px',
        textAlign: 'center', boxSizing: 'border-box',
      }}>
        {children}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div>
      <div style={{
        width: 40, height: 40, margin: '0 auto 16px', borderRadius: '50%',
        border: '3px solid #e2e8f0', borderTopColor: '#3b82f6', animation: 'spin 1s linear infinite',
      }} />
      <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Checking certificate…</p>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

function ValidState({ cert }: { cert: VerifiedCertificateInfo }) {
  const issued = new Date(cert.issuedAt);
  const dateLabel = Number.isNaN(issued.getTime())
    ? cert.issuedAt
    : issued.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div>
      <CheckCircle2 size={56} color="#16a34a" strokeWidth={1.5} style={{ marginBottom: 12 }} />
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Certificate Verified</h1>
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 24px' }}>This is a genuine certificate issued by MindNavy.</p>

      <div style={{ background: '#f8fafc', borderRadius: 12, padding: '18px 16px', textAlign: 'left' }}>
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 2px' }}>Student</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: 0 }}>{cert.studentName ?? '—'}</p>
        </div>
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 2px' }}>Course</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: 0 }}>{cert.courseTitle ?? '—'}</p>
        </div>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.4, margin: '0 0 2px' }}>Issued</p>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', margin: 0 }}>{dateLabel}</p>
        </div>
      </div>
    </div>
  );
}

function RevokedState() {
  return (
    <div>
      <AlertTriangle size={56} color="#d97706" strokeWidth={1.5} style={{ marginBottom: 12 }} />
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Certificate Revoked</h1>
      <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
        This certificate has been revoked and is no longer valid. Contact the issuing organization for details.
      </p>
    </div>
  );
}

function NotFoundState() {
  return (
    <div>
      <XCircle size={56} color="#dc2626" strokeWidth={1.5} style={{ marginBottom: 12 }} />
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Certificate Not Found</h1>
      <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
        We couldn&apos;t find a certificate matching this code. Double-check the link or QR code and try again.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div>
      <ShieldQuestion size={56} color="#64748b" strokeWidth={1.5} style={{ marginBottom: 12 }} />
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>Verification Unavailable</h1>
      <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>{message}</p>
    </div>
  );
}

export default function PublicVerifyPage() {
  const { code } = useParams<{ code: string }>();
  const [result,  setResult]  = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async (signal: { cancelled: boolean }) => {
    if (!code) { setLoading(false); setResult({ status: 'not_found' }); return; }
    setLoading(true);
    setError(null);
    try {
      const r = await verifyCertificate(code);
      if (!signal.cancelled) setResult(r);
    } catch (err) {
      if (!signal.cancelled) setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      if (!signal.cancelled) setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    const signal = { cancelled: false };
    load(signal);
    return () => { signal.cancelled = true; };
  }, [load]);

  return (
    <Card>
      {loading ? <LoadingState /> :
       error ? <ErrorState message={error} /> :
       result?.status === 'valid' ? <ValidState cert={result.certificate} /> :
       result?.status === 'revoked' ? <RevokedState /> :
       <NotFoundState />}
    </Card>
  );
}
