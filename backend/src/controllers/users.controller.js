const usersService = require("../services/users.service");
const {
  validateUuidParam,
  validateCreateUserInput,
  validateUpdateUserInput,
  validateUpdateUserStatusInput,
  validateSuspendUserInput,
  validateAssignUserRoleInput,
  validateResetUserPasswordInput,
  validateSendMessageInput,
  validateForceLogoutInput,
} = require("../validators/users.validator");

// ─── Analytics endpoint (Task 6D) ────────────────────────────────────────────

async function getUsersAnalytics(req, res) {
  try {
    const analytics = await usersService.getUsersAnalytics(req.admin);
    return res.status(200).json({ success: true, analytics });
  } catch (error) {
    console.error("[users] getUsersAnalytics error:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Failed to load user analytics." });
  }
}

// ─── Read endpoints ───────────────────────────────────────────────────────────

async function getUsersList(req, res) {
  try {
    const result = await usersService.getUsersList(req.query, req.admin);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("[users] getUsersList error:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Failed to load users." });
  }
}

async function exportUsers(req, res) {
  try {
    const result = await usersService.exportUsers(req.query, req.admin);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("[users] exportUsers error:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Export failed." });
  }
}

async function getUserDetails(req, res) {
  try {
    const result = await usersService.getUserDetails(req.params.id, req.admin);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: "Invalid user id." });
    }
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: "User not found." });
    }
    console.error("[users] getUserDetails error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to fetch user details." });
  }
}

// ─── Write endpoints (Task 6C) ────────────────────────────────────────────────

async function createUser(req, res) {
  const errors = validateCreateUserInput(req.body || {});
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0] });
  }

  try {
    const result = await usersService.createUser(req.body, req.admin);
    return res.status(201).json(result);
  } catch (error) {
    if (error.statusCode === 409) {
      return res.status(409).json({ success: false, message: error.message });
    }
    console.error("[users] createUser error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to create user." });
  }
}

async function updateUser(req, res) {
  const idError = validateUuidParam(req.params.id);
  if (idError) {
    return res.status(400).json({ success: false, message: idError });
  }

  const errors = validateUpdateUserInput(req.body || {});
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0] });
  }

  try {
    const result = await usersService.updateUser(req.params.id, req.body, req.admin);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.statusCode === 409) {
      return res.status(409).json({ success: false, message: error.message });
    }
    console.error("[users] updateUser error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to update user." });
  }
}

async function suspendUser(req, res) {
  const idError = validateUuidParam(req.params.id);
  if (idError) {
    return res.status(400).json({ success: false, message: idError });
  }

  const errors = validateSuspendUserInput(req.body || {});
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0] });
  }

  try {
    const result = await usersService.suspendUser(req.params.id, req.body, req.admin);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error("[users] suspendUser error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to suspend user." });
  }
}

async function updateUserStatus(req, res) {
  const idError = validateUuidParam(req.params.id);
  if (idError) {
    return res.status(400).json({ success: false, message: idError });
  }

  const errors = validateUpdateUserStatusInput(req.body || {});
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0] });
  }

  try {
    const result = await usersService.updateUserStatus(req.params.id, req.body, req.admin);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error("[users] updateUserStatus error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to update user status." });
  }
}

async function resetUserPassword(req, res) {
  const idError = validateUuidParam(req.params.id);
  if (idError) {
    return res.status(400).json({ success: false, message: idError });
  }

  const errors = validateResetUserPasswordInput(req.body || {});
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0] });
  }

  try {
    const result = await usersService.resetUserPassword(req.params.id, req.body, req.admin);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error("[users] resetUserPassword error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to reset user password." });
  }
}

async function assignUserRole(req, res) {
  const idError = validateUuidParam(req.params.id);
  if (idError) {
    return res.status(400).json({ success: false, message: idError });
  }

  const errors = validateAssignUserRoleInput(req.body || {});
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0] });
  }

  try {
    const result = await usersService.assignUserRole(req.params.id, req.body, req.admin);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error("[users] assignUserRole error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to assign user role." });
  }
}

