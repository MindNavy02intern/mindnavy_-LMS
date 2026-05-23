import { useState } from 'react';
import { requestPasswordReset } from '../../api/passwordRecovery';
import { getAuthErrorMessage } from '../../utils/authErrors';
import type { ForgotPasswordStep } from '../../types/passwordRecovery';

interface Props {
  /** Called when the email has been sent so the parent can switch to a success screen */
  onEmailSent: (email: string) => void;
}

// Basic email format check — full validation happens server-side
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ForgotPasswordForm({ onEmailSent }: Props) {
  const [email, setEmail]     = useState('');
  const [step, setStep]       = useState<ForgotPasswordStep>('email-input');
  const [error, setError]     = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const isLoading = step === 'loading';

  // ── Validate on blur ──────────────────────────────────────────
  const handleBlur = () => {
    if (email && !isValidEmail(email)) {
      setFieldError('Please enter a valid email address.');
    } else {
      setFieldError(null);
    }
  };

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Client-side validation before making the API call
    if (!email.trim()) {
      setFieldError('Email address is required.');
      return;
    }
    if (!isValidEmail(email)) {
      setFieldError('Please enter a valid email address.');
      return;
    }
    setFieldError(null);

    setStep('loading');

    try {
      // TODO: BACKEND — requestPasswordReset wraps supabase.auth.resetPasswordForEmail()
      // When the backend adds custom logic, update src/api/passwordRecovery.ts
      await requestPasswordReset(email.trim().toLowerCase());

      // Always show success — even if the email isn't registered (security best practice)
      onEmailSent(email.trim().toLowerCase());
    } catch (err) {
      setStep('error');
      setError(getAuthErrorMessage(err));
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* API-level error (rate limit, network, etc.) */}
      {error && step === 'error' && (
        <div className="mn-alert-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div style={{ marginBottom: '1.5rem' }}>
        <label htmlFor="forgot-email" className="mn-label">
          Email address
        </label>
        <input
          id="forgot-email"
          type="email"
          className={`mn-input${fieldError ? ' mn-input-error' : ''}`}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (fieldError) setFieldError(null);
          }}
          onBlur={handleBlur}
          autoComplete="email"
          placeholder="you@example.com"
          required
          disabled={isLoading}
          aria-describedby={fieldError ? 'forgot-email-error' : undefined}
          aria-invalid={!!fieldError}
        />
        {fieldError && (
          <p id="forgot-email-error" className="mn-match-err" style={{ marginTop: '0.35rem' }}>
            {fieldError}
          </p>
        )}
      </div>

      <button
        type="submit"
        className="mn-btn-primary"
        disabled={isLoading || !email}
      >
        {isLoading ? 'Sending reset link…' : 'Send Reset Link'}
      </button>
    </form>
  );
}
