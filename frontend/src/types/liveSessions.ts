// Live Sessions domain types — v1 (real Zoom integration).
// Source of truth: LIVE_SESSIONS_CONTRACT.md.
//
// CRITICAL: startUrl is the Zoom HOST link — never render it anywhere a
// learner could see it. status is server-derived (UPCOMING/LIVE/ENDED from
// startTime+durationMin) — there is no client-side status control.

export type LiveSessionStatus = 'UPCOMING' | 'LIVE' | 'ENDED';
// v1 accepts ZOOM only — MEET/TEAMS/OTHER are typed for forward-compat but
// the create/edit form must never offer them (backend 400s them).
export type MeetingProvider = 'ZOOM' | 'MEET' | 'TEAMS' | 'OTHER';

export interface LiveSession {
  id:              string;
  title:           string;
  description:     string | null;
  courseId:        string | null;
  courseTitle:     string | null;
  instructorId:    string | null;
  instructorName:  string | null;
  startTime:       string;              // ISO
  durationMin:     number;
  timezone:        string;              // IANA id
  maxParticipants: number | null;
  provider:        MeetingProvider;
  zoomMeetingId:   string | null;
  joinUrl:         string | null;       // participant link
  startUrl:        string | null;       // HOST link — admin-only, never learner-facing
  status:          LiveSessionStatus;   // server-derived, read-only
  // Set only via PATCH /:id/end (admin manual "End Session" override) — null
  // for sessions that reached ENDED purely by their schedule passing.
  endedAt:         string | null;
  createdAt:       string;
  updatedAt:       string;
}

export interface LiveSessionListParams {
  status?:       'upcoming' | 'live' | 'ended';
  courseId?:     string;
  instructorId?: string;
}

// POST / — provider omitted (server defaults to ZOOM; only ZOOM accepted anyway)
export interface CreateLiveSessionPayload {
  title:            string;
  instructorId:     string;
  startTime:        string;           // ISO, must be future
  durationMin?:     number;           // 5–1440, default 60
  timezone?:        string;           // default UTC
  courseId?:        string | null;
  description?:     string;
  maxParticipants?: number;
}

// PATCH /:id — never include status/joinUrl/startUrl/zoomMeetingId/provider
export interface UpdateLiveSessionPayload {
  title?:           string;
  description?:     string | null;
  courseId?:        string | null;
  instructorId?:    string;
  startTime?:       string;
  durationMin?:     number;
  timezone?:        string;
  maxParticipants?: number | null;
}

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';

export interface MarkAttendanceRecord {
  userId:              string;
  status:              AttendanceStatus;
  durationMin?:        number;
  participationScore?: number;
}

export interface AttendanceRecordResult {
  id:                 string;
  userId:             string;
  status:             AttendanceStatus;
  joinedAt:           string | null;
  leftAt:             string | null;
  durationMin:        number | null;
  participationScore: number | null;
}
