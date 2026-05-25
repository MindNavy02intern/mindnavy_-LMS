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
 * A single trusted device record as returned by GET /trusted-devices.
 */
export interface TrustedDevice {
  id: string;
  deviceName: string;
  ipAddress: string | null;
  userAgent: string | null;
  trustedAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  createdAt: string;
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
