// ─────────────────────────────────────────────────────────────────────────────
// Trusted Device Verification System — TypeScript types
// These types mirror what the backend API will return.
// Update this file when the backend contract is finalized.
// ─────────────────────────────────────────────────────────────────────────────

/** Whether a device entry is currently trusted, awaiting OTP, or revoked */
export type DeviceStatus = 'trusted' | 'pending' | 'revoked';

/** OS / platform of the trusted device */
export type DevicePlatform =
  | 'windows'
  | 'macos'
  | 'linux'
  | 'ios'
  | 'android'
  | 'unknown';

/**
 * A single trusted device record returned by the backend.
 * Stored in the `trusted_devices` table on the server.
 */
export interface TrustedDevice {
  /** Unique device record ID (UUID from the backend) */
  id: string;
  /** The user this device belongs to */
  userId: string;
  /** Human-readable label, e.g. "Chrome on Windows" */
  deviceName: string;
  platform: DevicePlatform;
  /** Browser name and version, e.g. "Chrome 124" */
  browser: string;
  /** IP address of the device when it was last seen */
  ipAddress: string;
  /** Approximate location derived from IP, e.g. "Riyadh, SA" — null if unavailable */
  location: string | null;
  /** ISO 8601 — when was this device last used to log in */
  lastSeenAt: string;
  /** ISO 8601 — when the user first marked this device as trusted */
  trustedAt: string;
  /** True if this record represents the device making the current HTTP request */
  isCurrent: boolean;
  status: DeviceStatus;
}

// ── OTP verification ──────────────────────────────────────────────────────────

/** All possible states of the OTP input UI */
export type OtpStatus = 'idle' | 'loading' | 'error' | 'success';

/** Props expected by OtpVerificationModal */
export interface OtpVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after the OTP has been accepted and the device is verified */
  onSuccess: () => void;
  /** The email address the OTP code is sent to */
  email: string;
}

/** Payload sent to POST /api/auth/otp/send */
export interface SendOtpRequest {
  email: string;
}

/** Payload sent to POST /api/auth/otp/verify */
export interface VerifyOtpRequest {
  /** 6-digit code the user typed */
  code: string;
  /** Whether to save this device as trusted for future logins */
  trustDevice: boolean;
}

/** Shape of the response from POST /api/auth/otp/verify */
export interface VerifyOtpResponse {
  success: boolean;
  /** User-facing message — shown directly in the UI */
  message: string;
}

/** Payload sent to DELETE /api/devices/:deviceId */
export interface RevokeDeviceRequest {
  deviceId: string;
}
