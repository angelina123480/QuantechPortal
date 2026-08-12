const { ROLES } = require('../../config/constants');

const PERMISSIONS = [
  { key: 'escalate_tickets', label: 'Escalate Tickets', description: 'Manually escalate a ticket to the team leader.' },
  { key: 'merge_tickets', label: 'Merge / Link Tickets', description: 'Mark tickets as duplicates or link related tickets.' },
  { key: 'delete_kb_articles', label: 'Delete Knowledge Base Articles', description: 'Permanently remove a knowledge base article.' },
  { key: 'manage_canned_responses', label: 'Manage Canned Responses', description: "Create, edit, or delete other staff members' canned responses." },
  { key: 'export_reports', label: 'Export Reports', description: 'Export ticket reports as CSV or PDF.' },
];

// Default grants seeded into role_permissions. Admins bypass permission
// checks entirely (see requirePermission middleware) so they are not listed.
const ROLE_PERMISSION_DEFAULTS = {
  [ROLES.AGENT]: ['escalate_tickets', 'manage_canned_responses'],
  [ROLES.TEAM_LEADER]: ['escalate_tickets', 'merge_tickets', 'manage_canned_responses', 'export_reports'],
};

function buildPermissions() {
  return PERMISSIONS;
}

function buildRolePermissions() {
  const rows = [];
  for (const [role, keys] of Object.entries(ROLE_PERMISSION_DEFAULTS)) {
    for (const key of keys) rows.push({ role, permissionKey: key });
  }
  return rows;
}

module.exports = { buildPermissions, buildRolePermissions, PERMISSIONS, ROLE_PERMISSION_DEFAULTS };
