const express = require("express");
const { requireAdminAuth } = require("../middlewares/auth.middleware");
const { adminUserActionRateLimiter } = require("../middlewares/rateLimit.middleware");

const {
  listBranches, getBranch, createBranch, updateBranch, deleteBranch, assignDepartmentsToBranch,
  listDepartments, getDepartment, createDepartment, updateDepartment, deleteDepartment,
  assignUsersToDepartment, getDepartmentKpis,
  listTeams, getTeam, createTeam, updateTeam, deleteTeam, assignTeamMembers, getTeamMembers,
  getOrgChart, moveOrgNode,
  getHierarchySettings, updateHierarchySettings, resetHierarchySettings,
} = require("../controllers/organization.controller");

const router = express.Router();

// All routes require a valid admin session
router.use(requireAdminAuth);

// ── Branches ───────────────────────────────────────────────────────────────────
router.get(   "/branches",                                listBranches);
router.post(  "/branches",          adminUserActionRateLimiter, createBranch);
router.get(   "/branches/:branchId",                      getBranch);
router.patch( "/branches/:branchId", adminUserActionRateLimiter, updateBranch);
router.delete("/branches/:branchId", adminUserActionRateLimiter, deleteBranch);
router.post(  "/branches/:branchId/assign-departments", adminUserActionRateLimiter, assignDepartmentsToBranch);

// ── Departments ────────────────────────────────────────────────────────────────
router.get(   "/departments",                               listDepartments);
router.post(  "/departments",        adminUserActionRateLimiter, createDepartment);
router.get(   "/departments/:departmentId",                  getDepartment);
router.patch( "/departments/:departmentId", adminUserActionRateLimiter, updateDepartment);
router.delete("/departments/:departmentId", adminUserActionRateLimiter, deleteDepartment);
router.post(  "/departments/:departmentId/assign-users",  adminUserActionRateLimiter, assignUsersToDepartment);
router.get(   "/departments/:departmentId/kpis",                         getDepartmentKpis);

// ── Teams ──────────────────────────────────────────────────────────────────────
router.get(   "/teams",                             listTeams);
router.post(  "/teams",      adminUserActionRateLimiter, createTeam);
router.get(   "/teams/:teamId",                      getTeam);
router.patch( "/teams/:teamId", adminUserActionRateLimiter, updateTeam);
router.delete("/teams/:teamId", adminUserActionRateLimiter, deleteTeam);
router.post(  "/teams/:teamId/assign-members", adminUserActionRateLimiter, assignTeamMembers);
router.get(   "/teams/:teamId/members",                      getTeamMembers);

// ── Org Chart ──────────────────────────────────────────────────────────────────
router.get(  "/chart",      getOrgChart);
router.patch("/chart/move", adminUserActionRateLimiter, moveOrgNode);

// ── Hierarchy Settings ─────────────────────────────────────────────────────────
router.get(  "/hierarchy/settings",       getHierarchySettings);
router.patch("/hierarchy/settings",       adminUserActionRateLimiter, updateHierarchySettings);
router.post( "/hierarchy/settings/reset", adminUserActionRateLimiter, resetHierarchySettings);

module.exports = router;
