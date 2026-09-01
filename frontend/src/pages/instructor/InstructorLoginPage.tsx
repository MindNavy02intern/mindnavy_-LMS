import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInstructorAuth } from '../../context/InstructorAuthContext';
import InstructorLoginForm from '../../components/auth/InstructorLoginForm';

// Mirrors pages/LoginPage.tsx's visual shell exactly (same mn-auth-* classes
// from brand.css) — separate route/audience from the admin login, per
// Section 1.3 of INSTRUCTOR_DASHBOARD_BLUEPRINT.docx: different form, does
// not share state with AuthContext.
export default function InstructorLoginPage() {
  const { instructor } = useInstructorAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (instructor) navigate('/instructor/dashboard', { replace: true });
  }, [instructor, navigate]);

  return (
    <div className="mn-auth-page">
      <div className="mn-auth-overlay" />

      <div className="mn-auth-card">
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
            Instructor Portal
          </p>
        </div>

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
            Sign in to manage your courses
          </p>
        </div>

        <InstructorLoginForm onSuccess={() => navigate('/instructor/dashboard')} />
      </div>
    </div>
  );
}
