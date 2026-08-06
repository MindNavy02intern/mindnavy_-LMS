// Supabase Storage provider — one implementation of the storage adapter contract
// (see ./index.js). The backend never proxies file bytes: it issues a signed
// upload URL, the frontend PUTs straight to Supabase, then we verify the object
// exists on confirm.
//
// The Supabase client + package are loaded LAZILY so the server still boots if
// @supabase/supabase-js isn't installed or the env vars aren't set yet — the
// upload endpoints just report "not configured" (503) instead of crashing.

let cachedClient = null;
let clientResolved = false;

function getClient() {
  if (clientResolved) return cachedClient;
  clientResolved = true;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return (cachedClient = null);

  try {
    const { createClient } = require("@supabase/supabase-js");
    cachedClient = createClient(url, key, { auth: { persistSession: false } });
  } catch (err) {
    console.error("[storage] @supabase/supabase-js not installed:", err.message);
    cachedClient = null;
  }
  return cachedClient;
}

function isConfigured() {
  return Boolean(getClient());
}

// Split "folder/sub/file.png" → { dir: "folder/sub", name: "file.png" }.
function splitPath(path) {
  const idx = path.lastIndexOf("/");
  return idx === -1
    ? { dir: "", name: path }
    : { dir: path.slice(0, idx), name: path.slice(idx + 1) };
}

// Returns { uploadUrl, token } for a direct upload to `path` inside `bucket`.
async function createSignedUpload(bucket, path) {
  const client = getClient();
  const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(path);
  if (error) throw Object.assign(new Error(error.message), { code: "STORAGE_SIGN_FAILED" });
  return { uploadUrl: data.signedUrl, token: data.token };
}

// Object metadata as recorded by storage: { exists, size, mimetype }. Used on
// confirm to re-verify what actually landed (never trust the client's claims).
// size is bytes; mimetype is the Content-Type the client sent on PUT. Either may
// be null if storage didn't record it.
async function statObject(bucket, path) {
  const client = getClient();
  const { dir, name } = splitPath(path);
  const { data, error } = await client.storage.from(bucket).list(dir, { search: name, limit: 100 });
  if (error) throw Object.assign(new Error(error.message), { code: "STORAGE_LIST_FAILED" });
  const obj = Array.isArray(data) ? data.find((o) => o.name === name) : null;
  if (!obj) return { exists: false, size: null, mimetype: null };
  const meta = obj.metadata || {};
  return {
    exists: true,
    size: typeof meta.size === "number" ? meta.size : null,
    mimetype: typeof meta.mimetype === "string" ? meta.mimetype : null,
  };
}

// True only if an object actually exists at `path` in `bucket`.
async function objectExists(bucket, path) {
  return (await statObject(bucket, path)).exists;
}

function getPublicUrl(bucket, path) {
  const client = getClient();
  return client.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// Time-limited read URL for an object in a PRIVATE bucket.
//
// getPublicUrl is not an alternative for private data: it returns a permanent,
// unauthenticated link that cannot be revoked once it has been seen. This grant
// expires, so a leaked instructor-document URL stops working on its own.
async function createSignedDownloadUrl(bucket, path, expiresIn) {
  const client = getClient();
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw Object.assign(new Error(error.message), { code: "STORAGE_SIGN_FAILED" });
  return data.signedUrl;
}

async function removeObject(bucket, path) {
  const client = getClient();
  const { error } = await client.storage.from(bucket).remove([path]);
  if (error) throw Object.assign(new Error(error.message), { code: "STORAGE_DELETE_FAILED" });
}

module.exports = {
  name: "supabase",
  isConfigured,
  createSignedUpload,
  statObject,
  objectExists,
  getPublicUrl,
  createSignedDownloadUrl,
  removeObject,
};
