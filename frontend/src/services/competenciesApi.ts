// Competencies API — per COMPETENCIES_CONTRACT.md. Real backend only (no mock
// flag — same convention as instructorsApi.ts/learnersApi.ts once shipped).

import { getStoredToken } from '../api/adminAuth';
import { fetchWithRetry } from '../lib/fetchWithRetry';
import {
  CompetenciesApiError,
  type Assessment,
  type AssessmentsListResponse,
  type AssessmentType,
  type CompetenciesAnalytics,
  type CompetenciesStats,
  type CreateAssessmentRequest,
  type CreateAssessmentResponse,
  type CreateFrameworkRequest,
  type CreateSkillCategoryRequest,
  type CreateSkillRequest,
  type CompetencySettings,
  type ExportSkillsResponse,
  type Framework,
  type FrameworkDetail,
  type FrameworksListResponse,
  type FrameworkSkillRow,
  type FrameworkStatus,
  type AddFrameworkSkillRequest,
  type Skill,
  type SkillCategory,
  type SkillDetail,
  type SkillGapsResponse,
  type SkillImportResult,
  type SkillLevel,
  type SkillLinkedCourse,
  type SkillsListResponse,
  type SkillStatus,
  type UpdateCompetencySettingsRequest,
  type UpdateFrameworkRequest,
  type UpdateSkillCategoryRequest,
  type UpdateSkillRequest,
  type UserSkillEntry,
  type CertificationStatus,
  type CertificationsListResponse,
  type CompetencyCertification,
  type AssignCertificationRequest,
} from '../types/competencies';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5001/api/admin';

// ── Fetch wrapper — same envelope as instructorsApi/learnersApi ──────────────

async function competenciesFetch<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  body?: unknown,
): Promise<T> {
  const token = getStoredToken();
  const res = await fetchWithRetry(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 401) throw new CompetenciesApiError(401, 'Unauthorized — please log in again.');

  let json: { success?: boolean; data?: T; message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 429 ? 'Rate limited — slow down and retry.' :
      res.status === 503 ? 'Database not migrated yet. Run `npx prisma db push`.' :
      res.status === 500 ? 'Something went wrong on the server.' :
      json.message ?? (res.status === 404 ? 'Not found.' : `HTTP ${res.status}`);
    throw new CompetenciesApiError(res.status, msg, json.data as unknown as Record<string, unknown> | undefined);
  }

  return json.data as T;
}

// ── Skills ─────────────────────────────────────────────────────────────────

export interface SkillsListParams {
  page?:       number;
  limit?:      number;
  search?:     string;
  categoryId?: string;
  level?:      SkillLevel;
  status?:     SkillStatus;
}

export function listSkills(params: SkillsListParams = {}): Promise<SkillsListResponse> {
  const qs = new URLSearchParams();
  if (params.page       !== undefined) qs.set('page',       String(params.page));
  if (params.limit      !== undefined) qs.set('limit',      String(params.limit));
  if (params.search)                   qs.set('search',     params.search);
  if (params.categoryId)               qs.set('categoryId', params.categoryId);
  if (params.level)                    qs.set('level',      params.level);
  if (params.status)                   qs.set('status',     params.status);
  return competenciesFetch<SkillsListResponse>(`/competencies/skills?${qs.toString()}`);
}

export function getSkill(id: string): Promise<SkillDetail> {
  return competenciesFetch<SkillDetail>(`/competencies/skills/${encodeURIComponent(id)}`);
}

export function createSkill(body: CreateSkillRequest): Promise<Skill> {
  return competenciesFetch<Skill>('/competencies/skills', 'POST', body);
}

export function updateSkill(id: string, body: UpdateSkillRequest): Promise<Skill> {
  return competenciesFetch<Skill>(`/competencies/skills/${encodeURIComponent(id)}`, 'PATCH', body);
}

export function deleteSkill(id: string): Promise<{ id: string }> {
  return competenciesFetch<{ id: string }>(`/competencies/skills/${encodeURIComponent(id)}`, 'DELETE');
}

export function assignCourseToSkill(id: string, courseId: string): Promise<SkillLinkedCourse> {
  return competenciesFetch<SkillLinkedCourse>(`/competencies/skills/${encodeURIComponent(id)}/assign-course`, 'POST', { courseId });
}

export function removeCourseFromSkill(id: string, courseId: string): Promise<{ id: string }> {
  return competenciesFetch<{ id: string }>(`/competencies/skills/${encodeURIComponent(id)}/courses/${encodeURIComponent(courseId)}`, 'DELETE');
}

// ── Stats / analytics ─────────────────────────────────────────────────────────

export function getCompetenciesStats(): Promise<CompetenciesStats> {
  return competenciesFetch<CompetenciesStats>('/competencies/stats');
}

export function getCompetenciesAnalytics(): Promise<CompetenciesAnalytics> {
  return competenciesFetch<CompetenciesAnalytics>('/competencies/analytics');
}

// ── Frameworks ─────────────────────────────────────────────────────────────

export interface FrameworksListParams {
  page?:   number;
  limit?:  number;
  search?: string;
  status?: FrameworkStatus;
}

