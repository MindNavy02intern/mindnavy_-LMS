import type {
  UsersResponse,
  UserDetailsResponse,
  CreateUserRequest,
  UpdateUserRequest,
  SuspendUserRequest,
  AssignRoleRequest,
  ActionResponse,
  AnalyticsResponse,
} from '../types/users';
import { getStoredToken } from './adminAuth';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

export interface UsersParams {
  page?:       number;
  limit?:      number;
  search?:     string;
  role?:       string;
  department?: string;
  status?:     string;
}

// TODO: REMOVE — temporary mock data while backend 500 is being fixed
const USERS_MOCK: UsersResponse = {
  kpiSummary: {
    totalUsers:                1284,
    totalUsersChange:          12.5,
    activeUsers:               1049,
    activeUsersChange:         8.2,
    pendingVerification:       73,
    pendingVerificationChange: -3.1,
    suspendedUsers:            12,
    suspendedUsersChange:      5.4,
    invitationsPending:        45,
    invitationsPendingChange:  7.8,
  },
  users: [
    { id: '1', fullName: 'John Doe',       email: 'john.doe@example.com',       avatar: null, role: 'Administrator',  phone: null, department: 'IT Department',      branch: 'Head Office', status: 'active',    verificationState: 'verified', lastActivityAt: new Date(Date.now() - 2 * 60_000).toISOString(),         riskScore: null, enrollmentCount: 4, createdAt: '2024-01-15T00:00:00.000Z' },
    { id: '2', fullName: 'Sarah Wilson',   email: 'sarah.wilson@example.com',   avatar: null, role: 'Instructor',     phone: null, department: 'Data Science',       branch: null,          status: 'active',    verificationState: 'verified', lastActivityAt: new Date(Date.now() - 15 * 60_000).toISOString(),        riskScore: null, enrollmentCount: 0, createdAt: '2024-02-20T00:00:00.000Z' },
    { id: '3', fullName: 'Mike Johnson',   email: 'mike.johnson@example.com',   avatar: null, role: 'Student',        phone: null, department: 'Marketing',          branch: null,          status: 'active',    verificationState: 'verified', lastActivityAt: new Date(Date.now() - 60 * 60_000).toISOString(),        riskScore: null, enrollmentCount: 3, createdAt: '2024-03-10T00:00:00.000Z' },
    { id: '4', fullName: 'Emily Davis',    email: 'emily.davis@example.com',    avatar: null, role: 'HR Manager',     phone: null, department: 'HR Department',      branch: null,          status: 'active',    verificationState: 'verified', lastActivityAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),   riskScore: null, enrollmentCount: 2, createdAt: '2024-04-05T00:00:00.000Z' },
    { id: '5', fullName: 'David Brown',    email: 'david.brown@example.com',    avatar: null, role: 'Finance Manager', phone: null, department: 'Finance Department', branch: null,          status: 'suspended', verificationState: 'verified', lastActivityAt: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),  riskScore: null, enrollmentCount: 1, createdAt: '2024-05-15T00:00:00.000Z' },
    { id: '6', fullName: 'Lisa Anderson', email: 'lisa.anderson@example.com',  avatar: null, role: 'Student',        phone: null, department: 'Data Science',       branch: null,          status: 'pending',   verificationState: 'pending',  lastActivityAt: null,                                                    riskScore: null, enrollmentCount: 0, createdAt: '2024-06-01T00:00:00.000Z' },
    { id: '7', fullName: 'Robert Taylor', email: 'robert.taylor@example.com',  avatar: null, role: 'Branch Manager', phone: null, department: 'New York Branch',    branch: 'New York',    status: 'active',    verificationState: 'verified', lastActivityAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),   riskScore: null, enrollmentCount: 2, createdAt: '2024-07-20T00:00:00.000Z' },
    { id: '8', fullName: 'Priya Sharma',  email: 'priya.sharma@example.com',   avatar: null, role: 'Instructor',     phone: null, department: 'Cyber Security',     branch: null,          status: 'active',    verificationState: 'verified', lastActivityAt: new Date(Date.now() - 5 * 60_000).toISOString(),         riskScore: null, enrollmentCount: 0, createdAt: '2024-08-10T00:00:00.000Z' },
  ],
  pagination: { page: 1, limit: 10, total: 1284, totalPages: 129 },
};

export async function getUsers(params: UsersParams = {}): Promise<UsersResponse> {
  const token = getStoredToken();
  const qs = new URLSearchParams();
  if (params.page       !== undefined) qs.set('page',       String(params.page));
  if (params.limit      !== undefined) qs.set('limit',      String(params.limit));
  if (params.search)                   qs.set('search',     params.search);
  if (params.role)                     qs.set('role',       params.role);
  if (params.department)               qs.set('department', params.department);
  if (params.status)                   qs.set('status',     params.status);

  const url = `${BASE_URL}/users?${qs.toString()}`;
  console.log('[users] GET', url, { token: token ? 'present' : 'missing' });

  try {
    const res = await fetch(url, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });
    if (res.ok) {
      return await res.json() as UsersResponse;
    }
    const body = await res.json().catch(() => null);
    console.error('[users] API error', res.status, body);
  } catch (err) {
    console.error('[users] Network error', err);
  }

  // TODO: REMOVE — temporary mock data while backend 500 is being fixed
  console.warn('[users] Using fallback mock data — backend returned error');
  return USERS_MOCK;
}

// ── getUserDetails ─────────────────────────────────────────────────────────────

