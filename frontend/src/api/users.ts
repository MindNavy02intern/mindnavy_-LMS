import type { UsersResponse } from '../types/users';
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
    { id: '1', fullName: 'John Doe',       email: 'john.doe@example.com',       avatar: null, role: 'Administrator',  department: 'IT Department',      branch: 'Head Office', status: 'active',    verificationState: 'verified', lastActivityAt: new Date(Date.now() - 2 * 60_000).toISOString(),         riskScore: null, enrollmentCount: 4, createdAt: '2024-01-15T00:00:00.000Z' },
    { id: '2', fullName: 'Sarah Wilson',   email: 'sarah.wilson@example.com',   avatar: null, role: 'Instructor',     department: 'Data Science',       branch: null,          status: 'active',    verificationState: 'verified', lastActivityAt: new Date(Date.now() - 15 * 60_000).toISOString(),        riskScore: null, enrollmentCount: 0, createdAt: '2024-02-20T00:00:00.000Z' },
    { id: '3', fullName: 'Mike Johnson',   email: 'mike.johnson@example.com',   avatar: null, role: 'Student',        department: 'Marketing',          branch: null,          status: 'active',    verificationState: 'verified', lastActivityAt: new Date(Date.now() - 60 * 60_000).toISOString(),        riskScore: null, enrollmentCount: 3, createdAt: '2024-03-10T00:00:00.000Z' },
    { id: '4', fullName: 'Emily Davis',    email: 'emily.davis@example.com',    avatar: null, role: 'HR Manager',     department: 'HR Department',      branch: null,          status: 'active',    verificationState: 'verified', lastActivityAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),   riskScore: null, enrollmentCount: 2, createdAt: '2024-04-05T00:00:00.000Z' },
    { id: '5', fullName: 'David Brown',    email: 'david.brown@example.com',    avatar: null, role: 'Finance Manager', department: 'Finance Department', branch: null,          status: 'suspended', verificationState: 'verified', lastActivityAt: new Date(Date.now() - 24 * 60 * 60_000).toISOString(),  riskScore: null, enrollmentCount: 1, createdAt: '2024-05-15T00:00:00.000Z' },
    { id: '6', fullName: 'Lisa Anderson', email: 'lisa.anderson@example.com',  avatar: null, role: 'Student',        department: 'Data Science',       branch: null,          status: 'pending',   verificationState: 'pending',  lastActivityAt: null,                                                    riskScore: null, enrollmentCount: 0, createdAt: '2024-06-01T00:00:00.000Z' },
    { id: '7', fullName: 'Robert Taylor', email: 'robert.taylor@example.com',  avatar: null, role: 'Branch Manager', department: 'New York Branch',    branch: 'New York',    status: 'active',    verificationState: 'verified', lastActivityAt: new Date(Date.now() - 3 * 60 * 60_000).toISOString(),   riskScore: null, enrollmentCount: 2, createdAt: '2024-07-20T00:00:00.000Z' },
    { id: '8', fullName: 'Priya Sharma',  email: 'priya.sharma@example.com',   avatar: null, role: 'Instructor',     department: 'Cyber Security',     branch: null,          status: 'active',    verificationState: 'verified', lastActivityAt: new Date(Date.now() - 5 * 60_000).toISOString(),         riskScore: null, enrollmentCount: 0, createdAt: '2024-08-10T00:00:00.000Z' },
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
