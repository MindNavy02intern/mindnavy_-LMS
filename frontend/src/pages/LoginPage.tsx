import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import LoginForm from '../components/auth/LoginForm';

export default function LoginPage() {
  const { user, enterDemoMode } = useAuth();
  const navigate = useNavigate();

  // If already authenticated (real or demo), skip the login page
  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  return (
    <div className="mn-auth-page">
      <div className="mn-auth-overlay" />

      <div className="mn-auth-card">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <img src="/brand/logowhite.png" alt="MindNavy" className="mn-auth-logo" />
          <p
            style={{
              marginTop: '1.1rem',
              marginBottom: 0,
              fontSize: '0.78rem',
              fontWeight: 600,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--mn-text-600)',
            }}
          >
            Learning Management System
          </p>
        </div>

        {/* Heading */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h1
            style={{
              fontSize: '1.3rem',
              fontWeight: 700,
              color: 'var(--mn-text-100)',
              margin: 0,
              marginBottom: '0.3rem',
            }}
          >
            Welcome back
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--mn-text-400)', margin: 0 }}>
            Sign in to continue to your workspace
          </p>
        </div>

        {/* Real Supabase login form */}
        <LoginForm onSuccess={() => navigate('/dashboard')} />

        {/*
         * DEV-ONLY: Demo Admin shortcut.
         * import.meta.env.DEV is statically false in production builds,
         * so Vite removes this entire block during `npm run build`.
         * Remove this section before going live if you want to be explicit.
         */}
        {import.meta.env.DEV && (
          <>
            <div className="mn-demo-sep">dev only</div>

            <button
              type="button"
              className="mn-btn-demo"
              onClick={enterDemoMode}
            >
              ⚡ Continue as Demo Admin
            </button>

            <p className="mn-demo-note">
              Mock session — no Supabase connection. Clears on tab close.
            </p>
          </>
        )}

        <hr className="mn-auth-divider" />

        <p style={{ textAlign: 'center', margin: 0, fontSize: '0.83rem', color: 'var(--mn-text-600)' }}>
          Don't have an account?{' '}
          <Link
            to="/signup"
            style={{
              color: 'var(--mn-blue-400)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
