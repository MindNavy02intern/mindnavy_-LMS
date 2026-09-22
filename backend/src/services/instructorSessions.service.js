const prisma = require("../config/prisma");

// ── Instructor Sessions & Devices (Phase 6, blueprint 2.12, Appendix A #15) ─────
//
// Genuinely new — AppUserSession only ever had admin-side read/revoke
// ("Force Logout" on a user) until now, and didn't exist at all as a live
// table until instructor login (Phase 1) started writing to it. No existing
// self-service list+revoke pattern to reuse; device-name derivation mirrors
// admin.service.js's deviceNameFromUserAgent (same small heuristic,
// duplicated rather than imported — that function isn't exported there).

function domainError(code, status) {
  return Object.assign(new Error(code), { code, status });
}

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }

function deviceNameFromUserAgent(userAgent) {
  const ua = (userAgent || "").toLowerCase();
  const os = ua.includes("windows") ? "Windows"
    : ua.includes("mac") ? "macOS"
    : ua.includes("android") ? "Android"
    : ua.includes("iphone") || ua.includes("ipad") ? "iOS"
    : ua.includes("linux") ? "Linux"
    : "Unknown OS";
  const browser = ua.includes("edg/") ? "Edge"
    : ua.includes("chrome") ? "Chrome"
    : ua.includes("firefox") ? "Firefox"
    : ua.includes("safari") ? "Safari"
    : "Unknown Browser";
  return `${browser} on ${os}`;
}

function mapSession(s, currentSessionId) {
  return {
    id:         s.id,
    device:     deviceNameFromUserAgent(s.userAgent),
    ipAddress:  s.ipAddress,
    createdAt:  iso(s.createdAt),
    lastUsedAt: iso(s.lastUsedAt),
    expiresAt:  iso(s.expiresAt),
    isCurrent:  s.id === currentSessionId,
  };
}

async function listMySessions(instructorId, currentSessionId) {
  const rows = await prisma.appUserSession.findMany({
    where: { userId: instructorId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((s) => mapSession(s, currentSessionId));
}

// Blocked for the current session by design — the task spec/blueprint route
// that through the existing "Sign Out" action instead of a silent self-revoke
// mid-request.
async function revokeMySession(instructorId, sessionId, currentSessionId) {
  if (sessionId === currentSessionId) throw domainError("CANNOT_REVOKE_CURRENT_SESSION", 400);

  const session = await prisma.appUserSession.findFirst({
    where: { id: sessionId, userId: instructorId, revokedAt: null },
    select: { id: true },
  });
  if (!session) throw domainError("SESSION_NOT_FOUND", 404);

  await prisma.appUserSession.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
  return { id: sessionId };
}

module.exports = {
  listMySessions,
  revokeMySession,
};
