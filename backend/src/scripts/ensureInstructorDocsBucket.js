/**
 * Creates the instructor documents storage bucket if it doesn't exist yet.
 *
 * PRIVATE (public: false) — unlike every other bucket in this system. It holds
 * identity documents, contracts and tax forms; in a public bucket those are
 * readable by anyone who ever obtains the URL, permanently and unrevocably.
 * Reads go through provider.createSignedDownloadUrl instead, which expires.
 *
 * If this bucket already exists as PUBLIC, the script says so and exits non-zero
 * rather than silently accepting it — Supabase will not flip an existing bucket
 * to private from here, and a silent pass would leave PII exposed.
 *
 * 10MB per-object cap — must stay in sync with MAX_BYTES in
 * instructorDocuments.service. Idempotent: safe to run any number of times.
 *
 *   node src/scripts/ensureInstructorDocsBucket.js
 */

require("dotenv").config();

const BUCKET = process.env.SUPABASE_INSTRUCTOR_DOCS_BUCKET || "instructor-documents";
const MAX_BYTES = 10 * 1024 * 1024;

// Mirrors ALLOWED_MIME in instructorDocuments.validator — enforced at the bucket
// as well as in the API, so a signed URL cannot be used to smuggle another type.
const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

async function ensureInstructorDocsBucket() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set.");

  const { createClient } = require("@supabase/supabase-js");
  const client = createClient(url, key, { auth: { persistSession: false } });

  const { data: existing, error: getErr } = await client.storage.getBucket(BUCKET);
  if (existing) {
    if (existing.public) {
      throw new Error(
        `Bucket "${BUCKET}" already exists and is PUBLIC. Instructor documents are ` +
        `PII and must not live in a public bucket — set it to private in the ` +
        `Supabase dashboard (Storage → ${BUCKET} → Settings), then re-run this script.`,
      );
    }
    return { bucket: BUCKET, created: false };
  }
  if (getErr && !/not found/i.test(getErr.message)) throw new Error(getErr.message);

  const { error: createErr } = await client.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ALLOWED_MIME,
  });
  if (createErr) throw new Error(createErr.message);
  return { bucket: BUCKET, created: true };
}

if (require.main === module) {
  ensureInstructorDocsBucket()
    .then((r) => {
      console.log(
        r.created
          ? `Created PRIVATE bucket "${r.bucket}".`
          : `Bucket "${r.bucket}" already exists and is private.`,
      );
      process.exit(0);
    })
    .catch((err) => {
      console.error("Failed to ensure instructor documents bucket:", err.message);
      process.exit(1);
    });
}

module.exports = { ensureInstructorDocsBucket };
