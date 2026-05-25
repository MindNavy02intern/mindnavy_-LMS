import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ResetPasswordForm from '../components/auth/ResetPasswordForm';

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconShieldCheck() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

// ── Shared page shell ─────────────────────────────────────────────────────────

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mn-auth-page">
      <div className="mn-auth-overlay" />
      <div className="mn-auth-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/brand/logowhite.png" alt="MindNavy" className="mn-auth-logo" />
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [success, setSuccess] = useState(false);

  // Email may be pre-filled if the user came from the forgot-password page
  const initialEmail = searchParams.get('email') ?? '';

  // ── Success screen ────────────────────────────────────────────
  if (success) {
    return (
      <AuthShell>
        <div style={{ textAlign: 'center' }}>
          <div className="mn-success-icon" style={{ color: 'var(--mn-teal-400)' }}>
            <IconShieldCheck />
          </div>
          <h2
            style={{
              fontSize: '1.2rem',
              fontWeight: 700,
              color: 'var(--mn-text-100)',
              marginBottom: '0.5rem',
            }}
          >
            Password updated!
          </h2>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--mn-text-400)',
              lineHeight: 1.65,
              marginBottom: '1.75rem',
            }}
          >
            Your password has been changed successfully. Sign in with your new
            password to continue.
          </p>
          <button
            type="button"
            className="mn-btn-primary"
            onClick={() => navigate('/login', { replace: true })}
          >
            Sign In
          </button>
        </div>
      </AuthShell>
    );
  }

  // ── Reset form ────────────────────────────────────────────────
  return (
    <AuthShell>
      <div style={{ marginBottom: '1.75rem' }}>
        <Link
          to="/forgot-password"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.82rem',
            color: 'var(--mn-text-600)',
            textDecoration: 'none',
            marginBottom: '1rem',
          }}
        >
          ← Back
        </Link>
        <h1
          style={{
            fontSize: '1.3rem',
            fontWeight: 700,
            color: 'var(--mn-text-100)',
            margin: 0,
            marginBottom: '0.4rem',
          }}
        >
          Create new password
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--mn-text-400)', margin: 0 }}>
          Enter your email, the reset code you received, and your new password.
        </p>
      </div>

      <ResetPasswordForm initialEmail={initialEmail} onSuccess={() => setSuccess(true)} />
    </AuthShell>
  );
}
