// Backend API base URL — set VITE_API_URL in your .env to point to the Express server
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error((body as { message?: string }).message ?? 'Request failed');
  }

  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, headers?: HeadersInit) =>
    apiFetch<T>(path, { method: 'GET', headers }),

  post: <T>(path: string, body: unknown, headers?: HeadersInit) =>
    apiFetch<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    }),

  put: <T>(path: string, body: unknown, headers?: HeadersInit) =>
    apiFetch<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
      headers,
    }),

  delete: <T>(path: string, headers?: HeadersInit) =>
    apiFetch<T>(path, { method: 'DELETE', headers }),
};
