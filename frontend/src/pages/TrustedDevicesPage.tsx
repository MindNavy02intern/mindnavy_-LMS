import { useEffect, useState } from 'react';
import AdminLayout from '../layouts/AdminLayout';
import OtpVerificationModal from '../components/auth/OtpVerificationModal';
import { getTrustedDevices, revokeDevice } from '../api/trustedDevices';
import { useAuth } from '../AuthContext';
import type { TrustedDevice, DevicePlatform } from '../types/device';

// ── Platform SVG icons ────────────────────────────────────────────────────────

function IconWindows() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 5.5L10.5 4.5V11.5H3V5.5Z" />
      <path d="M11.5 4.35L21 3V11.5H11.5V4.35Z" />
      <path d="M3 12.5H10.5V19.5L3 18.5V12.5Z" />
      <path d="M11.5 12.5H21V21L11.5 19.65V12.5Z" />
    </svg>
  );
}

function IconApple() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  );
}

function IconAndroid() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24C14.68 8.13 13.38 7.8 12 7.8s-2.68.33-3.46.91L6.65 5.47a.64.64 0 0 0-.83-.22.64.64 0 0 0-.26.85l1.84 3.18C4.7 11.25 3.8 14.44 4 18h16c.2-3.56-.7-6.75-2.4-8.52zM8.5 14.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z" />
    </svg>
  );
}

function IconLinux() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C9.8 2 8 4.8 8 8c0 1.7.5 3.2 1.3 4.3-.5.8-1.8 1.4-2.3 2.7-.5 1.3.1 2.8 1.4 3.5.4.2.8.4 1.3.5-.1.4-.2.8-.2 1.2 0 1 .5 1.8 1.5 1.8s1.5-.8 1.5-1.8c0-.1 0-.3-.1-.4.3 0 .5.1.8.1s.5 0 .8-.1c-.1.1-.1.3-.1.4 0 1 .5 1.8 1.5 1.8s1.5-.8 1.5-1.8c0-.4-.1-.8-.2-1.2.5-.1.9-.3 1.3-.5 1.3-.7 1.9-2.2 1.4-3.5-.5-1.3-1.8-1.9-2.3-2.7C15.5 11.2 16 9.7 16 8c0-3.2-1.8-6-4-6z" />
    </svg>
  );
}

function IconMonitor() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  );
}

