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

// ── Quiet hours ──────────────────────────────────────────────────────────────
//
// UserNotificationPreference has no timezone field (documented gap,
// NOTIFICATIONS_CONTRACT.md #8) — "current time" is always UTC, not the
// recipient's local time. quietHoursStart/End are "HH:MM" 24h strings.
// Supports an overnight range (e.g. 22:00-06:00): start > end wraps midnight.

function parseHHMM(s) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || "").trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function isWithinQuietHours(prefs, now = new Date()) {
  if (!prefs?.quietHoursStart || !prefs?.quietHoursEnd) return false;
  const start = parseHHMM(prefs.quietHoursStart);
  const end = parseHHMM(prefs.quietHoursEnd);
  if (start === null || end === null || start === end) return false;
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  return start < end ? (nowMin >= start && nowMin < end) : (nowMin >= start || nowMin < end);
}

// URGENT priority and SECURITY_EVENT-triggered / EMERGENCY-sourced sends are
// never deferred — same exemption list as the bypassPreferences callers
// already use for Emergency Alerts (blueprint 10 §13: mandatory, opt-out
// doesn't apply), extended to cover automation-fired security notices too.
function isQuietHoursExempt({ priority, sourceType, triggerType } = {}) {
  return priority === "URGENT" || sourceType === "EMERGENCY" || triggerType === "SECURITY_EVENT";
}

// ── Open/click tracking (self-hosted — no 3rd party) ────────────────────────
//
// Real pixel + redirect, backed by the SAME NotificationLog.openedAt/
// clickedAt columns the module has always had (previously only ever set by
// the in-app "mark read" action and an EMAIL retry succeeding — see decision
// #7). The log row must exist BEFORE the email is sent so its id can be
// embedded in the pixel/links, so every EMAIL send below creates the log row
// first (status PENDING) and updates it after sendMail() resolves, instead
// of the previous "send then log" order.

function trackingBaseUrl() {
  return (process.env.PUBLIC_API_URL || "http://localhost:5001").replace(/\/+$/, "");
}

function trackingPixelHtml(logId) {
  return `<img src="${trackingBaseUrl()}/api/track/open/${logId}" width="1" height="1" alt="" style="display:none" />`;
}

// Simple, safe href rewrite — every href in this codebase's email bodies is a
// plain absolute http(s) URL (no templating engine, no relative links), so a
// regex is sufficient without pulling in an HTML parser dependency.
function wrapLinksForTracking(html, logId) {
  return html.replace(/href="(https?:\/\/[^"]+)"/g, (_, url) => `href="${trackingBaseUrl()}/api/track/click/${logId}?url=${encodeURIComponent(url)}"`);
}

function trackedHtml(bodyHtml, logId) {
  return wrapLinksForTracking(bodyHtml, logId) + trackingPixelHtml(logId);
}

async function markOpened(logId) {
  await safe(() => prisma.notificationLog.updateMany({
    where: { id: logId, openedAt: null },
    data: { openedAt: new Date(), status: "OPENED" },
  }), null);
}

