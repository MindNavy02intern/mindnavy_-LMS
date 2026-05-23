const prisma = require("../config/prisma");

async function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const session = await prisma.adminSession.findUnique({
      where: {
        sessionToken: token,
      },
      include: {
        admin: true,
      },
    });

    if (!session) {
      return res.status(401).json({
        success: false,
        message: "Invalid session.",
      });
    }

    if (session.revokedAt) {
      return res.status(401).json({
        success: false,
        message: "Session revoked.",
      });
    }

    if (session.expiresAt < new Date()) {
      return res.status(401).json({
        success: false,
        message: "Session expired.",
      });
    }

    if (!session.admin || session.admin.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        message: "Access denied.",
      });
    }

    req.admin = {
      id: session.admin.id,
      email: session.admin.email,
      fullName: session.admin.fullName,
      role: session.admin.role,
      status: session.admin.status,
    };

    req.adminSession = {
      id: session.id,
      expiresAt: session.expiresAt,
    };

    next();
  } catch (error) {
    console.error("Admin auth middleware error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
}

module.exports = {
  requireAdminAuth,
};