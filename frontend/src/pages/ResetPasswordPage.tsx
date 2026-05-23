import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import ResetPasswordForm from '../components/auth/ResetPasswordForm';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { ResetPasswordStep } from '../types/passwordRecovery';

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconShieldCheck() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function IconAlertTriangle() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
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
  const [step, setStep] = useState<ResetPasswordStep>('loading');

  // We use a ref so the timeout callback reads the current step without stale closure
  const stepRef = useRef<ResetPasswordStep>('loading');
  const setStepSync = (s: ResetPasswordStep) => {
    stepRef.current = s;
    setStep(s);
  };

  useEffect(() => {
    // Supabase embeds the recovery token in the URL hash after the user clicks the email link:
    // /reset-password#access_token=...&type=recovery
    //
    // The Supabase client picks this up automatically and fires the PASSWORD_RECOVERY event.
    // We listen for that event to know the token is valid.
    //
    // TODO: BACKEND — if the backend issues its own tokens (not Supabase), parse them here instead.

    const hash = window.location.hash;
    const looksLikeRecoveryLink =
      hash.includes('type=recovery') || hash.includes('access_token');

    // If there's no token at all, immediately show the error screen
    if (!looksLikeRecoveryLink) {
      setStepSync('token-error');
      return;
    }

    // Subscribe to Supabase auth events to catch the PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStepSync('form');
      } else if (event === 'SIGNED_OUT' && stepRef.current === 'loading') {
        setStepSync('token-error');
      }
    });

    // Fallback: if Supabase hasn't fired after 5 seconds, the token is likely expired
    const timeout = setTimeout(() => {
      if (stepRef.current === 'loading') {
        setStepSync('token-error');
      }
    }, 5_000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // ── Loading ───────────────────────────────────────────────────
  if (step === 'loading') {
    return <LoadingSpinner />;
  }

  // ── Invalid / expired token ───────────────────────────────────
  if (step === 'token-error') {
    return (
      <AuthShell>
        <div style={{ textAlign: 'center' }}>
          <div className="mn-token-error-icon">
            <IconAlertTriangle />
          </div>
          <h2
            style={{
              fontSize: '1.2rem',
              fontWeight: 700,
              color: 'var(--mn-text-100)',
              marginBottom: '0.5rem',
            }}
          >
            Link invalid or expired
          </h2>
          <p
            style={{
              fontSize: '0.85rem',
              color: 'var(--mn-text-400)',
              lineHeight: 1.65,
              marginBottom: '1.75rem',
            }}
          >
            Password reset links expire after 1 hour and can only be used once.
            Please request a new one.
          </p>
          <Link
            to="/forgot-password"
            className="mn-btn-primary"
            style={{ textDecoration: 'none', display: 'block', marginBottom: '1rem' }}
          >
            Request New Link
          </Link>
          <Link
            to="/login"
            style={{
              display: 'block',
              fontSize: '0.82rem',
              color: 'var(--mn-text-600)',
              textDecoration: 'none',
              textAlign: 'center',
            }}
          >
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  // ── Password changed successfully ─────────────────────────────
  if (step === 'success') {
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

  // ── New password form (step === 'form' | 'submitting' | 'error') ───
  return (
    <AuthShell>
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
          Create new password
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--mn-text-400)', margin: 0 }}>
          Your new password must be different from the one you used before.
        </p>
      </div>

      <ResetPasswordForm onSuccess={() => setStepSync('success')} />
    </AuthShell>
  );
}
