// Field names match GET /api/admin/organization/* contract exactly.

export type DeptStatus          = 'ACTIVE' | 'INACTIVE';
export type BranchLocationType  = 'HEAD_OFFICE' | 'REGIONAL' | 'LOCAL';
export type ComplianceStatus    = 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING';
export type TeamStatus          = 'ACTIVE' | 'INACTIVE';
export type OrgNodeType         = 'COMPANY' | 'BRANCH' | 'DEPARTMENT' | 'TEAM' | 'USER';

// ── Department ─────────────────────────────────────────────────────────────────

export interface Department {
  id:           string;
  name:         string;
  code?:        string;
  description?: string;
  branchId:     string;
  branchName?:  string;
  managerId?:   string;
  managerName?: string;
  budget:       number;
  status:       DeptStatus;
  userCount:    number;
  createdAt:    string;
  updatedAt:    string;
}

export interface DepartmentDetail extends Department {
  manager?: { id: string; fullName: string; email: string };
  members:  Array<{ id: string; fullName: string; email: string; role: string }>;
  teams:    Array<{ id: string; name: string; memberCount: number }>;
  kpis:     { totalUsers: number; activeUsers: number; completionRate: number; averageProgress: number };
}

export interface CreateDepartmentBody {
  name:        string;
  code?:       string;
  description?: string;
  branchId:    string;
  managerId?:  string;
  budget:      number;
  status:      DeptStatus;
}

// ── Branch ─────────────────────────────────────────────────────────────────────

export interface Branch {
  id:               string;
  name:             string;
  locationType:     BranchLocationType;
  address:          string;
  city:             string;
  country:          string;
  latitude?:        number;
  longitude?:       number;
  phone?:           string;
  email?:           string;
  managerId?:       string;
  status:           'ACTIVE' | 'INACTIVE';
  userCount:        number;
  departmentCount:  number;
  complianceStatus: ComplianceStatus;
  createdAt:        string;
  updatedAt:        string;
}

export interface BranchDetail extends Branch {
  manager?:    { id: string; fullName: string; email: string };
  departments: Array<{ id: string; name: string; userCount: number }>;
  users:       Array<{ id: string; fullName: string; email: string }>;
  metrics:     { totalUsers: number; activeUsers: number; departments: number };
}

export interface CreateBranchBody {
  name:         string;
  locationType: BranchLocationType;
  address:      string;
  city:         string;
  country:      string;
  latitude?:    number;
  longitude?:   number;
  phone?:       string;
  email?:       string;
  managerId?:   string;
  status:       'ACTIVE' | 'INACTIVE';
}

// ── Team ───────────────────────────────────────────────────────────────────────

export interface Team {
  id:                      string;
  name:                    string;
  departmentId:            string;
  departmentName?:         string;
  leaderId?:               string;
  leaderName?:             string;
  description?:            string;
  status:                  TeamStatus;
  memberCount:             number;
  averageLearningProgress: number;
  createdAt:               string;
  updatedAt:               string;
}

export interface TeamDetail extends Team {
  department:   { id: string; name: string };
  leader?:      { id: string; fullName: string; email: string };
  members:      Array<{ id: string; fullName: string; email: string; learningProgress: number }>;
  learningPaths: Array<{ id: string; name: string; completionRate: number }>;
  metrics:      { totalMembers: number; averageProgress: number; completedCertificates: number };
}

export interface CreateTeamBody {
  name:          string;
  departmentId:  string;
  leaderId?:     string;
  description?:  string;
  status:        TeamStatus;
}

// ── Org Chart ──────────────────────────────────────────────────────────────────

export interface OrgChartNode {
  id:       string;
  label:    string;
  type:     OrgNodeType;
  parentId?: string;
  data:     { name: string; userCount?: number; status?: string; manager?: string };
  position?: { x: number; y: number };
  style?:   { background: string; border: string };
}

export interface OrgChartEdge {
  id:       string;
  source:   string;
  target:   string;
  animated: boolean;
}

export interface OrgChart {
  nodes: OrgChartNode[];
  edges: OrgChartEdge[];
}

// ── Hierarchy Settings ─────────────────────────────────────────────────────────

export interface HierarchySettings {
  id:                          string;
  allowMultiReporting:         boolean;
  maxReportingLevels:          number;
  requireManagerApproval:      boolean;
  applyRoleBasedAccess:        boolean;
  departmentHeadsSeeOwnOnly:   boolean;
  inheritPermissionsFromParent: boolean;
  allowPermissionOverride:     boolean;
  requireApprovalForMoves:     boolean;
  approvalLevels:              number;
  autoApproveAfterDays:        number;
  customRules?:                string;
  createdAt:                   string;
  updatedAt:                   string;
}

// ── Shared pagination ──────────────────────────────────────────────────────────

export interface OrgPagination {
  page:  number;
  limit: number;
  total: number;
  pages: number;
}

export interface DepartmentsResponse { data: Department[]; pagination: OrgPagination }
export interface BranchesResponse    { data: Branch[];     pagination: OrgPagination }
export interface TeamsResponse       { data: Team[];       pagination: OrgPagination }
