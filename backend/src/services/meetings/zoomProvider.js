// Zoom provider — one implementation of the meetings adapter contract (see
// ./index.js). Uses a Server-to-Server OAuth app (no user login flow):
//
//   ZOOM_ACCOUNT_ID / ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET in .env
//   (created at marketplace.zoom.us → Develop → Server-to-Server OAuth app,
//    scopes: meeting:write:admin or the granular meeting:write:meeting:admin set)
//
// While the vars are unset, isConfigured() is false and the live-sessions
// endpoints answer 503 MEETINGS_NOT_CONFIGURED — the server never crashes and
// nothing else is affected. The access token is cached in memory until ~1 min
// before expiry. Credentials and tokens are never logged and never leave this
// file; callers only ever see { meetingId, joinUrl, startUrl }.

const TOKEN_URL = "https://zoom.us/oauth/token";
const API_BASE = "https://api.zoom.us/v2";
const REQUEST_TIMEOUT_MS = 15000;
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

let cachedToken = null; // { value, expiresAt, scope, mintedAt }

function providerError(message) {
  return Object.assign(new Error(message), { code: "MEETING_PROVIDER_ERROR" });
}

// Debug tracing for the "scope missing" class of bug — logs cache hit/miss,
// the granted `scope` string Zoom returns at mint time (this is the ONLY
// reliable way to see what a token can actually do; the token value itself
// is opaque, not a decodable JWT), and which endpoint/scope failed. NEVER
// logs the token value or credentials — only the scope string, which is a
// list of permission names, not a secret.
function zoomDebug(...args) {
  console.log("[zoom]", ...args);
}

function isConfigured() {
  return Boolean(
    process.env.ZOOM_ACCOUNT_ID && process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET,
  );
}

// fetch with a hard timeout so a hung Zoom call can never pin a request open.
async function timedFetch(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    throw providerError(err.name === "AbortError" ? "Zoom API timed out." : `Zoom API unreachable: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    zoomDebug(
      `using cached token (minted ${new Date(cachedToken.mintedAt).toISOString()}, ` +
      `expires ${new Date(cachedToken.expiresAt).toISOString()}, scope="${cachedToken.scope}")`,
    );
    return cachedToken.value;
  }

  // No cache hit — mint a fresh token from Zoom right now. This app NEVER
  // persists an access token anywhere (no .env var, no DB row, no file) —
  // it is fetched fresh from Zoom every time the in-memory cache above is
  // empty or expired (~1 hour), using ZOOM_CLIENT_ID/SECRET/ACCOUNT_ID.
  // There is no "regenerate the token and paste it into the app" step in
  // this codebase — if that was tried, it wouldn't have gone anywhere, since
  // nothing reads a manually-set token from anywhere.
  zoomDebug("cache miss/expired — requesting a fresh token from Zoom");

  const basic = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`,
  ).toString("base64");

  const res = await timedFetch(
    `${TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(process.env.ZOOM_ACCOUNT_ID)}`,
    { method: "POST", headers: { Authorization: `Basic ${basic}` } },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.access_token) {
    // Zoom's reason (e.g. "Invalid client credentials") is safe to surface;
    // the credentials themselves never are.
    zoomDebug(`token mint FAILED: HTTP ${res.status}, reason="${json?.reason || json?.error}"`);
    throw providerError(`Zoom auth failed: ${json?.reason || json?.error || res.status}`);
  }

  // json.scope is a space-separated list of granted permission names — the
  // single source of truth for "what can this token actually do", straight
  // from Zoom at the moment of minting. Logging it (never the token itself)
  // is exactly what settles "did my scope change actually take effect".
  zoomDebug(`fresh token minted — expires_in=${json.expires_in}s, scope="${json.scope || "(not returned)"}"`);

  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (Number(json.expires_in) || 3600) * 1000 - TOKEN_EXPIRY_BUFFER_MS,
    scope: json.scope || "(not returned)",
    mintedAt: Date.now(),
  };
  return cachedToken.value;
}

