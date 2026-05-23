const crypto = require("crypto");

function generateSessionToken() {
  return crypto.randomBytes(64).toString("hex");
}

function getSessionExpiryDate() {
  const expiresAt = new Date();

  // Session expires after 24 hours
  expiresAt.setHours(expiresAt.getHours() + 24);

  return expiresAt;
}

module.exports = {
  generateSessionToken,
  getSessionExpiryDate,
};