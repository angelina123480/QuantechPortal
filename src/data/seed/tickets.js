const { SLA_HOURS_BY_PRIORITY } = require('../../config/constants');
const { CATEGORIES } = require('./categories');

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

let historySeq = 1;
function historyEntry({ type, author, message, fromStatus, toStatus, timestamp, internal = false }) {
  return {
    id: `h${historySeq++}`,
    type, // created | reply | status_change | note | assigned | priority_change
    authorId: author ? author.id : null,
    authorName: author ? author.name : 'System',
    authorRole: author ? author.role : 'system',
    message: message || null,
    fromStatus: fromStatus || null,
    toStatus: toStatus || null,
    internal,
    timestamp,
  };
}

// Category -> owning team + its two agents (mirrors assignmentRules.js).
const CATEGORY_ROUTING = {
  'Cloud & Infrastructure': { teamId: 'tm1', agents: ['u13', 'u14'] },
  Cybersecurity: { teamId: 'tm2', agents: ['u15', 'u16'] },
  'AI & Data Analytics': { teamId: 'tm4', agents: ['u19', 'u20'] },
  IoT: { teamId: 'tm5', agents: ['u21', 'u22'] },
  'Network & Systems': { teamId: 'tm3', agents: ['u17', 'u18'] },
  'Software & Applications': { teamId: 'tm5', agents: ['u21', 'u22'] },
  'Digital Transformation': { teamId: 'tm5', agents: ['u21', 'u22'] },
  'Technical Support': { teamId: 'tm5', agents: ['u21', 'u22'] },
  'Account & Access': { teamId: 'tm5', agents: ['u21', 'u22'] },
  Other: { teamId: 'tm5', agents: ['u21', 'u22'] },
};

const SUBCATS_BY_CATEGORY = Object.fromEntries(CATEGORIES.map((c) => [c.name, c.subcategories]));

/**
 * Each row: [
 *   suffix, company, category, subcategoryIdx, priority, status, agentSlot('a'|'b'|null),
 *   clientId, title, description, createdHoursAgo, resolvedHoursAgo|null, closedHoursAgo|null,
 *   rating|null, escalate(bool)
 * ]
 */
