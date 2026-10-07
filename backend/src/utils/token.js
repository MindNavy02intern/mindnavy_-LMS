const crypto = require("crypto");

function generateSessionToken() {
  return crypto.randomBytes(64).toString("hex");
}

// AdminSession.sessionToken stores THIS, never the raw token — same scheme
// AppUserSession.tokenHash already uses for instructors. A DB read (backup,
// dashboard access, SQL injection elsewhere) then yields hashes that can't be
// replayed as a Bearer token. Unsalted SHA-256 is correct here: the input is
// 512 bits of CSPRNG output, so there is nothing to brute-force or precompute.
function hashSessionToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

// Hard ceiling on any session, however active: 24h after sign-in.
const MAX_SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;

// When a session expires: `idleMinutes` (System Settings > Security "Session
// Timeout") after the most recent activity, never later than 24h after it was
// created. Used at sign-in (createdAt = now) and again by the auth
// middlewares, which slide the expiry forward as the session is used — so an
// admin who keeps working stays signed in, and one who walks away is signed
// out after the timeout.
function sessionExpiry({ createdAt, idleMinutes, now = Date.now() }) {
  const hardLimit = new Date(createdAt).getTime() + MAX_SESSION_LIFETIME_MS;
  return new Date(Math.min(hardLimit, now + idleMinutes * 60 * 1000));
}

module.exports = {
  generateSessionToken,
  hashSessionToken,
  sessionExpiry,
};