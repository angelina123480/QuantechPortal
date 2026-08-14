const { DAY } = require('./projects');

function buildMilestones() {
  const now = new Date();
  const rel = (days) => new Date(now.getTime() + days * DAY);

  return [
    // ---------- Project 1: Network Infrastructure Upgrade (7, the spec's own example) ----------
    { id: 'ms1', projectId: 'proj1', name: 'Requirements & Analysis', description: 'Survey existing hardware, gather branch-specific requirements.', assignedToId: 'u10', startDate: rel(-60), dueDate: rel(-50), status: 'Completed', progressPercentage: 100, priority: 'High', sortOrder: 0 },
    { id: 'ms2', projectId: 'proj1', name: 'Hardware Procurement', description: 'Order core switches, firewalls, and rack hardware.', assignedToId: 'u17', startDate: rel(-50), dueDate: rel(-35), status: 'Completed', progressPercentage: 100, priority: 'Medium', sortOrder: 1 },
    { id: 'ms3', projectId: 'proj1', name: 'Network Installation', description: 'Physical install at the Beirut HQ and Tripoli branch.', assignedToId: 'u17', startDate: rel(-30), dueDate: rel(-10), status: 'In Progress', progressPercentage: 65, priority: 'High', sortOrder: 2 },
    { id: 'ms4', projectId: 'proj1', name: 'Configuration', description: 'VLAN segmentation, routing, and firewall policy configuration.', assignedToId: 'u18', startDate: rel(-10), dueDate: rel(5), status: 'In Progress', progressPercentage: 20, priority: 'High', sortOrder: 3 },
    { id: 'ms5', projectId: 'proj1', name: 'Testing', description: 'Failover testing and load testing before go-live.', assignedToId: 'u18', startDate: rel(5), dueDate: rel(15), status: 'Not Started', progressPercentage: 0, priority: 'Critical', sortOrder: 4 },
    { id: 'ms6', projectId: 'proj1', name: 'Deployment', description: 'Weekend cutover to the new infrastructure.', assignedToId: 'u10', startDate: rel(15), dueDate: rel(22), status: 'Not Started', progressPercentage: 0, priority: 'Critical', sortOrder: 5 },
    { id: 'ms7', projectId: 'proj1', name: 'Documentation', description: 'Handover documentation and runbooks for the client.', assignedToId: null, startDate: rel(22), dueDate: rel(30), status: 'Not Started', progressPercentage: 0, priority: 'Low', sortOrder: 6 },

    // ---------- Project 2: Internal Service Desk Modernization (3) ----------
    { id: 'ms8', projectId: 'proj2', name: 'Discovery & Planning', description: 'Audit current KB articles and canned responses for gaps.', assignedToId: 'u12', startDate: rel(-10), dueDate: rel(0), status: 'In Progress', progressPercentage: 40, priority: 'Medium', sortOrder: 0 },
    { id: 'ms9', projectId: 'proj2', name: 'Build & Integration', description: 'Build out the new KB structure and canned-response library.', assignedToId: 'u21', startDate: rel(0), dueDate: rel(25), status: 'Not Started', progressPercentage: 0, priority: 'Medium', sortOrder: 1 },
    { id: 'ms10', projectId: 'proj2', name: 'Rollout & Training', description: 'Train the support team and roll out to production.', assignedToId: null, startDate: rel(25), dueDate: rel(50), status: 'Not Started', progressPercentage: 0, priority: 'Low', sortOrder: 2 },

    // ---------- Project 3: Beirut Branch ATM Network Refresh (2) ----------
    { id: 'ms11', projectId: 'proj3', name: 'Site Survey & Cabling', description: 'Survey ATM connectivity points and run new backup lines.', assignedToId: 'u17', startDate: rel(-20), dueDate: rel(-5), status: 'Completed', progressPercentage: 100, priority: 'Medium', sortOrder: 0 },
    { id: 'ms12', projectId: 'proj3', name: 'Failover Testing', description: 'Cut over ATMs to the new backup links and test failover.', assignedToId: 'u18', startDate: rel(-5), dueDate: rel(15), status: 'In Progress', progressPercentage: 45, priority: 'Medium', sortOrder: 1 },
  ].map((m) => ({ ...m, createdAt: now, updatedAt: now }));
}

module.exports = { buildMilestones };
