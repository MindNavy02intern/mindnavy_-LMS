// Instructor "My Reviews" domain types — source of truth:
// backend/src/services/instructorReviews.service.js listMyReviews/getMyReviewStats.
// Read-only: REMOVED reviews never appear here (blueprint 2.6).

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'FLAGGED';

export interface InstructorReviewRow {
  id:           string;
  instructorId: string;
  studentId:    string;
  studentName:  string | null;
  courseId:     string;
  courseTitle:  string | null;
  rating:       number;
  comment:      string | null;
  status:       ReviewStatus;
  createdAt:    string;
  updatedAt:    string;
}

export interface Pagination {
  total: number;
  page:  number;
  limit: number;
  pages: number;
}

export interface ListMyReviewsResult {
  reviews:    InstructorReviewRow[];
  pagination: Pagination;
}

export interface MyReviewStats {
  avgRating: { value: number | null; available: boolean; reason?: string };
  totalReviews: number;
}
