// Types for the standalone Roles & Permissions page.
// Distinct from types/rolesPermissions.ts which serves the embedded tab.

export type RoleStatus = 'ACTIVE' | 'INACTIVE';

export interface RolePage {
  id: string;
  name: string;
  description: string | null;
  status: RoleStatus;
  permissionCount: number;
  userCount: number;
  isCustomRole: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string | null;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface RolePageDetails extends RolePage {
  permissions: Permission[];
}

export interface RolePageStats {
  totalRoles: number;
  activeRoles: number;
  inactiveRoles: number;
  totalPermissions: number;
  usersWithRoles: number;
}

export interface RolesPagePagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface RolesPageResponse {
  data: RolePage[];
  pagination: RolesPagePagination;
}

export interface CreateRolePagePayload {
  name: string;
  description: string | null;
  status: RoleStatus;
}

// ── Permission Matrix ─────────────────────────────────────────────────────────

export type PermissionCategory =
  | 'USERS' | 'REPORTS' | 'SETTINGS' | 'ORGANIZATION'
  | 'LEARNERS' | 'COURSES' | 'ADMIN';

export interface MatrixRole {
  id: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  userCount: number;
  permissionCount: number;
}

export interface MatrixPermission {
  id: string;
  name: string;
  description: string | null;
  category: PermissionCategory;
}

export interface MatrixAssignment {
  roleId: string;
  permissionId: string;
}

export interface PermissionMatrixData {
  roles: MatrixRole[];
  permissions: MatrixPermission[];
  assignments: MatrixAssignment[];
  summary: {
    totalRoles: number;
    totalPermissions: number;
    totalAssignments: number;
  };
}
