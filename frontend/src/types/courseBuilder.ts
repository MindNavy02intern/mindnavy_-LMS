// Course Builder — types per FRONTEND_CONTRACT.md §3.11.
// Field names match the backend contract 1:1.
// Sections contain ordered lessons; reorder is always a single bulk call.

export type LessonType = 'TEXT' | 'VIDEO_URL';

export interface Lesson {
  id:          string;
  sectionId:   string;
  title:       string;
  type:        LessonType;
  content:     string | null;
  durationMin: number | null;
  order:       number;
  createdAt:   string;
  updatedAt:   string;
}

export interface CourseSection {
  id:        string;
  courseId:  string;
  title:     string;
  order:     number;
  createdAt: string;
  updatedAt: string;
  lessons:   Lesson[];
}

export interface CreateSectionPayload {
  title:  string;
  order?: number;
}

export interface UpdateSectionPayload {
  title?: string;
  order?: number;
}

export interface CreateLessonPayload {
  title:        string;
  type:         LessonType;
  content?:     string;
  durationMin?: number;
  order?:       number;
}

export interface UpdateLessonPayload {
  title?:       string;
  type?:        LessonType;
  content?:     string | null;
  durationMin?: number | null;
  order?:       number;
}

export interface ReorderPayload {
  sections: { id: string; order: number }[];
  lessons:  { id: string; sectionId: string; order: number }[];
}

export class CourseBuilderApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'CourseBuilderApiError';
  }
}
