# Graph Report - .  (2026-05-23)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 237 nodes · 304 edges · 18 communities (14 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b5e9248d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 17 edges
2. `compilerOptions` - 16 edges
3. `useAuth()` - 15 edges
4. `supabase` - 7 edges
5. `scripts` - 5 edges
6. `delay()` - 5 edges
7. `getAuthErrorMessage()` - 5 edges
8. `scripts` - 4 edges
9. `getPasswordStrength()` - 4 edges
10. `getTrustedDevices()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `AdminLayout()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/layouts/AdminLayout.tsx → frontend/src/AuthContext.tsx
- `DashboardPage()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/pages/DashboardPage.tsx → frontend/src/AuthContext.tsx
- `LoginPage()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/pages/LoginPage.tsx → frontend/src/AuthContext.tsx
- `SignupPage()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/pages/SignupPage.tsx → frontend/src/AuthContext.tsx
- `TrustedDevicesPage()` --calls--> `useAuth()`  [EXTRACTED]
  frontend/src/pages/TrustedDevicesPage.tsx → frontend/src/AuthContext.tsx

## Communities (18 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (20): AdminLayout(), NAV, Props, DashboardPage(), StatProps, LoginPage(), SignupPage(), TrustedDevicesPage() (+12 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (20): delay(), getTrustedDevices(), MOCK_DEVICES, mockDeviceStore, revokeDevice(), sendOtp(), verifyOtp(), DeviceCard() (+12 more)

### Community 2 - "Community 2"
Cohesion: 0.10
Nodes (14): updatePassword(), getPasswordStrength(), PasswordStrengthMeter(), REQUIREMENTS, Props, ResetPasswordForm(), ForgotPasswordStep, PasswordChecks (+6 more)

### Community 3 - "Community 3"
Cohesion: 0.12
Nodes (6): requestPasswordReset(), Props, Props, Props, supabase, getAuthErrorMessage()

### Community 4 - "Community 4"
Cohesion: 0.10
Nodes (20): author, dependencies, cors, dotenv, express, @prisma/client, description, devDependencies (+12 more)

### Community 5 - "Community 5"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 7 - "Community 7"
Cohesion: 0.12
Nodes (15): dependencies, bootstrap, react, react-dom, react-router-dom, @supabase/supabase-js, name, private (+7 more)

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (13): devDependencies, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, @types/node, @types/react (+5 more)

### Community 9 - "Community 9"
Cohesion: 0.33
Nodes (5): code:js (export default defineConfig([), code:js (// eslint.config.js), Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

## Knowledge Gaps
- **105 isolated node(s):** `allow`, `name`, `version`, `description`, `main` (+100 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAuth()` connect `Community 0` to `Community 1`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `supabase` connect `Community 3` to `Community 0`, `Community 2`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `Community 8` to `Community 7`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `allow`, `name`, `version` to the rest of the system?**
  _105 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06736353077816493 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09243697478991597 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09971509971509972 - nodes in this community are weakly interconnected._