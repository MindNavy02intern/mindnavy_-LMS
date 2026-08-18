// Reports & Analytics API — per REPORTS_CONTRACT.md. Real backend only (no
// mock flag — same convention as competenciesApi.ts).

import { getStoredToken } from '../api/adminAuth';
import {
  ReportsApiError,
  type AssessmentReports,
  type AttendanceReports,
  type AuditReports,
  type CertificateReports,
  type ComplianceReports,
  type CourseAnalytics,
  type DateRangeParams,
  type EngagementAnalytics,
  type ExportFormat,
  type ExportType,
  type InstructorAnalytics,
  type LearnerAnalytics,
  type ReportsOverview,
  type ScheduledReport,
  type ScheduledReportFilters,
  type ScheduledReportFormat,
  type ScheduledReportFrequency,
  type ScheduledReportsList,
  type SavedReport,
  type SavedReportInput,
  type SavedReportRunResult,
} from '../types/reports';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

// ── Fetch wrapper — same envelope as competenciesFetch/instructorsApi ──────

async function reportsFetch<T>(path: string): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401) throw new ReportsApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 429 ? 'Rate limited — slow down and retry.' :
      res.status === 503 ? 'Database not migrated yet. Run `npx prisma db push`.' :
      res.status === 500 ? 'Something went wrong on the server.' :
      json.message ?? (res.status === 404 ? 'Not found.' : `HTTP ${res.status}`);
    throw new ReportsApiError(res.status, msg);
  }

  return json.data as T;
}

// Write variant of reportsFetch — same envelope/error handling, adds
// method/body for the Scheduled Reports CRUD endpoints below.
async function reportsRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) throw new ReportsApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 429 ? 'Rate limited — slow down and retry.' :
      res.status === 503 ? 'Database not migrated yet. Run `npx prisma db push`.' :
      res.status === 500 ? 'Something went wrong on the server.' :
      json.message ?? (res.status === 404 ? 'Not found.' : `HTTP ${res.status}`);
    throw new ReportsApiError(res.status, msg);
  }

  return json.data as T;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  return qs.toString();
}

function dateRangeParams(d: DateRangeParams = {}): Record<string, string | undefined> {
  return { dateRange: d.dateRange, dateFrom: d.dateFrom, dateTo: d.dateTo };
}

// ── 1. Overview ──────────────────────────────────────────────────────────

export interface OverviewParams extends DateRangeParams {
  department?: string;
}

export function getReportsOverview(params: OverviewParams = {}): Promise<ReportsOverview> {
  const qs = buildQuery({ ...dateRangeParams(params), department: params.department });
  return reportsFetch<ReportsOverview>(`/reports/overview?${qs}`);
}

// ── 2. Learner Analytics ─────────────────────────────────────────────────

export interface LearnerAnalyticsParams extends DateRangeParams {
  department?: string;
  cohort?:     string;
  page?:       number;
  limit?:      number;
}

export function getLearnerAnalytics(params: LearnerAnalyticsParams = {}): Promise<LearnerAnalytics> {
  const qs = buildQuery({ ...dateRangeParams(params), department: params.department, cohort: params.cohort, page: params.page, limit: params.limit });
  return reportsFetch<LearnerAnalytics>(`/reports/learners?${qs}`);
}

// ── 3. Instructor Analytics ──────────────────────────────────────────────

export interface InstructorAnalyticsParams extends DateRangeParams {
  page?:  number;
  limit?: number;
}

export function getInstructorAnalytics(params: InstructorAnalyticsParams = {}): Promise<InstructorAnalytics> {
  const qs = buildQuery({ ...dateRangeParams(params), page: params.page, limit: params.limit });
  return reportsFetch<InstructorAnalytics>(`/reports/instructors?${qs}`);
}

// ── 4. Course Analytics ───────────────────────────────────────────────────

export interface CourseAnalyticsParams extends DateRangeParams {
  categoryId?: string;
  page?:       number;
  limit?:      number;
}

export function getCourseAnalytics(params: CourseAnalyticsParams = {}): Promise<CourseAnalytics> {
  const qs = buildQuery({ ...dateRangeParams(params), categoryId: params.categoryId, page: params.page, limit: params.limit });
  return reportsFetch<CourseAnalytics>(`/reports/courses?${qs}`);
}

// ── 5. Assessment Reports ────────────────────────────────────────────────

export interface AssessmentReportsParams extends DateRangeParams {
  courseId?: string;
  page?:     number;
  limit?:    number;
}

export function getAssessmentReports(params: AssessmentReportsParams = {}): Promise<AssessmentReports> {
  const qs = buildQuery({ ...dateRangeParams(params), courseId: params.courseId, page: params.page, limit: params.limit });
  return reportsFetch<AssessmentReports>(`/reports/assessments?${qs}`);
}

// ── 6. Certificate Reports ────────────────────────────────────────────────

export interface CertificateReportsParams extends DateRangeParams {
  page?:  number;
  limit?: number;
}

export function getCertificateReports(params: CertificateReportsParams = {}): Promise<CertificateReports> {
  const qs = buildQuery({ ...dateRangeParams(params), page: params.page, limit: params.limit });
  return reportsFetch<CertificateReports>(`/reports/certificates?${qs}`);
}

// ── 7. Attendance Reports ────────────────────────────────────────────────

export interface AttendanceReportsParams extends DateRangeParams {
  page?:  number;
  limit?: number;
}

export function getAttendanceReports(params: AttendanceReportsParams = {}): Promise<AttendanceReports> {
  const qs = buildQuery({ ...dateRangeParams(params), page: params.page, limit: params.limit });
  return reportsFetch<AttendanceReports>(`/reports/attendance?${qs}`);
}

