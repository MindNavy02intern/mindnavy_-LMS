// Instructor "Messages from Admin" domain types — source of truth:
// backend/src/services/messages.service.js mapMessage/getAdminMessages.
// Read + mark-read + reply. AdminMessage itself stays strictly one-way
// (admin->user) — a reply is a separate AdminMessageReply row, never a
// reversed AdminMessage (see messages.service.js's createReply comment).

export type MessageStatus = 'sent' | 'read' | 'archived';

export interface InstructorMessageReply {
  id:        string;
  messageId: string;
  userId:    string;
  body:      string;
  createdAt: string;
}

export interface InstructorMessage {
  id:             string;
  receiverUserId: string;
  subject:        string | null;
  body:           string;
  messageType:    string;
  priority:       string;
  status:         MessageStatus;
  readAt:         string | null;
  createdAt:      string;
  replies:        InstructorMessageReply[];
  // Who sent it — every message view must show name + email, not just an id.
  senderName:     string | null;
  senderEmail:    string | null;
}

// Single-message thread view (GET /messages/:id/thread) — same message shape
// plus its full reply list, no count/preview truncation.
export interface InstructorMessageThread {
  message: InstructorMessage;
  replies: InstructorMessageReply[];
}

export interface Pagination {
  page:  number;
  limit: number;
  total: number;
  pages: number;
}

export interface ListMyMessagesResult {
  data:       InstructorMessage[];
  pagination: Pagination;
}
