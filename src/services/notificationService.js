const notificationModel = require('../models/notificationModel');
const userModel = require('../models/userModel');
const emailService = require('./emailService');

// Maps a notification type to the notification_prefs flag that gates whether
// an email is *also* sent (the in-app notification always happens regardless).
const EMAIL_PREF_BY_TYPE = {
  agent_replied: 'emailOnReply',
  client_replied: 'emailOnReply',
  ticket_assigned: 'emailOnAssignment',
  status_changed: 'emailOnStatusChange',
  ticket_resolved: 'emailOnStatusChange',
  ticket_closed: 'emailOnStatusChange',
  ticket_escalated: 'emailOnStatusChange',
  task_assigned: 'emailOnAssignment',
  milestone_assigned: 'emailOnAssignment',
  project_assigned: 'emailOnAssignment',
};

/**
 * Notifies one or more users: always creates an in-app notification row,
 * and additionally emails the recipient if their notification_prefs opt
 * them into that category (or the type has no gating pref, e.g. SLA alerts —
 * those always email staff since they're time-sensitive).
 */
async function notify(userIds, { type, title, body, ticketId, taskId, milestoneId, projectId }) {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  const created = await notificationModel.createMany(ids, { type, title, body, ticketId, taskId, milestoneId, projectId });

  const users = await userModel.findByIds(ids);
  const prefKey = EMAIL_PREF_BY_TYPE[type];
  await Promise.all(
    users.map((user) => {
      const shouldEmail = prefKey ? !!(user.notificationPrefs && user.notificationPrefs[prefKey]) : true;
      if (!shouldEmail) return null;
      return emailService.send({ to: user.email, subject: title, text: body || title });
    })
  );

  return created;
}

module.exports = { notify };
