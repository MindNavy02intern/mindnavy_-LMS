// Validation for the instructor custom certificate design endpoints
// (POST .../certificate-design/sign, /confirm, PATCH .../position).
// Mirrors certificates.validator.js's logo upload validators — same
// sign→PUT→confirm shape, same allow-listed image mime/size.

const { LOGO_ALLOWED_MIME } = require("./certificates.validator");

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const FONT_SIZE_MIN = 8;
const FONT_SIZE_MAX = 120;

function validateDesignSign(body = {}) {
  const errors = [];

  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  if (!fileName) errors.push("fileName is required.");
  else if (fileName.length > 300) errors.push("fileName must be at most 300 characters.");

  const fileType = typeof body.fileType === "string" ? body.fileType.trim().toLowerCase() : "";
  if (!fileType) errors.push("fileType is required.");
  else if (!LOGO_ALLOWED_MIME.includes(fileType)) {
    errors.push(`fileType "${fileType}" is not allowed. Allowed: ${LOGO_ALLOWED_MIME.join(", ")}.`);
  }

  return { isValid: errors.length === 0, errors, data: { fileName, fileType } };
}

function validateDesignConfirm(body = {}) {
  const errors = [];
  const path = typeof body.path === "string" ? body.path.trim() : "";
  if (!path) errors.push("path is required.");
  else if (path.length > 500) errors.push("path must be at most 500 characters.");
  return { isValid: errors.length === 0, errors, data: { path } };
}

// nameX/nameY are required — there is no meaningful "clear the position"
// action separate from "clear the whole design" (deleting the image), so
// unlike fontSize/color there is no null/undefined path for them here.
function validateDesignPosition(body = {}) {
  const errors = [];

  const nameX = Number(body.nameX);
  if (!Number.isFinite(nameX) || nameX < 0 || nameX > 1) errors.push("nameX must be a number between 0 and 1.");

  const nameY = Number(body.nameY);
  if (!Number.isFinite(nameY) || nameY < 0 || nameY > 1) errors.push("nameY must be a number between 0 and 1.");

  let fontSize;
  if (body.fontSize !== undefined && body.fontSize !== null) {
    const n = Number(body.fontSize);
    if (!Number.isInteger(n) || n < FONT_SIZE_MIN || n > FONT_SIZE_MAX) {
      errors.push(`fontSize must be an integer between ${FONT_SIZE_MIN} and ${FONT_SIZE_MAX}.`);
    } else fontSize = n;
  }

  let color;
  if (body.color !== undefined && body.color !== null) {
    if (typeof body.color !== "string" || !HEX_COLOR.test(body.color.trim())) {
      errors.push("color must be a hex color like #111111.");
    } else color = body.color.trim().toUpperCase();
  }

  return {
    isValid: errors.length === 0,
    errors,
    data: {
      nameX,
      nameY,
      ...(fontSize !== undefined ? { fontSize } : {}),
      ...(color !== undefined ? { color } : {}),
    },
  };
}

module.exports = {
  validateDesignSign,
  validateDesignConfirm,
  validateDesignPosition,
};
