// Instructor "Learning Paths" visibility — source of truth:
// backend/src/services/instructorLearningPaths.service.js response shapes.
// Read-only: instructors don't create/edit paths, only see which ones
// include their own courses.

export interface MyLearningPathCourse {
  courseId:    string;
  courseTitle: string | null;
  position:    number; // 1-based
}

export interface MyLearningPathRow {
  id:          string;
  title:       string;
  description: string | null;
  sequential:  boolean;
  itemCount:   number;
  createdAt:   string;
  updatedAt:   string;
  myCourses:   MyLearningPathCourse[];
}

export type LearningPathItemType = 'COURSE' | 'LIVE_SESSION' | 'QUIZ';

export interface MyLearningPathItem {
  id:        string;
  itemType:  LearningPathItemType;
  itemId:    string;
  order:     number;
  createdAt: string;
  title:     string | null;
  status:    string | null;
  startTime: string | null;
  missing:   boolean;
  // true only for COURSE items this instructor owns — the highlight the
  // detail view uses to distinguish "mine" from another instructor's step.
  isMine:    boolean;
}

export interface MyLearningPathDetail {
  id:          string;
  title:       string;
  description: string | null;
  sequential:  boolean;
  itemCount:   number;
  createdAt:   string;
  updatedAt:   string;
  items:       MyLearningPathItem[];
}
