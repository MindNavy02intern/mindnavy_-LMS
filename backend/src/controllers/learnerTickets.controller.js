const svc = require("../services/learnerTickets.service");
const { validateId } = require("../validators/learners.validator");
const { validateListQuery, validateRespond, validateResolve, validateEscalate } = require("../validators/learnerTickets.validator");

function badRequest(res, msg) {
  return res.status(400).json({ success: false, message: msg });
}

function notFound(res, msg = "Not found.") {
  return res.status(404).json({ success: false, message: msg });
}

function handleDomainError(res, err) {
  switch (err.code) {
    case "LEARNER_NOT_FOUND":
      return notFound(res, "Learner not found.");
    case "TICKET_NOT_FOUND":
      return notFound(res, "Ticket not found.");
    default:
      return null;
  }
}

function serverError(res, err) {
  console.error("[LearnerTicketsController]", err);
  if (err.code === "P2025") return notFound(res, "Ticket not found.");
  if (err.code === "P2021" || err.code === "P2022") {
    return res.status(503).json({ success: false, message: "Database not migrated yet. Run `npx prisma db push`." });
  }
  return res.status(500).json({ success: false, message: "Internal server error." });
}

function run(handler) {
  return async (req, res) => {
    try {
      const idErr = validateId(req.params.id, "learnerId");
      if (idErr) return badRequest(res, idErr);
      return await handler(req, res);
    } catch (err) {
      return handleDomainError(res, err) ?? serverError(res, err);
    }
  };
}

function ticketIdErr(req, res) {
  const err = validateId(req.params.tid, "ticketId");
  if (err) { badRequest(res, err); return true; }
  return false;
}

const listTickets = run(async (req, res) => {
  const v = validateListQuery(req.query);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.listLearnerTickets(req.params.id, v.data);
  return res.json({ success: true, data: result });
});

const respond = run(async (req, res) => {
  if (ticketIdErr(req, res)) return;
  const v = validateRespond(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.respondToTicket(req.params.id, req.params.tid, v.data.body, req.admin?.id);
  return res.json({ success: true, message: "Response sent.", data: result });
});

const resolve = run(async (req, res) => {
  if (ticketIdErr(req, res)) return;
  const v = validateResolve(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.resolveTicket(req.params.id, req.params.tid, v.data.resolution, req.admin?.id);
  return res.json({ success: true, message: "Ticket resolved.", data: result });
});

const escalate = run(async (req, res) => {
  if (ticketIdErr(req, res)) return;
  const v = validateEscalate(req.body);
  if (!v.isValid) return badRequest(res, v.errors[0]);
  const result = await svc.escalateTicket(req.params.id, req.params.tid, v.data.priority, req.admin?.id);
  return res.json({ success: true, message: "Ticket escalated.", data: result });
});

module.exports = {
  listTickets,
  respond,
  resolve,
  escalate,
};
