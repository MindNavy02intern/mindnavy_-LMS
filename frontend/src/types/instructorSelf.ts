// Types for the Instructor Dashboard self-service API (Phase 2).
// Reuses types/instructors.ts wherever the backend genuinely returns the
// same shape (InstructorDetail, Metric, InstructorDocument*, Instructor
// Certification* — instructorSelf.service.js and instructorProfile.service.js
// both delegate to the exact same admin service functions for those). Only
// the shapes that are genuinely new below are defined here.

import type { Metric } from './instructors';

export interface CoursesByStatusBucket {
  status: string;
  count: number;
  percentage: number;
}

export interface InstructorDashboardStats {
  myPublishedCourses: Metric;
  myDraftCourses: Metric;
  myPendingApprovalCourses: Metric;
  myTotalStudents: Metric;
  myUpcomingSessions: Metric;
  myAvgRating: Metric;
  myTotalEarnings: Metric;
  myCertificatesIssued: Metric;
  coursesByStatus: { available: boolean; items: CoursesByStatusBucket[] };
  verificationStatus: {
    status: string;
    verificationState: string;
    verifiedAt: string | null;
    badges: { active: boolean; verified: boolean; topInstructor: boolean };
  };
}

export interface InstructorEnrollmentTrend {
  labels: string[];
  enrollments: number[];
}

// Broader than types/instructors.ts's InstructorRecentActivity['type'] —
// this endpoint merges in review_received/document_verified, two sources
// the admin side panel's activity feed has no reason to include.
export interface InstructorSelfActivityItem {
  id: string;
  type: 'course_created' | 'session_scheduled' | 'certificate_issued' | 'admin_action' | 'review_received' | 'document_verified';
  title: string;
  createdAt: string;
}

// Only the 6 fields Section 2.2 of the blueprint (and the Phase 2 task) list
// as instructor-editable — narrower than admin's UpdateInstructorRequest by
// design, not an oversight.
export interface UpdateInstructorSelfProfileRequest {
  specialization?: string | null;
  headline?: string | null;
  bio?: string | null;
  yearsExperience?: number | null;
  websiteUrl?: string | null;
  linkedinUrl?: string | null;
}
