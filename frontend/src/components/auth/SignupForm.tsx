import { useState } from 'react';
import { supabase } from '../../supabase';
import { getAuthErrorMessage } from '../../utils/authErrors';

interface Props {
  onSuccess: () => void;
}

export default function SignupForm({ onSuccess }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
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
        <label htmlFor="signup-name" className="mn-label">
          Full name
        </label>
        <input
          id="signup-name"
          type="text"
          className="mn-input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          placeholder="John Doe"
          required
          disabled={loading}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="signup-email" className="mn-label">
          Email address
        </label>
        <input
          id="signup-email"
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
        <label htmlFor="signup-password" className="mn-label">
          Password
        </label>
        <input
          id="signup-password"
          type="password"
          className="mn-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          placeholder="••••••••"
          minLength={6}
          required
          disabled={loading}
        />
        <p className="mn-input-hint">Must be at least 6 characters.</p>
      </div>

      <button type="submit" className="mn-btn-primary" disabled={loading}>
        {loading ? 'Creating account…' : 'Create Account'}
      </button>
    </form>
  );
}
