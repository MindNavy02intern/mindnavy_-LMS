# 10 · Notifications — `/notifications`
Doc: Notifications §1–§13 · Entity: NOTIFICATION/CAMPAIGN (IMPACT §5.12 extension) · Status: `[built]` — shipped 2026-08-10, see `NOTIFICATIONS_CONTRACT.md`

## Topbar NotificationsPanel `[built]`

A drop-down panel opened by the bell icon in `AdminLayout.tsx` topbar. This is a **read surface** — it does not manage campaigns.

| Surface | Query key | Kind | Notes |
|---|---|---|---|
| Bell icon → panel open | `['notifications']` | read | Same key as dashboard widget and the `/notifications` page (rule R4 — one datum, one owner). Reads `GET /api/admin/dashboard/core → recentActivities` — unchanged, deliberately separate from the module's own `NotificationLog` data (contract decision #1) |
| Sidebar badge (shipped 2026-08-10) | — | read | Real unread count: `GET /api/admin/notifications?read=false&limit=1 → total`. Was a hardcoded `badge: 12` before this build |
| "Mark all read" button | — | mut stub | Still a UI stub — it operates on `recentActivities` (audit log), which has no real read-state; the module's own bulk mark-read lives on the In-App tab (`PATCH /notifications/read-all`) |
| "View all notifications →" | nav | nav | Shipped 2026-08-10 — navigates to `/notifications?tab=inapp` |

> **Rule R4 enforcement:** `['notifications']` is the single source of truth for notification data across three surfaces: this topbar panel, the Dashboard Notifications widget, and the future `/notifications` page. All three must read the same query key — never duplicate with a different key.

---

**Two hats:** (a) the notification *feed* consumed everywhere (`['notifications']`, §2 default sink), (b) this admin module that *manages* channels, templates, and campaigns.

## Tab: Notification Dashboard (`?tab=dashboard`) — `['notifications','stats']` (doc §1)
Widgets: sent, failed deliveries, pending, open rates, click rates, push delivery rate, SMS status, scheduled campaigns, active automation rules.
Actions: Create notification (dlg) · Send announcement (nav → §8) · Monitor delivery / export / analytics (read).

## Tab: Email Notifications (`?tab=email`) (doc §2)
System types (auto): welcome, enrollment, course approval, assignment reminders, quiz, certificate issued, payment confirmations, password reset, security alerts — event-triggered, backend.
Admin campaign actions: Create email→`emailCampaign.create` (→ §5.12) · Edit template→`template.update` · Preview (read) · Schedule→`campaign.schedule` · Send test→`campaign.sendTest` (local) · Export reports (read).

## Tab: Push Notifications (`?tab=push`) (doc §3)
Types: course updates, session reminders, deadlines, quiz alerts, instructor messages, promotions, platform updates, emergency.
Flow: create → select target users→`['users']`/`['groups']` → configure platforms → send→`pushCampaign.send` (→ §5.12) → track open rate (read).

## Tab: SMS Notifications (`?tab=sms`) (doc §4)
Types: OTP, login alerts, payment confirmations, session reminders, emergency, security. Mostly system-triggered; admin campaign→`smsCampaign.send` (→ §5.12). Gateway config lives in file 11.

## Tab: In-App Notifications (`?tab=inapp`) (doc §5)
Alerts: course updates, assignment feedback, instructor comments, new certificates, announcements, forum replies, group activity, security warnings. States: Unread/Read/Archived/Pinned → `notification.markRead/.archive/.pin` (local: `['notifications']`) — same IDs as dashboard widget (file 01).

## Tab: Automation Triggers (`?tab=automation`) — `['notifications','rules']` (doc §6)
Trigger events: registration, enrollment, completion, quiz failure, deadline, payment success, subscription expiry, session start, security events.
Mutations: `notificationRule.create/update/delete/toggle` (→ §5.12 rule row). Execution = backend.

## Tab: Templates (`?tab=templates`) — `['notification-templates']` (doc §7)
Types: email, push, SMS, announcement, security. Components: subject, body, dynamic variables, branding, CTA buttons, localization.
Actions: Create→`notificationTemplate.create` · Edit→`notificationTemplate.update` · Add variables (part of update) · Preview (read, `POST .../preview`) · Duplicate→`notificationTemplate.duplicate` · Delete→`notificationTemplate.delete` (all local: templates key).

## Tab: Announcement Center (`?tab=announcements`) (doc §8)
Types: platform, maintenance, promotions, company updates, live events, emergency.
Targeting: all users / students / instructors / departments→`['org','departments']` / groups→`['groups']` / custom segments.
Send→`announcement.send` (→ §5.12; lands in every targeted user's `['notifications']`).

## Tab: Scheduled (`?tab=scheduled`) — `['campaigns',{status:'scheduled'}]` (doc §9)
Options: immediate, date/time, recurring, timezone delivery, trigger-based.
Actions: Schedule→`campaign.schedule` · Pause→`campaign.pause` · Cancel→`campaign.cancel` · Duplicate→`campaign.duplicate` (local: campaigns) · Delivery calendar (read, feeds `['calendar']`).

## Tab: User Preferences (`?tab=preferences`) (doc §10)
User-side: email/push/SMS prefs, marketing, learning alerts, security, quiet hours.
Admin-side: force mandatory notifications, opt-out policies, global rules, defaults → `notificationPrefs.updateGlobal` (local: `['notifications','settings']`).

## Tab: Delivery Logs (`?tab=logs`) — read-only (doc §11)
Sent, failed, bounces, opens, clicks, device status, interactions. Actions: search/export (read) · Retry failed→`delivery.retry` (local).

## Tab: Analytics (`?tab=analytics`) — read-only (doc §12)
Open rate, click rate, delivery success, trends, most/failed campaigns, device analytics, response metrics. Views: daily/weekly/monthly/comparison.

## Emergency Alerts (`?tab=emergency`) (doc §13)
Types: security breaches, downtime, compliance warnings, payment failures, session failures, platform emergencies.
Flow: critical event → escalation → multi-channel send → admins alerted → audit. Manual trigger→`emergencyAlert.send` (→ §5.12 + `['security','alerts']`).

## `[phase-later]`: AI optimization, smart timing, A/B testing, geo targeting, fatigue detection.
