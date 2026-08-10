const prisma = require("../config/prisma");

// Gates the two unauthenticated /api/public/* surfaces (certificate
// verification, "Become Instructor" applications) with 503 while maintenance
// mode is on. Every /api/admin/* route stays reachable — admins must be able
// to log in and turn maintenance mode back off, so this middleware is never
// mounted ahead of adminRoutes/requireAdminAuth.
//
// Short in-process cache (same TTL idea as auth.middleware's session cache):
// this middleware runs on every public request, and maintenance toggles are
// rare, so a fresh DB read per request is wasted work.

const CACHE_TTL_MS = 15 * 1000;
let cached = null;
let cachedAt = 0;

async function isMaintenanceOn() {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) return cached;
  try {
    const settings = await prisma.systemSettings.findFirst({
      orderBy: { createdAt: "asc" },
      select: { maintenanceMode: true, maintenanceMessage: true },
    });
    cached = settings ?? { maintenanceMode: false, maintenanceMessage: null };
  } catch {
    cached = { maintenanceMode: false, maintenanceMessage: null }; // fail open — a DB hiccup shouldn't 503 the public surfaces
  }
  cachedAt = Date.now();
  return cached;
}

async function blockDuringMaintenance(req, res, next) {
  const state = await isMaintenanceOn();
  if (!state.maintenanceMode) return next();
  return res.status(503).json({
    success: false,
    message: state.maintenanceMessage || "This service is temporarily down for maintenance. Please try again shortly.",
  });
}

module.exports = { blockDuringMaintenance };
