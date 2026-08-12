const { v4: uuidv4 } = require('uuid');
const pool = require('../data/db');
const ticketModel = require('../models/ticketModel');
const escalationModel = require('../models/escalationModel');
const teamModel = require('../models/teamModel');
const userModel = require('../models/userModel');
const notificationService = require('./notificationService');
const auditLogger = require('./auditLogger');
const slaPolicyModel = require('../models/slaPolicyModel');
const { OPEN_STATUSES, ESCALATION_REASONS } = require('../config/constants');

const WARNING_THRESHOLD = 0.8; // 80% of the resolution window elapsed

/**
 * Live SLA state for one ticket — no DB writes. Used to render the SLA
 * badge/countdown/percentage on every page that shows a ticket.
 */
function evaluate(ticket, policy) {
  const now = Date.now();
  const createdAt = new Date(ticket.createdAt).getTime();
  const resolutionDueAt = new Date(ticket.dueAt).getTime();
  const resolutionTotalMs = resolutionDueAt - createdAt;
  const resolutionElapsedMs = now - createdAt;
  const resolutionPercentUsed = resolutionTotalMs > 0 ? Math.min(100, Math.round((resolutionElapsedMs / resolutionTotalMs) * 100)) : 0;

  const isOpen = OPEN_STATUSES.includes(ticket.status);
  const resolutionBreached = isOpen && now > resolutionDueAt;
  const resolutionWarning = isOpen && !resolutionBreached && resolutionPercentUsed >= WARNING_THRESHOLD * 100;

  let responseStatus = 'met';
  let responseDueAt = null;
  if (policy) {
    responseDueAt = createdAt + policy.responseMinutes * 60 * 1000;
    if (ticket.firstResponseAt) {
      responseStatus = new Date(ticket.firstResponseAt).getTime() <= responseDueAt ? 'met' : 'breached';
    } else if (isOpen) {
      responseStatus = now > responseDueAt ? 'breached' : 'pending';
    }
  }

  return {
    resolutionDueAt: new Date(resolutionDueAt),
    resolutionPercentUsed,
    resolutionStatus: resolutionBreached ? 'breached' : resolutionWarning ? 'warning' : (ticket.resolvedAt ? 'met' : 'pending'),
    responseDueAt: responseDueAt ? new Date(responseDueAt) : null,
    responseStatus,
    isBreached: resolutionBreached || responseStatus === 'breached',
  };
}

async function hasEvent(ticketId, eventType) {
  const res = await pool.query('SELECT 1 FROM sla_events WHERE ticket_id = $1 AND event_type = $2 LIMIT 1', [ticketId, eventType]);
  return res.rows.length > 0;
}

async function recordEvent(ticketId, eventType, meta) {
  await pool.query('INSERT INTO sla_events (id, ticket_id, event_type, occurred_at, meta) VALUES ($1,$2,$3,now(),$4)', [
    uuidv4(), ticketId, eventType, meta ? JSON.stringify(meta) : null,
  ]);
}

/**
 * Materializes SLA side-effects (warning/breach notifications, automatic
 * escalation on resolution breach) for a batch of tickets already loaded by
 * the caller — see the architecture note in the implementation plan on why
 * this runs opportunistically on staff page loads rather than a real cron.
 * De-duplicated via sla_events so repeated sweeps of the same ticket are cheap no-ops.
 */
async function sweep(tickets) {
  const policyMap = await slaPolicyModel.asMap();
  let escalatedCount = 0;
  let warnedCount = 0;

  for (const ticket of tickets) {
    if (!OPEN_STATUSES.includes(ticket.status)) continue;
    const policy = policyMap[ticket.priority];
    const state = evaluate(ticket, policy);

    if (state.resolutionStatus === 'warning' && !(await hasEvent(ticket.id, 'warning'))) {
      await recordEvent(ticket.id, 'warning', { percentUsed: state.resolutionPercentUsed });
      if (ticket.assignedTechnicianId) {
        await notificationService.notify(ticket.assignedTechnicianId, {
          type: 'sla_warning',
          title: `SLA approaching limit: ${ticket.ticketNumber}`,
          body: `${ticket.title} has used ${state.resolutionPercentUsed}% of its SLA window.`,
          ticketId: ticket.id,
        });
      }
      warnedCount += 1;
    }

    if (state.resolutionStatus === 'breached' && !(await hasEvent(ticket.id, 'resolution_breached'))) {
      await recordEvent(ticket.id, 'resolution_breached', {});
      await escalateForSlaBreach(ticket, ESCALATION_REASONS.SLA_RESOLUTION_BREACH);
      escalatedCount += 1;
    } else if (state.responseStatus === 'breached' && !(await hasEvent(ticket.id, 'response_breached'))) {
      await recordEvent(ticket.id, 'response_breached', {});
      if (ticket.assignedTechnicianId) {
        await notificationService.notify(ticket.assignedTechnicianId, {
          type: 'sla_breached',
          title: `Response SLA breached: ${ticket.ticketNumber}`,
          body: `${ticket.title} has not received a first response within its SLA window.`,
          ticketId: ticket.id,
        });
      }
    }
  }

  return { escalatedCount, warnedCount };
}

async function escalateForSlaBreach(ticket, reason) {
  const fresh = await ticketModel.findById(ticket.id);
  if (!fresh || fresh.status === 'Escalated') return;

  await ticketModel.changeStatus(fresh, null, 'Escalated');

  const team = fresh.teamId ? await teamModel.findById(fresh.teamId) : null;
  await escalationModel.create({
    ticketId: fresh.id,
    reason,
    escalatedBy: null,
    escalatedToTeamId: fresh.teamId,
    note: 'Automatically escalated — SLA resolution target was missed.',
  });

  const recipients = [];
  if (team && team.leadUserId) recipients.push(team.leadUserId);
  if (fresh.assignedTechnicianId) recipients.push(fresh.assignedTechnicianId);
  if (recipients.length) {
    await notificationService.notify(recipients, {
      type: 'ticket_escalated',
      title: `Ticket auto-escalated: ${fresh.ticketNumber}`,
      body: `${fresh.title} missed its SLA resolution target and was automatically escalated.`,
      ticketId: fresh.id,
    });
  }

  await auditLogger.log({
    user: null,
    action: 'ticket.escalate',
    entityType: 'ticket',
    entityId: fresh.id,
    before: { status: ticket.status },
    after: { status: 'Escalated', reason },
  });
}

module.exports = { evaluate, sweep };
