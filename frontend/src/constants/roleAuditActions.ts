// Every role-related AuditAction the Roles & Permissions page surfaces —
// Company Roles CRUD + Delegated Admins grant/revoke. Filtered server-side via
// the `actions` CSV param (backend reports.validator.js) against the existing
// GET /reports/audit endpoint — reports.service.getAuditReports stays the one
// owner of that query (R4), no parallel /audit-logs endpoint.
//
// Shared by AuditTrackingTab (the full table) and RecentRoleActivityPreviewCard
// (the 4-row preview that links to it). Both MUST read this list: a card
// previewing a different action set than the tab it opens is a drift bug.
export const ROLE_AUDIT_ACTIONS = [
  'COMPANY_ROLE_CREATED', 'COMPANY_ROLE_UPDATED', 'COMPANY_ROLE_DELETED',
  'DELEGATED_ADMIN_GRANTED', 'DELEGATED_ADMIN_REVOKED',
];

// Window both surfaces query. Role changes are low-frequency — a 30-day
// default would leave the card empty on most installs.
export const ROLE_AUDIT_RANGE = 'quarter' as const;

export const ROLE_AUDIT_ACTION_LABEL: Record<string, string> = {
  COMPANY_ROLE_CREATED: 'Company role created',
  COMPANY_ROLE_UPDATED: 'Company role updated',
  COMPANY_ROLE_DELETED: 'Company role deleted',
  DELEGATED_ADMIN_GRANTED: 'Delegated admin granted',
  DELEGATED_ADMIN_REVOKED: 'Delegated admin revoked',
};

// Fallback for any audit action without an explicit label above — backend
// actions are SCREAMING_SNAKE_CASE.
export function humanizeAuditAction(action?: string): string {
  if (!action) return 'Activity';
  return ROLE_AUDIT_ACTION_LABEL[action]
    ?? action.toLowerCase().split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
}