// ── 8. Audit Reports ──────────────────────────────────────────────────────

export interface AuditReportsParams extends DateRangeParams {
  search?: string;
  action?: string;
  actions?: string[];
  userId?: string;
  page?:   number;
  limit?:  number;
}

export function getAuditReports(params: AuditReportsParams = {}): Promise<AuditReports> {
  const qs = buildQuery({ ...dateRangeParams(params), search: params.search, action: params.action, actions: params.actions?.join(','), userId: params.userId, page: params.page, limit: params.limit });
  return reportsFetch<AuditReports>(`/reports/audit?${qs}`);
}

// ── 9. Engagement Analytics ──────────────────────────────────────────────

export function getEngagementAnalytics(params: DateRangeParams = {}): Promise<EngagementAnalytics> {
  const qs = buildQuery(dateRangeParams(params));
  return reportsFetch<EngagementAnalytics>(`/reports/engagement?${qs}`);
}

// ── 10. Export Center — backend returns the actual file, not a JSON envelope ──

export interface ExportReportParams extends DateRangeParams {
  type:   ExportType;
  format: ExportFormat;
}

// Triggers a real browser download — mirrors ImportExportTab's triggerDownload,
// just fed by the server's file bytes instead of a client-built CSV string.
export async function downloadReportExport(params: ExportReportParams): Promise<void> {
  const token = getStoredToken();
  const qs = buildQuery({ ...dateRangeParams(params), type: params.type, format: params.format });
  const res = await fetch(`${BASE}/reports/export?${qs}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status === 401) throw new ReportsApiError(401, 'Unauthorized — please log in again.');
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { message?: string } | null;
    throw new ReportsApiError(res.status, body?.message ?? `HTTP ${res.status}`);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const filename = match?.[1] ?? `reports-${params.type}.${params.format}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── 11. Compliance Reports ────────────────────────────────────────────────

export interface ComplianceReportsParams extends DateRangeParams {
  departmentId?: string;
}

export function getComplianceReports(params: ComplianceReportsParams = {}): Promise<ComplianceReports> {
  const qs = buildQuery({ ...dateRangeParams(params), departmentId: params.departmentId });
  return reportsFetch<ComplianceReports>(`/reports/compliance?${qs}`);
}

// ── 12. Scheduled Reports ─────────────────────────────────────────────────

export interface ScheduledReportInput {
  name:        string;
  reportType:  ExportType;
  format:      ScheduledReportFormat;
  frequency:   ScheduledReportFrequency;
  recipients:  string[];
  filters?:    ScheduledReportFilters;
}

export function getScheduledReports(params: { page?: number; limit?: number; status?: string } = {}): Promise<ScheduledReportsList> {
  const qs = buildQuery({ page: params.page, limit: params.limit, status: params.status });
  return reportsFetch<ScheduledReportsList>(`/reports/scheduled?${qs}`);
}

export function createScheduledReport(input: ScheduledReportInput): Promise<ScheduledReport> {
  return reportsRequest<ScheduledReport>('/reports/scheduled', 'POST', input);
}

export function updateScheduledReport(id: string, input: Partial<ScheduledReportInput>): Promise<ScheduledReport> {
  return reportsRequest<ScheduledReport>(`/reports/scheduled/${id}`, 'PATCH', input);
}

export function deleteScheduledReport(id: string): Promise<{ id: string }> {
  return reportsRequest<{ id: string }>(`/reports/scheduled/${id}`, 'DELETE');
}

export function pauseScheduledReport(id: string): Promise<ScheduledReport> {
  return reportsRequest<ScheduledReport>(`/reports/scheduled/${id}/pause`, 'PATCH');
}

export function resumeScheduledReport(id: string): Promise<ScheduledReport> {
  return reportsRequest<ScheduledReport>(`/reports/scheduled/${id}/resume`, 'PATCH');
}

// ── Saved Reports (Custom Reports builder) ────────────────────────────────

export function listSavedReports(): Promise<SavedReport[]> {
  return reportsFetch<SavedReport[]>('/reports/saved');
}

export function getSavedReport(id: string): Promise<SavedReport> {
  return reportsFetch<SavedReport>(`/reports/saved/${id}`);
}

export function createSavedReport(input: SavedReportInput): Promise<SavedReport> {
  return reportsRequest<SavedReport>('/reports/saved', 'POST', input);
}

export function updateSavedReport(id: string, input: Partial<SavedReportInput>): Promise<SavedReport> {
  return reportsRequest<SavedReport>(`/reports/saved/${id}`, 'PATCH', input);
}

export function deleteSavedReport(id: string): Promise<{ id: string }> {
  return reportsRequest<{ id: string }>(`/reports/saved/${id}`, 'DELETE');
}

export function runSavedReport(id: string): Promise<SavedReportRunResult> {
  return reportsRequest<SavedReportRunResult>(`/reports/saved/${id}/run`, 'POST');
}

// CSV download — blob + Bearer, never a plain <a href> (mirrors
// certificatesApi.ts's downloadCertificatePdf / financeApi.ts's invoice PDF).
export async function exportSavedReportCsv(id: string): Promise<Blob> {
  const token = getStoredToken();
  const res = await fetch(`${BASE}/reports/saved/${id}/export`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) throw new ReportsApiError(401, 'Unauthorized — please log in again.');
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new ReportsApiError(res.status, (json as { message?: string }).message ?? `HTTP ${res.status}`);
  }
  return res.blob();
}

export function triggerCsvDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export { ReportsApiError };
