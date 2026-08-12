const { PRIORITIES, SLA_HOURS_BY_PRIORITY, SLA_RESPONSE_MINUTES_BY_PRIORITY } = require('../../config/constants');

function buildSlaPolicies() {
  const now = new Date();
  return PRIORITIES.map((priority) => ({
    priority,
    responseMinutes: SLA_RESPONSE_MINUTES_BY_PRIORITY[priority],
    resolutionMinutes: SLA_HOURS_BY_PRIORITY[priority] * 60,
    updatedAt: now,
  }));
}

// Seeds system_settings with a default Mon-Fri business-hours window,
// read by slaEngine when computing due dates and by the admin Settings screen.
function buildSystemSettings() {
  const now = new Date();
  return [
    {
      key: 'business_hours',
      value: {
        timezone: 'Asia/Beirut',
        days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        startHour: 9,
        endHour: 18,
      },
      updatedAt: now,
    },
  ];
}

module.exports = { buildSlaPolicies, buildSystemSettings };
