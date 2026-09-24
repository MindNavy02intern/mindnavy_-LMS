const svc = require("../services/notifications.service");
const { validatePreferencesUpdate, validateLogsQuery } = require("../validators/notifications.validator");

// Instructor self-service Notifications + Preferences (blueprint 2.10 + 2.12).
// Every handler is scoped to req.instructor.id — never a client-suppliable
// userId/:id param anywhere in this file.

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "NOTIFICATION_NOT_FOUND":
      return notFound(res, "Notification not found.");
    default:
      return null;
  }
}

function serverError(res, err) {
  console.error("[InstructorNotificationsController]", err);
  if (err.code === "P2021" || err.code === "P2022") {
    return res.status(503).json({ success: false, message: "Database not migrated yet. Run `npx prisma db push`." });
  }
  return res.status(500).json({ success: false, message: "Internal server error." });
}

function run(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      return handleDomainError(res, err) ?? serverError(res, err);
    }
  };
}

function validateId(id, label) {
  if (!id || typeof id !== "string" || !id.trim()) return `${label} is required.`;
  return null;
}

// ── In-app notification feed ────────────────────────────────────────────────────

// Reuses the same svc.listLogs the admin console's InAppTab.tsx itself calls
// (channel:'IN_APP') rather than the narrower listInAppNotifications — that's
// where date-range filtering actually lives (listInAppNotifications has no
// dateFrom/dateTo at all). channel/userId are forced AFTER spreading the
// parsed query, so a client-sent channel or userId can never override them —
// self-scoped to this instructor's own IN_APP rows only, same convention as
// every other instructor endpoint.
const listNotifications = run(async (req, res) => {
  const parsed = validateLogsQuery(req.query);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  const result = await svc.listLogs({ ...parsed.data, channel: "IN_APP", userId: req.instructor.id });
  return res.json({ success: true, data: result });
});

const markRead = run(async (req, res) => {
  const idErr = validateId(req.params.id, "notificationId");
  if (idErr) return badRequest(res, idErr);
  const result = await svc.markMyNotificationRead(req.instructor.id, req.params.id);
  return res.json({ success: true, message: "Marked as read.", data: result });
});

const markAllRead = run(async (req, res) => {
  const result = await svc.markAllRead(req.instructor.id);
  return res.json({ success: true, message: "Marked all as read.", data: result });
});

// ── Preferences ──────────────────────────────────────────────────────────────────

const getPreferences = run(async (req, res) => {
  const result = await svc.getPreferences(req.instructor.id);
  return res.json({ success: true, data: result });
});

const updatePreferences = run(async (req, res) => {
  const v = validatePreferencesUpdate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  // adminId stays null — this is an instructor's own self-service change, not
  // an admin-initiated one (same actor-agnostic convention as instructorAuth
  // .service.js's audit rows).
  const result = await svc.updatePreferences(req.instructor.id, v.data, null);
  return res.json({ success: true, message: "Preferences updated.", data: result });
});

module.exports = {
  listNotifications,
  markRead,
  markAllRead,
  getPreferences,
  updatePreferences,
};
