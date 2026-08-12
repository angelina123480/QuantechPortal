// Applied in order (sortOrder ascending) at ticket-creation time — first
// active match wins. See src/services/assignmentEngine.js.
const ASSIGNMENT_RULES = [
  { id: 'ar1', name: 'Cloud & Infrastructure → Cloud Ops Team', category: 'Cloud & Infrastructure', priority: null, departmentId: null, teamId: 'tm1', agentId: null, sortOrder: 1 },
  { id: 'ar2', name: 'Cybersecurity → Security Response Team', category: 'Cybersecurity', priority: null, departmentId: null, teamId: 'tm2', agentId: null, sortOrder: 2 },
  { id: 'ar3', name: 'Network & Systems → Network Operations Team', category: 'Network & Systems', priority: null, departmentId: null, teamId: 'tm3', agentId: null, sortOrder: 3 },
  { id: 'ar4', name: 'AI & Data Analytics → AI & Data Team', category: 'AI & Data Analytics', priority: null, departmentId: null, teamId: 'tm4', agentId: null, sortOrder: 4 },
  { id: 'ar5', name: 'Everything else → Enterprise Support Team', category: null, priority: null, departmentId: null, teamId: 'tm5', agentId: null, sortOrder: 99 },
];

function buildAssignmentRules() {
  const now = new Date();
  return ASSIGNMENT_RULES.map((r) => ({ ...r, isActive: true, createdAt: now }));
}

module.exports = { buildAssignmentRules };