function PlatformIcon({ platform }: { platform: DevicePlatform }) {
  switch (platform) {
    case 'windows': return <IconWindows />;
    case 'macos':   return <IconApple />;
    case 'ios':     return <IconPhone />;
    case 'android': return <IconAndroid />;
    case 'linux':   return <IconLinux />;
    default:        return <IconMonitor />;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m  = Math.floor(diff / 60_000);
  const h  = Math.floor(m / 60);
  const d  = Math.floor(h / 24);
  const mo = Math.floor(d / 30);
  if (m < 1)   return 'just now';
  if (m < 60)  return `${m}m ago`;
  if (h < 24)  return `${h}h ago`;
  if (d === 1) return 'yesterday';
  if (d < 30)  return `${d}d ago`;
  return `${mo}mo ago`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface DeviceCardProps {
  device: TrustedDevice;
  onRevoke: (id: string) => void;
  isRevoking: boolean;
}

function DeviceCard({ device, onRevoke, isRevoking }: DeviceCardProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className={`mn-device-card${device.isCurrent ? ' current-device' : ''}`}>
      {/* Platform icon */}
      <div className="mn-device-icon-wrap">
        <PlatformIcon platform={device.platform} />
      </div>

      {/* Device info */}
      <div>
        <div className="mn-device-name">
          {device.deviceName}
          {device.isCurrent && (
            <span className="mn-badge current">This device</span>
          )}
        </div>
        <div className="mn-device-meta">
          <span>{device.browser}</span>
          {' · '}
          <span>{device.ipAddress}</span>
          {device.location && <span>{' · '}{device.location}</span>}
          <br />
          <span>Last seen {formatRelative(device.lastSeenAt)}</span>
          {' · '}
          <span>Trusted {formatDate(device.trustedAt)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="mn-device-actions">
        {device.isCurrent ? (
          <span
            style={{
              fontSize: '0.72rem',
              color: 'var(--mn-text-800)',
              whiteSpace: 'nowrap',
            }}
          >
            Current session
          </span>
        ) : confirming ? (
          <div className="mn-confirm-row">
            <span className="mn-confirm-label">Remove this device?</span>
            <div className="mn-confirm-btns">
              <button
                className="mn-btn-danger"
                onClick={() => { onRevoke(device.id); setConfirming(false); }}
                disabled={isRevoking}
              >
                {isRevoking ? 'Removing…' : 'Yes, remove'}
              </button>
              <button
                className="mn-btn-ghost"
                style={{ fontSize: '0.76rem', padding: '0.33rem 0.7rem' }}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="mn-btn-danger"
            onClick={() => setConfirming(true)}
            disabled={isRevoking}
          >
            Revoke
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TrustedDevicesPage() {
  const { user } = useAuth();

  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // OTP modal state (for the "Test OTP flow" demo button in DEV mode)
  const [otpOpen, setOtpOpen] = useState(false);

  // ── Fetch devices on mount ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoadingDevices(true);
      setLoadError(null);
      try {
        // TODO: BACKEND — pass real userId once API is connected
        const data = await getTrustedDevices();
        if (!cancelled) setDevices(data);
      } catch {
        if (!cancelled) setLoadError('Could not load trusted devices. Please try again.');
      } finally {
        if (!cancelled) setLoadingDevices(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // ── Revoke a device ─────────────────────────────────────────
  const handleRevoke = async (deviceId: string) => {
    setRevokingId(deviceId);
    try {
      // TODO: BACKEND — call real DELETE /api/devices/:deviceId
      await revokeDevice(deviceId);
      setDevices((prev) => prev.filter((d) => d.id !== deviceId));
    } catch {
      // A real implementation would show a toast error here
      alert('Failed to revoke device. Please try again.');
    } finally {
      setRevokingId(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────

  const trustedCount = devices.filter((d) => d.status === 'trusted').length;

  return (
    <AdminLayout pageTitle="Trusted Devices">

      {/* Page header */}
      <div className="mn-page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="mn-page-title">Trusted Devices</h1>
          <p className="mn-page-desc">
            Devices that can access your account without OTP verification.
            Revoke any device you don't recognise.
          </p>
        </div>

        {/*
         * DEV-ONLY: Demo button to open the OTP modal without going through login.
         * Remove this block before shipping to production.
         */}
        {import.meta.env.DEV && (
          <button
            className="mn-btn-outline"
            style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}
            onClick={() => setOtpOpen(true)}
          >
            ⚡ Test OTP flow
          </button>
        )}
      </div>

      {/* Info banner explaining the feature */}
      <div className="mn-info-banner">
        When you log in from a new device, you will be asked to enter a one-time
        code sent to your email. Checking <strong>"Trust this device"</strong> skips
        that check for 30 days on the same device.
      </div>

      {/* Device list */}
      {loadingDevices && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
          <div className="mn-spinner" />
        </div>
      )}

      {loadError && !loadingDevices && (
        <div className="mn-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#fca5a5', marginBottom: '1rem' }}>{loadError}</p>
          <button
            className="mn-btn-outline"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      )}

      {!loadingDevices && !loadError && devices.length === 0 && (
        <div className="mn-card">
          <div className="mn-empty">
            <div className="mn-empty-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <p className="mn-empty-title">No trusted devices</p>
            <p className="mn-empty-desc">
              You haven't trusted any devices yet. Enable "Trust this device"
              during your next login to add one.
            </p>
          </div>
        </div>
      )}

      {!loadingDevices && !loadError && devices.length > 0 && (
        <>
          <p style={{ fontSize: '0.8rem', color: 'var(--mn-text-600)', marginBottom: '0.75rem' }}>
            {trustedCount} trusted {trustedCount === 1 ? 'device' : 'devices'}
          </p>
          <div className="mn-device-list">
            {devices.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                onRevoke={handleRevoke}
                isRevoking={revokingId === device.id}
              />
            ))}
          </div>
        </>
      )}

      {/* OTP Verification Modal (demo trigger in DEV mode, real trigger from backend in PROD) */}
      <OtpVerificationModal
        isOpen={otpOpen}
        onClose={() => setOtpOpen(false)}
        onSuccess={() => {
          setOtpOpen(false);
          // TODO: BACKEND — after successful OTP, refresh device list to show newly trusted device
          getTrustedDevices().then(setDevices).catch(() => null);
        }}
        email={user?.email ?? 'your email'}
      />

    </AdminLayout>
  );
}
