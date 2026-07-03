# 13 · Audit & Security — `/trusted-devices`
Doc: Audit & Security §1–§20 · Entities: sinks (audit/security events) + SECURITY actions · Status: `[partial]` — `TrustedDevicesPage.tsx` at `/trusted-devices` `[built]` (shows trusted login devices, revoke device); full Audit & Security suite (audit log table, security dashboard, threat monitor, compliance reports) `[planned]`. Backend `AuditLog` model exists; `/audit-logs` endpoint missing (Hassan to add).

**Module nature:** ~90% read/monitoring surfaces over backend-written logs. The few mutations are security responses. Frontend never fabricates log entries (IMPACT §5.10).

## Tabs & surfaces
| # | Tab | Reads | Actions (mut in **bold**) |
|---|---|---|---|
| 1 | Security Dashboard (`?tab=dashboard`) | `['security','stats']` + `['security','alerts']` | Open sections (nav), export (read) |
| 2 | Audit Logs (`?tab=audit`) | `['audit', filters]` | Filter/search/export (read), investigate (nav) |
| 3 | User Activity Monitoring (`?tab=activity`) | `['audit',{scope:'users'}]` | read |
| 4 | Login & Session Tracking (`?tab=sessions`) | `['security','sessions']` | **Revoke session→`user.revokeSessions`** (file 02 ID), **Force logout→`user.forceLogout`** |
| 5 | Access Control Monitoring (`?tab=access`) | `['audit',{scope:'roles'}]` | read (deep link → file 03 audit tab — same key, one source) |
| 6 | Threat Detection (`?tab=threats`) | `['security','threats']` | **Resolve/dismiss→`securityAlert.resolve`** (local: threats+alerts) |
| 7 | Security Alerts (`?tab=alerts`) | `['security','alerts']` | **Resolve→`securityAlert.resolve`** · **Escalate→`incident.create`** (→ `['security','incidents']` + `['tasks']`) |
| 8 | Device Management (`?tab=devices`) | `['security','devices']` | **Block device→`device.block`** · **Approve device→`device.approve`** (local: devices; affects user sessions) |
| 9 | IP & Geo Monitoring (`?tab=ip`) | `['security','ip']` | **Block IP→`ip.block`** · **Unblock→`ip.unblock`** (local; enforcement = policy engine, file 03 §19) |
| 10 | Compliance Center (`?tab=compliance`) | compliance endpoints | read + export |
| 11 | Data Protection (`?tab=data`) | `['security','dataProtection']` | **Update protection rules→`settings.security.update`** (file 12 ID — one source) |
| 12 | Backup Security (`?tab=backup`) | `['system','backups']` | read here; run/restore live in file 12 §14 |
| 13 | Incident Management (`?tab=incidents`) | `['security','incidents']` | **Create→`incident.create`** · **Update/respond→`incident.update`** · **Close→`incident.close`** (local + `['tasks']`, `['notifications']`) |
| 14 | Security Policies (`?tab=policies`) | `['policies']` (file 03 key) | **`policy.create/update/delete`** — same IDs as file 03; do not fork |
| 15 | Vulnerability Monitoring (`?tab=vulnerabilities`) `[phase-later]` | — | read |
| 16 | Risk Analysis (`?tab=risk`) `[phase-later]` | — | read |
| 17 | Forensics & Investigation (`?tab=forensics`) `[phase-later]` | — | read/export |
| 18 | Retention & Archiving (`?tab=retention`) | `['security','retention']` | **Update retention rules→`retention.update`** (local; affects archived-user policy checks, file 02 §12) |
| 19 | SIEM & Enterprise Monitoring (`?tab=siem`) `[phase-later]` | — | read |
| 20 | Security Reports (`?tab=reports`) | report endpoints | Export PDF/Excel/CSV + `reportSchedule.create` (file 08 ID) |

## Cross-links
- Security Alerts here = SAME `['security','alerts']` as the dashboard widget (file 01 §15). Resolving an alert reflects in both without extra work.
- Sensitive-permission validations (MFA, secondary approval — file 03 §14) log here.
- Every §5 mutation in the whole app produces an audit row (IMPACT §8 B3) — this module is where they surface.
