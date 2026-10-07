// The caller's IP address, as Express resolves it.
//
// Use this instead of reading the X-Forwarded-For header directly. That
// header is set by the CLIENT unless a proxy we control overwrites it, so
// trusting it lets anyone claim any IP. That matters wherever the IP feeds a
// security decision — the trusted-device fingerprint (ip + user agent) is the
// big one: a forged X-Forwarded-For matching a trusted admin's network would
// skip new-device verification.
//
// req.ip already does the right thing in both setups (see server.js's
// TRUST_PROXY note): with no proxy it's the socket address, and with
// TRUST_PROXY set it's derived from X-Forwarded-For only through the trusted
// hops. One knob, configured once, instead of every controller re-parsing a
// spoofable header its own way.
function getClientIp(req) {
  return req.ip || null;
}

module.exports = { getClientIp };
