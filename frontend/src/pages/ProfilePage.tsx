import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../layouts/AdminLayout';
import { useAuth } from '../AuthContext';
import { getStoredToken, apiChangePassword, apiMfaSetup, apiMfaVerify, apiMfaDisable } from '../api/adminAuth';

// Mirrors the inline checks in UserDetailsDrawer's reset-password form —
// no shared client-side password-policy util exists yet in this codebase.
function passwordStrengthError(pw: string): string | null {
  if (pw.length < 12) return 'Password must be at least 12 characters.';
  if (!/[A-Z]/.test(pw)) return 'Password must contain an uppercase letter.';
  if (!/[a-z]/.test(pw)) return 'Password must contain a lowercase letter.';
  if (!/[0-9]/.test(pw)) return 'Password must contain a number.';
  if (!/[@$!%*?&]/.test(pw)) return 'Password must contain a special character (@$!%*?&).';
  return null;
}

export default function ProfilePage() {
  const { user, profile, updateProfile, signOut, refreshUser } = useAuth();
  const navigate = useNavigate();

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

  // ── Edit Profile ──────────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(user?.fullName ?? user?.name ?? '');
  const [editPhone, setEditPhone] = useState(user?.phone ?? '');
  const [editBio, setEditBio] = useState(user?.bio ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const openEdit = () => {
    setEditName(user?.fullName ?? user?.name ?? '');
    setEditPhone(user?.phone ?? '');
    setEditBio(user?.bio ?? '');
    setProfileMsg(null);
    setEditOpen(true);
  };

  const handleSaveProfile = async () => {
    if (editName.trim().length < 2) {
      setProfileMsg({ type: 'error', text: 'Full name must be at least 2 characters.' });
      return;
    }
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      await updateProfile({ fullName: editName.trim(), phone: editPhone.trim() || null, bio: editBio.trim() || null });
      setProfileMsg({ type: 'success', text: 'Profile updated.' });
      setEditOpen(false);
    } catch (e) {
      setProfileMsg({ type: 'error', text: e instanceof Error ? e.message : 'Failed to update profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Change Password ───────────────────────────────────────────────────────
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const openPw = () => {
    setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwMsg(null);
    setPwOpen(true);
  };

  const handleChangePassword = async () => {
    setPwMsg(null);
    if (!currentPw) { setPwMsg({ type: 'error', text: 'Current password is required.' }); return; }
    const strengthError = passwordStrengthError(newPw);
    if (strengthError) { setPwMsg({ type: 'error', text: strengthError }); return; }
    if (newPw !== confirmPw) { setPwMsg({ type: 'error', text: 'Passwords do not match.' }); return; }

    setSavingPw(true);
    try {
      const token = getStoredToken();
      if (!token) throw new Error('Not authenticated.');
      const res = await apiChangePassword(token, currentPw, newPw);
      if (!res.success) throw new Error(res.message ?? 'Failed to change password.');
      // Backend revokes every AdminSession (including this one) on a password
      // change — same rule as an admin resetting a user's own password —
      // so the only correct next step is to sign out and log in again.
      await signOut();
      navigate('/login', { replace: true });
    } catch (e) {
      setPwMsg({ type: 'error', text: e instanceof Error ? e.message : 'Failed to change password.' });
      setSavingPw(false);
    }
  };

  // ── Two-Factor Authentication (TOTP) ─────────────────────────────────────
  const mfaEnabled = user?.mfaEnabled ?? false;
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; qrCodeDataUrl: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaPassword, setMfaPassword] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaMsg, setMfaMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const openMfa = async () => {
    setMfaMsg(null);
    setMfaCode('');
    setMfaPassword('');
    setMfaOpen(true);
    if (mfaEnabled) return; // disable flow just needs the password field
    setMfaBusy(true);
    try {
      const token = getStoredToken();
      if (!token) throw new Error('Not authenticated.');
      const res = await apiMfaSetup(token);
      setMfaSetup(res.data);
    } catch (e) {
      setMfaMsg({ type: 'error', text: e instanceof Error ? e.message : 'Failed to start MFA setup.' });
    } finally {
      setMfaBusy(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!mfaSetup) return;
    setMfaMsg(null);
    setMfaBusy(true);
    try {
      const token = getStoredToken();
      if (!token) throw new Error('Not authenticated.');
      const res = await apiMfaVerify(token, mfaSetup.secret, mfaCode.trim());
      if (!res.success) throw new Error(res.message ?? 'Verification failed.');
      await refreshUser();
      setMfaOpen(false);
      setMfaSetup(null);
      setMfaMsg({ type: 'success', text: 'Two-factor authentication is now enabled.' });
    } catch (e) {
      setMfaMsg({ type: 'error', text: e instanceof Error ? e.message : 'Invalid code. Please try again.' });
    } finally {
      setMfaBusy(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!mfaPassword) { setMfaMsg({ type: 'error', text: 'Enter your password to disable MFA.' }); return; }
    setMfaMsg(null);
    setMfaBusy(true);
    try {
      const token = getStoredToken();
      if (!token) throw new Error('Not authenticated.');
      const res = await apiMfaDisable(token, mfaPassword);
      if (!res.success) throw new Error(res.message ?? 'Failed to disable MFA.');
      await refreshUser();
      setMfaOpen(false);
      setMfaMsg({ type: 'success', text: 'Two-factor authentication has been disabled.' });
    } catch (e) {
      setMfaMsg({ type: 'error', text: e instanceof Error ? e.message : 'Failed to disable MFA.' });
    } finally {
      setMfaBusy(false);
    }
  };

  const CS_BTN: React.CSSProperties = {
    padding: '8px 18px', fontSize: '0.85rem', fontWeight: 600,
    border: '1px solid #e2e8f0', borderRadius: 6,
    background: '#f8fafc', color: '#94a3b8',
    cursor: 'not-allowed',
  };

  const ACT_BTN: React.CSSProperties = {
    padding: '8px 18px', fontSize: '0.85rem', fontWeight: 600,
    border: '1px solid #dbeafe', borderRadius: 6,
    background: '#eff6ff', color: '#2563eb',
    cursor: 'pointer',
  };

  const INPUT: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: '0.85rem',
    border: '1px solid #d1d5db', borderRadius: 6, fontFamily: 'inherit', outline: 'none',
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
                <button style={editOpen ? CS_BTN : ACT_BTN} disabled={editOpen} onClick={openEdit}>Edit Profile</button>
                <button style={pwOpen ? CS_BTN : ACT_BTN} disabled={pwOpen} onClick={openPw}>Change Password</button>
              </div>
            </div>

            {profileMsg && (
              <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, fontSize: '0.8rem', background: profileMsg.type === 'success' ? '#f0fdf4' : '#fef2f2', color: profileMsg.type === 'success' ? '#16a34a' : '#b91c1c' }}>
                {profileMsg.text}
              </div>
            )}

            {editOpen && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label htmlFor="profile-edit-name" style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Full Name</label>
                  <input id="profile-edit-name" value={editName} onChange={e => setEditName(e.target.value)} style={INPUT} />
                </div>
                <div>
                  <label htmlFor="profile-edit-phone" style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Phone</label>
                  <input id="profile-edit-phone" value={editPhone} onChange={e => setEditPhone(e.target.value)} style={INPUT} placeholder="Optional" />
                </div>
                <div>
                  <label htmlFor="profile-edit-bio" style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Bio</label>
                  <textarea id="profile-edit-bio" value={editBio} onChange={e => setEditBio(e.target.value)} rows={3} style={{ ...INPUT, resize: 'vertical' }} placeholder="Optional" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button onClick={() => setEditOpen(false)} disabled={savingProfile} style={{ padding: '7px 14px', fontSize: '0.8rem', fontFamily: 'inherit', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', color: '#374151' }}>Cancel</button>
                  <button onClick={handleSaveProfile} disabled={savingProfile} style={{ padding: '7px 14px', fontSize: '0.8rem', fontFamily: 'inherit', fontWeight: 600, background: savingProfile ? '#93c5fd' : '#2563eb', border: 'none', borderRadius: 6, cursor: savingProfile ? 'not-allowed' : 'pointer', color: '#fff' }}>
                    {savingProfile ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}
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
            <InfoField label="Phone"        value={user?.phone || '—'} />
            <InfoField label="Role"         value={roleLabel} />
            <InfoField label="Account ID"   value={user?.id ? user.id.slice(0, 8) + '…' : '—'} />
          </div>
          {user?.bio && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Bio</div>
              <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{user.bio}</div>
            </div>
          )}
        </div>

        {/* ── Security ── */}
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
            Security
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SecurityRow
              label="Two-Factor Authentication"
              description="Require a 6-digit authenticator app code at sign-in."
              badgeText={mfaOpen ? 'Managing…' : mfaEnabled ? 'Enabled' : 'Enable'}
              badgeBg={mfaEnabled ? '#f0fdf4' : '#eff6ff'}
              badgeColor={mfaEnabled ? '#16a34a' : '#1d4ed8'}
              disabled={mfaOpen}
              onClick={openMfa}
            />
            <SecurityRow
              label="Password"
              description="Change your account password."
              badgeText="Update"
              badgeBg="#eff6ff"
              badgeColor="#1d4ed8"
              onClick={openPw}
            />
          </div>

          {mfaMsg && (
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, fontSize: '0.8rem', background: mfaMsg.type === 'success' ? '#f0fdf4' : '#fef2f2', color: mfaMsg.type === 'success' ? '#16a34a' : '#b91c1c' }}>
              {mfaMsg.text}
            </div>
          )}

          {mfaOpen && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f8fafc', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {mfaEnabled ? (
                <>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#374151' }}>
                    Enter your password to disable two-factor authentication on this account.
                  </p>
                  <div>
                    <label htmlFor="mfa-disable-pw" style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Password</label>
                    <input id="mfa-disable-pw" type="password" value={mfaPassword} onChange={e => setMfaPassword(e.target.value)} style={INPUT} autoComplete="current-password" disabled={mfaBusy} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => setMfaOpen(false)} disabled={mfaBusy} style={{ padding: '7px 14px', fontSize: '0.8rem', fontFamily: 'inherit', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', color: '#374151' }}>Cancel</button>
                    <button onClick={handleDisableMfa} disabled={mfaBusy} style={{ padding: '7px 14px', fontSize: '0.8rem', fontFamily: 'inherit', fontWeight: 600, background: mfaBusy ? '#fca5a5' : '#dc2626', border: 'none', borderRadius: 6, cursor: mfaBusy ? 'not-allowed' : 'pointer', color: '#fff' }}>
                      {mfaBusy ? 'Disabling…' : 'Disable MFA'}
                    </button>
                  </div>
                </>
              ) : mfaBusy && !mfaSetup ? (
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#64748b' }}>Generating your setup code…</p>
              ) : mfaSetup ? (
                <>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#374151' }}>
                    Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.), then enter the 6-digit code it shows.
                  </p>
                  <img src={mfaSetup.qrCodeDataUrl} alt="MFA setup QR code" style={{ width: 160, height: 160, alignSelf: 'center' }} />
                  <div style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center', wordBreak: 'break-all' }}>
                    Can't scan? Enter manually: <span style={{ fontFamily: 'monospace', color: '#374151' }}>{mfaSetup.secret}</span>
                  </div>
                  <div>
                    <label htmlFor="mfa-verify-code" style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>6-digit code</label>
                    <input
                      id="mfa-verify-code" type="text" inputMode="numeric" maxLength={6}
                      value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      style={INPUT} placeholder="000000" disabled={mfaBusy}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button onClick={() => { setMfaOpen(false); setMfaSetup(null); }} disabled={mfaBusy} style={{ padding: '7px 14px', fontSize: '0.8rem', fontFamily: 'inherit', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', color: '#374151' }}>Cancel</button>
                    <button onClick={handleVerifyMfa} disabled={mfaBusy || mfaCode.length !== 6} style={{ padding: '7px 14px', fontSize: '0.8rem', fontFamily: 'inherit', fontWeight: 600, background: mfaBusy ? '#93c5fd' : '#2563eb', border: 'none', borderRadius: 6, cursor: mfaBusy ? 'not-allowed' : 'pointer', color: '#fff' }}>
                      {mfaBusy ? 'Verifying…' : 'Verify & Enable'}
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {pwMsg && (
            <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 6, fontSize: '0.8rem', background: pwMsg.type === 'success' ? '#f0fdf4' : '#fef2f2', color: pwMsg.type === 'success' ? '#16a34a' : '#b91c1c' }}>
              {pwMsg.text}
            </div>
          )}

          {pwOpen && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f8fafc', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label htmlFor="profile-pw-current" style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Current Password</label>
                <input id="profile-pw-current" type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} style={INPUT} autoComplete="current-password" />
              </div>
              <div>
                <label htmlFor="profile-pw-new" style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>New Password</label>
                <input id="profile-pw-new" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} style={INPUT} autoComplete="new-password" placeholder="12+ chars, upper, lower, number, special" />
              </div>
              <div>
                <label htmlFor="profile-pw-confirm" style={{ display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>Confirm New Password</label>
                <input id="profile-pw-confirm" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} style={INPUT} autoComplete="new-password" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setPwOpen(false)} disabled={savingPw} style={{ padding: '7px 14px', fontSize: '0.8rem', fontFamily: 'inherit', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, cursor: 'pointer', color: '#374151' }}>Cancel</button>
                <button onClick={handleChangePassword} disabled={savingPw} style={{ padding: '7px 14px', fontSize: '0.8rem', fontFamily: 'inherit', fontWeight: 600, background: savingPw ? '#93c5fd' : '#2563eb', border: 'none', borderRadius: 6, cursor: savingPw ? 'not-allowed' : 'pointer', color: '#fff' }}>
                  {savingPw ? 'Changing…' : 'Change Password'}
                </button>
              </div>
            </div>
          )}
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

function SecurityRow({ label, description, badgeText, badgeBg, badgeColor, disabled, onClick }: {
  label:       string;
  description: string;
  badgeText:   string;
  badgeBg:     string;
  badgeColor:  string;
  disabled?:   boolean;
  onClick?:    () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f8fafc', gap: 12 }}>
      <div>
        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{description}</div>
      </div>
      <button
        disabled={disabled}
        onClick={onClick}
        title={disabled ? 'Coming soon' : badgeText}
        style={{ padding: '4px 12px', fontSize: '0.75rem', fontWeight: 600, background: badgeBg, color: badgeColor, border: 'none', borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0 }}
      >
        {badgeText}
      </button>
    </div>
  );
}
