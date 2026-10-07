const prisma = require("../config/prisma");
const { hashSessionToken, sessionExpiry } = require("../utils/token");
const { getSecurityPolicy } = require("../services/settings.service");

const SESSION_CACHE   = new Map();
const CACHE_TTL_MS    = 60 * 1000;
const MAX_CACHE_SIZE  = 500;

function getCachedSession(token) {
  const entry = SESSION_CACHE.get(token);
  if (!entry) return null;
  // Evict when either the cache window OR the session's own expiry has passed,
  // so an expired session can never ride the cache past its real lifetime.
  const sessionExpiresAt = new Date(entry.payload.adminSession.expiresAt).getTime();
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

function invalidateCachedSession(token) {
  SESSION_CACHE.delete(token);
}

function clearAllCachedSessions() {
  SESSION_CACHE.clear();
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

    // Cache miss: validate against DB. The column holds the SHA-256 of the
    // token (utils/token.js hashSessionToken), never the token itself.
    const session = await prisma.adminSession.findUnique({
      where: {
        sessionToken: hashSessionToken(token),
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
      id:         session.admin.id,
      email:      session.admin.email,
      fullName:   session.admin.fullName,
      name:       session.admin.fullName,
      phone:      session.admin.phone,
      bio:        session.admin.bio,
      role:       session.admin.role,
      status:     session.admin.status,
      mfaEnabled: session.admin.mfaEnabled,
    };

    // Inactivity timeout (System Settings > Security "Session Timeout"): this
    // request is activity, so slide the expiry forward — never past 24h after
    // sign-in (utils/token.js sessionExpiry). Only reached on a cache miss, so
    // at most one background write per session per CACHE_TTL_MS; the request
    // never waits on it. Lowering the setting also shortens live sessions here.
    let expiresAt = session.expiresAt;
    try {
      const { sessionTimeoutMinutes } = await getSecurityPolicy();
      const next = sessionExpiry({ createdAt: session.createdAt, idleMinutes: sessionTimeoutMinutes });
      if (Math.abs(next.getTime() - expiresAt.getTime()) > CACHE_TTL_MS) {
        expiresAt = next;
        prisma.adminSession
          .update({ where: { id: session.id }, data: { expiresAt: next } })
          .catch((err) => console.error("Failed to extend admin session:", err.message));
      }
    } catch (err) {
      // Settings unreadable — keep the stored expiry rather than fail the request.
      console.error("Admin session timeout check skipped:", err.message);
    }

    const adminSession = {
      id:        session.id,
      expiresAt,
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
  clearAllCachedSessions,
};
