// Demo projects — kept deliberately small (3 projects) to prove the
// Projects/Milestones/Tasks feature works without cluttering the seed data,
// matching how sub-clients/end-client-users were kept minimal in Phase 1.
// proj3 is scoped to a specific sub-client (ABC Bank's Beirut Branch, sc1)
// so Phase 3's end_client_user visibility scoping has something real to
// show on every reseed — proj1/proj2 are both company-wide (subClientId null).
const DAY = 24 * 60 * 60 * 1000;

function buildProjects() {
  const now = new Date();
  return [
    {
      id: 'proj1',
      name: 'Network Infrastructure Upgrade',
      description: 'Replace ABC Bank\'s aging core switches and firewalls across all branches, with zero-downtime cutover.',
      company: 'ABC Bank',
      subClientId: null,
      projectManagerId: 'u10', // Omar Sfeir, Network & Systems team leader
      teamId: 'tm3',
      startDate: new Date(now.getTime() - 60 * DAY),
      expectedCompletionDate: new Date(now.getTime() + 30 * DAY),
      actualCompletionDate: null,
      status: 'In Progress',
      priority: 'High',
      budget: 85000,
      notes: 'Client wants change windows limited to weekends. Hardware already procured.',
      createdAt: new Date(now.getTime() - 62 * DAY),
      updatedAt: now,
    },
    {
      id: 'proj2',
      name: 'Internal Service Desk Modernization',
      description: 'Roll out the new self-service knowledge base and canned-response workflows across the Enterprise Support team.',
      company: 'QuanTech SAL',
      subClientId: null,
      projectManagerId: 'u12', // Hassan Zeidan, Enterprise Support team leader
      teamId: 'tm5',
      startDate: new Date(now.getTime() - 10 * DAY),
      expectedCompletionDate: new Date(now.getTime() + 50 * DAY),
      actualCompletionDate: null,
      status: 'Planning',
      priority: 'Medium',
      budget: null,
      notes: null,
      createdAt: new Date(now.getTime() - 10 * DAY),
      updatedAt: now,
    },
    {
      id: 'proj3',
      name: 'Beirut Branch ATM Network Refresh',
      description: 'Upgrade ATM connectivity and backup links at the Beirut Branch ahead of the wider infrastructure rollout.',
      company: 'ABC Bank',
      subClientId: 'sc1',
      projectManagerId: 'u10', // Omar Sfeir, Network & Systems team leader
      teamId: 'tm3',
      startDate: new Date(now.getTime() - 20 * DAY),
      expectedCompletionDate: new Date(now.getTime() + 15 * DAY),
      actualCompletionDate: null,
      status: 'In Progress',
      priority: 'Medium',
      budget: 22000,
      notes: 'Coordinate downtime windows directly with the branch manager, not head office.',
      createdAt: new Date(now.getTime() - 20 * DAY),
      updatedAt: now,
    },
  ];
}

module.exports = { buildProjects, DAY };
