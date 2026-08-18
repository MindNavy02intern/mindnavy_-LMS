const prisma = require("../config/prisma");
const { sendMail } = require("../utils/mailer");
const { renderTemplate, isWithinQuietHours, isQuietHoursExempt, trackedHtml } = require("./notifications.service");

// ── Automation trigger firing ────────────────────────────────────────────────
//
// NOTIFICATIONS_CONTRACT.md decision #5 documented this as CRUD-only —
// `sentCount` stuck at 0 forever because nothing ever called into this from
// the source services. This file is the missing piece: one entry point
// (`fireAutomationTrigger`) that source services call best-effort after the
// real thing they're doing (create a user, complete an enrollment, grade a
// quiz, ...) already happened.
//
// Recipient model: every `NotificationAutomation` fires at a SINGLE AppUser
// (the person the event is about) — this is a transactional notification
// ("your enrollment completed"), not a broad-audience campaign (that's
// Announcements). `metadata` supplies whatever the template's `{{variables}}`
// need beyond the recipient's own fullName/email (always available).
//
// Best-effort by design (same convention as certificateTriggers.service.js):
// every exported function swallows its own errors so a misconfigured or
// missing automation can never break the real action that triggered it.

async function safe(fn, fallback) {
  try {
    return await fn();
  } catch (err) {
    console.error("[automationTriggers.service] query failed:", err.message);
    return fallback;
  }
}

// Fires every ACTIVE automation configured for `triggerType`, at `userId`,
// rendering each automation's template with { fullName, email, ...metadata }.
// Never throws — call sites don't need their own try/catch.
async function fireAutomationTrigger(triggerType, userId, metadata = {}) {
  console.log('[TRIGGER] fired:', triggerType, 'userId:', userId); // TEMP DEBUG
  if (!userId) return;
  try {
    const automations = await prisma.notificationAutomation.findMany({
      where: { trigger: triggerType, status: "ACTIVE" },
      include: { template: true },
    });
    console.log('[TRIGGER] found automations:', automations.length); // TEMP DEBUG
    if (automations.length === 0) return;

    const user = await prisma.appUser.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, status: true },
    });
    if (!user || user.status === "ARCHIVED") return;

    for (const automation of automations) {
      console.log('[TRIGGER] processing:', automation.id, automation.name); // TEMP DEBUG
      await fireOne(automation, user, metadata, triggerType).catch((err) => {
        console.error(`[automationTriggers] automation ${automation.id} (${triggerType}) failed:`, err.message);
      });
    }
  } catch (err) {
    console.error(`[automationTriggers] fireAutomationTrigger(${triggerType}) failed:`, err.message);
  }
}

async function fireOne(automation, user, metadata, triggerType) {
  const vars = { fullName: user.fullName, email: user.email, ...metadata };
  const subject = automation.template.subject ? renderTemplate(automation.template.subject, vars) : null;
  const body = renderTemplate(automation.template.body, vars);

  let prefs = null;
  const exempt = isQuietHoursExempt({ triggerType });
  if (!exempt && automation.channels.includes("EMAIL")) {
    prefs = await safe(() => prisma.userNotificationPreference.findUnique({ where: { userId: user.id } }), null);
  }

  for (const channel of automation.channels) {
    if (channel === "IN_APP") {
      await prisma.notificationLog.create({
        data: {
          userId: user.id, channel: "IN_APP", status: "SENT", subject, body, priority: "NORMAL",
          sourceType: "AUTOMATION", sourceId: automation.id, sentAt: new Date(),
        },
      });
      continue;
    }

    if (channel === "EMAIL") {
      if (!user.email) continue;

      // Deferred, not dropped — notifications.service.retryPendingDeliveries
      // (server.js sweep) picks QUIET_HOURS rows back up once the window ends.
      if (!exempt && isWithinQuietHours(prefs)) {
        await prisma.notificationLog.create({
          data: {
            userId: user.id, channel: "EMAIL", status: "PENDING", subject, body, priority: "NORMAL",
            sourceType: "AUTOMATION", sourceId: automation.id, metadata: { reason: "QUIET_HOURS" },
          },
        });
        continue;
      }

      // Log row created BEFORE sending (same order notifications.service's
      // deliverToRecipients uses) — its id is embedded in the tracking
      // pixel/links.
      const log = await prisma.notificationLog.create({
        data: { userId: user.id, channel: "EMAIL", status: "PENDING", subject, body, priority: "NORMAL", sourceType: "AUTOMATION", sourceId: automation.id },
      });
      const result = await sendMail({ to: user.email, subject: subject ?? "Notification", text: body, html: trackedHtml(`<p>${body}</p>`, log.id) });
      const status = result.sent ? "SENT" : (result.reason === "NOT_CONFIGURED" ? "PENDING" : "FAILED");
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: { status, sentAt: result.sent ? new Date() : null, metadata: result.sent ? null : { reason: result.reason } },
      });
      continue;
    }

    // PUSH / SMS — no FCM/Twilio provider (same gap as everywhere else in
    // this module) — log PENDING so the row exists and the tabs have
    // something real to show, never a fabricated SENT.
    await prisma.notificationLog.create({
      data: {
        userId: user.id, channel, status: "PENDING", subject, body, priority: "NORMAL",
        sourceType: "AUTOMATION", sourceId: automation.id,
      },
    });
  }

  await prisma.notificationAutomation.update({ where: { id: automation.id }, data: { sentCount: { increment: 1 } } });
  console.log('[TRIGGER] sentCount updated for:', automation.id); // TEMP DEBUG
}

module.exports = { fireAutomationTrigger };
