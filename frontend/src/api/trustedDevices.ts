// ─────────────────────────────────────────────────────────────────────────────
// Trusted Device API — mock layer for frontend development
//
// Every function in this file has a "TODO: BACKEND" comment that shows exactly
// which Express endpoint to call and what the request/response shape will be.
// When the backend is ready:
//   1. Remove the `MOCK_*` constants and the `delay()` helper.
//   2. Uncomment the real `fetch` calls.
//   3. Add the Supabase session token to the Authorization header.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  TrustedDevice,
  SendOtpRequest,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from '../types/device';

// ── Mock helpers ──────────────────────────────────────────────────────────────

/** Simulates a network round-trip in dev so loading states are visible */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Realistic mock devices — replace with real API data when backend is ready */
const MOCK_DEVICES: TrustedDevice[] = [
  {
    id: 'dev-001',
    userId: 'mock-user',
    deviceName: 'Chrome on Windows',
    platform: 'windows',
    browser: 'Chrome 124',
    ipAddress: '192.168.1.105',
    location: 'Riyadh, SA',
    lastSeenAt: new Date().toISOString(),
    trustedAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    isCurrent: true,
    status: 'trusted',
  },
  {
    id: 'dev-002',
    userId: 'mock-user',
    deviceName: 'Safari on iPhone',
    platform: 'ios',
    browser: 'Safari 17',
    ipAddress: '192.168.1.110',
    location: 'Riyadh, SA',
    lastSeenAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    trustedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
    isCurrent: false,
    status: 'trusted',
  },
  {
    id: 'dev-003',
    userId: 'mock-user',
    deviceName: 'Firefox on macOS',
    platform: 'macos',
    browser: 'Firefox 126',
    ipAddress: '10.0.0.45',
    location: 'Jeddah, SA',
    lastSeenAt: new Date(Date.now() - 14 * 86_400_000).toISOString(),
    trustedAt: new Date(Date.now() - 60 * 86_400_000).toISOString(),
    isCurrent: false,
    status: 'trusted',
  },
  {
    id: 'dev-004',
    userId: 'mock-user',
    deviceName: 'Chrome on Android',
    platform: 'android',
    browser: 'Chrome Mobile 124',
    ipAddress: '172.16.0.88',
    location: 'Dubai, AE',
    lastSeenAt: new Date(Date.now() - 45 * 86_400_000).toISOString(),
    trustedAt: new Date(Date.now() - 90 * 86_400_000).toISOString(),
    isCurrent: false,
    status: 'trusted',
  },
];

// In-memory copy so revoke mutations persist during the session
let mockDeviceStore: TrustedDevice[] = [...MOCK_DEVICES];

// ── API functions ─────────────────────────────────────────────────────────────

/**
 * Fetch all trusted devices for the current user.
 *
 * TODO: BACKEND → GET /api/devices
 * Headers: { Authorization: `Bearer ${supabaseAccessToken}` }
 * Response: TrustedDevice[]
 */
export async function getTrustedDevices(): Promise<TrustedDevice[]> {
  await delay(900);
  return [...mockDeviceStore];
}

/**
 * Revoke (remove) a trusted device by ID.
 * After this call the device will need OTP verification on next login.
 *
 * TODO: BACKEND → DELETE /api/devices/:deviceId
 * Headers: { Authorization: `Bearer ${supabaseAccessToken}` }
 * Response: { success: true }
 */
export async function revokeDevice(deviceId: string): Promise<void> {
  await delay(700);
  mockDeviceStore = mockDeviceStore.filter((d) => d.id !== deviceId);
  console.info('[MOCK] Device revoked:', deviceId);
}

/**
 * Ask the backend to send an OTP email to the given address.
 * Call this when a login is detected on an unrecognized device.
 *
 * TODO: BACKEND → POST /api/auth/otp/send
 * Body: SendOtpRequest
 * Response: { success: true }
 */
export async function sendOtp(request: SendOtpRequest): Promise<void> {
  await delay(1_000);
  console.info('[MOCK] OTP dispatched to:', request.email);
}

/**
 * Verify the OTP code the user typed.
 * If `trustDevice` is true, the backend will save this device as trusted.
 *
 * TODO: BACKEND → POST /api/auth/otp/verify
 * Body: VerifyOtpRequest
 * Response: VerifyOtpResponse
 *
 * Mock rule: code "123456" always succeeds; any other code fails.
 */
export async function verifyOtp(
  request: VerifyOtpRequest,
): Promise<VerifyOtpResponse> {
  await delay(1_400);

  if (request.code === '123456') {
    if (request.trustDevice) {
      console.info('[MOCK] Device marked as trusted.');
    }
    return { success: true, message: 'Identity verified. Device confirmed.' };
  }

  return {
    success: false,
    message: 'Incorrect or expired code. Please try again.',
  };
}
