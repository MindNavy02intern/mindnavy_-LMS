# 05 · Instructors — `/instructors`
Doc: Instructors §1–§16 · Entities: INSTRUCTOR (IMPACT §5.3), COURSE (§5.4), FINANCE (§5.7) · Status: `[partial]`

> **Backend v1 shipped 2026-08-03** — contract: `INSTRUCTORS_CONTRACT.md` (root).
> Built: All Instructors tab (list/filters/tabs/stats), instructor CRUD + verify /
> suspend / reactivate / archive, the Applications queue with approve / reject /
> request-changes, and the public "Become Instructor" submit endpoint.
> **Frontend is not built** — the `/instructors` sidebar link exists in
> `AdminLayout.tsx` but has no route or page yet (task 104).
>
> An instructor IS an `AppUser` with `role = INSTRUCTOR` plus an optional
> `InstructorProfile` side table — there is no separate instructors table, and
> `:id` everywhere is the AppUser id (the same value in `Course.instructorId`).
>
> Tabs below that stay `[planned]` because their data has no model yet:
> **Earnings & Revenue**, **Reviews**, **Certifications**, **Documents**,
> **Suspension & Compliance** (beyond suspend/reactivate), and every payout,
> badge, warning and restriction mutation. `rating` and `revenue` are returned
> as `null` with `available: false` — render `—`, never `0`.

## Module sections (doc §1)
All Instructors · Applications · Approval · Profiles · Instructor Courses · Live Sessions · Analytics · Earnings & Revenue · Reviews · Certifications · Documents · Communication Center · Suspension & Compliance

---

## Tab: All Instructors (`?tab=all`) — `['instructors', filters]` (doc §2) `[backend built]`
**Table columns:** Name · Profile image · Expertise · Courses count · Student count · Rating · Revenue · Verification status · Account status · Last activity
| Action | Kind | Mutation ID | Impact |
|---|---|---|---|
| View profile | nav | — | → `/admin/instructors/:id` |
| Edit instructor | dlg→mut | `instructor.update` | local: `['instructors']`, `['instructors', id]` |
| View courses | nav | — | → profile Courses tab |
| Message instructor | dlg→mut | `message.send` | local: `['notifications']` |
| Verify instructor | mut | `instructor.verify` | local: `['instructors']`, `['instructors', id]` |
| Suspend account | dlg→mut | `instructor.suspend` | → IMPACT §5.3 (⚠️ course rule — contract question) |
| Delete instructor | dlg→mut | `instructor.delete` | → §5.3 + courses/earnings cascade check |

## Tab: Applications (`?tab=applications`) — `['instructor-applications']` (doc §3–§4) `[backend built]`
Public "Become Instructor" form feeds this queue. Submission data: name, email, phone, bio, skills, experience, certifications, CV, portfolio links, identity documents. Submit (public) → `instructorApplication.submit` (→ §5.3) → status Pending Review → admin notification.
**Review areas:** bio, experience, skills, documents, certifications, portfolio, identity verification, compliance checks.
| Decision | Mutation ID | Impact |
|---|---|---|
| Approve → create instructor account (active) | `instructorApplication.approve` | → §5.3 |
| Reject (reason required, applicant notified) | `instructorApplication.reject` | → §5.3 |
| Request changes (return to applicant) | `instructorApplication.requestChanges` | local: `['instructor-applications']` + `['notifications']` |

## Page: Instructor Profile (`/admin/instructors/:id`) — `['instructors', id]` (doc §5)
**Sections/tabs:** Personal info · Biography · Expertise · Certifications · Courses · Reviews & ratings · Student statistics · Revenue overview (`['instructors',id,'earnings']`) · Activity logs · Uploaded documents
**Controls:** Edit profile→`instructor.update` · Verify→`instructor.verify` · Assign badge→`instructor.badge.assign` (local) · Restrict access→`instructor.restrict` (local + permissions) · View analytics (nav) · Suspend→`instructor.suspend` (→ §5.3)

