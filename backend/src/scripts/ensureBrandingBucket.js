/**
 * Creates the system branding storage bucket if it doesn't exist yet (public,
 * 2MB per-object cap — must stay in sync with BRANDING_MAX_BYTES in
 * settings.service). Holds admin-uploaded logos/favicons, read via public URL
 * (settings.service's confirmBrandingUpload calls provider.getPublicUrl), so
 * this must be public unlike ensureInstructorDocsBucket's private one.
 * Idempotent: safe to run any number of times.
 *
 *   node src/scripts/ensureBrandingBucket.js
 */

require("dotenv").config();

const BUCKET = process.env.SUPABASE_BRANDING_BUCKET || "system-branding";
const MAX_BYTES = 2 * 1024 * 1024;

// Mirrors the upload box copy in BrandingTab.tsx ("PNG/JPG/SVG, up to 2MB").
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/svg+xml"];

async function ensureBrandingBucket() {
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
    allowedMimeTypes: ALLOWED_MIME,
  });
  if (createErr) throw new Error(createErr.message);
  return { bucket: BUCKET, created: true };
}

if (require.main === module) {
  ensureBrandingBucket()
    .then((r) => {
      console.log(r.created ? `Created PUBLIC bucket "${r.bucket}".` : `Bucket "${r.bucket}" already exists.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Failed to ensure branding bucket:", err.message);
      process.exit(1);
    });
}

module.exports = { ensureBrandingBucket };
