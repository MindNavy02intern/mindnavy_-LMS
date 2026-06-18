const invitationsService = require("../services/invitations.service");

async function list(req, res) {
  try {
    const result = await invitationsService.listInvitations(req.query);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("[invitations] list error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load invitations." });
  }
}

async function send(req, res) {
  try {
    const result = await invitationsService.sendInvitation(req.body || {}, req.admin);
    return res.status(201).json(result);
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message });
    if (error.statusCode === 409) return res.status(409).json({ success: false, message: error.message });
    console.error("[invitations] send error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to send invitation." });
  }
}

async function resend(req, res) {
  try {
    const result = await invitationsService.resendInvitation(req.params.id, req.admin);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message });
    if (error.statusCode === 404) return res.status(404).json({ success: false, message: error.message });
    console.error("[invitations] resend error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to resend invitation." });
  }
}

async function cancel(req, res) {
  try {
    const result = await invitationsService.cancelInvitation(req.params.id, req.admin);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message });
    if (error.statusCode === 404) return res.status(404).json({ success: false, message: error.message });
    console.error("[invitations] cancel error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to cancel invitation." });
  }
}

async function updateExpiration(req, res) {
  try {
    const result = await invitationsService.updateExpiration(req.params.id, req.body || {}, req.admin);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 400) return res.status(400).json({ success: false, message: error.message });
    if (error.statusCode === 404) return res.status(404).json({ success: false, message: error.message });
    console.error("[invitations] updateExpiration error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to update expiration." });
  }
}

module.exports = { list, send, resend, cancel, updateExpiration };
