import { useState } from 'react';
import { useInstructorAuth } from '../../context/InstructorAuthContext';

interface Props {
  onSuccess: () => void;
}

// Mirrors components/auth/LoginForm.tsx — same field/error/loading pattern,
// no MFA step (instructor MFA is an unbuilt Phase-2+ item, see blueprint
// Appendix A #16).
export default function InstructorLoginForm({ onSuccess }: Props) {
  const { login } = useInstructorAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <div className="mn-alert-error">{error}</div>}

      <div style={{ marginBottom: '1rem' }}>
        <label htmlFor="instructor-login-email" className="mn-label">
          Email address
        </label>
        <input
          id="instructor-login-email"
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
        <label htmlFor="instructor-login-password" className="mn-label">
          Password
        </label>
        <input
          id="instructor-login-password"
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
