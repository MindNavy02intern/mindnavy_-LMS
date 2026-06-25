// End-to-end smoke tests for the Role Templates API against a RUNNING server.
// Verifies the real routes (auth, validation, DB, JSON shapes) without touching
// any data permanently — it creates a uniquely-named template and deletes it.
//
// Setup (one time):
//   1. cd backend && npx prisma db push && node prisma/seed.js
//   2. npm run dev            (server on http://localhost:5001)
//   3. Grab your admin Bearer token (browser DevTools → Application → Local Storage,
//      or the value sent as "Authorization: Bearer <token>" in the Network tab).
//
// Run:
//   ADMIN_TOKEN=<your-token> node --test tests/roleTemplates.e2e.test.js
//   (optionally  API_BASE=http://localhost:5001/api/admin )
//
// If ADMIN_TOKEN is not set, the whole suite is SKIPPED (so it never fails in CI/locally
// without a server).

const { test, describe, before, after } = require("node:test");
const assert = require("node:assert");

const BASE  = process.env.API_BASE ?? "http://localhost:5001/api/admin";
const TOKEN = process.env.ADMIN_TOKEN;
const skip  = TOKEN ? false : "ADMIN_TOKEN not set — skipping live e2e tests";

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

describe("Role Templates API (e2e)", { skip }, () => {
  // Shared state captured during setup.
  const state = { createdId: null, roleId: null, permissionIds: [] };

  before(async () => {
    // A role to apply templates to.
    const roles = await api("/roles?limit=1");
    assert.strictEqual(roles.status, 200, "GET /roles should be 200");
    state.roleId = roles.json.data?.[0]?.id ?? null;
    assert.ok(state.roleId, "need at least one existing role (run the seed)");

    // A couple of real permission IDs to build a template from.
    const perms = await api("/permissions?limit=3");
    assert.strictEqual(perms.status, 200, "GET /permissions should be 200");
    state.permissionIds = (perms.json.data ?? []).map((p) => p.id);
    assert.ok(state.permissionIds.length > 0, "need at least one permission (run the seed)");
  });

  after(async () => {
    // Always clean up the template this suite created.
    if (state.createdId) await api(`/role-templates/${state.createdId}`, { method: "DELETE" });
  });

  test("requires auth (401 without token)", async () => {
    const res = await fetch(`${BASE}/role-templates`);
    assert.strictEqual(res.status, 401);
  });

  test("GET /role-templates lists templates with permissionCount", async () => {
    const { status, json } = await api("/role-templates");
    assert.strictEqual(status, 200);
    assert.strictEqual(json.success, true);
    assert.ok(Array.isArray(json.data));
    assert.ok(json.pagination && typeof json.pagination.total === "number");
    for (const t of json.data) {
      assert.strictEqual(typeof t.permissionCount, "number");
      assert.strictEqual(t.permissions, undefined, "list must NOT ship the permissions array");
    }
  });

  test("POST /role-templates creates a template", async () => {
    const name = `__test_tpl_${Date.now()}`;
    const { status, json } = await api("/role-templates", {
      method: "POST",
      body: { name, description: "temp test", permissions: state.permissionIds },
    });
    assert.strictEqual(status, 201);
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.data.permissionCount, state.permissionIds.length);
    state.createdId = json.data.id;
  });

  test("POST rejects unknown permission ids with 400 + missing[]", async () => {
    const { status, json } = await api("/role-templates", {
      method: "POST",
      body: { name: `__test_bad_${Date.now()}`, permissions: ["does-not-exist"] },
    });
    assert.strictEqual(status, 400);
    assert.ok(Array.isArray(json.missing) && json.missing.includes("does-not-exist"));
  });

  test("POST duplicate name returns 409", async () => {
    // Re-create with the same name as the one we just made.
    const first = await api("/role-templates/" + state.createdId);
    const { status } = await api("/role-templates", {
      method: "POST",
      body: { name: first.json.data.name, permissions: [] },
    });
    assert.strictEqual(status, 409);
  });

  test("GET /role-templates/:id resolves the permission bundle", async () => {
    const { status, json } = await api(`/role-templates/${state.createdId}`);
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(json.data.permissions));
    assert.strictEqual(json.data.permissions.length, json.data.permissionCount);
    for (const p of json.data.permissions) {
      assert.ok(p.id && p.name && p.category, "each permission has id/name/category");
    }
  });

  test("POST /:id/apply merges into a role and is idempotent", async () => {
    const first = await api(`/role-templates/${state.createdId}/apply`, {
      method: "POST",
      body: { roleId: state.roleId },
    });
    assert.strictEqual(first.status, 200);
    assert.strictEqual(typeof first.json.data.applied, "number");

    // Re-applying the same template must add 0 new permissions (merge, not duplicate).
    const second = await api(`/role-templates/${state.createdId}/apply`, {
      method: "POST",
      body: { roleId: state.roleId },
    });
    assert.strictEqual(second.status, 200);
    assert.strictEqual(second.json.data.applied, 0);
  });

  test("apply with unknown roleId returns 404", async () => {
    const { status } = await api(`/role-templates/${state.createdId}/apply`, {
      method: "POST",
      body: { roleId: "00000000-0000-0000-0000-000000000000" },
    });
    assert.strictEqual(status, 404);
  });

  test("apply with missing roleId returns 400", async () => {
    const { status } = await api(`/role-templates/${state.createdId}/apply`, {
      method: "POST",
      body: {},
    });
    assert.strictEqual(status, 400);
  });

  test("DELETE /role-templates/:id removes it (and 404 afterwards)", async () => {
    const del = await api(`/role-templates/${state.createdId}`, { method: "DELETE" });
    assert.strictEqual(del.status, 200);

    const gone = await api(`/role-templates/${state.createdId}`);
    assert.strictEqual(gone.status, 404);

    state.createdId = null; // already deleted — skip cleanup
  });
});