export function listFrameworks(params: FrameworksListParams = {}): Promise<FrameworksListResponse> {
  const qs = new URLSearchParams();
  if (params.page   !== undefined) qs.set('page',   String(params.page));
  if (params.limit  !== undefined) qs.set('limit',  String(params.limit));
  if (params.search)               qs.set('search', params.search);
  if (params.status)               qs.set('status', params.status);
  return competenciesFetch<FrameworksListResponse>(`/competencies/frameworks?${qs.toString()}`);
}

export function getFramework(id: string): Promise<FrameworkDetail> {
  return competenciesFetch<FrameworkDetail>(`/competencies/frameworks/${encodeURIComponent(id)}`);
}

export function createFramework(body: CreateFrameworkRequest): Promise<Framework> {
  return competenciesFetch<Framework>('/competencies/frameworks', 'POST', body);
}

export function updateFramework(id: string, body: UpdateFrameworkRequest): Promise<Framework> {
  return competenciesFetch<Framework>(`/competencies/frameworks/${encodeURIComponent(id)}`, 'PATCH', body);
}

export function deleteFramework(id: string): Promise<{ id: string }> {
  return competenciesFetch<{ id: string }>(`/competencies/frameworks/${encodeURIComponent(id)}`, 'DELETE');
}

export function addFrameworkSkill(id: string, body: AddFrameworkSkillRequest): Promise<FrameworkSkillRow> {
  return competenciesFetch<FrameworkSkillRow>(`/competencies/frameworks/${encodeURIComponent(id)}/skills`, 'POST', body);
}

export function removeFrameworkSkill(id: string, skillId: string): Promise<{ id: string }> {
  return competenciesFetch<{ id: string }>(`/competencies/frameworks/${encodeURIComponent(id)}/skills/${encodeURIComponent(skillId)}`, 'DELETE');
}

// ── Skill categories ─────────────────────────────────────────────────────────

export function listSkillCategories(): Promise<SkillCategory[]> {
  return competenciesFetch<SkillCategory[]>('/competencies/categories');
}

export function createSkillCategory(body: CreateSkillCategoryRequest): Promise<SkillCategory> {
  return competenciesFetch<SkillCategory>('/competencies/categories', 'POST', body);
}

export function updateSkillCategory(id: string, body: UpdateSkillCategoryRequest): Promise<SkillCategory> {
  return competenciesFetch<SkillCategory>(`/competencies/categories/${encodeURIComponent(id)}`, 'PATCH', body);
}

export function deleteSkillCategory(id: string): Promise<{ id: string }> {
  return competenciesFetch<{ id: string }>(`/competencies/categories/${encodeURIComponent(id)}`, 'DELETE');
}

// ── User skill profiles ───────────────────────────────────────────────────────

export function getUserSkills(userId: string): Promise<UserSkillEntry[]> {
  return competenciesFetch<UserSkillEntry[]>(`/competencies/users/${encodeURIComponent(userId)}/skills`);
}

// ── Assessments ────────────────────────────────────────────────────────────

export interface AssessmentsListParams {
  page?:    number;
  limit?:   number;
  userId?:  string;
  skillId?: string;
  type?:    AssessmentType;
  passed?:  boolean;
}

export function listAssessments(params: AssessmentsListParams = {}): Promise<AssessmentsListResponse> {
  const qs = new URLSearchParams();
  if (params.page    !== undefined) qs.set('page',    String(params.page));
  if (params.limit   !== undefined) qs.set('limit',   String(params.limit));
  if (params.userId)                qs.set('userId',  params.userId);
  if (params.skillId)               qs.set('skillId', params.skillId);
  if (params.type)                  qs.set('type',    params.type);
  if (params.passed  !== undefined) qs.set('passed',  String(params.passed));
  return competenciesFetch<AssessmentsListResponse>(`/competencies/assessments?${qs.toString()}`);
}

export function createAssessment(body: CreateAssessmentRequest): Promise<CreateAssessmentResponse> {
  return competenciesFetch<CreateAssessmentResponse>('/competencies/assessments', 'POST', body);
}

export type { Assessment };

// ── Skill gaps ─────────────────────────────────────────────────────────────

export interface SkillGapsParams {
  departmentId?: string;
  frameworkId?:  string;
  userId?:       string;
}

export function getSkillGaps(params: SkillGapsParams = {}): Promise<SkillGapsResponse> {
  const qs = new URLSearchParams();
  if (params.departmentId) qs.set('departmentId', params.departmentId);
  if (params.frameworkId)  qs.set('frameworkId',  params.frameworkId);
  if (params.userId)       qs.set('userId',       params.userId);
  return competenciesFetch<SkillGapsResponse>(`/competencies/skill-gaps?${qs.toString()}`);
}

// ── Import/Export ──────────────────────────────────────────────────────────

export interface ExportSkillsParams {
  search?:     string;
  categoryId?: string;
  level?:      SkillLevel;
  status?:     SkillStatus;
}

