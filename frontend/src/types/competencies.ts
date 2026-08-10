// Competencies — types per COMPETENCIES_CONTRACT.md. Field names mirror the
// backend service response shapes 1:1 (competencies.service.js /
// competencies.controller.js), same convention as types/instructors.ts /
// types/learners.ts.

import type { Pagination } from './lm';

export class CompetenciesApiError extends Error {
  status: number;
  // 409 SKILL_IN_USE responses carry { userProfiles, assessments, frameworks, courseMappings }.
  data?: Record<string, unknown>;
  constructor(status: number, message: string, data?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'CompetenciesApiError';
  }
}

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT' | 'CERTIFIED';
export type SkillStatus = 'ACTIVE' | 'ARCHIVED';
export type FrameworkStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
export type FrameworkImportance = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type SkillCategoryStatus = 'ACTIVE' | 'ARCHIVED';
export type AssessmentType = 'QUIZ' | 'PRACTICAL' | 'ASSIGNMENT' | 'LIVE_EVALUATION' | 'CERTIFICATION_EXAM';

export const SKILL_LEVELS: SkillLevel[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT', 'CERTIFIED'];
export const FRAMEWORK_IMPORTANCE: FrameworkImportance[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
export const ASSESSMENT_TYPES: AssessmentType[] = ['QUIZ', 'PRACTICAL', 'ASSIGNMENT', 'LIVE_EVALUATION', 'CERTIFICATION_EXAM'];

export type Metric = {
  value:         number | null;
  changePercent: number | null;
  available:     boolean;
  reason?:       string;
};

// ── Skills (Part 1) ────────────────────────────────────────────────────────

export interface Skill {
  id:                 string;
  name:               string;
  description:        string | null;
  categoryId:         string | null;
  categoryName:       string | null;
  level:              SkillLevel;
  status:             SkillStatus;
  linkedCoursesCount: number;
  assignedUsersCount: number;
  createdById:        string | null;
  createdAt:          string;
  updatedAt:          string;
}

export interface SkillLinkedCourse {
  mappingId: string;
  courseId:  string;
  title:     string | null;
  status:    string | null;
  createdAt: string;
  missing:   boolean;
}

export interface SkillDetail extends Skill {
  linkedCourses: SkillLinkedCourse[];
}

export interface SkillsListResponse {
  skills:     Skill[];
  pagination: Pagination;
}

export interface CreateSkillRequest {
  name: string;
  description?: string;
  categoryId?:  string;
  level?:       SkillLevel;
  status?:      SkillStatus;
}
export type UpdateSkillRequest = Partial<CreateSkillRequest>;

// ── Stats (6 cards) ──────────────────────────────────────────────────────────

export interface CompetenciesStats {
  totalCompetencies:    Metric;
  competencyFrameworks: Metric;
  assessedUsers:        Metric;
  proficiencyAchieved:  Metric;
  skillGaps:            Metric;
  inProgress:           Metric;
}

// ── Analytics (6 sections) ───────────────────────────────────────────────────

export interface NamedCountItem { name: string; count: number; percentage: number }
export interface GapOverviewItem { level: string; count: number; percentage: number }

export interface ProficiencyTrend {
  available:         boolean;
  labels:            string[];
  avgProficiency:    number[];
  // Derived from framework required levels — null months mean zero frameworks
  // existed, never a fabricated value.
  targetProficiency: (number | null)[];
}

export interface TopCompetencyItem {
  id:             string;
  name:           string;
  category:       string | null;
  usersAssessed:  number;
  proficiencyAvg: number;
  importance:     FrameworkImportance | null;
}

export interface CompetencyMatrixRow {
  role:   string;
  // Keyed by competency name; null = no (role, skill) data yet, never 0.
  values: Record<string, number | null>;
}

export interface CompetencyMatrix {
  available:     boolean;
  roles:         string[];
  competencies:  string[];
  data:          CompetencyMatrixRow[];
}

export interface RecentActivityItem {
  id:        string;
  type:      string;
  title:     string;
  by:        string | null;
  createdAt: string;
}

export interface CompetenciesAnalytics {
  competenciesByCategory: { available: boolean; items: NamedCountItem[] };
  skillGapOverview:       { available: boolean; items: GapOverviewItem[] };
  proficiencyTrend:       ProficiencyTrend;
  topCompetencies:        { available: boolean; items: TopCompetencyItem[] };
  competencyMatrix:       CompetencyMatrix;
  recentActivities:       { available: boolean; items: RecentActivityItem[] };
}

// ── Frameworks (Part 2) ──────────────────────────────────────────────────────

export interface Framework {
  id:                string;
  name:              string;
  description:       string | null;
  status:            FrameworkStatus;
  competenciesCount: number;
  usersMapped:       number;
  createdById:       string | null;
  createdAt:         string;
  updatedAt:         string;
}

export interface FrameworkSkillRow {
  frameworkSkillId: string;
  skillId:          string;
  skillName:        string | null;
  category:         string | null;
  requiredLevel:    SkillLevel;
  importance:       FrameworkImportance;
  createdAt:        string;
}

export interface FrameworkDetail extends Framework {
  skills: FrameworkSkillRow[];
}

export interface FrameworksListResponse {
  frameworks: Framework[];
  pagination: Pagination;
}

export interface CreateFrameworkRequest {
  name: string;
  description?: string;
  status?: FrameworkStatus;
}
export type UpdateFrameworkRequest = Partial<CreateFrameworkRequest>;

export interface AddFrameworkSkillRequest {
  skillId:       string;
  requiredLevel: SkillLevel;
  importance?:   FrameworkImportance;
}

// ── Skill categories (Part 2) ────────────────────────────────────────────────

export interface SkillCategory {
  id:          string;
  name:        string;
  description: string | null;
  color:       string | null;
  parentId:    string | null;
  status:      SkillCategoryStatus;
  skillCount:  number;
  createdAt:   string;
  updatedAt:   string;
  children?:   SkillCategory[]; // present on root nodes only
}

export interface CreateSkillCategoryRequest {
  name: string;
  description?: string;
  color?:       string;
  parentId?:    string;
}
export interface UpdateSkillCategoryRequest {
  name?: string;
  description?: string;
  color?: string;
  parentId?: string | null;
  status?: SkillCategoryStatus;
}

// ── User skill profiles (Part 2) ─────────────────────────────────────────────

export interface UserSkillEntry {
  skillId:             string;
  skillName:           string;
  category:            string | null;
  currentLevel:        SkillLevel | null;
  proficiencyPercent:  number | null;
  assessedAt:          string | null;
  missing:             boolean;
}

// ── Assessments (Part 2) ─────────────────────────────────────────────────────

export interface Assessment {
  id:           string;
  userId:       string;
  userName:     string | null;
  skillId:      string;
  skillName:    string | null;
  score:        number;
  maxScore:     number;
  passed:       boolean;
  type:         AssessmentType;
  assessedById: string | null;
  createdAt:    string;
}

export interface AssessmentsListResponse {
  assessments: Assessment[];
  pagination:  Pagination;
}

export interface CreateAssessmentRequest {
  userId:  string;
  skillId: string;
  score:   number;
  maxScore: number;
  type:    AssessmentType;
  assessedById?: string;
}

export interface CreateAssessmentResponse {
  assessment: Assessment;
  // null when Settings' "auto-update skill level after assessment" toggle is
  // off and the user had no prior UserSkillProfile row to return instead.
  profile: {
    userId: string;
    skillId: string;
    currentLevel: SkillLevel;
    proficiencyPercent: number;
    assessedAt: string;
  } | null;
}

// ── Skill gaps (Part 2) ──────────────────────────────────────────────────────

export interface SkillGapItem {
  userId:        string;
  userName:      string | null;
  skillId:       string;
  skillName:     string | null;
  frameworkId:   string;
  frameworkName: string | null;
  requiredLevel: SkillLevel;
  currentLevel:  SkillLevel;
  gapSize:       number;
}

export interface SkillGapsResponse {
  gaps: SkillGapItem[];
}

// ── Import/Export (Import/Export tab) ────────────────────────────────────────

export interface ExportSkillsResponse {
  skills: Skill[];
  total:  number;
}

export interface SkillImportError {
  row:     number;
  name:    string | null;
  message: string;
}

export interface SkillImportSummary {
  totalRows: number;
  created:   number;
  failed:    number;
  skipped:   number;
}

export interface SkillImportResult {
  success: boolean;
  message: string;
  summary: SkillImportSummary;
  errors:  SkillImportError[];
}

// ── Competency Settings (Settings tab) ───────────────────────────────────────

export interface CompetencySettings {
  id:                      string;
  passingThresholdPercent: number;
  gapSeverityCritical:     number;
  gapSeverityHigh:         number;
  gapSeverityMedium:       number;
  autoUpdateLevelOnAssess: boolean;
  defaultAssessmentType:   AssessmentType;
  createdAt:               string;
  updatedAt:               string;
}

export type UpdateCompetencySettingsRequest = Partial<Omit<CompetencySettings, 'id' | 'createdAt' | 'updatedAt'>>;
