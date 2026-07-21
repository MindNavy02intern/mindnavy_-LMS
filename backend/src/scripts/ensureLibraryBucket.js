/**
 * Creates the Content Library storage bucket if it doesn't exist yet (public,
 * 50MB per-object cap — must stay in sync with MAX_BYTES in content.service).
 * Idempotent: safe to run any number of times. Dev/setup tooling — uses the
 * service-role key from .env, so it grants nothing an operator doesn't have.
 *
 *   node src/scripts/ensureLibraryBucket.js
 */

require("dotenv").config();

const BUCKET = process.env.SUPABASE_LIBRARY_BUCKET || "content-library";
const MAX_BYTES = 50 * 1024 * 1024;

async function ensureLibraryBucket() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.");

  const { createClient } = require("@supabase/supabase-js");
  const client = createClient(url, key, { auth: { persistSession: false } });

  const { data: existing, error: getErr } = await client.storage.getBucket(BUCKET);
  if (existing) return { bucket: BUCKET, created: false };
  if (getErr && !/not found/i.test(getErr.message)) throw new Error(getErr.message);

  const { error: createErr } = await client.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
  });
  if (createErr) throw new Error(createErr.message);
  return { bucket: BUCKET, created: true };
}

if (require.main === module) {
  ensureLibraryBucket()
    .then((r) => {
      console.log(r.created ? `Created bucket "${r.bucket}".` : `Bucket "${r.bucket}" already exists.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Failed to ensure library bucket:", err.message);
      process.exit(1);
    });
}

module.exports = { ensureLibraryBucket };