async function zoomRequest(method, path, body) {
  const token = await getAccessToken();
  zoomDebug(`${method} ${path}`);
  const res = await timedFetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (res.status === 204) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    // On a scope-shaped error (Zoom doesn't consistently use 401 for these —
    // observed as 400 too), print the token's ACTUAL granted scope right
    // next to Zoom's complaint — this is the exact comparison that answers
    // "is my cached token stale relative to a Zoom-side scope change".
    if (/scope/i.test(json?.message || "")) {
      zoomDebug(
        `SCOPE MISMATCH on ${method} ${path}\n` +
        `  Zoom says: ${json?.message}\n` +
        `  Current cached token's granted scope: "${cachedToken?.scope}"\n` +
        `  Token was minted at: ${cachedToken ? new Date(cachedToken.mintedAt).toISOString() : "n/a"}\n` +
        `  If you changed scopes in the Zoom Marketplace AFTER that mint time, ` +
        `this process is still holding the pre-change token (cache lives ~1h, ` +
        `cleared only by minting a new one or restarting the server) — restart ` +
        `the backend to force a fresh mint and re-check the scope logged above.`,
      );
    }
    const err = providerError(`Zoom API error: ${json?.message || res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

// A Zoom meeting id is numeric; validate before it's ever interpolated into a
// URL path (defense-in-depth — ours are server-written, but cheap to enforce).
function assertMeetingId(meetingId) {
  if (!/^\d{5,20}$/.test(String(meetingId))) throw providerError("Invalid Zoom meeting id.");
  return String(meetingId);
}

function toZoomSchedule({ title, startTime, durationMin, timezone }) {
  return {
    ...(title !== undefined ? { topic: title } : {}),
    // UTC ISO without milliseconds — Zoom's documented UTC format.
    ...(startTime !== undefined ? { start_time: new Date(startTime).toISOString().replace(/\.\d{3}Z$/, "Z") } : {}),
    ...(durationMin !== undefined ? { duration: durationMin } : {}),
    ...(timezone !== undefined ? { timezone } : {}),
  };
}

// → { meetingId, joinUrl, startUrl }. joinUrl opens the Zoom app for
// participants; startUrl is the HOST link (sensitive — admin responses only).
async function createMeeting({ title, startTime, durationMin, timezone }) {
  const meeting = await zoomRequest("POST", "/users/me/meetings", {
    ...toZoomSchedule({ title, startTime, durationMin, timezone }),
    type: 2, // scheduled meeting
    settings: { join_before_host: false, waiting_room: true },
  });
  if (!meeting?.id || !meeting?.join_url) throw providerError("Zoom returned an incomplete meeting.");
  return {
    meetingId: String(meeting.id),
    joinUrl: meeting.join_url,
    startUrl: meeting.start_url ?? null,
  };
}

// Patch only the schedule fields that changed. Zoom answers 204 on success.
async function updateMeeting(meetingId, { title, startTime, durationMin, timezone }) {
  await zoomRequest("PATCH", `/meetings/${assertMeetingId(meetingId)}`, toZoomSchedule({ title, startTime, durationMin, timezone }));
}

// Idempotent: a meeting already deleted (or expired) on Zoom's side is success.
async function deleteMeeting(meetingId) {
  try {
    await zoomRequest("DELETE", `/meetings/${assertMeetingId(meetingId)}`);
  } catch (err) {
    if (err.status === 404) return;
    throw err;
  }
}

// Read-only connectivity check for the Integrations module's "Test Connection"
// button — mints/reuses a token via the same getAccessToken() every real
// meeting call uses, without creating a Zoom meeting as a side effect.
async function testConnection() {
  if (!isConfigured()) throw providerError("Zoom is not configured (ZOOM_ACCOUNT_ID/ZOOM_CLIENT_ID/ZOOM_CLIENT_SECRET missing).");
  await getAccessToken();
  return { scope: cachedToken?.scope ?? null };
}

module.exports = {
  name: "zoom",
  isConfigured,
  testConnection,
  createMeeting,
  updateMeeting,
  deleteMeeting,
};
