const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_TYPES = new Set(["DIRECT", "WARNING", "POLICY_UPDATE", "ANNOUNCEMENT", "FEEDBACK"]);
const VALID_PRIORITIES = new Set(["NORMAL", "HIGH", "URGENT"]);

function validateSendAdminMessageInput(body) {
  const errors = [];
  const { recipientId, subject, body: messageBody, type, priority } = body || {};

  if (!recipientId || typeof recipientId !== "string" || !UUID_REGEX.test(recipientId.trim())) {
    errors.push("recipientId must be a valid UUID.");
  }

  if (!messageBody || typeof messageBody !== "string") {
    errors.push("Message body is required.");
    return errors;
  }

  if (messageBody.trim().length === 0) {
    errors.push("Message body cannot be empty.");
    return errors;
  }

  if (messageBody.trim().length < 10) {
    errors.push("Message body must be at least 10 characters.");
  }

  if (messageBody.trim().length > 2000) {
    errors.push("Message body must not exceed 2000 characters.");
  }

  if (subject !== undefined && subject !== null) {
    if (typeof subject !== "string") {
      errors.push("Subject must be a string.");
    } else if (subject.trim().length > 150) {
      errors.push("Subject must not exceed 150 characters.");
    }
  }

  if (type !== undefined && type !== null) {
    if (typeof type !== "string" || !VALID_TYPES.has(type.trim().toUpperCase())) {
      errors.push(`type must be one of: ${[...VALID_TYPES].join(", ")}.`);
    }
  }

  if (priority !== undefined && priority !== null) {
    if (typeof priority !== "string" || !VALID_PRIORITIES.has(priority.trim().toUpperCase())) {
      errors.push(`priority must be one of: ${[...VALID_PRIORITIES].join(", ")}.`);
    }
  }

  return errors;
}

// Instructor reply to an admin message (this task). Same body-length rules
// as the original send (validateSendAdminMessageInput above) — a reply is
// still a real message, not a throwaway acknowledgment.
function validateReplyInput(body) {
  const errors = [];
  const { originalMessageId, body: replyBody } = body || {};

  if (!originalMessageId || typeof originalMessageId !== "string" || !UUID_REGEX.test(originalMessageId.trim())) {
    errors.push("originalMessageId must be a valid UUID.");
  }

  if (!replyBody || typeof replyBody !== "string") {
    errors.push("Reply body is required.");
    return errors;
  }

  if (replyBody.trim().length === 0) {
    errors.push("Reply body cannot be empty.");
    return errors;
  }

  if (replyBody.trim().length < 2) {
    errors.push("Reply body is too short.");
  }

  if (replyBody.trim().length > 2000) {
    errors.push("Reply body must not exceed 2000 characters.");
  }

  return errors;
}

module.exports = { validateSendAdminMessageInput, validateReplyInput };
