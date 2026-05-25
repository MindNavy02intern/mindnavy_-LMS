const crypto = require("crypto");
const bcrypt = require("bcryptjs");

function generateOtpCode() {
  return crypto.randomInt(100000, 999999).toString();
}

async function hashOtpCode(code) {
  return bcrypt.hash(code, 12);
}

async function compareOtpCode(code, hash) {
  return bcrypt.compare(code, hash);
}

function getOtpExpiryDate() {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 5);
  return expiresAt;
}

module.exports = {
  generateOtpCode,
  hashOtpCode,
  compareOtpCode,
  getOtpExpiryDate,
};