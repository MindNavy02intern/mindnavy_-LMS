# 11 · Integrations — `/integrations`
Doc: Integrations §1–§14 · Entity: INTEGRATION (IMPACT §5.15 extension) · Status: `[planned]`

**Module nature:** connection/config surfaces. Domain reflections are indirect — e.g., connecting Zoom changes what the Live Session form offers (file 04 providers list reads `['integrations',{type:'video'}]`).

## Tab: Integration Dashboard (`?tab=dashboard`) — `['integrations','stats']` (doc §1)
Widgets: active integrations, failed connections, API usage, sync status, webhook activity, auth status, recent events, health score.
Actions: Connect new (dlg) · Disconnect→`integration.disconnect` (→ §5.15) · Monitor/logs (read) · Configure sync rules→`sync.configure` (local).

## Category tabs — one pattern, seven instances (doc §2–§8)
Every category tab = provider cards + the same action set:
| Action | Kind | Mutation ID | Impact |
|---|---|---|---|
| Connect provider | dlg→mut | `integration.connect` | → §5.15 (credentials → validation → sandbox test → activated) |
| Configure API keys / settings | dlg→mut | `integration.configure` | local: `['integrations']` |
| Enable test/sandbox mode | mut | `integration.testMode` | local |
| Test connection / monitor | read | — | — |
| Disconnect | dlg→mut | `integration.disconnect` | → §5.15 |

| Tab | Providers (doc) | Downstream surface affected |
|---|---|---|
| Payment (`?tab=payment`) | Stripe, PayPal, Razorpay, Apple Pay, Google Pay, bank APIs | Checkout methods + file 09 gateways (single source: `['gateways']`) |
| Video conferencing (`?tab=video`) | Zoom, Google Meet, MS Teams, built-in | Live session provider dropdown (file 04) |
| Email service (`?tab=email`) | SMTP/providers | Email sending health (file 10) |
| SMS gateway (`?tab=sms`) | SMS providers | SMS campaigns (file 10) |
| HR & ERP (`?tab=hr`) | HR/ERP systems | User sync jobs → `['users']` after sync |
| CRM (`?tab=crm`) | CRM systems | Contact sync |
| Cloud storage (`?tab=storage`) | AWS S3, GCS, Azure, CDN | Upload targets (file 12 §10) |
| Authentication (`?tab=auth`) | SSO, LDAP, SAML, OAuth | Login methods (file 12 §7) |

## Tab: API Management (`?tab=api`) — `['api-keys']` (doc §10)
Actions: Generate key→`apiKey.generate` (→ §5.15) · Configure permissions→`apiKey.configure` (gates from file 03 §29) · Revoke→`apiKey.revoke` (→ §5.15) · Monitor usage (read).

## Tab: Webhooks & Automation (`?tab=webhooks`) — `['webhooks']` (doc §11)
Actions: `webhook.create/update/delete/toggle` (→ §5.15 webhook row) · View delivery attempts (read).

## Tab: Marketplace (`?tab=marketplace`) `[phase-later]` (doc §12)

## Tab: Data Sync Center (`?tab=sync`) (doc §13)
Actions: Run sync→`sync.run` (local: `['integrations','sync']` + target entity keys on completion, e.g. HR sync → `['users']`) · Configure→`sync.configure` (local).

## Tab: Logs & Monitoring (`?tab=logs`) — read-only (doc §14)
Integration events, errors, retries. Search/export = read.
