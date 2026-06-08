// Field names match GET /api/admin/users contract exactly.
// Do NOT rename these — they must stay in sync with the backend response.

export type UserStatus        = 'active' | 'suspended' | 'pending' | 'archived' | 'invited';
export type VerificationState = 'verified' | 'pending' | 'rejected' | 'expired';

export interface User {
  id:                string;
  fullName:          string;
  email:             string;
  avatar:            string | null;
  role:              string;
  phone:             string | null;
  department:        string | null;
  branch:            string | null;
  status:            UserStatus;
  verificationState: VerificationState;
  lastActivityAt:    string | null;
  riskScore:         null;
  enrollmentCount:   number;
  createdAt:         string;
}

export interface KpiSummary {
  totalUsers:                number;
  totalUsersChange:          number;
  activeUsers:               number;
  activeUsersChange:         number;
  pendingVerification:       number;
  pendingVerificationChange: number;
  suspendedUsers:            number;
  suspendedUsersChange:      number;
  invitationsPending:        number;
  invitationsPendingChange:  number;
}

export interface Pagination {
  page:       number;
  limit:      number;
  total:      number;
  totalPages: number;
}

export interface UsersResponse {
  kpiSummary: KpiSummary;
  users:      User[];
  pagination: Pagination;
}

// ── Task 6B: User Details ──────────────────────────────────────────────────────

export type RoleType    = 'primary' | 'secondary' | 'temporary';
export type RiskScore   = 'low' | 'medium' | 'high' | 'critical';
export type CourseStatus = 'active' | 'completed' | 'dropped';

export interface UserDetails {
  id:                string;
  fullName:          string;
  email:             string;
  phone:             string | null;
  avatar:            string | null;
  role:              string;
  department:        string | null;
  branch:            string | null;
  status:            UserStatus;
  verificationState: VerificationState;
  emailVerified:     boolean;
  phoneVerified:     boolean;
  riskScore:         null;
  createdAt:         string;
  lastActivityAt:    string | null;
}

export interface UserRole {
  id:        string;
  name:      string;
  type:      RoleType;
  expiresAt: string | null;
}

export interface SecurityOverview {
  mfaEnabled:      boolean;
  activeSessions:  number;
  lastIpAddress:   string | null;
  lastLocation:    string | null;
  riskScore:       RiskScore;
}

export interface ActivityItem {
  id:        string;
  action:    string;
  timestamp: string;
  ipAddress: string | null;
}

export interface EnrolledCourse {
  id:       string;
  title:    string;
  progress: number;
  status:   CourseStatus;
}

export interface UserDetailsResponse {
  user:             UserDetails;
  roles:            UserRole[];
  securityOverview: SecurityOverview;
  recentActivity:   ActivityItem[];
  enrolledCourses:  EnrolledCourse[];
}

// ── Task 6C: Action request / response types ──────────────────────────────────

export interface CreateUserRequest {
  fullName:         string;
  email:            string;
  password:         string;
  phone:            string | null;
  role:             string;
  department:       string | null;
  branch:           string | null;
  groupId:          string | null;
  accessLevel:      string | null;
  managerId:        string | null;
  skills:           string[] | null;
  customAttributes: Record<string, unknown> | null;
}

export interface UpdateUserRequest {
  fullName:    string;
  phone:       string | null;
  department:  string | null;
  branch:      string | null;
  groupId:     string | null;
  accessLevel: string | null;
  managerId:   string | null;
  skills:      string[] | null;
}

export interface SuspendUserRequest {
  reason: string;
  notes:  string | null;
}

export interface AssignRoleRequest {
  roleId:    string;
  type:      RoleType;
  expiresAt: string | null;
}

export interface ActionResponse {
  message: string;
  user:    Partial<User>;
}
