const usersService = require("../services/users.service");

const EMPTY_LIST_RESPONSE = {
  kpiSummary: {
    totalUsers: 0,
    totalUsersChange: 0,
    activeUsers: 0,
    activeUsersChange: 0,
    pendingVerification: 0,
    pendingVerificationChange: 0,
    suspendedUsers: 0,
    suspendedUsersChange: 0,
    invitationsPending: 0,
    invitationsPendingChange: 0,
  },
  users: [],
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },
};

async function getUsersList(req, res) {
  try {
    const result = await usersService.getUsersList(req.query, req.admin);
    return res.status(200).json(result);
  } catch (error) {
    console.error("[users] Service error:", error.message, error.stack);
    return res.status(200).json(EMPTY_LIST_RESPONSE);
  }
}

async function getUserDetails(req, res) {
  try {
    const result = await usersService.getUserDetails(req.params.id, req.admin);
    return res.status(200).json(result);
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({ message: "Invalid user id." });
    }
    if (error.statusCode === 404) {
      return res.status(404).json({ message: "User not found." });
    }
    console.error("getUserDetails controller error:", error.message);
    return res.status(500).json({ message: "Unable to fetch user details." });
  }
}

module.exports = { getUsersList, getUserDetails };
