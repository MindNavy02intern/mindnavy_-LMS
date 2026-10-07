// Single source of truth for "are we running in local development?".
//
// The relaxed security behaviour — no account lockout, ~10x looser login
// rate limits, OTP / password-reset codes printed to the server console when
// SMTP isn't configured — must ONLY ever switch on when the environment says
// so explicitly. It used to be keyed on `NODE_ENV !== "production"`, which
// fails OPEN: a deploy that simply forgot to set NODE_ENV got development
// mode. Now an unset, misspelled, or "production" value all mean strict.
//
// Local development opts in with NODE_ENV=development in backend/.env.
// A function (not a load-time constant) so it always reflects the env as it
// is when called, regardless of module load order relative to dotenv.
function isDevMode() {
  return process.env.NODE_ENV === "development";
}

module.exports = { isDevMode };
