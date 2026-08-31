// Instructor "My Reports & Analytics" domain types — source of truth:
// backend/src/services/instructorReports.service.js.

export interface Metric {
  value: number | null;
  changePercent: number | null;
  available: boolean;
  reason?: string;
}

export interface PerformanceTrend {
  labels: string[];          // 'YYYY-MM', trailing 12 months
  completionRate: number[];  // 0-100, same length as labels
}

export interface MyReportsOverview {
  courseCompletionRate: Metric;
  avgRating: Metric;
  liveSessionAttendance: Metric;
  performanceTrend: PerformanceTrend;
}

export interface MyCourseBreakdownRow {
  courseId:       string;
  courseTitle:    string;
  enrolled:       number;
  completed:      number;
  completionRate: number | null;
  avgQuizScore:   number | null;
}
