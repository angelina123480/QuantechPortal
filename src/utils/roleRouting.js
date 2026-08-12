const { ROLES } = require('../config/constants');

// Where each role lands after login / when hitting a route that doesn't apply to them.
function dashboardPathForRole(role) {
  switch (role) {
    case ROLES.AGENT: return '/agent';
    case ROLES.TEAM_LEADER: return '/team';
    case ROLES.ADMIN: return '/admin';
    case ROLES.CLIENT:
    default: return '/dashboard';
  }
}

module.exports = { dashboardPathForRole };
