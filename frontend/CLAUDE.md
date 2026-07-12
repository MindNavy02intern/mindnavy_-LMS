# Claude Project Instructions — frontend/

> **Monorepo note:** this file governs ALL frontend work. The companion
> reference files live **one level up at the monorepo root**:
> - `../docs/blueprint/` (INDEX.md + 13 page files) — UI spec
> - `../IMPACT_MAP.md` — reflection / invalidation map
> - `../graphify-out/GRAPH_REPORT.md` + `dependency-report.html` — code graph

---

## 0. Project references (read FIRST, route by task)

Three reference layers exist **at the monorepo root (one level above `frontend/`)**:
- `../docs/blueprint/` (INDEX.md + 13 page files) — the UI SPEC: every page,
  tab, table column, filter, dropdown, and button → mutation ID → impact ref.
- `../IMPACT_MAP.md` — the REFLECTION map: mutation → query keys to
  invalidate → surfaces that visibly change.
- `../graphify-out/GRAPH_REPORT.md` + `dependency-report.html` /
  `../graphify-out/graph.json` — the ACTUAL code graph.

On EVERY feature / UI task:
1. Read `../docs/blueprint/INDEX.md` and follow its routing table — read ONLY
   the page files the task touches, plus the IMPACT_MAP §5 rows for the
   touched entities. Never read all 19 files.
2. Build exactly what the page file specifies (tabs, columns, filters, actions,
   query keys).
3. Routes in the blueprint are placeholders — verify against the real router
   before using one, and correct the blueprint if they differ.

On architecture / code-connection questions:
- First read `../graphify-out/GRAPH_REPORT.md`. Then check
  `dependency-report.html` or `../graphify-out/graph.json` to audit code
  connections — unlinked/orphan files, missing imports, state updates not
  connected between the User modules and the Dashboard. Then open only the
  specific source files that are relevant.
- Do NOT read `../graphify-out/graph.html` unless explicitly asked (large
  browser visualization). Do NOT scan the whole project unless absolutely
  necessary.

Blueprint = what SHOULD exist. Graph report = what ACTUALLY exists. When they
disagree, report the gap — don't silently fix either side.

## 1. Data reflection protocol (MANDATORY)

- Every mutation invalidates via `invalidateFor()` using its IMPACT_MAP §5 row
  + the §2 defaults (`['activity']`, `['notifications']`,
  `['dashboard','stats']`). Ad-hoc `queryClient.invalidateQueries` calls
  outside `src/lib/invalidation.ts` are forbidden.
  (If `src/lib/invalidation.ts` doesn't exist yet, building it per
  IMPACT_MAP §6 is the prerequisite task — flag it.)
- Displayed numbers are NEVER computed or adjusted client-side (no manual
  +1/−1) — invalidate and refetch (rule R1). Optimistic updates are allowed
  for lists, never for aggregates.
- Dropdowns/selects always read their source entity's query key (rule R2):
  role dropdown reads `['roles']`, department reads `['org','departments']`.
  Hardcoded option arrays are forbidden.
- One datum, one owner: two surfaces showing "the same number" must consume
  the same query key and endpoint field (rule R4).

## 2. Keep the maps alive (same change, not later)

After every task, in the SAME change:
- Update the blueprint page file: status markers `[built]`/`[partial]`, rows
  for any new tabs/actions/buttons.
- Update IMPACT_MAP (§5 row + §4 surface/key) AND `INVALIDATION_MAP` for any
  new mutation or surface.
- New button/surface/mutation with no row yet → add the row FIRST, then
  implement.
A stale map is a failing review, not documentation debt.

## 3. Tests (CRITICAL)

For EVERY new feature or endpoint you build, ALWAYS create a Playwright test
file (`*.full.spec.ts`) as part of the SAME task — don't wait to be asked, and
don't end the task without it. Building a feature without a test is incomplete
work.
When you add a new test file, also add its name to the authenticated project's
`testMatch` regex in `playwright.config.ts` — it's an explicit allowlist, so a
file not listed there is silently ignored (this gap was hit with
access-policies and stats-consistency).
Reflection tests: any mutation that changes a dashboard number gets a
reflection test per IMPACT_MAP §7 — mutate via the UI → navigate back to the
Dashboard → assert the number reflects the change WITHOUT a hard reload.
NEVER run the Playwright tests. The user runs them manually.
Always end by confirming you did NOT run them, and give the exact command,
e.g. `npx playwright test <name>.full --workers=1`.
Match existing test patterns (waitForResponse on real API calls, robust
locators by label text, unique/timestamped data so the suite is re-runnable).

