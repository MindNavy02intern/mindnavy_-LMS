const prisma = require("../config/prisma");
const { sendMail, isMailerConfigured } = require("../utils/mailer");

// ── Notifications service ─────────────────────────────────────────────────────
//
// Same conventions as certificates.service/competencies.service: safe() so
// reads render empty instead of 500ing pre-migration; stats/analytics are
// computed live from NotificationLog (R3) except Announcement.sentCount /
// NotificationAutomation.sentCount, which are per-entity send counters (see
// notifications.prisma header note).
//
// NotificationLog is the single sink for every channel, including IN_APP —
// see notifications.prisma header. "Read" = status flips OPENED + openedAt set.
//
// EMAIL_BLAST_CAP: real SMTP sends for a single campaign/emergency alert are
// capped — this is a synchronous admin action with no job queue, so blasting
// thousands of real emails inline isn't safe. Recipients beyond the cap still
// get their IN_APP log row (the guaranteed channel) and an EMAIL row logged
// PENDING with metadata.reason = 'BATCH_CAP' — a production version would hand
// these to a background worker instead of dropping them.
const EMAIL_BLAST_CAP = 50;

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[notifications.service] query failed:", err.message);
    return fallback;
  }
}

function iso(d) { return d instanceof Date ? d.toISOString() : (d ? String(d) : null); }
function domainError(code) { return Object.assign(new Error(code), { code }); }

async function auditLog(adminId, action, details) {
  try {
    await prisma.auditLog.create({ data: { adminId: adminId ?? null, action, details: details ?? null } });
  } catch (err) {
    console.error(`Audit log error (${action}):`, err.message);
  }
}

