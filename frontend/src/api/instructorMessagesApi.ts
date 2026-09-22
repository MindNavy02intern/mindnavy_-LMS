// Instructor self-service Messages API — scoped to /api/instructor/messages.
// Read + mark-read only.

import { getStoredInstructorToken } from './instructorAuth';
import type { InstructorMessage, InstructorMessageReply, ListMyMessagesResult } from '../types/instructorMessages';

const BASE = import.meta.env.VITE_INSTRUCTOR_API_BASE_URL2 ?? 'http://localhost:5001/api/instructor';

export class InstructorMessagesApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'InstructorMessagesApiError';
  }
}

async function messagesFetch<T>(path: string, method: 'GET' | 'PATCH' | 'POST' = 'GET', body?: unknown): Promise<T> {
  const token = getStoredInstructorToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new InstructorMessagesApiError(401, 'Your session has expired — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg = res.status === 429 ? 'Too many requests — slow down.' : json.message ?? `HTTP ${res.status}`;
    throw new InstructorMessagesApiError(res.status, msg);
  }

  return json.data as T;
}

export function listMyMessages(): Promise<ListMyMessagesResult> {
  return messagesFetch<{ messages: InstructorMessage[]; pagination: ListMyMessagesResult['pagination'] }>('/messages')
    .then((r) => ({ data: r.messages, pagination: r.pagination }));
}

export function markMyMessageRead(id: string): Promise<InstructorMessage> {
  return messagesFetch<InstructorMessage>(`/messages/${encodeURIComponent(id)}/read`, 'PATCH');
}

export function replyToMessage(originalMessageId: string, body: string): Promise<InstructorMessageReply> {
  return messagesFetch<InstructorMessageReply>('/messages/reply', 'POST', { originalMessageId, body });
}
