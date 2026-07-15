const svc = require("../services/learningPaths.service");
const {
  validateId,
  validatePathCreate,
  validatePathUpdate,
  validateItemAdd,
  validateReorder,
} = require("../validators/learningPaths.validator");

// ── Helpers ────────────────────────────────────────────────────────────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

// Domain errors thrown by the service → clean HTTP status + message.
function handleDomainError(res, err) {
  switch (err.code) {
    case "PATH_NOT_FOUND":   return notFound(res, "Learning path not found.");
    case "ITEM_NOT_FOUND":   return notFound(res, "Item not found in this learning path.");
    case "ITEM_NOT_IN_PATH": return badRequest(res, "An item does not belong to this learning path.");
    case "REF_NOT_FOUND":    return badRequest(res, "Referenced course or live session does not exist.");
    case "DUPLICATE_ITEM":   return badRequest(res, "This item is already in the learning path.");
    default:                 return null;
  }
}

function serverError(res, err) {
  console.error("[LearningPathsController]", err);
  if (err.code === "P2025") return notFound(res, "Record not found.");
  if (err.code === "P2003") return badRequest(res, "Invalid reference: one or more IDs do not exist.");
  // Table missing → migration not run yet. A clean 503 makes the cause obvious.
  if (err.code === "P2021") {
    return res.status(503).json({ success: false, message: "Database not migrated yet. Run `npx prisma db push`." });
  }
  return res.status(500).json({ success: false, message: "Internal server error." });
}

function run(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      return handleDomainError(res, err) ?? serverError(res, err);
    }
  };
}

// ── Paths ────────────────────────────────────────────────────────────────────────

const listPaths = run(async (req, res) => {
  const paths = await svc.listPaths();
  return res.json({ success: true, data: paths });
});

const getPath = run(async (req, res) => {
  const idErr = validateId(req.params.id, "pathId");
  if (idErr) return badRequest(res, idErr);
  const path = await svc.getPath(req.params.id);
  return res.json({ success: true, data: path });
});

const createPath = run(async (req, res) => {
  const v = validatePathCreate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const path = await svc.createPath(v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Learning path created.", data: path });
});

const updatePath = run(async (req, res) => {
  const idErr = validateId(req.params.id, "pathId");
  if (idErr) return badRequest(res, idErr);
  const v = validatePathUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const path = await svc.updatePath(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Learning path updated.", data: path });
});

const deletePath = run(async (req, res) => {
  const idErr = validateId(req.params.id, "pathId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.deletePath(req.params.id, req.admin?.id);
  return res.json({ success: true, message: "Learning path deleted.", data: result });
});

// ── Items ────────────────────────────────────────────────────────────────────────

const addItem = run(async (req, res) => {
  const idErr = validateId(req.params.id, "pathId");
  if (idErr) return badRequest(res, idErr);
  const v = validateItemAdd(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const item = await svc.addItem(req.params.id, v.data, req.admin?.id);
  return res.status(201).json({ success: true, message: "Item added to learning path.", data: item });
});

const removeItem = run(async (req, res) => {
  const idErr = validateId(req.params.id, "pathId") ?? validateId(req.params.itemId, "itemId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.removeItem(req.params.id, req.params.itemId, req.admin?.id);
  return res.json({ success: true, message: "Item removed from learning path.", data: result });
});

// ── Reorder ────────────────────────────────────────────────────────────────────────

const reorder = run(async (req, res) => {
  const idErr = validateId(req.params.id, "pathId");
  if (idErr) return badRequest(res, idErr);
  const v = validateReorder(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const path = await svc.reorder(req.params.id, v.data, req.admin?.id);
  return res.json({ success: true, message: "Order updated.", data: path });
});

module.exports = {
  listPaths,
  getPath,
  createPath,
  updatePath,
  deletePath,
  addItem,
  removeItem,
  reorder,
};