async function reactivateUser(req, res) {
  const idError = validateUuidParam(req.params.id);
  if (idError) {
    return res.status(400).json({ success: false, message: idError });
  }

  try {
    const result = await usersService.reactivateUser(req.params.id, req.admin);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error("[users] reactivateUser error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to reactivate user." });
  }
}

async function approveVerification(req, res) {
  const idError = validateUuidParam(req.params.id);
  if (idError) {
    return res.status(400).json({ success: false, message: idError });
  }

  try {
    const result = await usersService.approveVerification(req.params.id, req.admin);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error("[users] approveVerification error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to approve verification." });
  }
}

async function deleteUser(req, res) {
  const idError = validateUuidParam(req.params.id);
  if (idError) {
    return res.status(400).json({ success: false, message: idError });
  }

  try {
    const result = await usersService.deleteUser(req.params.id, req.admin);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error("[users] deleteUser error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to archive user." });
  }
}

// ─── Task 6E: Bulk User Import ────────────────────────────────────────────────

async function importUsers(req, res) {
  if (req.uploadError) {
    return res.status(400).json({ success: false, message: req.uploadError });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: "No CSV file uploaded. Use field name: file." });
  }

  try {
    const result = await usersService.importUsersFromCsv(req.file, req.admin);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("[users] importUsers error:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Failed to import users." });
  }
}

// ─── Task 6E: Bulk Action ─────────────────────────────────────────────────────

async function bulkActionUsers(req, res) {
  const body = req.body || {};
  if (!body.action || !Array.isArray(body.userIds) || body.userIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: "body must include action (string) and userIds (non-empty array).",
    });
  }
  try {
    const result = await usersService.bulkActionUsers(body, req.admin);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("[users] bulkActionUsers error:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Bulk action failed." });
  }
}

// ─── Messaging endpoints ──────────────────────────────────────────────────────

async function sendMessage(req, res) {
  const idError = validateUuidParam(req.params.id);
  if (idError) {
    return res.status(400).json({ success: false, message: idError });
  }

  const errors = validateSendMessageInput(req.body || {});
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0] });
  }

  try {
    const result = await usersService.sendMessageToUser(req.params.id, req.body, req.admin);
    return res.status(201).json(result);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error("[users] sendMessage error:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Failed to send message." });
  }
}

async function getUserMessagesList(req, res) {
  const idError = validateUuidParam(req.params.id);
  if (idError) {
    return res.status(400).json({ success: false, message: idError });
  }

  try {
    const result = await usersService.getUserMessages(req.params.id, req.query, req.admin);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error("[users] getUserMessagesList error:", error.message, error.stack);
    return res.status(500).json({ success: false, message: "Failed to fetch messages." });
  }
}

// ─── Force Logout ─────────────────────────────────────────────────────────────

async function forceLogoutUser(req, res) {
  const idError = validateUuidParam(req.params.id);
  if (idError) {
    return res.status(400).json({ success: false, message: idError });
  }

  const errors = validateForceLogoutInput(req.body || {});
  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors[0] });
  }

  try {
    const result = await usersService.forceLogoutUser(req.params.id, req.body, req.admin);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    console.error("[users] forceLogoutUser error:", error.message);
    return res.status(500).json({ success: false, message: "Unable to force logout user." });
  }
}

module.exports = {
  getUsersList,
  getUserDetails,
  createUser,
  updateUser,
  updateUserStatus,
  suspendUser,
  reactivateUser,
  approveVerification,
  resetUserPassword,
  assignUserRole,
  deleteUser,
  getUsersAnalytics,
  exportUsers,
  importUsers,
  bulkActionUsers,
  sendMessage,
  getUserMessagesList,
  forceLogoutUser,
};
