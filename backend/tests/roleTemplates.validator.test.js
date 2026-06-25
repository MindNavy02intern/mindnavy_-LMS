// Unit tests for the Role Templates validators (pure functions — no DB, no server).
// Run:  node --test tests/roleTemplates.validator.test.js
//
// These prove the input-handling layer that keeps bad requests at 400 instead of 500.

const { test, describe } = require("node:test");
const assert = require("node:assert");

const {
  validateId,
  validateListTemplatesQuery,
  validateCreateTemplate,
  validateApplyTemplate,
} = require("../src/validators/roleTemplates.validator");

describe("validateId", () => {
  test("rejects empty / non-string ids", () => {
    assert.ok(validateId(""));            // returns an error string
    assert.ok(validateId("   "));
    assert.ok(validateId(undefined));
    assert.ok(validateId(123));
  });

  test("accepts a non-empty string", () => {
    assert.strictEqual(validateId("abc"), null);
  });
});

describe("validateListTemplatesQuery", () => {
  test("applies safe defaults", () => {
    const { isValid, data } = validateListTemplatesQuery({});
    assert.strictEqual(isValid, true);
    assert.strictEqual(data.page, 1);
    assert.strictEqual(data.limit, 50);
    assert.strictEqual(data.search, "");
  });

  test("caps limit at 200 and floors bad page/limit", () => {
    assert.strictEqual(validateListTemplatesQuery({ limit: 9999 }).data.limit, 200);
    assert.strictEqual(validateListTemplatesQuery({ page: -5 }).data.page, 1);
    assert.strictEqual(validateListTemplatesQuery({ page: "x", limit: "y" }).data.page, 1);
    assert.strictEqual(validateListTemplatesQuery({ limit: "y" }).data.limit, 50);
  });

  test("trims search", () => {
    assert.strictEqual(validateListTemplatesQuery({ search: "  hr  " }).data.search, "hr");
  });
});

describe("validateCreateTemplate", () => {
  test("accepts a valid payload and dedupes permission ids", () => {
    const { isValid, data } = validateCreateTemplate({
      name: "  My Template  ",
      description: "  desc  ",
      permissions: ["a", "b", "a", " b "],
    });
    assert.strictEqual(isValid, true);
    assert.strictEqual(data.name, "My Template");      // trimmed
    assert.strictEqual(data.description, "desc");        // trimmed
    assert.deepStrictEqual(data.permissions, ["a", "b"]); // deduped + trimmed
  });

  test("requires a name", () => {
    assert.strictEqual(validateCreateTemplate({ permissions: [] }).isValid, false);
    assert.strictEqual(validateCreateTemplate({ name: "   ", permissions: [] }).isValid, false);
  });

  test("rejects an over-long name (>100) and description (>500)", () => {
    assert.strictEqual(validateCreateTemplate({ name: "x".repeat(101), permissions: [] }).isValid, false);
    assert.strictEqual(
      validateCreateTemplate({ name: "ok", description: "y".repeat(501), permissions: [] }).isValid,
      false,
    );
  });

  test("empty description normalises to null", () => {
    assert.strictEqual(validateCreateTemplate({ name: "ok", description: "   " }).data.description, null);
  });

  test("permissions defaults to [] when omitted", () => {
    const { isValid, data } = validateCreateTemplate({ name: "ok" });
    assert.strictEqual(isValid, true);
    assert.deepStrictEqual(data.permissions, []);
  });

  test("rejects non-array / non-string / empty-string permissions", () => {
    assert.strictEqual(validateCreateTemplate({ name: "ok", permissions: "nope" }).isValid, false);
    assert.strictEqual(validateCreateTemplate({ name: "ok", permissions: [1, 2] }).isValid, false);
    assert.strictEqual(validateCreateTemplate({ name: "ok", permissions: [""] }).isValid, false);
  });

  test("rejects more than 300 permissions", () => {
    const many = Array.from({ length: 301 }, (_, i) => `p${i}`);
    assert.strictEqual(validateCreateTemplate({ name: "ok", permissions: many }).isValid, false);
  });
});

describe("validateApplyTemplate", () => {
  test("requires a roleId", () => {
    assert.strictEqual(validateApplyTemplate({}).isValid, false);
    assert.strictEqual(validateApplyTemplate({ roleId: "" }).isValid, false);
    assert.strictEqual(validateApplyTemplate({ roleId: 5 }).isValid, false);
  });

  test("accepts and trims a valid roleId", () => {
    const { isValid, data } = validateApplyTemplate({ roleId: "  role-1  " });
    assert.strictEqual(isValid, true);
    assert.strictEqual(data.roleId, "role-1");
  });
});
