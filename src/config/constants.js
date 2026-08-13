const ROLES = {
  CLIENT: 'client',
  AGENT: 'agent',
  TEAM_LEADER: 'team_leader',
  ADMIN: 'admin',
};

const ROLE_LABELS = {
  [ROLES.CLIENT]: 'Client',
  [ROLES.AGENT]: 'Support Agent',
  [ROLES.TEAM_LEADER]: 'Team Leader',
  [ROLES.ADMIN]: 'Administrator',
};

// Every non-client role — used for the coarse client-vs-staff access check.
const STAFF_ROLES = [ROLES.AGENT, ROLES.TEAM_LEADER, ROLES.ADMIN];
// Roles that can manage a team (reassign, escalate, monitor SLA/analytics).
const MANAGEMENT_ROLES = [ROLES.TEAM_LEADER, ROLES.ADMIN];

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

// Order matters for the status timeline UI.
const STATUSES = ['Open', 'In Progress', 'Waiting for Client', 'Escalated', 'Resolved', 'Closed'];

const OPEN_STATUSES = ['Open', 'In Progress', 'Waiting for Client', 'Escalated'];

// Fallback SLA windows (hours) — seeds the admin-configurable `sla_policies`
// table; once seeded, slaEngine reads live policy rows instead of this.
const SLA_HOURS_BY_PRIORITY = {
  Critical: 4,
  High: 24,
  Medium: 72,
  Low: 168,
};

// Response-time SLA windows (minutes) — first-reply target, seeds `sla_policies`.
const SLA_RESPONSE_MINUTES_BY_PRIORITY = {
  Critical: 15,
  High: 60,
  Medium: 240,
  Low: 480,
};

const NOTIFICATION_TYPES = [
  'ticket_created',
  'ticket_assigned',
  'agent_replied',
  'client_replied',
  'status_changed',
  'priority_changed',
  'ticket_escalated',
  'sla_warning',
  'sla_breached',
  'ticket_resolved',
  'ticket_closed',
  'ticket_restored',
];

const TICKET_LINK_TYPES = ['duplicate', 'related', 'parent'];

const ESCALATION_REASONS = {
  SLA_RESPONSE_BREACH: 'sla_response_breach',
  SLA_RESOLUTION_BREACH: 'sla_resolution_breach',
  MANUAL: 'manual',
};

const PRIORITY_COLORS = {
  Low: { bg: '#E6F4EA', fg: '#0B7A0B', dot: '#0CA30C' },
  Medium: { bg: '#FEF3E2', fg: '#8A5A00', dot: '#FAB219' },
  High: { bg: '#FDECE4', fg: '#A83E1C', dot: '#EC835A' },
  Critical: { bg: '#FCE4E4', fg: '#8E1616', dot: '#D03B3B' },
};

const STATUS_COLORS = {
  Open: { bg: '#E7EEFC', fg: '#17508F', dot: '#2A78D6' },
  'In Progress': { bg: '#FEF0E9', fg: '#A6431A', dot: '#EB6834' },
  'Waiting for Client': { bg: '#EFECFB', fg: '#3B2E86', dot: '#4A3AA7' },
  Escalated: { bg: '#FCE4E4', fg: '#8E1616', dot: '#D03B3B' },
  Resolved: { bg: '#E6F4EA', fg: '#046B04', dot: '#008300' },
  Closed: { bg: '#EEF1F5', fg: '#5A6473', dot: '#8A94A6' },
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB per file
const MAX_UPLOAD_FILES = 5;
const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/json',
];

module.exports = {
  ROLES,
  ROLE_LABELS,
  STAFF_ROLES,
  MANAGEMENT_ROLES,
  PRIORITIES,
  STATUSES,
  OPEN_STATUSES,
  SLA_HOURS_BY_PRIORITY,
  SLA_RESPONSE_MINUTES_BY_PRIORITY,
  NOTIFICATION_TYPES,
  TICKET_LINK_TYPES,
  ESCALATION_REASONS,
  PRIORITY_COLORS,
  STATUS_COLORS,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  ALLOWED_UPLOAD_MIME_TYPES,
};
