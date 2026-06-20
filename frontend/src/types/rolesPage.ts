// Types for the standalone Roles & Permissions page.
// Distinct from types/rolesPermissions.ts which serves the embedded tab.

export type RoleLevel           = 'System' | 'Department' | 'Branch' | 'Functional' | 'Default';
export type AccessScope         = 'Global' | 'Department' | 'Branch' | 'Course';
export type RiskClassification  = 'Low' | 'Medium' | 'High' | 'Critical';
export type PageRoleStatus      = 'Active' | 'Inactive' | 'Archived';

export interface RolePage {
  id:               string;
  name:             string;
  description:      string | null;
  level:            RoleLevel;
  usersCount:       number;
  permissionsCount: number;
  scope:            AccessScope;
  status:           PageRoleStatus;
  riskClassification: RiskClassification;
  priority:         number;
  departmentScope:  string | null;
  branchScope:      string | null;
  createdAt:        string;
  updatedAt:        string;
}

export interface RolePageDetails {
  id:               string;
  name:             string;
  description:      string | null;
  level:            RoleLevel;
  scope:            AccessScope;
  status:           PageRoleStatus;
  riskClassification: RiskClassification;
  priority:         number;
  departmentScope:  string | null;
  branchScope:      string | null;
  createdAt:        string;
  updatedAt:        string;
  totalPermissions:   number;
  assignedUsers:      number;
  mfaRequired:        boolean;
  sensitivePermissions: number;
  lastAccessReview:   string | null;
  complianceStatus:   'Compliant' | 'Non-Compliant';
  lastModifiedBy:     string | null;
  permissionBreakdown: {
    fullAccess: number;
    readOnly:   number;
    custom:     number;
    noAccess:   number;
  };
}

export interface RolePageStats {
  totalRoles:              number;
  totalRolesChange:        number;
  activeRoles:             number;
  activeRolesChange:       number;
  usersWithRoles:          number;
  usersWithRolesChange:    number;
  permissionSets:          number;
  permissionSetsChange:    number;
  accessPolicies:          number;
  accessPoliciesChange:    number;
  highRiskPermissions:     number;
  highRiskPermissionsChange: number;
}

export interface RolesPagePagination {
  page:       number;
  limit:      number;
  total:      number;
  totalPages: number;
}

export interface RolesPageResponse {
  roles:      RolePage[];
  pagination: RolesPagePagination;
}

export type PermissionsByCategory = Record<string, string[]>;

export interface CreateRolePagePayload {
  name:               string;
  description:        string | null;
  level:              RoleLevel;
  riskClassification: RiskClassification;
  priority:           number;
  scope:              AccessScope;
  departmentScope:    string | null;
  branchScope:        string | null;
  permissions:        PermissionsByCategory;
}