async function markClicked(logId) {
  const now = new Date();
  await safe(() => prisma.notificationLog.updateMany({
    where: { id: logId, clickedAt: null },
    data: { clickedAt: now, openedAt: now, status: "CLICKED" },
  }), null);
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
// Returns the prefMap alongside the filtered list so the caller can also
// apply the quiet-hours check without a second prefs query (same batch fetch).
async function filterEmailRecipients(recipients, { requireMarketing = false, bypassPreferences = false } = {}) {
  const withEmail = recipients.filter(r => r.email);
  if (bypassPreferences || withEmail.length === 0) return { recipients: withEmail, prefMap: new Map() };

  const prefs = await prisma.userNotificationPreference.findMany({
    where: { userId: { in: withEmail.map(r => r.id) } },
  });
  const prefMap = new Map(prefs.map(p => [p.userId, p]));

  const eligible = withEmail.filter(r => {
    const p = prefMap.get(r.id);
    if (!p) return true; // no row yet = defaults = opted in
    if (!p.emailEnabled) return false;
    if (requireMarketing && !p.marketingEnabled) return false;
    return true;
  });
  return { recipients: eligible, prefMap };
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
    const { recipients: eligible, prefMap } = await filterEmailRecipients(recipients, { requireMarketing, bypassPreferences });
    const toSend = eligible.slice(0, EMAIL_BLAST_CAP);
    const overflow = eligible.slice(EMAIL_BLAST_CAP);
    const exempt = bypassPreferences || isQuietHoursExempt({ priority, sourceType });

    for (const r of toSend) {
      // Deferred, not dropped — the retry sweep (server.js, notifications.service
      // .retryPendingDeliveries) picks QUIET_HOURS rows back up once the window
      // ends, same PENDING lane BATCH_CAP overflow already uses below.
      if (!exempt && isWithinQuietHours(prefMap.get(r.id))) {
        await prisma.notificationLog.create({
          data: {
            userId: r.id, channel: "EMAIL", status: "PENDING", subject: title, body, priority,
            sourceType, sourceId, metadata: { reason: "QUIET_HOURS" },
          },
        });
        continue;
      }
      // Log row created BEFORE sending — its id is embedded in the tracking
      // pixel/links, so it has to exist first.
      const log = await prisma.notificationLog.create({
        data: { userId: r.id, channel: "EMAIL", status: "PENDING", subject: title, body, priority, sourceType, sourceId },
      });
      const result = await sendMail({ to: r.email, subject: title, text: body, html: trackedHtml(`<p>${body}</p>`, log.id) });
      const status = result.sent ? "SENT" : (result.reason === "NOT_CONFIGURED" ? "PENDING" : "FAILED");
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: { status, sentAt: result.sent ? new Date() : null, metadata: result.sent ? null : { reason: result.reason } },
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

// NotificationLog.userId is a plain scalar — no `user` relation exists on
// the model (see notifications.prisma), so it can't be Prisma `include`d.
// Resolve names with a separate batch lookup instead, attached in the same
// `{ user: { fullName } }` shape mapLog() expects.
async function attachUserNames(rows) {
  const ids = [...new Set(rows.map(r => r.userId).filter(Boolean))];
  if (ids.length === 0) return rows;
  const users = await prisma.appUser.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true } });
  const nameById = new Map(users.map(u => [u.id, u.fullName]));
  return rows.map(r => ({ ...r, user: r.userId && nameById.has(r.userId) ? { fullName: nameById.get(r.userId) } : null }));
}

async function listInAppNotifications({ userId, read, page = 1, limit = 20 } = {}) {
  const where = {
    channel: "IN_APP",
    ...(userId ? { userId } : {}),
    ...(read === true ? { status: { in: ["OPENED", "CLICKED"] } } : {}),
    ...(read === false ? { status: { notIn: ["OPENED", "CLICKED"] } } : {}),
  };
  const [rows, total] = await safe(
    () => Promise.all([
      prisma.notificationLog.findMany({ where, orderBy: { createdAt: "desc" }, ...paginate({ page, limit }) }),
      prisma.notificationLog.count({ where }),
    ]),
    [[], 0],
  );
  return { items: (await attachUserNames(rows)).map(mapLog), total, page, limit };
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
  const l = await prisma.notificationLog.update({ where: { id }, data: { status: "OPENED", openedAt: new Date() } });
  return mapLog((await attachUserNames([l]))[0]);
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
      prisma.notificationLog.findMany({ where, orderBy: { createdAt: "desc" }, ...paginate({ page, limit }) }),
      prisma.notificationLog.count({ where }),
    ]),
    [[], 0],
  );
  return { items: (await attachUserNames(rows)).map(mapLog), total, page, limit };
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
      where: { id }, data: { status, sentAt: result.sent ? new Date() : null, metadata: result.sent ? null : { reason: result.reason } },
    });
    await auditLog(adminId, "NOTIFICATION_DELIVERY_RETRIED", { logId: id, status });
    return mapLog((await attachUserNames([updated]))[0]);
  }

  // PUSH/SMS — no provider yet, retry is a no-op that keeps it PENDING.
  await auditLog(adminId, "NOTIFICATION_DELIVERY_RETRIED", { logId: id, status: "PENDING" });
  const l = await prisma.notificationLog.findUnique({ where: { id } });
  return mapLog((await attachUserNames([l]))[0]);
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

