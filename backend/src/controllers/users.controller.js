const usersService = require("../services/users.service");

const EMPTY_RESPONSE = {
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
    console.error("getUsersList controller error:", error.message);
    return res.status(500).json(EMPTY_RESPONSE);
  }
}

module.exports = { getUsersList };
