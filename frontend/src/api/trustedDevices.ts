import type {
  TrustedDevice,
  SendOtpRequest,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from '../types/device';
import { apiSendOtp, apiVerifyOtp, getStoredToken } from './adminAuth';
import { fetchWithRetry } from '../lib/fetchWithRetry';

const ADMIN_API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

function authHeaders(): Record<string, string> {
  const token = getStoredToken() ?? '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetchWithRetry(`${ADMIN_API}${path}`, {
    headers: authHeaders(),
    ...options,
    // Merge headers so authHeaders() is always present but options.headers can extend
    ...(options.headers ? { headers: { ...authHeaders(), ...options.headers } } : {}),
  });
  const body = await res.json().catch(() => ({ message: 'Request failed' }));
  if (!res.ok) throw new Error((body as { message?: string }).message ?? 'Request failed');
  return body as T;
}

export async function getTrustedDevices(): Promise<TrustedDevice[]> {
  const res = await apiCall<{ success: boolean; devices: TrustedDevice[] }>('/trusted-devices');
  return res.devices ?? [];
}

export async function revokeDevice(deviceId: string): Promise<void> {
  await apiCall(`/trusted-devices/${deviceId}`, { method: 'DELETE' });
}

export async function sendOtp(request: SendOtpRequest): Promise<void> {
  const token = getStoredToken() ?? '';
  await apiSendOtp(request.email, token);
}

export async function verifyOtp(request: VerifyOtpRequest): Promise<VerifyOtpResponse> {
  const token = getStoredToken() ?? '';
  return apiVerifyOtp(request.code, request.trustDevice, token);
}
