// Field names match GET /api/admin/users contract exactly.
// Do NOT rename these — they must stay in sync with the backend response.

export type UserStatus       = 'active' | 'suspended' | 'pending' | 'archived' | 'invited';
export type VerificationState = 'verified' | 'pending' | 'rejected' | 'expired';

export interface User {
  id:                string;
  fullName:          string;
  email:             string;
  avatar:            string | null;
  role:              string;
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
