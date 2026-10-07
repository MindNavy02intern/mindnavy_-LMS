const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const base = new PrismaClient({
  adapter,
  log: ["error", "warn"],
});

// ── Instructor access changes take effect immediately ────────────────────────
//
// instructorAuth.middleware caches a validated session for up to 60s, so a
// suspend / role change / password reset / revoked session used to keep
// working until that entry aged out. Rather than every service remembering to
// clear the cache (15+ write sites today, more tomorrow), any write that can
// REDUCE access clears it here, in one place. Routine writes — lastUsedAt /
// expiresAt / lastActivityAt bumps, profile edits — don't, so the cache keeps
// doing its job. Clearing is cheap: each instructor's next request re-reads
// its session once.
const ACCESS_FIELDS = ["status", "role", "passwordHash", "revokedAt"];
const ACCESS_WRITE_OPS = new Set(["update", "updateMany", "upsert", "delete", "deleteMany"]);

function reducesAccess(operation, args) {
  if (!ACCESS_WRITE_OPS.has(operation)) return false;
  if (operation === "delete" || operation === "deleteMany") return true;
  const data = operation === "upsert" ? args?.update : args?.data;
  return Boolean(data) && ACCESS_FIELDS.some((field) => field in data);
}

function clearInstructorSessionCache() {
  // Required lazily: the middleware itself requires this module.
  require("../middlewares/instructorAuth.middleware").clearAllCachedInstructorSessions();
}

const clearOnAccessChange = {
  async $allOperations({ operation, args, query }) {
    const result = await query(args);
    if (reducesAccess(operation, args)) {
      clearInstructorSessionCache();
      // Inside an interactive transaction the write isn't visible until
      // commit; a request landing in between could re-cache the old state.
      // One more clear just after covers that window.
      setTimeout(clearInstructorSessionCache, 1000).unref();
    }
    return result;
  },
};

const prisma = base.$extends({
  query: {
    appUser: clearOnAccessChange,
    appUserSession: clearOnAccessChange,
  },
});

module.exports = prisma;
