import { useState } from 'react';
import { updatePassword } from '../../api/passwordRecovery';
import { getAuthErrorMessage } from '../../utils/authErrors';
import PasswordStrengthMeter, { getPasswordStrength } from './PasswordStrengthMeter';

interface Props {
  onSuccess: () => void;
}

// ── Eye / EyeOff icons ────────────────────────────────────────────────────────

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function MatchOkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="2 6 5 9 10 3" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResetPasswordForm({ onSuccess }: Props) {
  const [password, setPassword]         = useState('');
  const [confirm, setConfirm]           = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const strength = getPasswordStrength(password);

  // Confirm-match state — only show the indicator once the user starts typing in the confirm field
  const confirmTouched = confirm.length > 0;
  const passwordsMatch = password === confirm;

  // ── Validation ────────────────────────────────────────────────
  const validate = (): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters.';
    }
    if (strength.score < 2) {
      return 'Password is too weak. Add uppercase letters, numbers, or special characters.';
    }
    if (!confirm) {
      return 'Please confirm your new password.';
    }
    if (!passwordsMatch) {
      return 'Passwords do not match.';
    }
    return null;
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      // TODO: BACKEND — updatePassword calls supabase.auth.updateUser({ password })
      // then signs out. When the backend adds audit logging, update src/api/passwordRecovery.ts
      await updatePassword(password);
      onSuccess();
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="mn-alert-error" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* ── New password ── */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label htmlFor="reset-password" className="mn-label">
          New password
        </label>
        <div className="mn-password-wrap">
          <input
            id="reset-password"
            type={showPassword ? 'text' : 'password'}
            className="mn-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder="••••••••"
            required
            disabled={loading}
            aria-describedby="reset-strength"
          />
          <button
            type="button"
            className="mn-password-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>

        {/* Password strength meter — auto-hides when field is empty */}
        <div id="reset-strength">
          <PasswordStrengthMeter password={password} />
        </div>
      </div>

      {/* ── Confirm password ── */}
      <div style={{ marginBottom: '1.75rem' }}>
        <label htmlFor="reset-confirm" className="mn-label">
          Confirm new password
        </label>
        <div className="mn-password-wrap">
          <input
            id="reset-confirm"
            type={showConfirm ? 'text' : 'password'}
            className="mn-input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            placeholder="••••••••"
            required
            disabled={loading}
            aria-describedby="confirm-match-status"
          />
          <button
            type="button"
            className="mn-password-toggle"
            onClick={() => setShowConfirm((v) => !v)}
            aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
            tabIndex={-1}
          >
            {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>

        {/* Confirm match indicator */}
        <div id="confirm-match-status" aria-live="polite">
          {confirmTouched && passwordsMatch && (
            <p className="mn-match-ok">
              <MatchOkIcon />
              Passwords match
            </p>
          )}
          {confirmTouched && !passwordsMatch && (
            <p className="mn-match-err">Passwords don't match</p>
          )}
        </div>
      </div>

      <button
        type="submit"
        className="mn-btn-primary"
        disabled={loading || !password || !confirm}
      >
        {loading ? 'Updating password…' : 'Set New Password'}
      </button>
    </form>
  );
}
