// Meetings adapter selector — same shape as ../storage/index.js.
//
// Every provider (Zoom now, Meet/Teams later) implements the SAME interface:
// { name, isConfigured, createMeeting, updateMeeting, deleteMeeting }. The
// liveSessions service talks ONLY to this module, so adding a provider later is
// a new file plus one line here — no endpoint, contract, or frontend change.
//
//   MEETING_PROVIDER=zoom (default)

const zoomProvider = require("./zoomProvider");

const PROVIDERS = {
  zoom: zoomProvider,
  // meet:  require("./meetProvider"),  // v2
  // teams: require("./teamsProvider"), // v2
};

function getMeetingProvider() {
  const key = (process.env.MEETING_PROVIDER || "zoom").toLowerCase();
  return PROVIDERS[key] || zoomProvider;
}

module.exports = { getMeetingProvider };
