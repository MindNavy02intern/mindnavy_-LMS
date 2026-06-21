const svc = require("../services/roles.service");
const {
  validateId,
  validateListRolesQuery,
  validateCreateRole,
  validateUpdateRole,
  validateAssignPermissions,
  validatePermissionMatrixQuery,
  validateMatrixToggle,
} = require("../validators/roles.validator");

// ── Helpers ────────────────────────────────────────────────────────────────────

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function serverError(res, err) {
  console.error("[RolesController]", err);
  if (err.code === "P2002") {
    return res.status(409).json({ success: false, message: "A record with this name already exists." });
  }
  if (err.code === "P2025") {
    return res.status(404).json({ success: false, message: "Record not found." });
  }
  if (err.code === "P2003") {
    return res.status(400).json({ success: false, message: "Invalid reference: one or more IDs do not exist." });
  }
  return res.status(500).json({ success: false, message: "Internal server error." });
}

// ── Roles ─────────────────────────────────────────────────────────────────────

async function listRoles(req, res) {
  try {
    const v = validateListRolesQuery(req.query);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    const result = await svc.listRoles(v.data);
    return res.json({ success: true, ...result });
  } catch (err) { return serverError(res, err); }
}

async function getRolesStats(req, res) {
  try {
    const stats = await svc.getRolesStats();
    return res.json({ success: true, data: stats });
  } catch (err) { return serverError(res, err); }
}

async function getRole(req, res) {
  try {
    const role = await svc.getRole(req.params.id);
    if (!role) return notFound(res, "Role not found.");
    return res.json({ success: true, data: role });
  } catch (err) { return serverError(res, err); }
}

async function createRole(req, res) {
  try {
    const v = validateCreateRole(req.body);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    const role = await svc.createRole(v.data, req.admin?.id);
    return res.status(201).json({
      success: true,
      message: "Role created successfully.",
      data: { ...role, userCount: 0, permissionCount: 0 },
    });
  } catch (err) { return serverError(res, err); }
}

async function updateRole(req, res) {
  try {
    const idErr = validateId(req.params.id, "roleId");
    if (idErr) return badRequest(res, idErr);
    const v = validateUpdateRole(req.body);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    const role = await svc.updateRole(req.params.id, v.data, req.admin?.id);
    return res.json({
      success: true,
      message: "Role updated successfully.",
      data: { ...role, userCount: 0 },
    });
  } catch (err) {
    if (err.code === "P2025") return notFound(res, "Role not found.");
    return serverError(res, err);
  }
}

async function deleteRole(req, res) {
  try {
    const idErr = validateId(req.params.id, "roleId");
    if (idErr) return badRequest(res, idErr);
    await svc.deleteRole(req.params.id, req.admin?.id);
    return res.json({ success: true, message: "Role deleted successfully." });
  } catch (err) {
    if (err.code === 'ROLE_HAS_USERS') {
      return res.status(409).json({
        success: false,
        error: 'ROLE_HAS_USERS',
        message: `This role has ${err.userCount} assigned user(s). Reassign them before deleting.`,
        count: err.userCount,
        roleName: err.roleName,
      });
    }
    if (err.code === "P2025") return notFound(res, "Role not found.");
    return serverError(res, err);
  }
}

async function duplicateRole(req, res) {
  try {
    const idErr = validateId(req.params.id, "roleId");
    if (idErr) return badRequest(res, idErr);
    const role = await svc.duplicateRole(req.params.id, req.admin?.id);
    return res.status(201).json({ success: true, message: "Role duplicated successfully.", data: role });
  } catch (err) {
    if (err.code === "ROLE_NOT_FOUND") return notFound(res, "Role not found.");
    return serverError(res, err);
  }
}

// ── Role Permissions ───────────────────────────────────────────────────────────

async function getRolePermissions(req, res) {
  try {
    const permissions = await svc.getRolePermissions(req.params.id);
    return res.json({ success: true, data: permissions });
  } catch (err) { return serverError(res, err); }
}

async function assignPermissionsToRole(req, res) {
  try {
    const idErr = validateId(req.params.id, "roleId");
    if (idErr) return badRequest(res, idErr);
    const v = validateAssignPermissions(req.body);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    const permissions = await svc.assignPermissionsToRole(req.params.id, v.data.permissionIds, req.admin?.id);
    return res.json({ success: true, message: "Permissions assigned successfully.", data: permissions });
  } catch (err) {
    if (err.code === "ROLE_NOT_FOUND") return notFound(res, "Role not found.");
    if (err.code === "INVALID_PERMISSIONS") {
      return res.status(400).json({
        success: false,
        message: "One or more permission IDs do not exist.",
        missing: err.missing,
      });
    }
    return serverError(res, err);
  }
}

// ── Permission Matrix ────────────────────────────────────────────────────────

async function getPermissionMatrix(req, res) {
  try {
    const v = validatePermissionMatrixQuery(req.query);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    const data = await svc.getPermissionMatrix(v.data);
    return res.json({ success: true, data });
  } catch (err) { return serverError(res, err); }
}

async function togglePermissionMatrixCell(req, res) {
  try {
    const v = validateMatrixToggle(req.body);
    if (!v.isValid) return badRequest(res, v.errors[0]);
    const cell = await svc.togglePermissionMatrixCell(v.data, req.admin?.id);
    return res.json({
      success: true,
      message: "Permission matrix updated successfully.",
      data: cell,
    });
  } catch (err) {
    if (err.code === "ROLE_NOT_FOUND")       return notFound(res, "Role not found.");
    if (err.code === "PERMISSION_NOT_FOUND") return notFound(res, "Permission not found.");
    return serverError(res, err);
  }
}

// ── Permissions ────────────────────────────────────────────────────────────────

async function listPermissions(req, res) {
  try {
    const { search, category, page, limit } = req.query;
    const result = await svc.listPermissions({ search, category, page, limit });
    return res.json({ success: true, ...result });
  } catch (err) { return serverError(res, err); }
}

async function getPermission(req, res) {
  try {
    const permission = await svc.getPermission(req.params.id);
    if (!permission) return notFound(res, "Permission not found.");
    return res.json({ success: true, data: permission });
  } catch (err) { return serverError(res, err); }
}

async function createPermission(req, res) {
  try {
    const { name, description, category } = req.body;
    if (!name?.trim())  return badRequest(res, "Permission name is required.");
    if (!category)      return badRequest(res, "Permission category is required.");
    const permission = await svc.createPermission({ name, description, category });
    return res.status(201).json({ success: true, message: "Permission created successfully.", data: permission });
  } catch (err) { return serverError(res, err); }
}

async function updatePermission(req, res) {
  try {
    const permission = await svc.updatePermission(req.params.id, req.body);
    return res.json({ success: true, message: "Permission updated successfully.", data: permission });
  } catch (err) {
    if (err.code === "P2025") return notFound(res, "Permission not found.");
    return serverError(res, err);
  }
}

async function deletePermission(req, res) {
  try {
    await svc.deletePermission(req.params.id);
    return res.json({ success: true, message: "Permission deleted successfully." });
  } catch (err) {
    if (err.code === "P2025") return notFound(res, "Permission not found.");
    return serverError(res, err);
  }
}

module.exports = {
  listRoles, getRolesStats, getRole, createRole, updateRole, deleteRole, duplicateRole,
  getRolePermissions, assignPermissionsToRole,
  getPermissionMatrix, togglePermissionMatrixCell,
  listPermissions, getPermission, createPermission, updatePermission, deletePermission,
};
