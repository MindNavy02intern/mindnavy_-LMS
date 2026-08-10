const svc = require("../services/notifications.service");
const v = require("../validators/notifications.validator");

// ── Helpers (same shape as certificates.controller) ──────────────────────────

function badRequest(res, msg) { return res.status(400).json({ success: false, message: msg }); }
function notFound(res, msg = "Not found.") { return res.status(404).json({ success: false, message: msg }); }

function handleDomainError(res, err) {
  switch (err.code) {
    case "TEMPLATE_NOT_FOUND":      return notFound(res, "Template not found.");
    case "TEMPLATE_REF_NOT_FOUND":  return badRequest(res, "Referenced template does not exist.");
    case "ANNOUNCEMENT_NOT_FOUND":  return notFound(res, "Announcement not found.");
    case "ANNOUNCEMENT_LOCKED":     return badRequest(res, "Announcement has already been sent or cancelled.");
    case "ALREADY_SENT":            return badRequest(res, "Announcement has already been sent.");
    case "AUTOMATION_NOT_FOUND":    return notFound(res, "Automation not found.");
    case "USERS_NOT_FOUND":         return badRequest(res, "None of the given userIds exist.");
    case "USER_NOT_FOUND":          return notFound(res, "User not found.");
    case "NOTIFICATION_NOT_FOUND":  return notFound(res, "Notification not found.");
    case "NOT_RETRYABLE":           return badRequest(res, "Only FAILED or PENDING deliveries can be retried.");
    case "NO_RECIPIENT_EMAIL":      return badRequest(res, "Recipient has no email on file.");
    default:                        return null;
  }
}

function serverError(res, err) {
  console.error("[NotificationsController]", err);
  if (err.code === "P2025") return notFound(res, "Record not found.");
  if (err.code === "P2003") return badRequest(res, "Invalid reference: one or more IDs do not exist.");
  if (err.code === "P2021") return res.status(503).json({ success: false, message: "Database not migrated yet. Run `npx prisma db push`." });
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

// ── Stats / analytics ─────────────────────────────────────────────────────────

const getStats     = run(async (req, res) => res.json({ success: true, data: await svc.getStats() }));
const getAnalytics = run(async (req, res) => res.json({ success: true, data: await svc.getAnalytics() }));

// ── Templates ────────────────────────────────────────────────────────────────

const listTemplates = run(async (req, res) => {
  const { page, limit } = v.validatePageQuery(req.query).data;
  const { type, category, status, search } = req.query;
  const data = await svc.listTemplates({ type, category, status, search, page, limit });
  res.json({ success: true, data });
});

const getTemplate = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "templateId");
  if (idErr) return badRequest(res, idErr);
  res.json({ success: true, data: await svc.getTemplate(req.params.id) });
});

const createTemplate = run(async (req, res) => {
  const parsed = v.validateTemplateCreate(req.body);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  const data = await svc.createTemplate(parsed.data, req.admin?.id);
  res.status(201).json({ success: true, message: "Template created.", data });
});

const updateTemplate = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "templateId");
  if (idErr) return badRequest(res, idErr);
  const parsed = v.validateTemplateUpdate(req.body);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  const data = await svc.updateTemplate(req.params.id, parsed.data, req.admin?.id);
  res.json({ success: true, message: "Template updated.", data });
});

const deleteTemplate = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "templateId");
  if (idErr) return badRequest(res, idErr);
  const data = await svc.deleteTemplate(req.params.id, req.admin?.id);
  res.json({ success: true, message: "Template deleted.", data });
});

const duplicateTemplateHandler = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "templateId");
  if (idErr) return badRequest(res, idErr);
  const data = await svc.duplicateTemplate(req.params.id, req.admin?.id);
  res.status(201).json({ success: true, message: "Template duplicated.", data });
});

const previewTemplateHandler = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "templateId");
  if (idErr) return badRequest(res, idErr);
  const parsed = v.validateTemplatePreview(req.body);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  const data = await svc.previewTemplate(req.params.id, parsed.data.variables);
  res.json({ success: true, data });
});

// ── Announcements ────────────────────────────────────────────────────────────

const listAnnouncements = run(async (req, res) => {
  const { page, limit } = v.validatePageQuery(req.query).data;
  const { status, type, audience, search } = req.query;
  const data = await svc.listAnnouncements({ status, type, audience, search, page, limit });
  res.json({ success: true, data });
});

const createAnnouncement = run(async (req, res) => {
  const parsed = v.validateAnnouncementCreate(req.body);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  const data = await svc.createAnnouncement(parsed.data, req.admin?.id);
  res.status(201).json({ success: true, message: "Announcement created.", data });
});

const getAnnouncement = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "announcementId");
  if (idErr) return badRequest(res, idErr);
  res.json({ success: true, data: await svc.getAnnouncement(req.params.id) });
});

const updateAnnouncement = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "announcementId");
  if (idErr) return badRequest(res, idErr);
  const parsed = v.validateAnnouncementUpdate(req.body);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  const data = await svc.updateAnnouncement(req.params.id, parsed.data, req.admin?.id);
  res.json({ success: true, message: "Announcement updated.", data });
});

const sendAnnouncementHandler = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "announcementId");
  if (idErr) return badRequest(res, idErr);
  const data = await svc.sendAnnouncement(req.params.id, req.admin?.id);
  res.json({ success: true, message: "Announcement sent.", data });
});

const cancelAnnouncementHandler = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "announcementId");
  if (idErr) return badRequest(res, idErr);
  const data = await svc.cancelAnnouncement(req.params.id, req.admin?.id);
  res.json({ success: true, message: "Announcement cancelled.", data });
});