// TODO: REMOVE — temporary mock data while backend is being wired up
const DETAILS_MOCK: UserDetailsResponse = {
  user: {
    id: 'usr-001', fullName: 'John Doe', email: 'john.doe@example.com',
    phone: '+1 555 123 4567', avatar: null, role: 'Administrator',
    department: 'IT Department', branch: 'Head Office',
    status: 'active', verificationState: 'verified',
    emailVerified: true, phoneVerified: true, riskScore: null,
    createdAt: '2024-01-15T00:00:00.000Z',
    lastActivityAt: new Date(Date.now() - 2 * 60_000).toISOString(),
  },
  roles: [
    { id: 'r1', name: 'Administrator', type: 'primary',   expiresAt: null },
    { id: 'r2', name: 'IT Manager',    type: 'secondary', expiresAt: null },
    { id: 'r3', name: 'System Access', type: 'temporary', expiresAt: '2025-06-30T00:00:00.000Z' },
  ],
  securityOverview: {
    mfaEnabled: true, activeSessions: 2,
    lastIpAddress: '192.168.1.105', lastLocation: 'New York, USA', riskScore: 'low',
  },
  recentActivity: [
    { id: 'a1', action: 'Logged in successfully',    timestamp: new Date(Date.now() - 2 * 60_000).toISOString(),    ipAddress: '192.168.1.105' },
    { id: 'a2', action: 'Updated profile settings',  timestamp: new Date(Date.now() - 60 * 60_000).toISOString(),   ipAddress: '192.168.1.105' },
    { id: 'a3', action: 'Completed course module',   timestamp: new Date(Date.now() - 180 * 60_000).toISOString(),  ipAddress: '192.168.1.105' },
    { id: 'a4', action: 'Password changed',          timestamp: new Date(Date.now() - 1440 * 60_000).toISOString(), ipAddress: '192.168.1.90'  },
  ],
  enrolledCourses: [
    { id: 'c1', title: 'React Advanced Patterns',    progress: 75,  status: 'active'    },
    { id: 'c2', title: 'TypeScript Fundamentals',    progress: 100, status: 'completed' },
    { id: 'c3', title: 'Node.js for Enterprise',     progress: 40,  status: 'active'    },
  ],
};

// ── ApiError ───────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// ── Shared action fetch helper ────────────────────────────────────────────────

async function actionFetch(
  url:     string,
  method:  string,
  body?:   unknown,
): Promise<ActionResponse> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    Authorization: token ? `Bearer ${token}` : '',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  try {
    const res = await fetch(url, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (res.ok) return await res.json() as ActionResponse;
    const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
    throw new ApiError(res.status, (err as { message?: string }).message ?? `HTTP ${res.status}`);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.warn('[users] actionFetch: network error at', url);
    // TODO: REMOVE — mock response while backend is being built
    return { message: 'Action completed (mock)', user: {} };
  }
}

// ── User actions ──────────────────────────────────────────────────────────────

export function createUser(body: CreateUserRequest): Promise<ActionResponse> {
  return actionFetch(`${BASE_URL}/users`, 'POST', body);
}

export function updateUser(userId: string, body: UpdateUserRequest): Promise<ActionResponse> {
  return actionFetch(`${BASE_URL}/users/${encodeURIComponent(userId)}`, 'PATCH', body);
}

export function suspendUser(userId: string, body: SuspendUserRequest): Promise<ActionResponse> {
  return actionFetch(`${BASE_URL}/users/${encodeURIComponent(userId)}/suspend`, 'PATCH', body);
}

export function reactivateUser(userId: string): Promise<ActionResponse> {
  return actionFetch(`${BASE_URL}/users/${encodeURIComponent(userId)}/reactivate`, 'PATCH', {});
}

export function deleteUser(userId: string): Promise<ActionResponse> {
  return actionFetch(`${BASE_URL}/users/${encodeURIComponent(userId)}`, 'DELETE');
}

export function resetPassword(userId: string): Promise<ActionResponse> {
  return actionFetch(`${BASE_URL}/users/${encodeURIComponent(userId)}/reset-password`, 'POST', {});
}

export function assignRole(userId: string, body: AssignRoleRequest): Promise<ActionResponse> {
  return actionFetch(`${BASE_URL}/users/${encodeURIComponent(userId)}/role`, 'PATCH', body);
}

// ── getUserDetails ─────────────────────────────────────────────────────────────

export async function getUserDetails(userId: string): Promise<UserDetailsResponse> {
  const token = getStoredToken();
  const url   = `${BASE_URL}/users/${encodeURIComponent(userId)}?_t=${Date.now()}`;
  console.log('[users] GET details', url, { token: token ? 'present' : 'missing' });

  try {
    const res = await fetch(url, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });
    if (res.ok) {
      return await res.json() as UserDetailsResponse;
    }
    const body = await res.json().catch(() => null);
    console.error('[users] getUserDetails error', res.status, body);
  } catch (err) {
    console.error('[users] getUserDetails network error', err);
  }

  // TODO: REMOVE — temporary mock data while backend is being wired up
  console.warn('[users] getUserDetails: using fallback mock — real userId:', userId);
  return { ...DETAILS_MOCK, user: { ...DETAILS_MOCK.user, id: userId } };
}

// ── getAnalytics ───────────────────────────────────────────────────────────────

export async function getAnalytics(): Promise<AnalyticsResponse> {
  const token = getStoredToken();
  try {
    const res = await fetch(`${BASE_URL}/users/analytics?_t=${Date.now()}`, {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });
    if (res.ok) {
      const json = await res.json();
      return json.analytics as AnalyticsResponse;
    }
    const body = await res.json().catch(() => null);
    console.error('[users] getAnalytics error', res.status, body);
    throw new ApiError(res.status, 'Failed to fetch analytics');
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error('[users] getAnalytics network error', err);
    throw new ApiError(0, 'Network error fetching analytics');
  }
}
