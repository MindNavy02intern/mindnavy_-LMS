const { markOpened, markClicked } = require("../services/notifications.service");

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
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Content-Length", TRANSPARENT_GIF.length);
  return res.status(200).end(TRANSPARENT_GIF);
}

async function trackClick(req, res) {
  const { logId } = req.params;
  const rawUrl = typeof req.query.url === "string" ? req.query.url : "";
  if (logId) markClicked(logId).catch(() => {});

  // Only ever redirect to an absolute http(s) URL — never reflect an
  // arbitrary query value as an open redirect target.
  let target = "/";
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") target = parsed.toString();
  } catch {
    // malformed/missing url — fall through to the safe default above
  }
  return res.redirect(302, target);
}

module.exports = { trackOpen, trackClick };