const deleteAnnouncement = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "announcementId");
  if (idErr) return badRequest(res, idErr);
  const data = await svc.deleteAnnouncement(req.params.id, req.admin?.id);
  res.json({ success: true, message: "Announcement deleted.", data });
});

// ── Automations ──────────────────────────────────────────────────────────────

const listAutomations = run(async (req, res) => {
  const { page, limit } = v.validatePageQuery(req.query).data;
  const { status, trigger, search } = req.query;
  const data = await svc.listAutomations({ status, trigger, search, page, limit });
  res.json({ success: true, data });
});

const createAutomation = run(async (req, res) => {
  const parsed = v.validateAutomationCreate(req.body);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  const data = await svc.createAutomation(parsed.data, req.admin?.id);
  res.status(201).json({ success: true, message: "Automation created.", data });
});

const updateAutomation = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "automationId");
  if (idErr) return badRequest(res, idErr);
  const parsed = v.validateAutomationUpdate(req.body);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  const data = await svc.updateAutomation(req.params.id, parsed.data, req.admin?.id);
  res.json({ success: true, message: "Automation updated.", data });
});

const pauseAutomation = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "automationId");
  if (idErr) return badRequest(res, idErr);
  const data = await svc.setAutomationStatus(req.params.id, "PAUSED", req.admin?.id);
  res.json({ success: true, message: "Automation paused.", data });
});

const resumeAutomation = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "automationId");
  if (idErr) return badRequest(res, idErr);
  const data = await svc.setAutomationStatus(req.params.id, "ACTIVE", req.admin?.id);
  res.json({ success: true, message: "Automation resumed.", data });
});

const deleteAutomation = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "automationId");
  if (idErr) return badRequest(res, idErr);
  const data = await svc.deleteAutomation(req.params.id, req.admin?.id);
  res.json({ success: true, message: "Automation deleted.", data });
});

// ── In-app notifications ─────────────────────────────────────────────────────

const listNotifications = run(async (req, res) => {
  const { page, limit } = v.validatePageQuery(req.query).data;
  const { userId } = req.query;
  const read = req.query.read === "true" ? true : req.query.read === "false" ? false : undefined;
  const data = await svc.listInAppNotifications({ userId, read, page, limit });
  res.json({ success: true, data });
});

const sendNotification = run(async (req, res) => {
  const parsed = v.validateSendNotification(req.body);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  const data = await svc.sendInAppNotification(parsed.data, req.admin?.id);
  res.status(201).json({ success: true, message: "Notification sent.", data });
});

const markRead = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "notificationId");
  if (idErr) return badRequest(res, idErr);
  const data = await svc.markNotificationRead(req.params.id);
  res.json({ success: true, message: "Marked as read.", data });
});

const markAllRead = run(async (req, res) => {
  const data = await svc.markAllRead(req.body?.userId);
  res.json({ success: true, message: "Marked all as read.", data });
});

const deleteNotification = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "notificationId");
  if (idErr) return badRequest(res, idErr);
  const data = await svc.deleteNotification(req.params.id, req.admin?.id);
  res.json({ success: true, message: "Notification deleted.", data });
});

// ── Delivery logs ─────────────────────────────────────────────────────────────

const listLogs = run(async (req, res) => {
  const parsed = v.validateLogsQuery(req.query);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  const data = await svc.listLogs(parsed.data);
  res.json({ success: true, data });
});

const retryDelivery = run(async (req, res) => {
  const idErr = v.validateId(req.params.id, "logId");
  if (idErr) return badRequest(res, idErr);
  const data = await svc.retryDelivery(req.params.id, req.admin?.id);
  res.json({ success: true, message: "Retry attempted.", data });
});

// ── Preferences ───────────────────────────────────────────────────────────────

const getPreferences = run(async (req, res) => {
  const idErr = v.validateId(req.params.userId, "userId");
  if (idErr) return badRequest(res, idErr);
  res.json({ success: true, data: await svc.getPreferences(req.params.userId) });
});

const updatePreferences = run(async (req, res) => {
  const idErr = v.validateId(req.params.userId, "userId");
  if (idErr) return badRequest(res, idErr);
  const parsed = v.validatePreferencesUpdate(req.body);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  const data = await svc.updatePreferences(req.params.userId, parsed.data, req.admin?.id);
  res.json({ success: true, message: "Preferences updated.", data });
});

// ── Emergency ─────────────────────────────────────────────────────────────────

const sendEmergency = run(async (req, res) => {
  const parsed = v.validateEmergency(req.body);
  if (!parsed.isValid) return badRequest(res, parsed.errors[0]);
  const data = await svc.sendEmergencyAlert(parsed.data, req.admin?.id);
  res.status(201).json({ success: true, message: "Emergency alert sent.", data });
});

const listEmergencyAlerts = run(async (req, res) => {
  const { page, limit } = v.validatePageQuery(req.query).data;
  const data = await svc.listEmergencyAlerts({ page, limit });
  res.json({ success: true, data });
});

module.exports = {
  getStats, getAnalytics,
  listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate,
  duplicateTemplate: duplicateTemplateHandler, previewTemplate: previewTemplateHandler,
  listAnnouncements, getAnnouncement, createAnnouncement, updateAnnouncement,
  sendAnnouncement: sendAnnouncementHandler, cancelAnnouncement: cancelAnnouncementHandler, deleteAnnouncement,
  listAutomations, createAutomation, updateAutomation, pauseAutomation, resumeAutomation, deleteAutomation,
  listNotifications, sendNotification, markRead, markAllRead, deleteNotification,
  listLogs, retryDelivery,
  getPreferences, updatePreferences,
  sendEmergency, listEmergencyAlerts,
};
