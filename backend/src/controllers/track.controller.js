const { markOpened, markClicked } = require("../services/notifications.service");
const { isValidTrackedUrl } = require("../utils/trackingLinks");

// ── Public tracking endpoints (no requireAdminAuth — hit by external mail
// clients rendering an admin-sent email, not by the admin console itself) ──
//
// Self-hosted, no 3rd party (DEFERRED_ITEMS.md). Both handlers are
// deliberately permissive about the id — an unknown/garbage logId still
// returns a valid response (pixel / redirect) so a malformed or stale
// tracking link never surfaces an error to whoever's email client hit it;
// markOpened/markClicked are themselves best-effort (notifications.service's
// safe() wrapper) and simply no-op on a miss.

// Smallest valid GIF — a 1x1 transparent pixel, the standard tracking-pixel
// payload. Static buffer, not read from disk.
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7",
  "base64",
);

async function trackOpen(req, res) {
  const { logId } = req.params;
  if (logId) markOpened(logId).catch(() => {});
  res.setHeader("Content-Type", "image/gif");
  // Webmail renders this pixel from ITS origin — explicitly allow that
  // (helmet's default Cross-Origin-Resource-Policy is same-origin).
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Content-Length", TRANSPARENT_GIF.length);
  return res.status(200).end(TRANSPARENT_GIF);
}

// Where an unverifiable click lands: our own app, never the requested URL.
function fallbackUrl() {
  return (process.env.PUBLIC_APP_URL || "http://localhost:5173").replace(/\/+$/, "") + "/";
}

async function trackClick(req, res) {
  const { logId } = req.params;
  const rawUrl = typeof req.query.url === "string" ? req.query.url : "";
  const sig = typeof req.query.sig === "string" ? req.query.sig : "";

  // Redirect ONLY to a destination this server signed into the email
  // (utils/trackingLinks.js). Checking "is it http(s)?" alone — the old
  // behaviour — still let anyone build a link on our domain that bounced to
  // their own site. Unsigned / tampered / expired-secret links go to our app
  // and don't count as a click either, so stats can't be inflated by
  // forged links.
  if (logId && rawUrl && isValidTrackedUrl(logId, rawUrl, sig)) {
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        markClicked(logId).catch(() => {});
        return res.redirect(302, parsed.toString());
      }
    } catch {
      // malformed url — fall through to the safe default below
    }
  }
  return res.redirect(302, fallbackUrl());
}

module.exports = { trackOpen, trackClick };