const ROWS = [
  ['00201', 'ABC Bank', 'Cloud & Infrastructure', 0, 'Medium', 'Resolved', 'a', 'u1', 'VPN latency spikes during peak hours', 'Branch staff are reporting significant VPN latency between 9-11am, coinciding with peak transaction volume. Needs investigation into gateway capacity and routing.', 288, 216, null, 5, false],
  ['00202', 'Beirut Telecom', 'Cybersecurity', 0, 'Critical', 'Closed', 'a', 'u2', 'Suspicious login attempts on admin portal', 'Security monitoring flagged over 200 failed login attempts against the network admin portal from a single external IP range within a 10-minute window.', 480, 432, 408, 4, false],
  ['00203', 'MedCare Hospital Group', 'Account & Access', 2, 'Low', 'Closed', 'b', 'u3', 'New employee account provisioning request', 'Requesting provisioning of QuanTech-managed accounts and access groups for 6 newly onboarded IT staff in the radiology department.', 600, 576, 552, 5, false],
  ['00204', 'Levant Insurance Group', 'AI & Data Analytics', 2, 'Medium', 'In Progress', 'a', 'u4', 'Model drift detected in claims fraud scoring model', 'The fraud-scoring model deployed in Q2 is flagging a higher-than-expected false positive rate over the last two weeks. Requesting a retraining and drift analysis.', 144, null, null, null, false],
  ['00205', 'Cedars Retail Holdings', 'IoT', 0, 'High', 'Open', null, 'u5', 'In-store IoT sensors going offline intermittently', 'Shelf-inventory IoT sensors across 4 stores are dropping off the network sporadically, causing gaps in real-time stock data.', 18, null, null, null, false],
  ['00206', 'ABC Bank', 'Network & Systems', 2, 'High', 'Waiting for Client', 'a', 'u1', 'Branch office network segmentation request', 'Requesting VLAN segmentation for the new Tripoli branch office to isolate POS terminals from general staff network traffic.', 96, null, null, null, false],
  ['00207', 'Beirut Telecom', 'Software & Applications', 0, 'Medium', 'In Progress', 'b', 'u2', 'Billing platform report export failing for large datasets', 'Monthly billing reconciliation exports time out for datasets larger than 500k rows. Needs performance tuning or async export support.', 60, null, null, null, false],
  ['00208', 'MedCare Hospital Group', 'Digital Transformation', 0, 'High', 'Open', null, 'u3', 'EHR integration roadmap kickoff support', 'Requesting a technical kickoff session to scope integration of the new Electronic Health Records platform with existing hospital systems.', 30, null, null, null, false],
  ['00209', 'Levant Insurance Group', 'Technical Support', 0, 'Low', 'Resolved', 'a', 'u4', 'Printer driver issues on finance floor', 'Multiple workstations on the finance floor are unable to print to the shared network printer after the recent OS update.', 240, 216, null, 3, false],
  ['00210', 'Cedars Retail Holdings', 'Cybersecurity', 1, 'Critical', 'Escalated', 'a', 'u5', 'Potential ransomware activity on POS network', 'Endpoint protection triggered an alert consistent with ransomware behavior on two POS terminals. Terminals have been isolated pending investigation.', 8, null, null, null, true],
  ['00211', 'ABC Bank', 'Account & Access', 1, 'Medium', 'Open', null, 'u1', 'MFA reset requests spiking after policy update', 'Since the new MFA policy rollout, the helpdesk has seen a sharp increase in employees locked out and requesting manual resets.', 96, null, null, null, false],
  ['00212', 'Beirut Telecom', 'Cloud & Infrastructure', 0, 'Critical', 'Open', null, 'u2', '5G core network cloud node unresponsive', 'One of the cloud-hosted 5G core network nodes has stopped responding to health checks, risking regional service degradation.', 10, null, null, null, false],
  ['00213', 'MedCare Hospital Group', 'Network & Systems', 0, 'Medium', 'In Progress', 'b', 'u3', 'Hospital wifi coverage gaps in new wing', 'The newly opened east wing has significant wifi dead zones affecting mobile charting devices used by nursing staff.', 120, null, null, null, false],
  ['00214', 'Levant Insurance Group', 'Other', 0, 'Low', 'Waiting for Client', 'b', 'u4', 'Request for vendor security questionnaire completion', "Levant Insurance's procurement team has requested QuanTech complete a third-party vendor security questionnaire for an upcoming audit.", 144, null, null, null, false],
  ['00215', 'ABC Bank', 'Cloud & Infrastructure', 0, 'High', 'In Progress', 'a', 'u1', 'Hybrid Cloud Migration Issue', 'The client is experiencing connectivity issues between their on-premise infrastructure and the newly deployed cloud environment.', 48, null, null, null, false],
  ['00216', 'Continental Freight Logistics', 'Cloud & Infrastructure', 1, 'High', 'Resolved', 'b', 'u6', 'Fleet tracking data lake provisioning', 'Requesting a new cloud data lake environment to consolidate fleet GPS telemetry currently split across three regional systems.', 336, 288, null, 4, false],
  ['00217', 'Continental Freight Logistics', 'Network & Systems', 1, 'Medium', 'In Progress', 'a', 'u6', 'Warehouse WAN link degraded since last week', 'The primary WAN link to the Zahle warehouse has been running at roughly half its contracted throughput since last Tuesday.', 72, null, null, null, false],
  ['00218', 'Continental Freight Logistics', 'IoT', 0, 'Medium', 'Open', null, 'u6', 'Trailer telematics units dropping signal in transit', 'Several trailer-mounted telematics units lose signal for extended periods on the coastal highway route, creating gaps in shipment tracking.', 20, null, null, null, false],
  ['00219', 'Continental Freight Logistics', 'Account & Access', 0, 'Low', 'Closed', 'b', 'u6', 'Driver app account lockouts after password policy change', 'Multiple drivers are getting locked out of the mobile logistics app after the recent minimum password length change.', 400, 380, 360, 5, false],
  ['00220', 'Sapphire Hospitality Group', 'Cybersecurity', 2, 'High', 'In Progress', 'b', 'u7', 'Guest WiFi portal flagged in security scan', 'A routine vulnerability scan flagged the guest WiFi captive portal for an outdated TLS configuration across all three properties.', 40, null, null, null, false],
  ['00221', 'Sapphire Hospitality Group', 'Software & Applications', 1, 'Medium', 'Open', null, 'u7', 'Booking engine feature request: room upgrade upsell', 'Requesting a new upsell prompt in the booking engine checkout flow for room upgrades, similar to the add-on flow already in place.', 14, null, null, null, false],
  ['00222', 'Sapphire Hospitality Group', 'Technical Support', 1, 'Low', 'Resolved', 'a', 'u7', 'Front desk receipt printers jamming frequently', 'Receipt printers at two of the three front desks are jamming multiple times per shift since the paper stock change.', 168, 140, null, 4, false],
  ['00223', 'Sapphire Hospitality Group', 'Digital Transformation', 1, 'Medium', 'In Progress', 'b', 'u7', 'Loyalty program data integration scoping', 'Requesting a technical scoping session to integrate the new loyalty program platform with the existing property management system.', 90, null, null, null, false],
  ['00224', 'MedCare Hospital Group', 'AI & Data Analytics', 0, 'High', 'Open', null, 'u3', 'Bed-occupancy forecasting model onboarding', 'Requesting onboarding support for a new bed-occupancy forecasting model ahead of the flu season capacity planning cycle.', 26, null, null, null, false],
  ['00225', 'Levant Insurance Group', 'Cybersecurity', 0, 'Critical', 'In Progress', 'b', 'u4', 'Phishing campaign targeting claims department', 'A targeted phishing campaign impersonating a known vendor has reached at least 12 claims department mailboxes in the last hour.', 3, null, null, null, false],
  ['00226', 'Cedars Retail Holdings', 'Account & Access', 0, 'Medium', 'Resolved', 'a', 'u5', 'Seasonal staff bulk account provisioning', 'Requesting bulk provisioning of 25 temporary POS accounts ahead of the upcoming holiday hiring wave.', 200, 170, null, 5, false],
  ['00227', 'Cedars Retail Holdings', 'Digital Transformation', 2, 'Medium', 'Waiting for Client', 'b', 'u5', 'Unified commerce rollout — phase 2 kickoff', 'Following the phase 1 pilot, requesting a kickoff session to scope the phase 2 unified commerce rollout to the remaining 12 stores.', 110, null, null, null, false],
  ['00228', 'Beirut Telecom', 'Account & Access', 1, 'Medium', 'Open', null, 'u2', 'Field technician MFA enrollment failing on new devices', 'The batch of newly issued field technician tablets are failing MFA enrollment with an unclear error at the final step.', 15, null, null, null, false],
  ['00229', 'Beirut Telecom', 'Technical Support', 2, 'Low', 'Closed', 'a', 'u2', 'Conference room AV equipment not powering on', 'The AV equipment in the 4th floor executive conference room has stopped powering on ahead of tomorrow\'s board meeting.', 260, 250, 230, 4, false],
  ['00230', 'ABC Bank', 'Other', 1, 'Low', 'Open', null, 'u1', 'Billing question on last quarter invoice', 'Finance has a question about a line item on last quarter\'s support invoice and would like it clarified before payment processing.', 6, null, null, null, false],
  ['00231', 'ABC Bank', 'Software & Applications', 2, 'High', 'In Progress', 'a', 'u1', 'Core banking gateway intermittent slow transactions', 'A subset of transactions through the core banking gateway are taking 8-12 seconds instead of the usual sub-second response.', 22, null, null, null, false],
  ['00232', 'MedCare Hospital Group', 'IoT', 1, 'High', 'Resolved', 'b', 'u3', 'Patient monitor gateway firmware rollout', 'Requesting a coordinated firmware update rollout across all bedside patient-monitor gateways to patch a known connectivity bug.', 150, 100, null, 5, false],
  ['00233', 'Levant Insurance Group', 'Network & Systems', 0, 'Medium', 'In Progress', 'b', 'u4', 'Branch office VPN reconnect loop', 'The Jounieh branch office VPN tunnel is reconnecting every few minutes, briefly interrupting the claims processing system.', 34, null, null, null, false],
  ['00234', 'Cedars Retail Holdings', 'Cloud & Infrastructure', 2, 'Low', 'Open', null, 'u5', 'Nightly inventory backup job duration increasing', 'The nightly inventory backup job duration has crept up from 40 minutes to over 3 hours over the past month.', 12, null, null, null, false],
  ['00235', 'Continental Freight Logistics', 'Digital Transformation', 0, 'Low', 'Resolved', 'a', 'u6', 'Route optimization proof-of-concept follow-up', 'Following up on the route optimization proof-of-concept from last quarter to discuss production rollout timeline.', 500, 460, null, 4, false],
  ['00236', 'Sapphire Hospitality Group', 'AI & Data Analytics', 0, 'Medium', 'Open', null, 'u7', 'Dynamic pricing model performance review request', 'Requesting a scheduled performance review of the dynamic pricing model ahead of the upcoming peak season.', 9, null, null, null, false],
  // A duplicate pair for the ticket-merge feature: 00238 gets marked as a
  // duplicate of 00237 and auto-closed.
  ['00237', 'ABC Bank', 'Cybersecurity', 0, 'High', 'In Progress', 'b', 'u1', 'Multiple failed login alerts from card-services VPN', 'Card services is seeing repeated failed-login alerts from the VPN concentrator over the last two hours, from varying source IPs.', 5, null, null, null, false],
  ['00238', 'ABC Bank', 'Cybersecurity', 0, 'High', 'Open', null, 'u1', 'Repeated VPN login failures — card services', 'Getting the same failed-login alert pattern reported separately by the card services team — likely the same underlying issue as another open ticket.', 4, null, null, null, false],
];

