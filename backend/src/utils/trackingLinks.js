const crypto = require("crypto");

// Signed click-tracking links (GET /api/track/click/:logId?url=…&sig=…).
//
// The click endpoint is public — it's opened from inside an email — so
// without a signature it is an open redirect: anyone could craft
// /api/track/click/x?url=https://evil.example and hand out a link that starts
// with OUR domain but lands on theirs (classic phishing). The signature is an
// HMAC over the log id + exact destination, made when the email is built
// (notifications.service.js wrapLinksForTracking). Only destinations this
// server itself put into an email verify; everything else gets the safe
// fallback instead of a redirect.

function trackingSecret() {
  // A dedicated secret is preferred. Falling back to a key DERIVED from
  // DATABASE_URL (one-way, never the URL itself) keeps links working on
  // setups that haven't added TRACKING_LINK_SECRET yet, without ever falling
  // back to a guessable constant. Rotating either value just makes
  // already-sent links land on the fallback page — never on another site.
  const material = process.env.TRACKING_LINK_SECRET || process.env.DATABASE_URL;
  if (!material) return null;
  return crypto.createHash("sha256").update(`mindnavy-track-link-v1\0${material}`).digest();
}

function signTrackedUrl(logId, url) {
  const secret = trackingSecret();
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update(`${logId}\n${url}`).digest("base64url");
}

function isValidTrackedUrl(logId, url, sig) {
  if (typeof sig !== "string" || sig.length === 0) return false;
  const expected = signTrackedUrl(logId, url);
  if (!expected) return false; // no secret configured → never redirect
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { signTrackedUrl, isValidTrackedUrl };
