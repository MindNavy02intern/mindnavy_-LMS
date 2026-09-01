const crypto = require("crypto");
const prisma = require("../config/prisma");

// Mirrors auth.middleware.js's requireAdminAuth exactly in shape (in-memory
// session cache, revoked/expiry/status checks, req.<actor> attachment) with
// three deliberate differences dictated by the underlying tables:
//  1. AppUserSession stores tokenHash, not the raw token — lookup hashes the
//     presented Bearer token first (see instructorAuth.service.js's
//     hashToken, same sha256).
//  2. The role check (AppUser.role === "INSTRUCTOR") has no admin-side
//     equivalent — AdminUser has no role enum to gate on.
//  3. AppUser.status is re-checked on EVERY request, same as admin.status —
//     this is what makes an admin's instructor.suspend action lock the
//     instructor out starting their very next call, with no separate
//     session-revocation step required.

const SESSION_CACHE = new Map();
const CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_SIZE = 500;

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function getCachedSession(token) {
  const entry = SESSION_CACHE.get(token);
  if (!entry) return null;
  const sessionExpiresAt = new Date(entry.payload.instructorSession.expiresAt).getTime();
  if (Date.now() > entry.cacheExpiresAt || Date.now() > sessionExpiresAt) {
    SESSION_CACHE.delete(token);
    return null;
  }
  return entry.payload;
}

function setCachedSession(token, payload) {
  if (SESSION_CACHE.size >= MAX_CACHE_SIZE) {
    SESSION_CACHE.delete(SESSION_CACHE.keys().next().value);
  }
  SESSION_CACHE.set(token, { payload, cacheExpiresAt: Date.now() + CACHE_TTL_MS });
}

function invalidateCachedInstructorSession(token) {
  SESSION_CACHE.delete(token);
}

function clearAllCachedInstructorSessions() {
  SESSION_CACHE.clear();
}

async function requireInstructorAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    // Cache hit: skip DB query entirely. NOTE — status re-checks (suspend
    // taking effect immediately) still work through the cache, because the
    // cache stores the instructor.status snapshot from the last DB read and
    // is only trusted for CACHE_TTL_MS (60s) before falling through to a
    // fresh DB read. Worst case, a suspended instructor keeps read access
    // for up to 60s after being suspended — same trade-off requireAdminAuth
    // already accepts for admins.
    const cached = getCachedSession(token);
    if (cached) {
      req.instructor = cached.instructor;
      req.instructorSession = cached.instructorSession;
      return next();
    }

    const tokenHash = hashToken(token);

    const session = await prisma.appUserSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Invalid session.",
      });
    }

    if (session.revokedAt) {
      return res.status(401).json({
        success: false,
        message: "Session revoked.",
      });
    }

    if (session.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        message: "Session expired.",
      });
    }

    if (!session.user || session.user.role !== "INSTRUCTOR") {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    if (session.user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    const instructor = {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      role: session.user.role,
      status: session.user.status,
      verificationState: session.user.verificationState,
    };

    const instructorSession = {
      id: session.id,
      expiresAt: session.expiresAt,
    };

    setCachedSession(token, { instructor, instructorSession });

    req.instructor = instructor;
    req.instructorSession = instructorSession;

    // Best-effort, non-blocking — mirrors the fire-and-forget shape used
    // elsewhere in this codebase for non-critical writes (never awaited
    // ahead of the response, a failure here must not fail the request).
    prisma.appUserSession
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
      .catch((err) => console.error("Failed to update instructor session lastUsedAt:", err.message));

    next();
  } catch (error) {
    console.error("Instructor auth middleware error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
}

module.exports = {
  requireInstructorAuth,
  invalidateCachedInstructorSession,
  clearAllCachedInstructorSessions,
};
