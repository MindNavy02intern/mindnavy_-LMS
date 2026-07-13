const svc = require("../services/categories.service");
const { validateId, validateCreate, validateUpdate } = require("../validators/categories.validator");

// ── Helpers (mirror courses.controller) ─────────────────────────────────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function handleDomainError(res, err) {
  if (err.code === "CATEGORY_NOT_FOUND")  return notFound(res, "Category not found.");
  if (err.code === "PARENT_NOT_FOUND")    return notFound(res, "Parent category not found.");
  if (err.code === "MAX_DEPTH")           return badRequest(res, "Only two levels are supported — a subcategory cannot be a parent.");
  if (err.code === "SELF_PARENT")         return badRequest(res, "A category cannot be its own parent.");
  if (err.code === "DUPLICATE_CATEGORY")  return badRequest(res, "A category with this name already exists at this level.");
  if (err.code === "HAS_CHILDREN_MOVE")   return badRequest(res, "Move or delete its subcategories first — a category with subcategories cannot become a subcategory.");
  if (err.code === "HAS_CHILDREN_DELETE") return badRequest(res, "Delete its subcategories first.");
  if (err.code === "HAS_COURSES")         return badRequest(res, "Reassign this category's courses first.");
  return null;
}

function serverError(res, err) {
  console.error("[CategoriesController]", err);
  if (err.code === "P2025") return notFound(res, "Category not found.");
  if (err.code === "P2002") return badRequest(res, "A category with this name already exists at this level.");
  return res.status(500).json({ success: false, message: "Internal server error." });
}

// ── Endpoints ────────────────────────────────────────────────────────────────────

async function listCategories(req, res) {
  try {
    return res.json({ success: true, data: await svc.listCategories() });
  } catch (err) { return serverError(res, err); }
}

async function createCategory(req, res) {
  try {
    const v = validateCreate(req.body);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    const category = await svc.createCategory(v.data, req.admin?.id);
    return res.status(201).json({ success: true, message: "Category created.", data: category });
  } catch (err) {
    return handleDomainError(res, err) ?? serverError(res, err);
  }
}

async function updateCategory(req, res) {
  try {
    const idErr = validateId(req.params.id, "categoryId");
    if (idErr) return badRequest(res, idErr);
    const v = validateUpdate(req.body);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    const category = await svc.updateCategory(req.params.id, v.data, req.admin?.id);
    return res.json({ success: true, message: "Category updated.", data: category });
  } catch (err) {
    return handleDomainError(res, err) ?? serverError(res, err);
  }
}

async function deleteCategory(req, res) {
  try {
    const idErr = validateId(req.params.id, "categoryId");
    if (idErr) return badRequest(res, idErr);
    const result = await svc.deleteCategory(req.params.id, req.admin?.id);
    return res.json({ success: true, message: "Category deleted.", data: result });
  } catch (err) {
    return handleDomainError(res, err) ?? serverError(res, err);
  }
}

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };
