# 05 · Instructors — `/instructors`
Doc: Instructors §1–§16 · Entities: INSTRUCTOR (IMPACT §5.3), COURSE (§5.4), FINANCE (§5.7) · Status: `[partial]`

> **Backend v1 shipped 2026-08-03** — contract: `INSTRUCTORS_CONTRACT.md` (root).
> Built: All Instructors tab (list/filters/tabs/stats), instructor CRUD + verify /
> suspend / reactivate / archive, the Applications queue with approve / reject /
> request-changes, and the public "Become Instructor" submit endpoint.
> **Frontend v1 shipped 2026-08-05 (task 104)** — `/instructors` route + page:
> All Instructors / Active / Inactive / Suspended / Top Performers tabs (real
> `GET /instructors?tab=…`), Pending Approval tab (applications endpoint), the
> instructor side panel (`GET /instructors/:id`), Add/Edit/Verify/Suspend/
> Reactivate/Delete/Message actions, and the Applications approve/reject/
> request-changes queue. Import/Export reuse the Users module's CSV endpoints
> filtered to `role=INSTRUCTOR` per the contract (no separate exporter built).
> **Invitations tab** reuses the `inactive` bucket client-filtered to
> `status==='invited'` — the contract has no dedicated tab value for it.
> **Payouts tab** renders an explicit "not available yet" empty state — no
> Payment/Transaction model exists (see note below). Earnings/Documents/
> Communication Center/Suspension&Compliance beyond suspend/reactivate remain
> `[planned]` — same reason. Reviews and Certifications are `[built]` — see
> Phase C+D note below.
>
> An instructor IS an `AppUser` with `role = INSTRUCTOR` plus an optional
> `InstructorProfile` side table — there is no separate instructors table, and
> `:id` everywhere is the AppUser id (the same value in `Course.instructorId`).
>
> **Phase B shipped 2026-08-07**: Instructor Courses tab (side panel, real
> `GET /courses?instructor=&status=` — no separate instructors-scoped endpoint
> exists, per contract), Suspension & Compliance (violation-type dropdown now
> required + suspension history read from the audit log), and Documents
> (upload/verify/reject/archive, signed-URL 3-step upload, no CERTIFICATION
> type — that's a separate unshipped entity).
>
> Tabs below that stay `[planned]` because their data has no model yet:
> **Earnings & Revenue**, and every payout, badge, warning and restriction
> mutation beyond suspend/reactivate. `rating` and `revenue` on the instructor
> ROW (list/stats/analytics) are still returned as `null` with
> `available: false` — render `—`, never `0` — those come from AppUser
> aggregates, not the review row itself.
>
> **Phase C+D shipped 2026-08-07**: Instructor Reviews tab (side panel —
> `InstructorReview` moderation queue: approve/remove/flag) and Certifications
> tab (side panel — `InstructorCertification`, sign→PUT→create upload flow,
> verify/reject/delete). **Neither is in `INSTRUCTORS_CONTRACT.md` v1** — that
> contract explicitly lists both as `[planned]` gaps ("no Review model" /
> "Certifications deliberately did NOT ship... decision for Hassan, not a
> bug"). Built anyway at the user's explicit direction after the conflict was
> flagged — see the contract's own note for the full context. Anyone touching
> this area should reconcile the contract doc with reality before assuming its
> "Known gaps" section is current.

## Module sections (doc §1)
All Instructors · Applications · Approval · Profiles · Instructor Courses · Live Sessions · Analytics · Earnings & Revenue · Reviews · Certifications · Documents · Communication Center · Suspension & Compliance

---

## Tab: All Instructors (`?tab=all`) — `['instructors', filters]` (doc §2) `[built]`
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

## Tab: Applications (`?tab=applications`) — `['instructor-applications']` (doc §3–§4) `[built]`
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

## Tab: Instructor Courses (profile sub-tab) — `['courses',{instructorId,status}]` (doc §6) `[built]`
Status views: All · Draft · Pending Approval · Published · Archived · Rejected (client sub-tabs over `GET /courses?instructor=&status=`).
Table columns: Title · Category · Students (`enrolledCount`) · Status · Updated (`updatedAt` — list rows have no `createdAt`) · Actions.
Actions: Open (read, reuses `CourseQuickViewModal`) · Approve→`course.approve` (Pending only) · Reject→`course.reject` (Pending only, reason modal) · Unpublish→`course.unpublish` (Published only) · Archive→`course.archive` (Draft/Rejected only) — **same mutation IDs as file 04**, never fork instructor-specific variants. Rejected badge is derived from `isRejected`, not `status` (a rejected course's real status is Draft).

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

## Tab: Reviews (side panel sub-tab) — `['instructors',id,'reviews']` (doc §10) `[built]`
NOT in `INSTRUCTORS_CONTRACT.md` v1 (documented there as a deliberate gap — "no Review model"). `InstructorReview` model: `instructorId`/`studentId`/`courseId` (no `CourseEnrollment` dependency check — a review can exist without an active enrollment, same trust level as the rest of this admin-only queue). List columns: rating (★), comment, course, student, date, status badge (PENDING yellow / APPROVED green / REMOVED red / FLAGGED orange).
| Action | Kind | Mutation ID | Impact |
|---|---|---|---|
| Approve | mut | `review.moderate` | local: `['instructors',id,'reviews']`, `['dashboard','instructor-performance']` |
| Remove | mut | `review.moderate` | same as above |
| Flag | mut | `review.moderate` | same as above |
Endpoints: `GET /instructors/:id/reviews` · `PATCH .../reviews/:reviewId/approve` \| `/remove` \| `/flag`. `Respond` stays `[planned]` — no such endpoint (not requested).

## Tab: Certifications (side panel sub-tab) — `['instructors',id,'certifications']` (doc §11) `[built]`
NOT in `INSTRUCTORS_CONTRACT.md` v1 (documented there as a deliberately unshipped, SEPARATE entity from Documents §12). `InstructorCertification` model: name, type (TEACHING/PROFESSIONAL/ACADEMIC/TECHNICAL/TRAINING), issuer, optional file. Upload is admin-side only (no instructor-facing app exists) — same sign→client PUT→create 3-step flow as Documents, own private bucket/prefix (`instructors/<id>/certifications/`).
| Action | Kind | Mutation ID | Impact |
|---|---|---|---|
| Upload | dlg→mut | `instructorCert.upload` | local: `['instructors',id,'certifications']`, `['instructors',id]` |
| Verify | mut | `instructorCert.verify` | local: certifications + `['approvals']` |
| Reject | mut | `instructorCert.reject` | local: certifications + `['approvals']` |
| Delete | mut | `instructorCert.delete` | local: `['instructors',id,'certifications']` (hard delete — no ARCHIVED status in this model, unlike Documents) |
Endpoints: `GET /instructors/:id/certifications` · `POST .../certifications/sign` · `POST .../certifications` · `PATCH .../certifications/:certId/verify` \| `/reject` · `DELETE .../certifications/:certId`.

## Tab: Documents (`?tab=documents`) — `['instructors',id,'documents']` (doc §12) `[built]`
Stored: identity docs, contracts, agreements, tax docs, compliance records. **No CERTIFICATION type** — teaching certs/licences/degrees are a separate unshipped entity (doc §11), sending one is a 400.
Actions: Upload→`instructorDoc.upload` (sign → direct PUT to storage → confirm; 3 real requests, API never receives the file) · Verify→`instructorDoc.verify` (Pending only) · Reject→`instructorDoc.reject` (Pending only, reason required ≥3 chars) · Archive/Delete→`instructorDoc.archive` (soft — file stays, compliance record) · Download (read — `downloadUrl` is signed, expires in 5 min, refetched on every click, never cached). `Replace` stays `[planned]` — no such endpoint; contract's answer is upload a new document.

## Communication Center (doc §13) — shared with file 10
Types: direct messages, email broadcasts, announcements, warnings, feedback, policy updates. Flow: select instructor → compose → attach → send → track read. `message.send` / `announcement.send` (file 10 IDs).

## Tab: Suspension & Compliance (side panel, within Overview) (doc §14) `[partial]`
Violations: copyright, policy, fraudulent content, inappropriate behavior, fake certifications, security — `violationType` dropdown is now **required** on the Suspend modal (contract's stated end state; was optional pre-dropdown).
| Action | Mutation ID | Impact |
|---|---|---|
| Suspend instructor (violation type + reason ≥20 chars) | `instructor.suspend` | → §5.3 (their courses are NOT unpublished in v1 — open decision) |
| Reactivate instructor | `instructor.reactivate` | → §5.3 |
| View suspension history (`GET …/suspension-history`, reads the audit log) | read | — |
| Warn instructor | `instructor.warn` | `[planned]` — local: `['instructors',id]` + `['notifications']` |
| Restrict publishing | `instructor.publishRestrict` | `[planned]` — local + affects course create gating |
| Disable live sessions | `instructor.liveDisable` | `[planned]` — local + `['live-sessions']` |
| Freeze revenue | `instructor.revenueFreeze` | `[planned]` — local: earnings + `['dashboard','revenue']` |
| Permanent ban | `instructor.ban` | `[planned]` — → §5.3 suspend row, irreversible flag |

## `[phase-later]` (doc §15): badges system, multi-instructor courses, AI insights, leaderboards, auto-recording, performance alerts, contract management, availability, reputation.