## Tab: Instructor Courses (profile sub-tab) — `['courses',{instructorId,status}]` (doc §6)
Status views: Draft · Pending Approval · Published · Archived · Rejected.
Actions: Open/Review (nav/read) · Approve→`course.approve` · Reject→`course.reject` · Request changes→`course.requestChanges` · Unpublish→`course.unpublish` · Archive→`course.archive` — **same mutation IDs as file 04**, never fork instructor-specific variants.

## Tab: Live Sessions (`?tab=sessions`) — `['live-sessions',{instructorId}]` (doc §7)
Info: title, related course, date/time, duration, participants, attendance, recording status, rating.
Controls: Join/Monitor/Moderate chat (read `[phase-later]`) · Remove participant→`liveSession.removeParticipant` (local) · End session→`liveSession.end` (→ §5.4) · Download recording (read).

## Tab: Analytics (`?tab=analytics`) — `['dashboard','instructor-performance']` + per-id (doc §8)
Read-only: enrollment, completion, engagement, ratings, quiz performance, watch time, attendance, revenue, feedback. Views: daily/weekly/monthly/custom. Export = read.

## Tab: Earnings & Revenue (`?tab=earnings`) — `['instructors',id,'earnings']` (doc §9)
Data: course sales, revenue share, commission, pending payouts, completed payouts, refunds, tax reports.
| Action | Kind | Mutation ID | Impact |
|---|---|---|---|
| Approve payout | mut | `payout.approve` | → IMPACT §5.7 |
| Hold payment | mut | `payout.hold` | local: earnings + `['transactions','recent']` |
| Generate invoice | mut | `invoice.generate` | → §5.7 invoice row (file 09) |
| Apply/modify commission | mut | `commission.update` | local: earnings + `['dashboard','revenue']` |
| Export financial report | read | — | — |
Payout pipeline (backend): sale → revenue share calc → balance → admin approval → transfer.

## Tab: Reviews (`?tab=reviews`) — `['instructors',id,'reviews']` (doc §10)
Data: rating, comment, course, student, date. Source event: student completes course → leaves review (student side).
Moderation: Approve→`review.approve` · Remove spam→`review.remove` · Flag abuse→`review.flag` · Respond→`review.respond` — all → §5.3 review row (`['dashboard','instructor-performance']` included).

## Tab: Certifications (`?tab=certifications`) (doc §11)
Types: teaching certs, licenses, degrees, technical certs, training records. Upload (instructor side) → verification queue.
Actions: Verify authenticity / Approve→`instructorCert.approve` · Reject→`instructorCert.reject` · Request additional proof→`instructorCert.requestProof` (all local: `['instructors',id]` + `['approvals']` if queued).

## Tab: Documents (`?tab=documents`) — `['instructors',id,'documents']` (doc §12)
Stored: identity docs, contracts, agreements, tax docs, certifications, compliance records.
Actions: Upload→`instructorDoc.upload` · Replace→`instructorDoc.replace` · Verify→`instructorDoc.verify` · Archive→`instructorDoc.archive` (all local) · Download (read).

## Communication Center (doc §13) — shared with file 10
Types: direct messages, email broadcasts, announcements, warnings, feedback, policy updates. Flow: select instructor → compose → attach → send → track read. `message.send` / `announcement.send` (file 10 IDs).

## Tab: Suspension & Compliance (`?tab=compliance`) (doc §14)
Violations: copyright, policy, fraudulent content, inappropriate behavior, fake certifications, security.
| Action | Mutation ID | Impact |
|---|---|---|
| Warn instructor | `instructor.warn` | local: `['instructors',id]` + `['notifications']` |
| Restrict publishing | `instructor.publishRestrict` | local + affects course create gating |
| Suspend instructor | `instructor.suspend` | → §5.3 (workflow: restrictions → notify → courses status updated → audit) |
| Disable live sessions | `instructor.liveDisable` | local + `['live-sessions']` |
| Freeze revenue | `instructor.revenueFreeze` | local: earnings + `['dashboard','revenue']` |
| Permanent ban | `instructor.ban` | → §5.3 suspend row, irreversible flag |

## `[phase-later]` (doc §15): badges system, multi-instructor courses, AI insights, leaderboards, auto-recording, performance alerts, contract management, availability, reputation.
