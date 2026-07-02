# Access Policies API — Frontend Contract

Backend for the **Roles & Permissions → Access Policies** tab.
This document is the single source of truth. Build the frontend exactly to these
shapes so the frontend and backend never conflict.

---

## 1. Basics

- **Base URL:** `http://localhost:5001/api/admin`
- **Auth:** every request needs the admin token header (same as the Roles API):
  ```
  Authorization: Bearer <token>
  ```
  Reuse the existing `getStoredToken()` + `apiFetch()` helpers in
  `frontend/src/api/rolesPage.ts`. **Do not** create a new fetch wrapper.
- **Content type for writes:** `Content-Type: application/json`
- **Make one request per action.** Do not call per row/per policy. Use the list
  endpoint with filters + pagination.
- Do **not** invent alias paths like `/roles-page/...`. The real paths are below.

### Response envelope (always)
- Success (list): `{ "success": true, "data": [...], "pagination": {...} }`
- Success (single/create/update): `{ "success": true, "message": "...", "data": {...} }`
- Success (delete): `{ "success": true, "message": "..." }`
- Error (any): `{ "success": false, "message": "..." }`

---

## 2. Allowed enum values (use these EXACT strings)

| Field | Allowed values |
|---|---|
| `resource` | `USERS`, `REPORTS`, `SETTINGS`, `ORGANIZATION`, `LEARNERS`, `COURSES`, `ADMIN` |
| `action` | `VIEW`, `CREATE`, `EDIT`, `DELETE`, `MANAGE`, `EXPORT` |
| `effect` | `ALLOW`, `DENY` |
| `status` | `ACTIVE`, `INACTIVE` |

For filter dropdowns, `status` and `effect` also accept `ALL` (means "no filter").

---

## 3. The Policy object (what every endpoint returns)

```ts
interface AccessPolicy {
  id: string;                 // uuid
  name: string;               // unique, max 100 chars
  description: string | null; // max 500 chars
  resource: "USERS" | "REPORTS" | "SETTINGS" | "ORGANIZATION" | "LEARNERS" | "COURSES" | "ADMIN";
  action: "VIEW" | "CREATE" | "EDIT" | "DELETE" | "MANAGE" | "EXPORT";
  effect: "ALLOW" | "DENY";
  priority: number;           // integer 0..1000
  status: "ACTIVE" | "INACTIVE";
  roleId: string | null;      // null = applies to all roles
  role: { id: string; name: string } | null; // populated when roleId is set
  createdAt: string;          // ISO date
  updatedAt: string;          // ISO date
}
```

---

## 4. Endpoints

### 4.1 List policies
```
GET /access-policies
```
**Query params (all optional):**

| Param | Type / values | Default | Notes |
|---|---|---|---|
| `page` | integer ≥ 1 | `1` | |
| `limit` | integer 1..200 | `50` | capped at 200 |
| `search` | string | — | matches `name` (contains, case-insensitive) |
| `status` | `ACTIVE` \| `INACTIVE` \| `ALL` | `ALL` | |
| `effect` | `ALLOW` \| `DENY` \| `ALL` | `ALL` | |
| `resource` | one resource enum (or `ALL`) | — | |
| `action` | one action enum (or `ALL`) | — | |
| `roleId` | string | — | filter to one role |

**200 response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "f0c1...uuid",
      "name": "Block report exports",
      "description": "Managers cannot export reports",
      "resource": "REPORTS",
      "action": "EXPORT",
      "effect": "DENY",
      "priority": 10,
      "status": "ACTIVE",
      "roleId": "9ab2...uuid",
      "role": { "id": "9ab2...uuid", "name": "Manager" },
      "createdAt": "2026-06-24T10:00:00.000Z",
      "updatedAt": "2026-06-24T10:00:00.000Z"
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 50, "pages": 1 }
}
```
Results are ordered by `priority` (desc), then `createdAt` (desc).

---

### 4.2 Stats (for the header / stat cards)
```
GET /access-policies/stats
```
**200 response:**
```json
{
  "success": true,
  "data": {
    "totalPolicies": 12,
    "activePolicies": 10,
    "inactivePolicies": 2,
    "allowPolicies": 7,
    "denyPolicies": 5
  }
}
```

---

### 4.3 Get one policy
```
GET /access-policies/:id
```
- **200:** `{ "success": true, "data": <AccessPolicy> }`
- **404:** `{ "success": false, "message": "Access policy not found." }`

---

### 4.4 Create policy
```
POST /access-policies
```
**Body:**
```json
{
  "name": "Block report exports",
  "description": "optional text",
  "resource": "REPORTS",
  "action": "EXPORT",
  "effect": "DENY",
  "status": "ACTIVE",
  "priority": 10,
  "roleId": "9ab2...uuid"
}
```

| Field | Required | Default | Rules |
|---|---|---|---|
| `name` | ✅ | — | string, max 100, must be unique |
| `resource` | ✅ | — | resource enum |
| `action` | ✅ | — | action enum |
| `description` | ❌ | `null` | string max 500, or `null` |
| `effect` | ❌ | `ALLOW` | `ALLOW` or `DENY` |
| `status` | ❌ | `ACTIVE` | `ACTIVE` or `INACTIVE` |
| `priority` | ❌ | `0` | integer 0..1000 |
| `roleId` | ❌ | `null` | must be an existing role id; `null` = all roles |

- **201:** `{ "success": true, "message": "Access policy created successfully.", "data": <AccessPolicy> }`
- **400:** validation failed (see `message`)
- **404:** `{ "success": false, "message": "Role not found." }` (bad `roleId`)
- **409:** `{ "success": false, "message": "A policy with this name already exists." }`

---

### 4.5 Update policy
```
PATCH /access-policies/:id
```
Send **any subset** of the create fields. Only included fields change.
Set `"roleId": null` to unscope a policy from its role.

```json
{ "status": "INACTIVE", "priority": 20 }
```
- **200:** `{ "success": true, "message": "Access policy updated successfully.", "data": <AccessPolicy> }`
- **400 / 404 / 409:** same meanings as create. (404 also if the policy id doesn't exist.)

---

### 4.6 Delete policy
```
DELETE /access-policies/:id
```
- **200:** `{ "success": true, "message": "Access policy deleted successfully." }`
- **404:** `{ "success": false, "message": "Access policy not found." }`

---

## 5. Error reference (handle these in the UI)

| Status | Meaning | UI action |
|---|---|---|
| `400` | Validation error | Show `message` near the form field |
| `401` | Not logged in / invalid session | Redirect to login |
| `404` | Policy or role not found | Show "not found" message |
| `409` | Duplicate policy name | Show "name already used" on the name field |
| `429` | Too many write requests (rate limit) | Show "Please slow down and retry" |
| `500` | Server error (should not happen on bad input) | Generic error toast |

Every error body is `{ "success": false, "message": "..." }` — read `message`.

> **Auth/rate limits:** All endpoints require the Bearer token. Writes
> (POST/PATCH/DELETE) are rate-limited to **60 requests / 10 minutes** per admin.
> Reads are not rate-limited.

---

## 6. Ready-to-use TypeScript API client

Drop this into `frontend/src/api/accessPoliciesPage.ts` (mirrors `rolesPage.ts`):

```ts
import { getStoredToken } from './adminAuth';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

