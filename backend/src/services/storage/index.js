// Storage adapter selector.
//
// Every provider (Supabase now, Cloudflare Stream/R2 later) implements the SAME
// interface: { name, isConfigured, createSignedUpload, statObject, objectExists,
// getPublicUrl, removeObject }. The uploads service talks ONLY to this module, so
// swapping providers later is a one-line change here (plus a new provider file) —
// no endpoint, contract, or frontend change.
//
//   STORAGE_PROVIDER=supabase   (default)
//   STORAGE_PROVIDER=cloudflare (Phase 2 — real video via Cloudflare Stream)

const supabaseProvider = require("./supabaseProvider");

const PROVIDERS = {
  supabase: supabaseProvider,
  // cloudflare: require("./cloudflareProvider"), // Phase 2
};

function getProvider() {
  const key = (process.env.STORAGE_PROVIDER || "supabase").toLowerCase();
  return PROVIDERS[key] || supabaseProvider;
}

module.exports = { getProvider };
