import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import SignupForm from '../components/auth/SignupForm';

export default function SignupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  // Post-signup: ask user to check their email
  if (submitted) {
    return (
      <div className="mn-auth-page">
        <div className="mn-auth-overlay" />
        <div className="mn-auth-card" style={{ textAlign: 'center' }}>
          <img
            src="/brand/logowhite.png"
            alt="MindNavy"
            className="mn-auth-logo"
            style={{ marginBottom: '1.5rem' }}
          />

          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--mn-teal-glow)',
              border: '1px solid rgba(6,182,212,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--mn-teal-400)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>

          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--mn-text-100)', marginBottom: '0.5rem' }}>
            Check your email
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--mn-text-400)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            We sent a confirmation link to your email address.<br />
            Click it to activate your account, then sign in.
          </p>

          <Link
            to="/login"
            style={{
              display: 'inline-block',
              padding: '0.62rem 1.5rem',
              background: 'var(--mn-blue-glow)',
              border: '1px solid rgba(14,165,233,0.2)',
              borderRadius: 'var(--mn-r-sm)',
              color: 'var(--mn-blue-400)',
              fontWeight: 600,
              fontSize: '0.88rem',
              textDecoration: 'none',
              transition: 'var(--mn-t)',
            }}
          >
            Go to Sign In
          </Link>
        </div>
      </div>
    );
  }

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
            Create your account
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--mn-text-400)', margin: 0 }}>
            Join MindNavy LMS and start learning today
          </p>
        </div>

        <SignupForm onSuccess={() => setSubmitted(true)} />

        <hr className="mn-auth-divider" />

        <p style={{ textAlign: 'center', margin: 0, fontSize: '0.83rem', color: 'var(--mn-text-600)' }}>
          Already have an account?{' '}
          <Link
            to="/login"
            style={{
              color: 'var(--mn-blue-400)',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