// ── Feature waitlist ─────────────────────────────────────────────────────────
// Generic "notify me" — currently only Custom Reports (CustomReportsTab.tsx)
// calls this. Tracks by ADMIN (req.admin), not AppUser — this is an admin
// console operator expressing interest in an admin-console feature, a
// different concept from UserNotificationPreference above (learner-facing
// channel prefs). Idempotent: joining twice is a no-op, not an error.
const WAITLIST_FEATURES = new Set(["custom_reports"]);

async function joinWaitlist(feature, admin) {
  if (!WAITLIST_FEATURES.has(feature)) throw domainError("UNKNOWN_FEATURE");

  const existing = await prisma.featureWaitlist.findUnique({
    where: { feature_adminId: { feature, adminId: admin.id } },
  });
  if (existing) return { alreadyJoined: true };

  await prisma.featureWaitlist.create({ data: { feature, adminId: admin.id } });
  await auditLog(admin.id, "FEATURE_WAITLIST_JOINED", { feature });

  if (admin.email && isMailerConfigured()) {
    const label = feature.replace(/_/g, " ");
    await sendMail({
      to: admin.email,
      subject: `You're on the waitlist — ${label}`,
      text: `Hi ${admin.fullName ?? ""}, you're on the list for ${label}. We'll email this address the moment it ships.`,
      html: `<p>Hi ${admin.fullName ?? ""},</p><p>You're on the list for <strong>${label}</strong>. We'll email this address the moment it ships.</p>`,
    }).catch((err) => console.error("[notifications.service] waitlist email failed:", err.message));
  }

  return { alreadyJoined: false };
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

// Background sweep (server.js setInterval, same convention as
// sendDueAnnouncements/scheduledReports) — retries EMAIL rows logged PENDING
// for a reason that resolves on its own over time: "BATCH_CAP" (beyond
// EMAIL_BLAST_CAP — never attempted, retried once an hour has passed) and
// "QUIET_HOURS" (deferred send — retried as soon as that recipient's window
// ends, re-checked per row, not on a fixed delay). "NOT_CONFIGURED" (SMTP
// unset) rows are deliberately NOT retried here — retrying would just
// reproduce NOT_CONFIGURED every sweep forever; an admin who fixes SMTP can
// already retry those individually via POST /logs/:id/retry. Same "no job
// queue, bounded inline work" constraint EMAIL_BLAST_CAP itself documents —
// one capped batch per sweep, never unbounded.
const MAX_DELIVERY_RETRIES = 3;
const RETRY_SWEEP_BATCH = 100;
const BATCH_CAP_RETRY_DELAY_MS = 60 * 60 * 1000; // 1 hour

async function retryPendingDeliveries() {
  const rows = await safe(() => prisma.notificationLog.findMany({
    where: { channel: "EMAIL", status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: RETRY_SWEEP_BATCH,
  }), []);

  let attempted = 0;
  for (const row of rows) {
    const reason = row.metadata?.reason;
    if (reason !== "BATCH_CAP" && reason !== "QUIET_HOURS") continue;

    const retryCount = row.metadata?.retryCount ?? 0;
    if (retryCount >= MAX_DELIVERY_RETRIES) continue;

    if (reason === "BATCH_CAP" && Date.now() - row.createdAt.getTime() < BATCH_CAP_RETRY_DELAY_MS) continue;
    if (reason === "QUIET_HOURS") {
      if (!row.userId) continue;
      const prefs = await safe(() => prisma.userNotificationPreference.findUnique({ where: { userId: row.userId } }), null);
      if (isWithinQuietHours(prefs)) continue; // still quiet — leave PENDING, try again next sweep
    }

    const user = row.userId
      ? await safe(() => prisma.appUser.findUnique({ where: { id: row.userId }, select: { email: true } }), null)
      : null;
    if (!user?.email) {
      await safe(() => prisma.notificationLog.update({
        where: { id: row.id }, data: { status: "FAILED", metadata: { reason: "NO_RECIPIENT_EMAIL", retryCount: retryCount + 1 } },
      }), null);
      continue;
    }

    attempted += 1;
    const result = await sendMail({ to: user.email, subject: row.subject ?? "Notification", text: row.body, html: trackedHtml(`<p>${row.body}</p>`, row.id) });
    if (result.sent) {
      await safe(() => prisma.notificationLog.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date(), metadata: null } }), null);
    } else {
      const nextRetryCount = retryCount + 1;
      const exhausted = nextRetryCount >= MAX_DELIVERY_RETRIES;
      await safe(() => prisma.notificationLog.update({
        where: { id: row.id },
        data: { status: exhausted ? "FAILED" : "PENDING", metadata: { reason: exhausted ? result.reason : reason, retryCount: nextRetryCount } },
      }), null);
    }
  }
  return { checked: rows.length, attempted };
}

