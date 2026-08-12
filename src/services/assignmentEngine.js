const pool = require('../data/db');

/**
 * Picks the team (and optionally a specific agent) a new ticket should route
 * to, based on admin-configured assignment_rules (see /admin/workflows).
 * Rules are evaluated in sort_order; the first active rule whose conditions
 * are all satisfied (or left blank, meaning "any") wins. Returns
 * { teamId, agentId } — both may be null if no rule matches.
 */
async function resolve({ category, priority, departmentId }) {
  const res = await pool.query(
    `SELECT * FROM assignment_rules WHERE is_active = TRUE ORDER BY sort_order ASC, created_at ASC`
  );

  for (const row of res.rows) {
    const categoryMatches = !row.category || row.category === category;
    const priorityMatches = !row.priority || row.priority === priority;
    const departmentMatches = !row.department_id || row.department_id === departmentId;
    if (categoryMatches && priorityMatches && departmentMatches) {
      return { teamId: row.team_id, agentId: row.agent_id };
    }
  }
  return { teamId: null, agentId: null };
}

module.exports = { resolve };
