# 07 · Competencies — `/competencies`
Doc: Competencies §1–§12 · Entity: COMPETENCY/SKILL (IMPACT §5.11 — extension) · Status: `[planned]`

## Module sections
Skills Library · Skill Categories · Frameworks · Skill Levels · Assessments · Competency Mapping · Learning Path Mapping · Skill Profiles · Certifications · Skill Gap Analysis · Compliance Skills · Analytics

## Tab: Skills Library (`?tab=skills`) — `['competencies']` (doc §1)
**Filters:** Category→`['competencies','categories']` · Level (enum) · Certification status.
**Table columns:** Skill name · Category · Level · Linked courses · Assigned users · Certification status · Last updated.
| Action | Kind | Mutation ID | Impact |
|---|---|---|---|
| Create skill | dlg→mut | `skill.create` | → IMPACT §5.11 |
| Edit skill | dlg→mut | `skill.update` | → §5.11 |
| Delete skill | dlg→mut | `skill.delete` | → §5.11 |
| Assign to course | mut | `skill.assignToCourse` | local: `['competencies']`, `['courses', id]` |
| Assign to learning path | mut | `skill.assignToPath` | local: `['competencies']`, `['learning-paths']` |
| View analytics | nav | — | → `?tab=analytics` |

## Tab: Skill Categories (`?tab=categories`) — `['competencies','categories']` (doc §2)
Examples: Technical, Leadership, Communication, Compliance, Sales, Soft skills.
Actions: `skillCategory.create/update/archive` (→ §5.11 category row) · Organize hierarchy→`skillCategory.reorder` (local).

## Tab: Frameworks (`?tab=frameworks`) — `['competencies','frameworks']` (doc §3)
Structure per framework: role name, required skills→`['competencies']`, required levels, certifications, learning requirements. (e.g. Frontend Developer: HTML, CSS, JS, React.)
Mutations: `framework.create/update/delete` (local: frameworks key).

## Tab: Skill Levels (`?tab=levels`) (doc §4)
Ladder: Beginner → Intermediate → Advanced → Expert → Certified. Config: customize levels, requirements, passing rules, thresholds → `skillLevel.configure` (local: `['competencies','levels']`; affects profile rendering).

## Tab: Assessments (`?tab=assessments`) (doc §5)
Types: quizzes, practical tasks, assignments, live evaluations, certification exams.
Create/edit → `skillAssessment.create/update` (local). **Completion flow (student side):** score calculated → skill level updated → competency profile updated → analytics refreshed = backend chain feeding `['users',id,'skills']` + `['competencies','analytics']`.

## Tab: Competency Mapping (`?tab=mapping`) (doc §6–§7)
Mapping types: course→skill, quiz→skill, assignment→skill, certificate→skill, path→skill. Learning path mapping: progression beginner→certified + system recommendations `[phase-later]`.
Mutation: `competencyMap.link` / `competencyMap.unlink` (local: `['competencies']`, target entity key).

## Skill Profiles (surface inside User/Student profile — files 02/06) — `['users',id,'skills']` (doc §8)
Displays: skill, current level, progress, assessment results, certifications, missing skills. Read-only here; changes flow from assessments/mappings.

## Tab: Certifications (`?tab=certifications`) (doc §9)
Tracking: issued, expiring, verification status, skill validation, compliance certs.
Actions: Verify→`competencyCert.verify` · Revoke→`competencyCert.revoke` · Assign→`competencyCert.assign` (local: `['users',id,'skills']`, `['competencies']`) · Export (read).

## Tab: Skill Gap Analysis (`?tab=gaps`) — read-only `[phase-later]` (doc §10)
Detects: missing skills, weak competencies, expired certs, incomplete paths, compliance risks + recommendations.

## Tab: Compliance Skills (`?tab=compliance`) (doc §11)
Mandatory training tracking: completion, expired training, retraining, risk alerts — read surfaces over `['competencies']` + enrollments.

## Tab: Analytics (`?tab=analytics`) — `['competencies','analytics']` (doc §12)
Metrics: most completed skills, missing skills, department levels, certification rates, effectiveness, readiness, training progress. Filters: department, team, category, role, date range. Read-only.
