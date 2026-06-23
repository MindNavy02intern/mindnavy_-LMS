import { useEffect } from 'react';
import AdminLayout from '../layouts/AdminLayout';
import { useAuth } from '../AuthContext';

export default function ProfilePage() {
  const { user, profile } = useAuth();

  const displayName = profile?.full_name ?? user?.fullName ?? user?.name ?? 'Admin';
  const email       = user?.email ?? '—';
  const roleLabel   = profile?.role ?? user?.role ?? 'Administrator';

  const initials = displayName
    .split(' ')
    .map((w: string) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  useEffect(() => { document.title = 'Profile — MindNavy'; }, []);

  const CS_BTN: React.CSSProperties = {
    padding: '8px 18px', fontSize: '0.85rem', fontWeight: 600,
    border: '1px solid #e2e8f0', borderRadius: 6,
    background: '#f8fafc', color: '#94a3b8',
    cursor: 'not-allowed',
  };

  return (
    <AdminLayout pageTitle="Profile">
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>My Profile</h1>
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '4px 0 0' }}>View and manage your account information.</p>
        </div>

        {/* ── Profile card ── */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>

          {/* Cover banner */}
          <div style={{ height: 80, background: 'linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)' }} />

          {/* Avatar + name row */}
          <div style={{ padding: '0 24px 24px', marginTop: -32 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'linear-gradient(135deg, #2563eb, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.4rem', fontWeight: 700, color: '#fff',
              border: '3px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              marginBottom: 12,
            }}>
              {initials}
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: '0 0 4px' }}>{displayName}</h2>
                <span style={{
                  fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                  background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: 10,
                }}>
                  {roleLabel}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={CS_BTN} disabled title="Coming Soon">Edit Profile</button>
                <button style={CS_BTN} disabled title="Coming Soon">Change Password</button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Info fields ── */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24, marginBottom: 16 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
            Account Information
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            <InfoField label="Full Name"    value={displayName} />
            <InfoField label="Email"        value={email} />
            <InfoField label="Role"         value={roleLabel} />
            <InfoField label="Account ID"   value={user?.id ? user.id.slice(0, 8) + '…' : '—'} />
          </div>
        </div>

        {/* ── Security ── */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
            Security
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SecurityRow
              label="Two-Factor Authentication"
              description="Add an extra layer of security to your account."
              badgeText="Not Enabled"
              badgeBg="#fef3c7"
              badgeColor="#92400e"
            />
            <SecurityRow
              label="Password"
              description="Last changed: unknown."
              badgeText="Update"
              badgeBg="#eff6ff"
              badgeColor="#1d4ed8"
              disabled
            />
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function SecurityRow({ label, description, badgeText, badgeBg, badgeColor, disabled }: {
  label:       string;
  description: string;
  badgeText:   string;
  badgeBg:     string;
  badgeColor:  string;
  disabled?:   boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f8fafc', gap: 12 }}>
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{description}</div>
      </div>
      <button disabled={disabled ?? true} title="Coming Soon"
        style={{ padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600, background: badgeBg, color: badgeColor, border: 'none', borderRadius: 8, cursor: 'not-allowed', flexShrink: 0 }}>
        {badgeText}
      </button>
    </div>
  );
}