function metric(value, changePercent = null) { return { value, changePercent, available: true }; }
function unavailable(reason) { return { value: null, changePercent: null, available: false, reason }; }
function computeChangePercent(current, previous) {
  if (!previous) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function renderTemplate(str, variables = {}) {
  if (typeof str !== "string") return str;
  return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => (variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`));
}

function paginate({ page, limit }) {
  return { skip: (page - 1) * limit, take: limit };
}

// ── Templates ────────────────────────────────────────────────────────────────

async function listTemplates({ type, category, status, search, page = 1, limit = 20 } = {}) {
  const where = {
    ...(type ? { type } : {}),
    ...(category ? { category } : {}),
    ...(status ? { status } : {}),
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };
  const [rows, total] = await safe(
    () => Promise.all([
      prisma.notificationTemplate.findMany({ where, orderBy: { updatedAt: "desc" }, ...paginate({ page, limit }) }),
      prisma.notificationTemplate.count({ where }),
    ]),
    [[], 0],
  );
  return { items: rows.map(mapTemplate), total, page, limit };
}

function mapTemplate(t) {
  return {
    id: t.id, name: t.name, type: t.type, subject: t.subject, body: t.body,
    variables: t.variables, category: t.category, status: t.status,
    createdById: t.createdById, createdAt: iso(t.createdAt), updatedAt: iso(t.updatedAt),
  };
}

async function getTemplateOrThrow(id) {
  const t = await prisma.notificationTemplate.findUnique({ where: { id } });
  if (!t) throw domainError("TEMPLATE_NOT_FOUND");
  return t;
}

async function getTemplate(id) { return mapTemplate(await getTemplateOrThrow(id)); }

async function createTemplate(data, adminId) {
  const template = await prisma.notificationTemplate.create({ data: { ...data, createdById: adminId ?? null } });
  await auditLog(adminId, "NOTIFICATION_TEMPLATE_CREATED", { templateId: template.id, name: template.name });
  return mapTemplate(template);
}

async function updateTemplate(id, data, adminId) {
  await getTemplateOrThrow(id);
  const template = await prisma.notificationTemplate.update({ where: { id }, data });
  await auditLog(adminId, "NOTIFICATION_TEMPLATE_UPDATED", { templateId: id, fields: Object.keys(data) });
  return mapTemplate(template);
}

async function deleteTemplate(id, adminId) {
  await getTemplateOrThrow(id);
  await prisma.notificationTemplate.delete({ where: { id } });
  await auditLog(adminId, "NOTIFICATION_TEMPLATE_DELETED", { templateId: id });
  return { id };
}

async function duplicateTemplate(id, adminId) {
  const src = await getTemplateOrThrow(id);
  const copy = await prisma.notificationTemplate.create({
    data: {
      name: `${src.name} (Copy)`, type: src.type, subject: src.subject, body: src.body,
      variables: src.variables, category: src.category, status: "INACTIVE", createdById: adminId ?? null,
    },
  });
  await auditLog(adminId, "NOTIFICATION_TEMPLATE_CREATED", { templateId: copy.id, name: copy.name, duplicatedFrom: id });
  return mapTemplate(copy);
}

async function previewTemplate(id, variables) {
  const t = await getTemplateOrThrow(id);
  return {
    subject: t.subject ? renderTemplate(t.subject, variables) : null,
    body: renderTemplate(t.body, variables),
    variablesUsed: t.variables,
  };
}

// ── Audience resolution (Announcements + Emergency) ──────────────────────────

async function resolveAudienceUserIds(audience, targetIds = []) {
  const SELECT = { id: true, email: true, fullName: true };
  switch (audience) {
    case "ALL":
      return prisma.appUser.findMany({ where: { status: { not: "ARCHIVED" } }, select: SELECT });
    case "LEARNERS":
      return prisma.appUser.findMany({ where: { status: { not: "ARCHIVED" }, role: "LEARNER" }, select: SELECT });
    case "INSTRUCTORS":
      return prisma.appUser.findMany({ where: { status: { not: "ARCHIVED" }, role: "INSTRUCTOR" }, select: SELECT });
    case "DEPARTMENTS":
      return prisma.appUser.findMany({ where: { status: { not: "ARCHIVED" }, departmentId: { in: targetIds } }, select: SELECT });
    case "GROUPS": {
      const members = await prisma.groupMember.findMany({ where: { groupId: { in: targetIds } }, select: { userId: true } });
      const userIds = [...new Set(members.map(m => m.userId))];
      return prisma.appUser.findMany({ where: { id: { in: userIds }, status: { not: "ARCHIVED" } }, select: SELECT });
    }
    case "CUSTOM":
      return prisma.appUser.findMany({ where: { id: { in: targetIds }, status: { not: "ARCHIVED" } }, select: SELECT });
    default:
      return [];
  }
}

// Email gating: PROMOTION campaigns require marketingEnabled; every other
// campaign type only needs the global emailEnabled opt-in. `bypassPreferences`
// is used for emergency alerts (blueprint: mandatory, opt-out doesn't apply).
async function filterEmailRecipients(recipients, { requireMarketing = false, bypassPreferences = false } = {}) {
  const withEmail = recipients.filter(r => r.email);
  if (bypassPreferences || withEmail.length === 0) return withEmail;

  const prefs = await prisma.userNotificationPreference.findMany({
    where: { userId: { in: withEmail.map(r => r.id) } },
  });
  const prefMap = new Map(prefs.map(p => [p.userId, p]));

  return withEmail.filter(r => {
    const p = prefMap.get(r.id);
    if (!p) return true; // no row yet = defaults = opted in
    if (!p.emailEnabled) return false;
    if (requireMarketing && !p.marketingEnabled) return false;
    return true;
  });
}

// Sends IN_APP (always, to every recipient) + EMAIL (best-effort, capped) log
// rows for a campaign. Shared by announcement.send and emergencyAlert.send.
async function deliverToRecipients({ recipients, title, body, priority, sourceType, sourceId, channels, bypassPreferences = false, requireMarketing = false }) {
  if (recipients.length === 0) return { recipientCount: 0 };

  const wantsInApp = channels.includes("IN_APP") || sourceType === "ANNOUNCEMENT";
  const wantsEmail = channels.includes("EMAIL");
  const wantsOther = channels.filter(c => c !== "IN_APP" && c !== "EMAIL");

  if (wantsInApp) {
    await prisma.notificationLog.createMany({
      data: recipients.map(r => ({
        userId: r.id, channel: "IN_APP", status: "SENT", subject: title, body, priority,
        sourceType, sourceId, sentAt: new Date(),
      })),
    });
  }

  if (wantsEmail) {
    const eligible = await filterEmailRecipients(recipients, { requireMarketing, bypassPreferences });
    const toSend = eligible.slice(0, EMAIL_BLAST_CAP);
    const overflow = eligible.slice(EMAIL_BLAST_CAP);

    for (const r of toSend) {
      const result = await sendMail({ to: r.email, subject: title, text: body, html: `<p>${body}</p>` });
      const status = result.sent ? "SENT" : (result.reason === "NOT_CONFIGURED" ? "PENDING" : "FAILED");
      await prisma.notificationLog.create({
        data: {
          userId: r.id, channel: "EMAIL", status, subject: title, body, priority,
          sourceType, sourceId, sentAt: result.sent ? new Date() : null,
          metadata: result.sent ? null : { reason: result.reason },
        },
      });
    }
    if (overflow.length > 0) {
      await prisma.notificationLog.createMany({
        data: overflow.map(r => ({
          userId: r.id, channel: "EMAIL", status: "PENDING", subject: title, body, priority,
          sourceType, sourceId, metadata: { reason: "BATCH_CAP" },
        })),
      });
    }
  }

  // PUSH / SMS — no provider integration yet (no FCM/Twilio). Store + log
  // PENDING so the record exists and the Push/SMS tabs have something to show.
  for (const channel of wantsOther) {
    await prisma.notificationLog.createMany({
      data: recipients.map(r => ({
        userId: r.id, channel, status: "PENDING", subject: title, body, priority, sourceType, sourceId,
      })),
    });
  }

  return { recipientCount: recipients.length };
}

// ── Announcements ────────────────────────────────────────────────────────────

function mapAnnouncement(a) {
  return {
    id: a.id, title: a.title, body: a.body, type: a.type, audience: a.audience, targetIds: a.targetIds,
    priority: a.priority, status: a.status, scheduledAt: iso(a.scheduledAt), sentAt: iso(a.sentAt),
    sentCount: a.sentCount, createdById: a.createdById, createdAt: iso(a.createdAt), updatedAt: iso(a.updatedAt),
  };
}

async function listAnnouncements({ status, type, audience, search, page = 1, limit = 20 } = {}) {
  const where = {
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(audience ? { audience } : {}),
    ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
  };
  const [rows, total] = await safe(
    () => Promise.all([
      prisma.announcement.findMany({ where, orderBy: { createdAt: "desc" }, ...paginate({ page, limit }) }),
      prisma.announcement.count({ where }),
    ]),
    [[], 0],
  );
  return { items: rows.map(mapAnnouncement), total, page, limit };
}

async function getAnnouncementOrThrow(id) {
  const a = await prisma.announcement.findUnique({ where: { id } });
  if (!a) throw domainError("ANNOUNCEMENT_NOT_FOUND");
  return a;
}

async function getAnnouncement(id) { return mapAnnouncement(await getAnnouncementOrThrow(id)); }

async function createAnnouncement(data, adminId) {
  const announcement = await prisma.announcement.create({ data: { ...data, createdById: adminId ?? null } });
  await auditLog(adminId, "ANNOUNCEMENT_CREATED", { announcementId: announcement.id, title: announcement.title });
  return mapAnnouncement(announcement);
}

async function updateAnnouncement(id, data, adminId) {
  const existing = await getAnnouncementOrThrow(id);
  if (existing.status === "SENT" || existing.status === "CANCELLED") throw domainError("ANNOUNCEMENT_LOCKED");
  const announcement = await prisma.announcement.update({ where: { id }, data });
  await auditLog(adminId, "ANNOUNCEMENT_UPDATED", { announcementId: id, fields: Object.keys(data) });
  return mapAnnouncement(announcement);
}

async function sendAnnouncement(id, adminId) {
  const existing = await getAnnouncementOrThrow(id);
  if (existing.status === "SENT") throw domainError("ALREADY_SENT");
  if (existing.status === "CANCELLED") throw domainError("ANNOUNCEMENT_LOCKED");

  const recipients = await resolveAudienceUserIds(existing.audience, existing.targetIds);
  const { recipientCount } = await deliverToRecipients({
    recipients, title: existing.title, body: existing.body, priority: existing.priority,
    sourceType: "ANNOUNCEMENT", sourceId: existing.id, channels: ["IN_APP", "EMAIL"],
    requireMarketing: existing.type === "PROMOTION",
  });

  const announcement = await prisma.announcement.update({
    where: { id }, data: { status: "SENT", sentAt: new Date(), sentCount: recipientCount },
  });
  await auditLog(adminId, "ANNOUNCEMENT_SENT", { announcementId: id, recipientCount });
  return mapAnnouncement(announcement);
}

async function cancelAnnouncement(id, adminId) {
  const existing = await getAnnouncementOrThrow(id);
  if (existing.status === "SENT" || existing.status === "CANCELLED") throw domainError("ANNOUNCEMENT_LOCKED");
  const announcement = await prisma.announcement.update({ where: { id }, data: { status: "CANCELLED" } });
  await auditLog(adminId, "ANNOUNCEMENT_CANCELLED", { announcementId: id });
  return mapAnnouncement(announcement);
}

async function deleteAnnouncement(id, adminId) {
  await getAnnouncementOrThrow(id);
  await prisma.announcement.delete({ where: { id } });
  await auditLog(adminId, "ANNOUNCEMENT_DELETED", { announcementId: id });
  return { id };
}

// ── Automations ──────────────────────────────────────────────────────────────
//
// CRUD + pause/resume are fully live. Trigger execution (actually firing on
// USER_REGISTRATION / COURSE_ENROLLMENT / etc.) is NOT wired to the source
// services yet — that would mean editing users/enrollments/quizzes/finance/
// live-sessions services to emit events, a cross-cutting change out of this
// task's scope. Documented gap, same pattern as competencies' skillLevel.
// configure — sentCount stays 0 until a later phase wires real triggers.

function mapAutomation(a) {
  return {
    id: a.id, name: a.name, description: a.description, trigger: a.trigger, templateId: a.templateId,
    templateName: a.template?.name ?? null, channels: a.channels, status: a.status, sentCount: a.sentCount,
    createdById: a.createdById, createdAt: iso(a.createdAt), updatedAt: iso(a.updatedAt),
  };
}

const AUTOMATION_INCLUDE = { template: { select: { name: true } } };

async function listAutomations({ status, trigger, search, page = 1, limit = 20 } = {}) {
  const where = {
    ...(status ? { status } : {}),
    ...(trigger ? { trigger } : {}),
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };
  const [rows, total] = await safe(
    () => Promise.all([
      prisma.notificationAutomation.findMany({ where, orderBy: { createdAt: "desc" }, include: AUTOMATION_INCLUDE, ...paginate({ page, limit }) }),
      prisma.notificationAutomation.count({ where }),
    ]),
    [[], 0],
  );
  return { items: rows.map(mapAutomation), total, page, limit };
}

async function getAutomationOrThrow(id) {
  const a = await prisma.notificationAutomation.findUnique({ where: { id }, include: AUTOMATION_INCLUDE });
  if (!a) throw domainError("AUTOMATION_NOT_FOUND");
  return a;
}

async function assertTemplateRefExists(templateId) {
  const t = await prisma.notificationTemplate.findUnique({ where: { id: templateId }, select: { id: true } });
  if (!t) throw domainError("TEMPLATE_REF_NOT_FOUND");
}

async function createAutomation(data, adminId) {
  await assertTemplateRefExists(data.templateId);
  const automation = await prisma.notificationAutomation.create({ data: { ...data, createdById: adminId ?? null }, include: AUTOMATION_INCLUDE });
  await auditLog(adminId, "NOTIFICATION_AUTOMATION_CREATED", { automationId: automation.id, name: automation.name });
  return mapAutomation(automation);
}

async function updateAutomation(id, data, adminId) {
  await getAutomationOrThrow(id);
  if (data.templateId) await assertTemplateRefExists(data.templateId);
  const automation = await prisma.notificationAutomation.update({ where: { id }, data, include: AUTOMATION_INCLUDE });
  await auditLog(adminId, "NOTIFICATION_AUTOMATION_UPDATED", { automationId: id, fields: Object.keys(data) });
  return mapAutomation(automation);
}

async function setAutomationStatus(id, status, adminId) {
  await getAutomationOrThrow(id);
  const automation = await prisma.notificationAutomation.update({ where: { id }, data: { status }, include: AUTOMATION_INCLUDE });
  await auditLog(adminId, status === "PAUSED" ? "NOTIFICATION_AUTOMATION_PAUSED" : "NOTIFICATION_AUTOMATION_RESUMED", { automationId: id });
  return mapAutomation(automation);
}

async function deleteAutomation(id, adminId) {
  await getAutomationOrThrow(id);
  await prisma.notificationAutomation.delete({ where: { id } });
  await auditLog(adminId, "NOTIFICATION_AUTOMATION_DELETED", { automationId: id });
  return { id };
}

// ── In-app notifications (NotificationLog, channel=IN_APP) ──────────────────

function mapLog(l) {
  return {
    id: l.id, userId: l.userId, userName: l.user?.fullName ?? null, channel: l.channel, status: l.status,
    subject: l.subject, body: l.body, priority: l.priority, sourceType: l.sourceType, sourceId: l.sourceId,
    metadata: l.metadata, read: l.status === "OPENED" || l.status === "CLICKED",
    sentAt: iso(l.sentAt), openedAt: iso(l.openedAt), clickedAt: iso(l.clickedAt), createdAt: iso(l.createdAt),
  };
}

const LOG_INCLUDE = { user: { select: { fullName: true } } };

async function listInAppNotifications({ userId, read, page = 1, limit = 20 } = {}) {
  const where = {
    channel: "IN_APP",
    ...(userId ? { userId } : {}),
    ...(read === true ? { status: { in: ["OPENED", "CLICKED"] } } : {}),
    ...(read === false ? { status: { notIn: ["OPENED", "CLICKED"] } } : {}),
  };
  const [rows, total] = await safe(
    () => Promise.all([
      prisma.notificationLog.findMany({ where, orderBy: { createdAt: "desc" }, include: LOG_INCLUDE, ...paginate({ page, limit }) }),
      prisma.notificationLog.count({ where }),
    ]),
    [[], 0],
  );
  return { items: rows.map(mapLog), total, page, limit };
}

async function sendInAppNotification({ userIds, title, body, type, priority }, adminId) {
  const users = await prisma.appUser.findMany({ where: { id: { in: userIds } }, select: { id: true } });
  if (users.length === 0) throw domainError("USERS_NOT_FOUND");

  await prisma.notificationLog.createMany({
    data: users.map(u => ({
      userId: u.id, channel: "IN_APP", status: "SENT", subject: title, body, priority,
      sourceType: "MANUAL", sentAt: new Date(), metadata: type ? { type } : null,
    })),
  });
  await auditLog(adminId, "NOTIFICATION_SENT", { userCount: users.length, title });
  return { sentCount: users.length };
}

async function getLogOrThrow(id) {
  const l = await prisma.notificationLog.findUnique({ where: { id } });
  if (!l) throw domainError("NOTIFICATION_NOT_FOUND");
  return l;
}

async function markNotificationRead(id) {
  await getLogOrThrow(id);
  const l = await prisma.notificationLog.update({ where: { id }, data: { status: "OPENED", openedAt: new Date() }, include: LOG_INCLUDE });
  return mapLog(l);
}

async function markAllRead(userId) {
  const where = { channel: "IN_APP", status: { notIn: ["OPENED", "CLICKED"] }, ...(userId ? { userId } : {}) };
  const result = await prisma.notificationLog.updateMany({ where, data: { status: "OPENED", openedAt: new Date() } });
  return { updated: result.count };
}

async function deleteNotification(id, adminId) {
  await getLogOrThrow(id);
  await prisma.notificationLog.delete({ where: { id } });
  await auditLog(adminId, "NOTIFICATION_DELETED", { notificationId: id });
  return { id };
}

// ── Delivery logs (any channel) ──────────────────────────────────────────────

async function listLogs({ channel, status, userId, dateFrom, dateTo, page = 1, limit = 20 } = {}) {
  const where = {
    ...(channel ? { channel } : {}),
    ...(status ? { status } : {}),
    ...(userId ? { userId } : {}),
    ...(dateFrom || dateTo ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } } : {}),
  };
  const [rows, total] = await safe(
    () => Promise.all([
      prisma.notificationLog.findMany({ where, orderBy: { createdAt: "desc" }, include: LOG_INCLUDE, ...paginate({ page, limit }) }),
      prisma.notificationLog.count({ where }),
    ]),
    [[], 0],
  );
  return { items: rows.map(mapLog), total, page, limit };
}

async function retryDelivery(id, adminId) {
  const log = await getLogOrThrow(id);
  if (log.status !== "FAILED" && log.status !== "PENDING") throw domainError("NOT_RETRYABLE");

  if (log.channel === "EMAIL") {
    const user = log.userId ? await prisma.appUser.findUnique({ where: { id: log.userId }, select: { email: true } }) : null;
    if (!user?.email) throw domainError("NO_RECIPIENT_EMAIL");
    const result = await sendMail({ to: user.email, subject: log.subject ?? "Notification", text: log.body, html: `<p>${log.body}</p>` });
    const status = result.sent ? "SENT" : (result.reason === "NOT_CONFIGURED" ? "PENDING" : "FAILED");
    const updated = await prisma.notificationLog.update({
      where: { id }, data: { status, sentAt: result.sent ? new Date() : null, metadata: result.sent ? null : { reason: result.reason } }, include: LOG_INCLUDE,
    });
    await auditLog(adminId, "NOTIFICATION_DELIVERY_RETRIED", { logId: id, status });
    return mapLog(updated);
  }

  // PUSH/SMS — no provider yet, retry is a no-op that keeps it PENDING.
  await auditLog(adminId, "NOTIFICATION_DELIVERY_RETRIED", { logId: id, status: "PENDING" });
  return mapLog(await prisma.notificationLog.findUnique({ where: { id }, include: LOG_INCLUDE }));
}

// ── Preferences ───────────────────────────────────────────────────────────────

const DEFAULT_PREFS = {
  emailEnabled: true, pushEnabled: false, smsEnabled: false, marketingEnabled: true,
  learningAlertsEnabled: true, securityEnabled: true, quietHoursStart: null, quietHoursEnd: null,
};

function mapPrefs(p, userId) {
  if (!p) return { id: null, userId, ...DEFAULT_PREFS, updatedAt: null };
  return {
    id: p.id, userId: p.userId, emailEnabled: p.emailEnabled, pushEnabled: p.pushEnabled, smsEnabled: p.smsEnabled,
    marketingEnabled: p.marketingEnabled, learningAlertsEnabled: p.learningAlertsEnabled, securityEnabled: p.securityEnabled,
    quietHoursStart: p.quietHoursStart, quietHoursEnd: p.quietHoursEnd, updatedAt: iso(p.updatedAt),
  };
}

async function getPreferences(userId) {
  const user = await prisma.appUser.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw domainError("USER_NOT_FOUND");
  const p = await prisma.userNotificationPreference.findUnique({ where: { userId } });
  return mapPrefs(p, userId);
}

async function updatePreferences(userId, data, adminId) {
  const user = await prisma.appUser.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw domainError("USER_NOT_FOUND");
  const p = await prisma.userNotificationPreference.upsert({
    where: { userId }, create: { userId, ...DEFAULT_PREFS, ...data }, update: data,
  });
  await auditLog(adminId, "NOTIFICATION_PREFERENCES_UPDATED", { userId, fields: Object.keys(data) });
  return mapPrefs(p, userId);
}

// ── Emergency alerts ──────────────────────────────────────────────────────────

async function sendEmergencyAlert({ title, message, channels }, adminId) {
  const recipients = await resolveAudienceUserIds("ALL", []);
  const announcement = await prisma.announcement.create({
    data: {
      title, body: message, type: "EMERGENCY", audience: "ALL", targetIds: [], priority: "URGENT",
      status: "SENT", sentAt: new Date(), createdById: adminId ?? null,
    },
  });

  const { recipientCount } = await deliverToRecipients({
    recipients, title, body: message, priority: "URGENT", sourceType: "EMERGENCY", sourceId: announcement.id,
    channels: [...new Set(["IN_APP", ...channels])], bypassPreferences: true,
  });

  const updated = await prisma.announcement.update({ where: { id: announcement.id }, data: { sentCount: recipientCount } });
  await auditLog(adminId, "EMERGENCY_ALERT_SENT", { announcementId: announcement.id, recipientCount, channels });
  return { ...mapAnnouncement(updated), recipientCount };
}

async function listEmergencyAlerts({ page = 1, limit = 20 } = {}) {
  return listAnnouncements({ type: "EMERGENCY", page, limit });
}

// Background sweep (server.js setInterval, same convention as
// scheduledReports.service's runDueReports) — sends every SCHEDULED
// announcement whose scheduledAt has passed. adminId is null (system-authored),
// same precedent as ScheduledReport's RUN audit rows.
async function sendDueAnnouncements() {
  const due = await prisma.announcement.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } },
    select: { id: true },
  });
  for (const { id } of due) {
    try {
      await sendAnnouncement(id, null);
    } catch (err) {
      console.error(`[notifications.service] scheduled send failed for ${id}:`, err.message);
    }
  }
  return { sent: due.length };
}

// ── Stats ──────────────────────────────────────────────────────────────────────

const SUCCESS_STATUSES = ["SENT", "OPENED", "CLICKED"];
const ATTEMPTED_STATUSES = ["SENT", "OPENED", "CLICKED", "FAILED", "BOUNCED"];

async function getStats() {
  const now = new Date();
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [sentThis, sentLast, failed, pending, scheduledCampaigns, activeAutomations, attempted, succeeded] = await Promise.all([
    safe(() => prisma.notificationLog.count({ where: { status: { in: SUCCESS_STATUSES }, createdAt: { gte: startThisMonth } } }), 0),
    safe(() => prisma.notificationLog.count({ where: { status: { in: SUCCESS_STATUSES }, createdAt: { gte: startLastMonth, lt: startThisMonth } } }), 0),
    safe(() => prisma.notificationLog.count({ where: { status: "FAILED" } }), 0),
    safe(() => prisma.notificationLog.count({ where: { status: "PENDING" } }), 0),
    safe(() => prisma.announcement.count({ where: { status: "SCHEDULED" } }), 0),
    safe(() => prisma.notificationAutomation.count({ where: { status: "ACTIVE" } }), 0),
    safe(() => prisma.notificationLog.count({ where: { status: { in: ATTEMPTED_STATUSES } } }), 0),
    safe(() => prisma.notificationLog.count({ where: { status: { in: SUCCESS_STATUSES } } }), 0),
  ]);

  return {
    sentTotal: metric(sentThis, computeChangePercent(sentThis, sentLast)),
    failedDeliveries: metric(failed),
    pendingNotifications: metric(pending),
    openRate: unavailable("No open tracking yet"),
    clickRate: unavailable("No click tracking yet"),
    scheduledCampaigns: metric(scheduledCampaigns),
    activeAutomations: metric(activeAutomations),
    deliverySuccessRate: attempted > 0 ? metric(Math.round((succeeded / attempted) * 100)) : unavailable("No delivery attempts yet"),
  };
}

// ── Analytics ──────────────────────────────────────────────────────────────────

const TREND_DAYS = 14;

async function getAnalytics() {
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);
    days.push(day);
  }

  const [sentByDay, failedByDay, channelGroups, topCampaigns, automations] = await Promise.all([
    Promise.all(days.map(d => safe(() => prisma.notificationLog.count({
      where: { status: { in: SUCCESS_STATUSES }, createdAt: { gte: d, lt: new Date(d.getTime() + 86400000) } },
    }), 0))),
    Promise.all(days.map(d => safe(() => prisma.notificationLog.count({
      where: { status: "FAILED", createdAt: { gte: d, lt: new Date(d.getTime() + 86400000) } },
    }), 0))),
    safe(() => prisma.notificationLog.groupBy({ by: ["channel"], _count: { _all: true } }), []),
    safe(() => prisma.announcement.findMany({ where: { sentCount: { gt: 0 } }, orderBy: { sentCount: "desc" }, take: 5 }), []),
    safe(() => prisma.notificationAutomation.findMany({ orderBy: { sentCount: "desc" }, take: 10 }), []),
  ]);

  return {
    deliveryTrend: {
      labels: days.map(d => d.toISOString().slice(0, 10)),
      sent: sentByDay,
      failed: failedByDay,
    },
    channelBreakdown: {
      available: true,
      items: channelGroups.map(g => ({ channel: g.channel, count: g._count._all })),
    },
    topCampaigns: {
      available: topCampaigns.length > 0,
      reason: topCampaigns.length > 0 ? undefined : "No campaigns sent yet",
      items: topCampaigns.map(a => ({ id: a.id, title: a.title, sentCount: a.sentCount, sentAt: iso(a.sentAt) })),
    },
    automationPerformance: {
      available: automations.length > 0,
      reason: automations.length > 0 ? undefined : "No automations configured yet",
      items: automations.map(a => ({ id: a.id, name: a.name, sentCount: a.sentCount, status: a.status })),
    },
  };
}

module.exports = {
  // templates
  listTemplates, getTemplate, createTemplate, updateTemplate, deleteTemplate, duplicateTemplate, previewTemplate,
  // announcements
  listAnnouncements, getAnnouncement, createAnnouncement, updateAnnouncement, sendAnnouncement, cancelAnnouncement, deleteAnnouncement,
  // automations
  listAutomations, getAutomationOrThrow, createAutomation, updateAutomation, setAutomationStatus, deleteAutomation,
  // in-app
  listInAppNotifications, sendInAppNotification, markNotificationRead, markAllRead, deleteNotification,
  // logs
  listLogs, retryDelivery,
  // preferences
  getPreferences, updatePreferences,
  // emergency
  sendEmergencyAlert, listEmergencyAlerts,
  // background sweep
  sendDueAnnouncements,
  // stats/analytics
  getStats, getAnalytics,
};
