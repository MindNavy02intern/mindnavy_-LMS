import { getStoredToken } from './adminAuth'
import { fetchWithRetry } from '../lib/fetchWithRetry';

const BASE = import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:5001/api/admin'

export type PolicyResource =
  | 'USERS' | 'REPORTS' | 'SETTINGS' | 'ORGANIZATION'
  | 'LEARNERS' | 'COURSES' | 'ADMIN'
export type PolicyAction =
  'VIEW' | 'CREATE' | 'EDIT' | 'DELETE' | 'MANAGE' | 'EXPORT'
export type PolicyEffect = 'ALLOW' | 'DENY'
export type PolicyStatus = 'ACTIVE' | 'INACTIVE'

export interface AccessPolicy {
  id: string
  name: string
  description: string | null
  resource: PolicyResource
  action: PolicyAction
  effect: PolicyEffect
  priority: number
  status: PolicyStatus
  roleId: string | null
  role: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
}

export interface AccessPolicyStats {
  totalPolicies: number
  activePolicies: number
  inactivePolicies: number
  allowPolicies: number
  denyPolicies: number
}

export interface CreatePolicyPayload {
  name: string
  resource: PolicyResource
  action: PolicyAction
  description?: string | null
  effect?: PolicyEffect
  status?: PolicyStatus
  priority?: number
  roleId?: string | null
}

export class AccessPolicyError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AccessPolicyError'
  }
}

async function apiFetch<T>(
  path: string, method = 'GET', body?: unknown
): Promise<T> {
  const token = getStoredToken()
  const res = await fetchWithRetry(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
  const json = await res.json().catch(() => ({
    message: `HTTP ${res.status}`
  }))
  if (!res.ok) {
    throw new AccessPolicyError(
      res.status,
      (json as { message?: string }).message ?? `HTTP ${res.status}`
    )
  }
  return json as T
}

export function listAccessPolicies(params: {
  page?: number; limit?: number; search?: string
  status?: PolicyStatus | 'ALL'; effect?: PolicyEffect | 'ALL'
  resource?: PolicyResource; action?: PolicyAction; roleId?: string
} = {}) {
  const qs = new URLSearchParams()
  if (params.page)   qs.set('page', String(params.page))
  if (params.limit)  qs.set('limit', String(params.limit))
  if (params.search) qs.set('search', params.search)
  if (params.status && params.status !== 'ALL')
    qs.set('status', params.status)
  if (params.effect && params.effect !== 'ALL')
    qs.set('effect', params.effect)
  if (params.resource) qs.set('resource', params.resource)
  if (params.action)   qs.set('action', params.action)
  if (params.roleId)   qs.set('roleId', params.roleId)
  const q = qs.toString()
  return apiFetch<{
    success: boolean
    data: AccessPolicy[]
    pagination: { total: number; page: number; limit: number; pages: number }
  }>(`/access-policies${q ? `?${q}` : ''}`)
}

export async function getAccessPolicyStats(): Promise<AccessPolicyStats> {
  const json = await apiFetch<{
    success: boolean; data: AccessPolicyStats
  }>('/access-policies/stats')
  return json.data
}

export async function getAccessPolicy(id: string): Promise<AccessPolicy> {
  const json = await apiFetch<{ success: boolean; data: AccessPolicy }>(
    `/access-policies/${encodeURIComponent(id)}`
  )
  return json.data
}

export async function createAccessPolicy(
  payload: CreatePolicyPayload
): Promise<AccessPolicy> {
  const json = await apiFetch<{ success: boolean; data: AccessPolicy }>(
    '/access-policies', 'POST', payload
  )
  return json.data
}

export async function updateAccessPolicy(
  id: string, payload: Partial<CreatePolicyPayload>
): Promise<AccessPolicy> {
  const json = await apiFetch<{ success: boolean; data: AccessPolicy }>(
    `/access-policies/${encodeURIComponent(id)}`, 'PATCH', payload
  )
  return json.data
}

export async function deleteAccessPolicy(id: string): Promise<void> {
  await apiFetch<{ success: boolean }>(
    `/access-policies/${encodeURIComponent(id)}`, 'DELETE'
  )
}
