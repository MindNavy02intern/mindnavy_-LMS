Claude Project Instructions

1. Before ANY architecture / code question


First read graphify-out/GRAPH_REPORT.md.
Then check dependency-report.html or graphify-out/graph.json to audit code
connections — look for unlinked/orphan files, missing imports, or state updates
not connected between the User modules and the Dashboard.
Then open only the specific source files that are relevant.
Do NOT read graphify-out/graph.html unless explicitly asked (it's a large
browser visualization).
Do NOT scan the whole project unless absolutely necessary.


2. Tests (CRITICAL)


For EVERY new feature or endpoint you build, ALWAYS create a Playwright test file
(*.full.spec.ts) as part of the SAME task — don't wait to be asked, and don't
end the task without it. Building a feature without a test is incomplete work.
When you add a new test file, also add its name to the authenticated project's
testMatch regex in playwright.config.ts — it's an explicit allowlist, so a
file not listed there is silently ignored (this gap was hit with access-policies
and stats-consistency).
NEVER run the Playwright tests. The user runs them manually.
Always end by confirming you did NOT run them, and give the exact command, e.g.
npx playwright test <name>.full --workers=1.
Match existing test patterns (waitForResponse on real API calls, robust locators
by label text, unique/timestamped data so the suite is re-runnable).


3. Before building any feature


Verify the backend actually exists (routes, controller, service, Prisma model).
If a "ready backend" is claimed, confirm it by hitting the API directly first.
If a new Prisma model was added, the table may not exist yet — flag that the user
needs to run npx prisma db push (do NOT run it yourself; it changes the shared DB).
Never assume — check.


4. When tests / things fail


First determine: is it a TEST bug or a REAL APP bug?
Verify backend correctness directly (curl the endpoint) before blaming code.
Add diagnostic logging to find the real cause — don't guess-fix or mask issues.
Many failures are rate-limiting after rapid data creation, not real bugs.


5. Contract vs description (source of truth)


When a task description conflicts with the backend API contract/endpoints, the
CONTRACT WINS. The code must match the real API, not an outdated description.
Example: if the contract's apply endpoint takes { roleId }, build a ROLE
picker even if the description says "select user" — sending the wrong ID fails.
If you spot such a conflict, flag it to the user before building.


6. Code quality


TypeScript strict is on — keep it clean (zero errors).
Don't reintroduce set-state-in-effect warnings.
Don't weaken tests just to make them pass.
Don't hardcode counts/values that should come from the API (drift-bug risk).
Never paste real secret keys or passwords; keep .env in .gitignore.


7. Before editing


Explain what you found and ask for confirmation.
Keep explanations simple — the user is learning.


8. Review work before calling it done (act as a senior reviewer)

When a feature or fix is finished, review it like a careful senior engineer BEFORE
saying it's done. Don't just check syntax — question the logic and intent. Look for:


Logic bugs: does it actually do what it should? Any number/value shown in two
places that could drift apart (read from different or hardcoded sources)?
Security: exposed secrets/keys/passwords, missing auth checks.
Missing tests: a feature added without a test guarding it (see section 2 — this
should never happen, but double-check).
Data flow: state that should refresh but doesn't; stats reading a wrong source.
Edge cases: null/undefined, empty states, error handling.
Consistency: does it match existing patterns in the codebase?
Report each issue (file, what's wrong, why it matters, suggested fix). Don't fix
silently — surface problems and let the user decide. Be honest and critical.