export type PolicyResource =
  | 'USERS' | 'REPORTS' | 'SETTINGS' | 'ORGANIZATION' | 'LEARNERS' | 'COURSES' | 'ADMIN';
export type PolicyAction = 'VIEW' | 'CREATE' | 'EDIT' | 'DELETE' | 'MANAGE' | 'EXPORT';
export type PolicyEffect = 'ALLOW' | 'DENY';
export type PolicyStatus = 'ACTIVE' | 'INACTIVE';

export interface AccessPolicy {
  id: string;
  name: string;
  description: string | null;
  resource: PolicyResource;
  action: PolicyAction;
  effect: PolicyEffect;
  priority: number;
  status: PolicyStatus;
  roleId: string | null;
  role: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccessPolicyStats {
  totalPolicies: number;
  activePolicies: number;
  inactivePolicies: number;
  allowPolicies: number;
  denyPolicies: number;
}

export interface Pagination { total: number; page: number; limit: number; pages: number }

export interface CreatePolicyPayload {
  name: string;
  resource: PolicyResource;
  action: PolicyAction;
  description?: string | null;
  effect?: PolicyEffect;
  status?: PolicyStatus;
  priority?: number;
  roleId?: string | null;
}

export class AccessPolicyError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'AccessPolicyError';
  }
}

async function apiFetch<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
  if (!res.ok) {
    throw new AccessPolicyError(res.status, (json as { message?: string }).message ?? `HTTP ${res.status}`);
  }
  return json as T;
}

export function listAccessPolicies(params: {
  page?: number; limit?: number; search?: string;
  status?: PolicyStatus | 'ALL'; effect?: PolicyEffect | 'ALL';
  resource?: PolicyResource; action?: PolicyAction; roleId?: string;
} = {}) {
  const qs = new URLSearchParams();
  if (params.page)     qs.set('page', String(params.page));
  if (params.limit)    qs.set('limit', String(params.limit));
  if (params.search)   qs.set('search', params.search);
  if (params.status && params.status !== 'ALL') qs.set('status', params.status);
  if (params.effect && params.effect !== 'ALL') qs.set('effect', params.effect);
  if (params.resource) qs.set('resource', params.resource);
  if (params.action)   qs.set('action', params.action);
  if (params.roleId)   qs.set('roleId', params.roleId);
  const q = qs.toString();
  return apiFetch<{ success: boolean; data: AccessPolicy[]; pagination: Pagination }>(
    `/access-policies${q ? `?${q}` : ''}`,
  );
}

export async function getAccessPolicyStats(): Promise<AccessPolicyStats> {
  const json = await apiFetch<{ success: boolean; data: AccessPolicyStats }>('/access-policies/stats');
  return json.data;
}

export async function getAccessPolicy(id: string): Promise<AccessPolicy> {
  const json = await apiFetch<{ success: boolean; data: AccessPolicy }>(
    `/access-policies/${encodeURIComponent(id)}`,
  );
  return json.data;
}

export async function createAccessPolicy(payload: CreatePolicyPayload): Promise<AccessPolicy> {
  const json = await apiFetch<{ success: boolean; data: AccessPolicy }>(
    '/access-policies', 'POST', payload,
  );
  return json.data;
}

export async function updateAccessPolicy(
  id: string, payload: Partial<CreatePolicyPayload>,
): Promise<AccessPolicy> {
  const json = await apiFetch<{ success: boolean; data: AccessPolicy }>(
    `/access-policies/${encodeURIComponent(id)}`, 'PATCH', payload,
  );
  return json.data;
}

export async function deleteAccessPolicy(id: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/access-policies/${encodeURIComponent(id)}`, 'DELETE');
}
```

---

## 7. Notes for the role dropdown

When building the create/edit form, the `roleId` dropdown should be populated
from the **existing** Roles API — do not add a new endpoint:
```
GET /api/admin/roles?limit=200   ->  data: [{ id, name, ... }]
```
Leave it empty / "All roles" to send `roleId: null`.
