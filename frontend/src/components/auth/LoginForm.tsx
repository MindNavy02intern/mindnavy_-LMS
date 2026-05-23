import { useState } from 'react';
import { supabase } from '../../supabase';
import { getAuthErrorMessage } from '../../utils/authErrors';

interface Props {
  onSuccess: () => void;
}

export default function LoginForm({ onSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw authError;
      onSuccess();
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

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
