// Instructor self-service Earnings API — scoped to /api/instructor/earnings.
// Read-only — approve/hold/complete a payout stay admin-only.

import { getStoredInstructorToken } from './instructorAuth';
import type { MyEarningsSummary, ListMyPayoutsResult, PayoutStatus } from '../types/instructorEarnings';

const BASE = import.meta.env.VITE_INSTRUCTOR_API_BASE_URL2 ?? 'http://localhost:5001/api/instructor';

export class InstructorEarningsApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'InstructorEarningsApiError';
  }
}

async function earningsFetch<T>(path: string): Promise<T> {
  const token = getStoredInstructorToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });

  if (res.status === 401) throw new InstructorEarningsApiError(401, 'Your session has expired — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg = res.status === 429 ? 'Too many requests — slow down.' : json.message ?? `HTTP ${res.status}`;
    throw new InstructorEarningsApiError(res.status, msg);
  }

  return json.data as T;
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}`;
}

export function getMyEarningsSummary(): Promise<MyEarningsSummary> {
  return earningsFetch<MyEarningsSummary>('/earnings/summary');
}

export function listMyPayouts(params: { status?: PayoutStatus; page?: number; limit?: number } = {}): Promise<ListMyPayoutsResult> {
  return earningsFetch<ListMyPayoutsResult>(`/earnings/payouts${qs(params)}`);
}
