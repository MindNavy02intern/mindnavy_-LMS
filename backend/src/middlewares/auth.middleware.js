const prisma = require("../config/prisma");

// ── In-memory session cache (Fix 1: skip DB lookup on every request) ──────────
const SESSION_CACHE = new Map();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

function getCachedSession(token) {
  const entry = SESSION_CACHE.get(token);
  if (!entry) return null;
  if (Date.now() > entry.cacheExpiresAt) {
    SESSION_CACHE.delete(token);
    return null;
  }
  return entry.payload; // { admin, adminSession }
}

function setCachedSession(token, payload) {
  SESSION_CACHE.set(token, {
    payload,
    cacheExpiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function invalidateCachedSession(token) {
  SESSION_CACHE.delete(token);
}

async function requireAdminAuth(req, res, next) {
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

    // Cache hit: skip DB query entirely
    const cached = getCachedSession(token);
    if (cached) {
      req.admin        = cached.admin;
      req.adminSession = cached.adminSession;
      return next();
    }

    // Cache miss: validate against DB
    const session = await prisma.adminSession.findUnique({
      where: {
        sessionToken: token,
      },
      include: {
        admin: true,
      },
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

    if (!session.admin || session.admin.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    const admin = {
      id:       session.admin.id,
      email:    session.admin.email,
      fullName: session.admin.fullName,
      name:     session.admin.fullName,
      role:     session.admin.role,
      status:   session.admin.status,
    };

    const adminSession = {
      id:        session.id,
      expiresAt: session.expiresAt,
    };

    setCachedSession(token, { admin, adminSession });

    req.admin        = admin;
    req.adminSession = adminSession;

    next();
  } catch (error) {
    console.error("Admin auth middleware error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
}

module.exports = {
  requireAdminAuth,
  invalidateCachedSession,
};
