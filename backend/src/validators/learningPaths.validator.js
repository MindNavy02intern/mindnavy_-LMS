// Validation for the Learning Paths API (paths + items + reorder).
// Mirrors courseBuilder.validator: each function returns { isValid, errors, data }.
// Everything is parsed, length-capped and allow-listed here so the service only
// ever receives safe, bounded values. The polymorphic itemId existence check needs
// the DB, so it runs in the service, not here.

const ITEM_TYPES = ["COURSE", "LIVE_SESSION"];

const MAX = {
  title:       200,
  description: 2000,
  bulk:        500, // max items per reorder array
  order:       1000000,
};

function validateId(id, label = "id") {
  if (!id || typeof id !== "string" || id.trim().length === 0) return `${label} is required.`;
  return null;
}

// Optional non-negative integer (order). Returns undefined (absent), or the parsed
// int. Pushes on invalid.
function optInt(body, key, max, errors) {
  if (body[key] === undefined || body[key] === null) return undefined;
  const n = Number(body[key]);
  if (!Number.isInteger(n) || n < 0 || n > max) {
    errors.push(`${key} must be an integer between 0 and ${max}.`);
    return undefined;
  }
  return n;
}

// Shared title/description/sequential field readers (create + update).

function readTitle(value, errors, { required }) {
  if (value === undefined) {
    if (required) errors.push("title is required.");
    return undefined;
  }
  const title = typeof value === "string" ? value.trim() : "";
  if (!title) { errors.push(required ? "title is required." : "title cannot be empty."); return undefined; }
  if (title.length > MAX.title) { errors.push(`title must be at most ${MAX.title} characters.`); return undefined; }
  return title;
}

function readDescription(value, errors) {
  if (value === undefined) return undefined;
  if (value === null) return null; // explicit null clears it
  if (typeof value !== "string") { errors.push("description must be a string."); return undefined; }
  const d = value.trim();
  if (d.length > MAX.description) { errors.push(`description must be at most ${MAX.description} characters.`); return undefined; }
  return d || null;
}

function readSequential(value, errors) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") { errors.push("sequential must be a boolean."); return undefined; }
  return value;
}

// ── Paths ────────────────────────────────────────────────────────────────────────

function validatePathCreate(body = {}) {
  const errors = [];

  const title = readTitle(body.title, errors, { required: true });
  const description = readDescription(body.description, errors);
  const sequential = readSequential(body.sequential, errors);

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      title,
      description: description !== undefined ? description : null,
      sequential:  sequential  !== undefined ? sequential  : false,
    },
  };
}

function validatePathUpdate(body = {}) {
  const errors = [];
  const data = {};

  const title = readTitle(body.title, errors, { required: false });
  if (title !== undefined) data.title = title;

  const description = readDescription(body.description, errors);
  if (description !== undefined) data.description = description; // null clears it

  const sequential = readSequential(body.sequential, errors);
  if (sequential !== undefined) data.sequential = sequential;

  if (errors.length === 0 && Object.keys(data).length === 0) {
    errors.push("No valid fields provided to update.");
  }

  return { isValid: errors.length === 0, errors, data };
}

// ── Items ────────────────────────────────────────────────────────────────────────

function validateItemAdd(body = {}) {
  const errors = [];

  let itemType;
  if (body.itemType === undefined || body.itemType === null || String(body.itemType).trim() === "") {
    errors.push("itemType is required.");
  } else {
    const upper = String(body.itemType).trim().toUpperCase();
    if (!ITEM_TYPES.includes(upper)) errors.push("itemType must be COURSE or LIVE_SESSION.");
    else itemType = upper;
  }

  const idErr = validateId(body.itemId, "itemId");
  if (idErr) errors.push(idErr);

  const order = optInt(body, "order", MAX.order, errors);

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      itemType,
      itemId: typeof body.itemId === "string" ? body.itemId.trim() : body.itemId,
      ...(order !== undefined ? { order } : {}),
    },
  };
}

// ── Reorder (bulk) ─────────────────────────────────────────────────────────────────

function validateReorder(body = {}) {
  const errors = [];

  if (!Array.isArray(body.items)) {
    return { isValid: false, errors: ["items must be an array."], data: { items: [] } };
  }
  if (body.items.length === 0) errors.push("Provide at least one item to reorder.");
  if (body.items.length > MAX.bulk) errors.push(`items must have at most ${MAX.bulk} entries.`);

  const items = [];
  for (const it of body.items) {
    const idErr = validateId(it?.id, "item id");
    const order = optInt(it ?? {}, "order", MAX.order, errors);
    if (idErr) { errors.push(idErr); continue; }
    if (!Number.isInteger(order)) { errors.push("each item needs an integer order."); continue; }
    items.push({ id: it.id.trim(), order });
  }

  return { isValid: errors.length === 0, errors, data: { items } };
}

module.exports = {
  validateId,
  validatePathCreate,
  validatePathUpdate,
  validateItemAdd,
  validateReorder,
};
