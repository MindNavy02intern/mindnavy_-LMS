// Content Library domain types — v1. Extends the EXISTING course_contents
// table (same table the LM "Content Statistics" tiles read).
// Source of truth: CONTENT_LIBRARY_CONTRACT.md.
//
// CRITICAL: type is 100% server-derived from MIME at /confirm — there is no
// client type picker. VIDEO/DOCUMENT/PDF/AUDIO/IMAGE are uploadable in v1;
// QUIZ/SCORM are valid FILTER values only (legacy rows) and must never be
// offered as upload targets — UploadableContentType makes that distinction
// structural, not just a convention.

import type { Pagination } from './lm';

export type { Pagination };

export type UploadableContentType = 'VIDEO' | 'DOCUMENT' | 'PDF' | 'AUDIO' | 'IMAGE';
export type ContentType = UploadableContentType | 'QUIZ' | 'SCORM';

export interface ContentItem {
  id:          string;
  title:       string;
  type:        ContentType;
  courseId:    string | null;
  courseTitle: string | null;
  fileUrl:     string | null;     // null on legacy seed rows — hide download/preview
  sizeBytes:   number | null;
  mimeType:    string | null;
  tags:        string[];          // server-normalized: trimmed/lowercased/deduped
  uploadedBy:  string | null;
  createdAt:   string;
  updatedAt:   string;
}

// Chips/tiles: counts share every active filter EXCEPT type
export interface ContentTypeCounts {
  All: number;
  VIDEO?: number;
  DOCUMENT?: number;
  PDF?: number;
  AUDIO?: number;
  IMAGE?: number;
  QUIZ?: number;
  SCORM?: number;
}

export interface ContentListData {
  content:     ContentItem[];
  pagination:  Pagination;
  typeCounts:  ContentTypeCounts;
}

export interface ContentListParams {
  search?:   string;
  type?:     ContentType;
  tag?:      string;
  courseId?: string;
  page?:     number;
  limit?:    number;
}

// POST /sign — step 1
export interface ContentSignRequest {
  fileName: string;
  fileType: string;
}

export interface ContentSignResponse {
  uploadUrl:  string;
  path:       string;
  type:       UploadableContentType;
  maxBytes:   number;   // read from here every time — never hardcode
  expiresIn:  number;
}

// POST /confirm — step 3 (after the direct PUT)
export interface ContentConfirmRequest {
  path:      string;
  title?:    string;
  tags?:     string[];
  courseId?: string | null;
}

// PATCH /:id — metadata only. File fields are never part of this type.
export interface UpdateContentPayload {
  title?:    string;
  tags?:     string[];         // full replacement; [] clears
  courseId?: string | null;    // null detaches
}
