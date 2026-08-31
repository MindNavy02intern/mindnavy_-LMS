// Instructor "My Students" domain types — source of truth:
// backend/src/services/instructorStudents.service.js response shapes.
// Read-only this phase (Part 3 spec) — no write payloads exist here.

import type { Pagination } from './lm';

export type EnrollmentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';

export interface StudentEnrollmentRow {
  enrollmentId:  string;
  studentId:     string;
  studentName:   string | null;
  studentEmail:  string | null;
  studentAvatar: string | null;
  courseId:      string;
  courseTitle:   string | null;
  progress:      number;
  status:        EnrollmentStatus;
  enrolledAt:    string | null;
  completedAt:   string | null;
}

export interface MyCourseOption {
  id:    string;
  title: string;
}

export interface ListMyStudentsResult {
  students:   StudentEnrollmentRow[];
  courses:    MyCourseOption[];
  pagination: Pagination;
}

export interface StudentCourseProgress {
  enrollmentId: string;
  courseId:     string;
  courseTitle:  string | null;
  progress:     number;
  status:       EnrollmentStatus;
  enrolledAt:   string | null;
  completedAt:  string | null;
  updatedAt:    string | null;
}

export interface StudentDetail {
  id:       string;
  fullName: string;
  email:    string;
  avatar:   string | null;
  // Scoped to THIS instructor's own courses only — never the student's full
  // cross-instructor history (privacy rule, blueprint 2.5).
  courses:  StudentCourseProgress[];
}

export interface StudentAssessment {
  id:           string;
  quizId:       string;
  quizTitle:    string | null;
  passingGrade: number | null;
  courseId:     string | null;
  courseTitle:  string | null;
  status:       'IN_PROGRESS' | 'SUBMITTED' | 'GRADED' | 'REOPENED';
  score:        number | null;
  feedback:     string | null;
  attemptNo:    number;
  submittedAt:  string | null;
  gradedAt:     string | null;
  createdAt:    string;
}

export interface ListStudentAssessmentsResult {
  assessments: StudentAssessment[];
  pagination:  Pagination;
}

export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'EXCUSED';

export interface StudentAttendanceRecord {
  id:                 string;
  sessionId:          string | null;
  sessionTitle:       string | null;
  sessionStartTime:   string | null;
  status:             AttendanceStatus;
  joinedAt:           string | null;
  leftAt:             string | null;
  durationMin:        number | null;
  participationScore: number | null;
  createdAt:          string;
}

export interface AttendanceSummary {
  present: number;
  late:    number;
  absent:  number;
  excused: number;
}

export interface ListStudentAttendanceResult {
  records:    StudentAttendanceRecord[];
  summary:    AttendanceSummary;
  pagination: Pagination;
}
