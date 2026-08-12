// leadUserId is filled in by scripts/seed.js after users are built, since
// team leaders reference users and users reference teams (both directions).
const TEAMS = [
  { id: 'tm1', name: 'Cloud Ops Team', departmentId: 'd1', leadUserId: 'u8' },
  { id: 'tm2', name: 'Security Response Team', departmentId: 'd2', leadUserId: 'u9' },
  { id: 'tm3', name: 'Network Operations Team', departmentId: 'd3', leadUserId: 'u10' },
  { id: 'tm4', name: 'AI & Data Team', departmentId: 'd4', leadUserId: 'u11' },
  { id: 'tm5', name: 'Enterprise Support Team', departmentId: 'd5', leadUserId: 'u12' },
];

function buildTeams() {
  const now = new Date();
  return TEAMS.map((t) => ({ ...t, createdAt: now }));
}

module.exports = { buildTeams, TEAMS };