// ── Stats ──────────────────────────────────────────────────────────────────────

const SUCCESS_STATUSES = ["SENT", "OPENED", "CLICKED"];
const ATTEMPTED_STATUSES = ["SENT", "OPENED", "CLICKED", "FAILED", "BOUNCED"];

async function getStats() {
  const now = new Date();
  const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    sentThis, sentLast, failed, pending, scheduledCampaigns, activeAutomations, attempted, succeeded,
    emailDelivered, emailOpened, emailClicked,
  ] = await Promise.all([
    safe(() => prisma.notificationLog.count({ where: { status: { in: SUCCESS_STATUSES }, createdAt: { gte: startThisMonth } } }), 0),
    safe(() => prisma.notificationLog.count({ where: { status: { in: SUCCESS_STATUSES }, createdAt: { gte: startLastMonth, lt: startThisMonth } } }), 0),
    safe(() => prisma.notificationLog.count({ where: { status: "FAILED" } }), 0),
    safe(() => prisma.notificationLog.count({ where: { status: "PENDING" } }), 0),
    safe(() => prisma.announcement.count({ where: { status: "SCHEDULED" } }), 0),
    safe(() => prisma.notificationAutomation.count({ where: { status: "ACTIVE" } }), 0),
    safe(() => prisma.notificationLog.count({ where: { status: { in: ATTEMPTED_STATUSES } } }), 0),
    safe(() => prisma.notificationLog.count({ where: { status: { in: SUCCESS_STATUSES } } }), 0),
    // Real pixel/redirect tracking (see markOpened/markClicked) — EMAIL
    // channel only; IN_APP's OPENED/CLICKED come from the in-app "mark read"
    // action, a different signal that would dilute an actual open/click rate.
    safe(() => prisma.notificationLog.count({ where: { channel: "EMAIL", status: { in: SUCCESS_STATUSES } } }), 0),
    safe(() => prisma.notificationLog.count({ where: { channel: "EMAIL", status: { in: ["OPENED", "CLICKED"] } } }), 0),
    safe(() => prisma.notificationLog.count({ where: { channel: "EMAIL", status: "CLICKED" } }), 0),
  ]);

  return {
    sentTotal: metric(sentThis, computeChangePercent(sentThis, sentLast)),
    failedDeliveries: metric(failed),
    pendingNotifications: metric(pending),
    openRate: emailDelivered > 0 ? metric(Math.round((emailOpened / emailDelivered) * 100)) : unavailable("No emails delivered yet."),
    clickRate: emailDelivered > 0 ? metric(Math.round((emailClicked / emailDelivered) * 100)) : unavailable("No emails delivered yet."),
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
  // feature waitlist
  joinWaitlist,
  // emergency
  sendEmergencyAlert, listEmergencyAlerts,
  // background sweep
  sendDueAnnouncements, retryPendingDeliveries,
  // stats/analytics
  getStats, getAnalytics,
  // shared helpers (reused by automationTriggers.service.js)
  renderTemplate, isWithinQuietHours, isQuietHoursExempt, trackedHtml,
  // open/click tracking (backend/src/routes/track.routes.js)
  markOpened, markClicked,
};