export function exportSkills(params: ExportSkillsParams = {}): Promise<ExportSkillsResponse> {
  const qs = new URLSearchParams();
  if (params.search)     qs.set('search',     params.search);
  if (params.categoryId) qs.set('categoryId', params.categoryId);
  if (params.level)      qs.set('level',      params.level);
  if (params.status)     qs.set('status',     params.status);
  return competenciesFetch<ExportSkillsResponse>(`/competencies/skills/export?${qs.toString()}`);
}

// Not routed through competenciesFetch — that helper always JSON.stringifies
// a body and unwraps `{ data }`; this is a multipart upload whose response is
// the flat `{ success, message, summary, errors }` shape (mirrors
// api/users.ts's importUsers).
export async function importSkills(file: File): Promise<SkillImportResult> {
  const token = getStoredToken();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetchWithRetry(`${BASE}/competencies/skills/import`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (res.status === 401) throw new CompetenciesApiError(401, 'Unauthorized — please log in again.');

  let json: Partial<SkillImportResult> & { message?: string } = {};
  try { json = await res.json(); } catch { /* empty body */ }

  if (!res.ok || json.success === false) {
    const msg =
      res.status === 429 ? 'Rate limited — slow down and retry.' :
      res.status === 503 ? 'Database not migrated yet. Run `npx prisma db push`.' :
      res.status === 500 ? 'Something went wrong on the server.' :
      json.message ?? `HTTP ${res.status}`;
    throw new CompetenciesApiError(res.status, msg);
  }

  return json as SkillImportResult;
}

// ── Competency Settings ────────────────────────────────────────────────────

export function getCompetencySettings(): Promise<CompetencySettings> {
  return competenciesFetch<CompetencySettings>('/competencies/settings');
}

export function updateCompetencySettings(body: UpdateCompetencySettingsRequest): Promise<CompetencySettings> {
  return competenciesFetch<CompetencySettings>('/competencies/settings', 'PATCH', body);
}

// ── Proficiency Levels ───────────────────────────────────────────────────────

export interface ProficiencyLevel {
  level: 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT' | 'CERTIFIED';
  minPercent: number;
  maxPercent: number;
  color: string;
  description: string | null;
}

export function getProficiencyLevels(): Promise<{ levels: ProficiencyLevel[] }> {
  return competenciesFetch<{ levels: ProficiencyLevel[] }>('/competencies/proficiency-levels');
}

export function updateProficiencyLevels(levels: ProficiencyLevel[]): Promise<{ levels: ProficiencyLevel[] }> {
  return competenciesFetch<{ levels: ProficiencyLevel[] }>('/competencies/proficiency-levels', 'PATCH', { levels });
}

// ── Skill distribution (CompetencySidePanel donut) ──────────────────────────

export type SkillDistribution = Record<ProficiencyLevel['level'], number>;

export function getSkillDistribution(skillId: string): Promise<SkillDistribution> {
  return competenciesFetch<SkillDistribution>(`/competencies/skills/${encodeURIComponent(skillId)}/distribution`);
}

// ── Competency Certifications (Certifications tab) ───────────────────────────

export interface CertificationsListParams {
  userId?:  string;
  skillId?: string;
  status?:  CertificationStatus;
  page?:    number;
  limit?:   number;
}

export function listCertifications(params: CertificationsListParams = {}): Promise<CertificationsListResponse> {
  const qs = new URLSearchParams();
  if (params.userId)              qs.set('userId',  params.userId);
  if (params.skillId)             qs.set('skillId', params.skillId);
  if (params.status)              qs.set('status',  params.status);
  if (params.page !== undefined)  qs.set('page',    String(params.page));
  if (params.limit !== undefined) qs.set('limit',   String(params.limit));
  return competenciesFetch<CertificationsListResponse>(`/competencies/certifications?${qs.toString()}`);
}

export function getCertification(id: string): Promise<CompetencyCertification> {
  return competenciesFetch<CompetencyCertification>(`/competencies/certifications/${encodeURIComponent(id)}`);
}

export function getUserCertifications(userId: string): Promise<CompetencyCertification[]> {
  return competenciesFetch<CompetencyCertification[]>(`/competencies/users/${encodeURIComponent(userId)}/certifications`);
}

export function assignCertification(req: AssignCertificationRequest): Promise<CompetencyCertification> {
  return competenciesFetch<CompetencyCertification>('/competencies/certifications', 'POST', req);
}

export function verifyCertification(id: string, notes?: string): Promise<CompetencyCertification> {
  return competenciesFetch<CompetencyCertification>(`/competencies/certifications/${encodeURIComponent(id)}/verify`, 'PATCH', { notes });
}

export function revokeCertification(id: string, reason: string): Promise<CompetencyCertification> {
  return competenciesFetch<CompetencyCertification>(`/competencies/certifications/${encodeURIComponent(id)}/revoke`, 'PATCH', { reason });
}

export function deleteCertification(id: string): Promise<{ id: string }> {
  return competenciesFetch<{ id: string }>(`/competencies/certifications/${encodeURIComponent(id)}`, 'DELETE');
}

export { CompetenciesApiError };
