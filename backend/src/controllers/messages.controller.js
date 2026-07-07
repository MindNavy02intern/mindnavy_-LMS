const messagesService = require("../services/messages.service");
const { validateSendAdminMessageInput } = require("../validators/messages.validator");

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function sendMessage(req, res) {
  const errors = validateSendAdminMessageInput(req.body || {});
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0] });
  }

  try {
    const result = await messagesService.sendAdminMessage(req.body, req.admin);
    return res.status(201).json(result);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error("[messages] sendMessage error:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
}

async function getMessages(req, res) {
  const recipientId = req.query.recipientId;

  if (!recipientId || typeof recipientId !== "string" || !UUID_REGEX.test(recipientId.trim())) {
    return res.status(400).json({ success: false, message: "recipientId query param must be a valid UUID." });
  }

  try {
    const result = await messagesService.getAdminMessages(recipientId.trim(), req.query);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error("[messages] getMessages error:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Failed to fetch messages." });
  }
}

module.exports = { sendMessage, getMessages };
