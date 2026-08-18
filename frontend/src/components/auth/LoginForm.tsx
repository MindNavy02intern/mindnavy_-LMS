import { useState } from 'react';
import { useAuth } from '../../AuthContext';

interface Props {
  onSuccess: () => void;
}

export default function LoginForm({ onSuccess }: Props) {
  const { login, completeMfaLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Set once a password check succeeds and the admin has TOTP MFA enabled —
  // switches the form to the 6-digit code step instead of navigating in.
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result.mfaRequired && result.mfaToken) {
        setMfaToken(result.mfaToken);
        return;
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!mfaToken) return;
    setError(null);
    setLoading(true);
    try {
      await completeMfaLogin(mfaToken, mfaCode.trim());
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (mfaToken) {
    return (
      <form onSubmit={handleMfaSubmit} noValidate>
        {error && <div className="mn-alert-error">{error}</div>}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="mfa-code" className="mn-label">
            Authenticator code
          </label>
          <p style={{ fontSize: '0.78rem', color: 'var(--mn-text-600)', margin: '0 0 0.5rem' }}>
            Enter the 6-digit code from your authenticator app.
          </p>
          <input
            id="mfa-code"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            className="mn-input"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoComplete="one-time-code"
            placeholder="000000"
            required
            autoFocus
            disabled={loading}
          />
        </div>
        <button type="submit" className="mn-btn-primary" disabled={loading || mfaCode.length !== 6}>
          {loading ? 'Verifying…' : 'Verify & Sign In'}
        </button>
        <button
          type="button"
          onClick={() => { setMfaToken(null); setMfaCode(''); setError(null); }}
          style={{ display: 'block', width: '100%', marginTop: '0.75rem', background: 'none', border: 'none', color: 'var(--mn-text-600)', fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Back to sign in
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <div className="mn-alert-error">{error}</div>}

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="login-email" className="mn-label">
          Email address
        </label>
        <input
          id="login-email"
          type="email"
          className="mn-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          required
          disabled={loading}
        />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <label htmlFor="login-password" className="mn-label" style={{ margin: 0 }}>
            Password
          </label>
          <a
            href="/forgot-password"
            style={{
              fontSize: '0.75rem',
              color: 'var(--mn-blue-400)',
              textDecoration: 'none',
              fontWeight: 500,
            }}
          >
            Forgot password?
          </a>
        </div>
        <input
          id="login-password"
          type="password"
          className="mn-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="••••••••"
          required
          disabled={loading}
        />
      </div>

      <button type="submit" className="mn-btn-primary" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  );
}