## 4. Before building any feature

Verify the backend actually exists (routes, controller, service, Prisma
model). Endpoints named in the blueprint or IMPACT_MAP are CONTRACT
placeholders, not proof of existence — verify the same way.
If a "ready backend" is claimed, confirm it by hitting the API directly first.
If a new Prisma model was added, the table may not exist yet — flag that the
user needs to run `npx prisma db push` (do NOT run it yourself; it changes the
shared DB).
Mock data lives behind the `USE_MOCK` flag in the API files and must match
contract shapes field-by-field, so swapping mock→real changes zero frontend
code.
Never assume — check.

### 4.1 Parent-child / dependent-entity flows (MANDATORY CHECK)

Before building ANY feature where one entity references, attaches to, or
depends on another entity (a lesson attaching a video, a section belonging
to a course, an assignment belonging to a role, etc.), explicitly determine
and document:

1. **Does the backend require the parent/referenced entity to already exist
   in the database — with the correct field values already saved — before
   the dependent action is allowed?** Check this in the actual
   controller/service code or by testing directly (curl), not by assuming.
2. If yes, the UI and the test MUST follow the real sequence:
   - Step 1: create/save the parent entity (with the correct type/state)
     as its own action, and wait for that save to actually complete.
   - Step 2: only THEN allow/perform the dependent action (upload, attach,
     link), scoped to the now-real ID.
   - The UI must visibly gate the dependent action until step 1 succeeds
     (disable the control + show a clear message like "Save X first"),
     not just fail silently or throw a confusing backend error at the user.
3. Never assume a single combined step works just because the form LOOKS
   like one screen. A single screen/modal can still require two sequential
   API calls underneath — verify this explicitly before writing the test.
4. Playwright tests for such features must reproduce the REAL sequence:
   perform step 1 as a genuine action and wait for its real response,
   THEN perform step 2 — never fabricate or assume an ID that hasn't
   actually been returned by a real API call.

This class of bug (assuming one step when the backend needs two) has
caused wasted cycles before — treat it as a first-class check, same
priority as verifying the backend exists (§4).

## 5. When tests / things fail

First determine: is it a TEST bug or a REAL APP bug?
Verify backend correctness directly (curl the endpoint) before blaming code.
Add diagnostic logging to find the real cause — don't guess-fix or mask
issues.
Many failures are rate-limiting after rapid data creation, not real bugs.

## 6. Source of truth & precedence

When sources conflict, the precedence is:
**backend API contract > blueprint > task description.**
The code must match the real API, not an outdated description.
Example: if the contract's apply endpoint takes `{ roleId }`, build a ROLE
picker even if the description says "select user" — sending the wrong ID
fails.
If you spot such a conflict (including task vs blueprint), flag it to the user
BEFORE building.

## 7. Code quality

TypeScript strict is on — keep it clean (zero errors).
Don't reintroduce set-state-in-effect warnings.
Don't weaken tests just to make them pass.
Don't hardcode counts/values that should come from the API (drift-bug risk —
enforced by rules R1/R2 above).
Never paste real secret keys or passwords; keep `.env` in `.gitignore`.

## 8. Before editing

Explain what you found and ask for confirmation.
Keep explanations simple — the user is learning.

## 9. Review work before calling it done (act as a senior reviewer)

When a feature or fix is finished, review it like a careful senior engineer
BEFORE saying it's done. Don't just check syntax — question the logic and
intent. Look for:
- Logic bugs: does it actually do what it should? Any number/value shown in
  two places that could drift apart (read from different or hardcoded
  sources)?
- Reflections: every mutation wired through `invalidateFor()` with its FULL
  IMPACT_MAP row — no missing surfaces, no ad-hoc invalidations.
- Maps updated: blueprint status markers, IMPACT_MAP, and INVALIDATION_MAP
  reflect this change (section 2).
- Security: exposed secrets/keys/passwords, missing auth checks.
- Missing tests: a feature added without a test guarding it (see section 3 —
  this should never happen, but double-check).
- Parent-child sequencing: for any dependent-entity feature (§4.1), confirm
  the UI actually gates the dependent action until the parent save
  completes, and the test reproduces the real two-step sequence.
- Data flow: state that should refresh but doesn't; stats reading a wrong
  source.
- Edge cases: null/undefined, empty states, error handling.
- Consistency: does it match existing patterns in the codebase?
Report each issue (file, what's wrong, why it matters, suggested fix). Don't
fix silently — surface problems and let the user decide. Be honest and
critical.