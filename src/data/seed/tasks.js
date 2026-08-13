const { DAY } = require('./projects');

// tickets: the array already built by scripts/seed.js (buildTickets), used
// to link one demo task to a real seeded ticket rather than inventing one.
function buildTasks({ tickets }) {
  const now = new Date();
  const rel = (days) => new Date(now.getTime() + days * DAY);
  const abcBankTicket = tickets.find((t) => t.company === 'ABC Bank' && !t.closedAt);

  const raw = [
    {
      id: 'tk1', title: 'Rack new core switches at Beirut HQ', assignedToId: 'u17', createdById: 'u10',
      projectId: 'proj1', milestoneId: 'ms3', ticketId: null, status: 'In Progress', priority: 'High',
      dueDate: rel(-2), checklist: [{ text: 'Confirm rack space', done: true }, { text: 'Power off old switches', done: true }, { text: 'Mount and cable new switches', done: false }],
    },
    {
      id: 'tk2', title: 'Draft VLAN segmentation plan', assignedToId: 'u18', createdById: 'u10',
      projectId: 'proj1', milestoneId: 'ms4', ticketId: null, status: 'To Do', priority: 'High',
      dueDate: rel(3), checklist: [],
    },
    {
      id: 'tk3', title: 'Schedule weekend cutover window with client', assignedToId: 'u10', createdById: 'u10',
      projectId: 'proj1', milestoneId: null, ticketId: null, status: 'To Do', priority: 'Medium',
      dueDate: rel(12), checklist: [],
    },
    {
      id: 'tk4', title: 'Audit existing KB articles for outdated content', assignedToId: 'u21', createdById: 'u12',
      projectId: 'proj2', milestoneId: 'ms8', ticketId: null, status: 'In Progress', priority: 'Medium',
      dueDate: rel(-1), checklist: [{ text: 'List all published articles', done: true }, { text: 'Flag anything older than 6 months', done: false }],
    },
    {
      id: 'tk5', title: 'Renew personal certification (AWS)', assignedToId: 'u13', createdById: 'u13',
      projectId: null, milestoneId: null, ticketId: null, status: 'To Do', priority: 'Low',
      dueDate: rel(20), checklist: [{ text: 'Book exam slot', done: false }, { text: 'Finish practice exams', done: false }],
    },
    {
      id: 'tk6', title: 'Follow up on client hardware delivery', assignedToId: 'u13', createdById: 'u13',
      projectId: null, milestoneId: null, ticketId: null, status: 'Blocked', priority: 'Medium',
      dueDate: rel(-5), checklist: [], // overdue — exercises the agent dashboard's "Overdue Tasks" widget
    },
    {
      id: 'tk7', title: 'Prepare handover documentation template', assignedToId: null, createdById: 'u10',
      projectId: 'proj1', milestoneId: 'ms7', ticketId: null, status: 'To Do', priority: 'Low',
      dueDate: rel(25), checklist: [],
    },
  ];

  if (abcBankTicket) {
    raw.push({
      id: 'tk8', title: `Investigate root cause for ${abcBankTicket.ticketNumber}`,
      assignedToId: abcBankTicket.assignedTechnicianId || 'u13', createdById: 'u10',
      projectId: null, milestoneId: null, ticketId: abcBankTicket.id, status: 'In Progress', priority: abcBankTicket.priority,
      dueDate: rel(1), checklist: [],
    });
  }

  return raw.map((t) => ({ ...t, createdAt: now, updatedAt: now, completedAt: t.status === 'Completed' ? now : null }));
}

module.exports = { buildTasks };
