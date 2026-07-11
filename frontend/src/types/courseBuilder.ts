export class CourseBuilderApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'CourseBuilderApiError';
    this.status = status;
  }
}

export type LessonType = 'TEXT' | 'VIDEO_URL';

export interface Lesson {
  id: string;
  sectionId: string;
  title: string;
  type: LessonType;
  content: string | null;
  durationMin: number | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CourseSection {
  id: string;
  courseId: string;
  title: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  lessons: Lesson[];
}

export interface CreateLessonPayload {
  title: string;
  type: LessonType;
  content?: string;
  durationMin?: number | null;
}

export interface UpdateLessonPayload {
  title?: string;
  type?: LessonType;
  content?: string | null;
  durationMin?: number | null;
}