function buildTickets({ usersById }) {
  const client = (id) => usersById[id];

  return ROWS.map(([suffix, company, category, subIdx, priority, status, agentSlot, clientId, title, description, createdH, resolvedH, closedH, rating, escalate], idx) => {
    const createdAt = hoursAgo(createdH);
    const resolvedAt = resolvedH != null ? hoursAgo(resolvedH) : null;
    const closedAt = closedH != null ? hoursAgo(closedH) : null;
    const dueAt = new Date(createdAt.getTime() + SLA_HOURS_BY_PRIORITY[priority] * 60 * 60 * 1000);
    const routing = CATEGORY_ROUTING[category];
    const agentId = agentSlot ? routing.agents[agentSlot === 'a' ? 0 : 1] : null;
    const agent = agentId ? client(agentId) : null;
    const clientUser = client(clientId);
    const admin = usersById.u23;
    let updatedAt = createdAt;

    const history = [
      historyEntry({ type: 'created', author: clientUser, message: description, timestamp: createdAt }),
    ];

    if (agent) {
      const assignedAt = new Date(createdAt.getTime() + 30 * 60 * 1000);
      history.push(historyEntry({
        type: 'assigned', author: admin, message: `Assigned to ${agent.name}`, timestamp: assignedAt,
      }));
      updatedAt = assignedAt;

      if (status !== 'Open') {
        const inProgressAt = new Date(assignedAt.getTime() + 60 * 60 * 1000);
        history.push(historyEntry({
          type: 'status_change', author: agent, fromStatus: 'Open', toStatus: 'In Progress', timestamp: inProgressAt,
        }));
        history.push(historyEntry({
          type: 'reply', author: agent,
          message: `Thanks for the report — I've started investigating the ${category.toLowerCase()} issue and will update this ticket shortly.`,
          timestamp: new Date(inProgressAt.getTime() + 30 * 60 * 1000),
        }));
        history.push(historyEntry({
          type: 'note', author: agent, internal: true,
          message: 'Internal: checked recent change log for this system, nothing suspicious yet — continuing investigation.',
          timestamp: new Date(inProgressAt.getTime() + 35 * 60 * 1000),
        }));
        updatedAt = new Date(inProgressAt.getTime() + 35 * 60 * 1000);
      }
    }

    if (status === 'Waiting for Client') {
      const waitingAt = new Date(updatedAt.getTime() + 2 * 60 * 60 * 1000);
      history.push(historyEntry({
        type: 'status_change', author: agent, fromStatus: 'In Progress', toStatus: 'Waiting for Client', timestamp: waitingAt,
      }));
      history.push(historyEntry({
        type: 'reply', author: agent,
        message: 'Could you confirm a few additional details on your end so we can proceed? See notes above.',
        timestamp: waitingAt,
      }));
      updatedAt = waitingAt;
    }

    if (status === 'Escalated') {
      const escalatedAt = new Date(updatedAt.getTime() + 90 * 60 * 1000);
      history.push(historyEntry({
        type: 'status_change', author: agent, fromStatus: 'In Progress', toStatus: 'Escalated', timestamp: escalatedAt,
      }));
      history.push(historyEntry({
        type: 'note', author: agent, internal: true,
        message: `Escalating to the team leader — this needs additional resources given the priority and blast radius.`,
        timestamp: escalatedAt,
      }));
      updatedAt = escalatedAt;
    }

    if (resolvedAt) {
      history.push(historyEntry({
        type: 'status_change', author: agent, fromStatus: 'In Progress', toStatus: 'Resolved', timestamp: resolvedAt,
      }));
      history.push(historyEntry({
        type: 'reply', author: agent,
        message: 'This issue has been resolved. Please let us know if the problem resurfaces.',
        timestamp: resolvedAt,
      }));
      updatedAt = resolvedAt;
    }

    if (closedAt) {
      history.push(historyEntry({
        type: 'status_change', author: clientUser, fromStatus: 'Resolved', toStatus: 'Closed', timestamp: closedAt,
      }));
      updatedAt = closedAt;
    }

    const subcategoryName = SUBCATS_BY_CATEGORY[category] ? SUBCATS_BY_CATEGORY[category][subIdx] : null;

    return {
      id: `t${idx + 1}`,
      ticketNumber: `QNT-2026-${suffix}`,
      title,
      description,
      category,
      subcategoryName,
      priority,
      status,
      affectedService: category,
      company,
      clientDepartment: clientUser.department,
      contactName: clientUser.name,
      contactEmail: clientUser.email,
      contactPhone: clientUser.phone,
      clientUserId: clientUser.id,
      assignedTechnicianId: agent ? agent.id : null,
      teamId: routing.teamId,
      attachments: [],
      dueAt,
      createdAt,
      updatedAt,
      resolvedAt,
      closedAt,
      firstResponseAt: agent ? new Date(createdAt.getTime() + 30 * 60 * 1000) : null,
      history,
      rating: rating != null ? { stars: rating, feedback: null } : null,
      escalate,
    };
  });
}

module.exports = { buildTickets };
