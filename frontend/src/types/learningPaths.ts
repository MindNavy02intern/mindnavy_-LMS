// Learning Paths domain types — v1 (COURSE + LIVE_SESSION items only).
// Source of truth: LEARNING_PATHS_CONTRACT / backend learningPaths.service.js.
//
// CRITICAL: LearningPathItem.id is the path-item record's own id — used for
// remove and reorder. It is NOT the course/session id (that's itemId). Mixing
// these up causes silent 404s on every remove/reorder call.

export type LearningPathItemType = 'COURSE' | 'LIVE_SESSION';

export interface LearningPath {
  id:          string;
  title:       string;
  description: string | null;
  sequential:  boolean;
  itemCount:   number;  // server-derived — never compute from items.length
  createdAt:   string;  // ISO
  updatedAt:   string;  // ISO
}

export interface LearningPathItem {
  id:        string;               // path-item id (for remove/reorder)
  itemType:  LearningPathItemType;
  itemId:    string;               // course or live-session id
  order:     number;
  createdAt: string;               // ISO
  // Resolved fields (populated by backend's resolveItems)
  title:     string | null;        // null when missing: true
  status:    string | null;        // Course: Draft/Pending/Published/Archived; Session: upcoming/live/ended
  startTime: string | null;        // LIVE_SESSION only
  missing:   boolean;              // true = referenced row hard-deleted from DB
}

export interface LearningPathDetail extends LearningPath {
  items: LearningPathItem[];
}

// API payloads

export interface CreatePathPayload {
  title:        string;
  description?: string | null;
  sequential?:  boolean;
}

export interface UpdatePathPayload {
  title?:       string;
  description?: string | null;  // null clears the field
  sequential?:  boolean;
}

export interface AddItemPayload {
  itemType: LearningPathItemType;
  itemId:   string;
}

export interface ReorderPayload {
  items: { id: string; order: number }[];
}
