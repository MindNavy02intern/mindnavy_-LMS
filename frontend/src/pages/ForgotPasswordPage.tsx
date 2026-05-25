import { useState } from 'react';
import { Link } from 'react-router-dom';
import ForgotPasswordForm from '../components/auth/ForgotPasswordForm';

// ── Back arrow icon ───────────────────────────────────────────────────────────

function IconArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);

  // ── Success state ─────────────────────────────────────────────
  if (sentTo) {
    return (
      <div className="mn-auth-page">
        <div className="mn-auth-overlay" />

        <div className="mn-auth-card" style={{ textAlign: 'center' }}>
          <img
            src="/brand/logowhite.png"
            alt="MindNavy"
            className="mn-auth-logo"
            style={{ marginBottom: '1.75rem' }}
          />

          {/* Success icon */}
          <div className="mn-success-icon" style={{ color: 'var(--mn-teal-400)' }}>
            <IconMail />
          </div>

          <h2
            style={{
              fontSize: '1.2rem',
              fontWeight: 700,
              color: 'var(--mn-text-100)',
              marginBottom: '0.5rem',
            }}
          >
            Check your inbox
          </h2>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--mn-text-400)',
              lineHeight: 1.65,
              marginBottom: '0.4rem',
            }}
          >
            If <strong style={{ color: 'var(--mn-text-200)' }}>{sentTo}</strong> is
            registered, you'll receive a password reset code shortly.
          </p>
          <p
            style={{
              fontSize: '0.78rem',
              color: 'var(--mn-text-600)',
              marginBottom: '1.75rem',
            }}
          >
            Didn't receive it? Check your spam folder or{' '}
            <button
              type="button"
              className="mn-resend-btn"
              onClick={() => setSentTo(null)}
            >
              try again
            </button>
            .
          </p>

          <Link
            to={`/reset-password?email=${encodeURIComponent(sentTo)}`}
            className="mn-btn-primary"
            style={{ textDecoration: 'none', display: 'block', marginBottom: '0.75rem' }}
          >
            Enter Reset Code
          </Link>
          <Link to="/login" style={{ display: 'block', fontSize: '0.82rem', color: 'var(--mn-text-600)', textDecoration: 'none', textAlign: 'center' }}>
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  // ── Email input state ─────────────────────────────────────────
  return (
    <div className="mn-auth-page">
      <div className="mn-auth-overlay" />

      <div className="mn-auth-card">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/brand/logowhite.png" alt="MindNavy" className="mn-auth-logo" />
        </div>

        {/* Back link */}
        <div style={{ marginBottom: '1.25rem' }}>
          <Link to="/login" className="mn-auth-back-link">
            <IconArrowLeft />
            Back to sign in
          </Link>
        </div>

        {/* Heading */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h1
            style={{
              fontSize: '1.3rem',
              fontWeight: 700,
              color: 'var(--mn-text-100)',
              margin: 0,
              marginBottom: '0.4rem',
            }}
          >
            Reset your password
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--mn-text-400)', margin: 0 }}>
            Enter your email address and we'll send you a code to reset your password.
          </p>
        </div>

        <ForgotPasswordForm onEmailSent={(email) => setSentTo(email)} />
      </div>
    </div>
  );
}
