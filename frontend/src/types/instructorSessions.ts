// Instructor "Sessions & Devices" domain types — source of truth:
// backend/src/services/instructorSessions.service.js.

export interface InstructorSession {
  id:         string;
  device:     string;
  ipAddress:  string | null;
  createdAt:  string;
  lastUsedAt: string | null;
  expiresAt:  string;
  isCurrent:  boolean;
}
