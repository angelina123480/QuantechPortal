const { SLA_HOURS_BY_PRIORITY } = require('../../config/constants');

function hoursAgo(h) {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

let historySeq = 1;
function historyEntry({ type, author, message, fromStatus, toStatus, timestamp, internal = false }) {
  return {
    id: `h${historySeq++}`,
    type, // created | reply | status_change | note | assigned
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

/**
 * Each row: [number suffix, company, category, priority, status, technician|null, title, description, createdHoursAgo, resolvedHoursAgo|null, closedHoursAgo|null]
 */
function buildTickets({ usersById }) {
  const client = (id) => usersById[id];

  const rows = [
    ['00110', 'ABC Bank', 'Cloud & Infrastructure', 'Medium', 'Resolved', 'u8', 'u1',
      'VPN latency spikes during peak hours',
      'Branch staff are reporting significant VPN latency between 9-11am, coinciding with peak transaction volume. Needs investigation into gateway capacity and routing.',
      288, 216, null],
    ['00111', 'Beirut Telecom', 'Cybersecurity', 'Critical', 'Closed', 'u7', 'u2',
      'Suspicious login attempts on admin portal',
      'Security monitoring flagged over 200 failed login attempts against the network admin portal from a single external IP range within a 10-minute window.',
      480, 432, 408],
    ['00112', 'MedCare Hospital Group', 'Account & Access', 'Low', 'Closed', 'u10', 'u3',
      'New employee account provisioning request',
      'Requesting provisioning of QuanTech-managed accounts and access groups for 6 newly onboarded IT staff in the radiology department.',
      600, 576, 552],
    ['00113', 'Levant Insurance Group', 'AI & Data Analytics', 'Medium', 'In Progress', 'u9', 'u4',
      'Model drift detected in claims fraud scoring model',
      'The fraud-scoring model deployed in Q2 is flagging a higher-than-expected false positive rate over the last two weeks. Requesting a retraining and drift analysis.',
      144, null, null],
    ['00114', 'Cedars Retail Holdings', 'IoT', 'High', 'Open', null, 'u5',
      'In-store IoT sensors going offline intermittently',
      'Shelf-inventory IoT sensors across 4 stores are dropping off the network sporadically, causing gaps in real-time stock data.',
      18, null, null],
    ['00115', 'ABC Bank', 'Network & Systems', 'High', 'Waiting for Client', 'u8', 'u1',
      'Branch office network segmentation request',
      'Requesting VLAN segmentation for the new Tripoli branch office to isolate POS terminals from general staff network traffic.',
      96, null, null],
    ['00116', 'Beirut Telecom', 'Software & Applications', 'Medium', 'In Progress', 'u9', 'u2',
      'Billing platform report export failing for large datasets',
      'Monthly billing reconciliation exports time out for datasets larger than 500k rows. Needs performance tuning or async export support.',
      60, null, null],
    ['00117', 'MedCare Hospital Group', 'Digital Transformation', 'High', 'Open', null, 'u3',
      'EHR integration roadmap kickoff support',
      'Requesting a technical kickoff session to scope integration of the new Electronic Health Records platform with existing hospital systems.',
      30, null, null],
    ['00118', 'Levant Insurance Group', 'Technical Support', 'Low', 'Resolved', 'u6', 'u4',
      'Printer driver issues on finance floor',
      'Multiple workstations on the finance floor are unable to print to the shared network printer after the recent OS update.',
      240, 216, null],
    ['00119', 'Cedars Retail Holdings', 'Cybersecurity', 'Critical', 'In Progress', 'u7', 'u5',
      'Potential ransomware activity on POS network',
      'Endpoint protection triggered an alert consistent with ransomware behavior on two POS terminals. Terminals have been isolated pending investigation.',
      8, null, null],
    ['00120', 'ABC Bank', 'Account & Access', 'Medium', 'Open', null, 'u1',
      'MFA reset requests spiking after policy update',
      'Since the new MFA policy rollout, the helpdesk has seen a sharp increase in employees locked out and requesting manual resets.',
      96, null, null],
    ['00121', 'Beirut Telecom', 'Cloud & Infrastructure', 'Critical', 'Open', null, 'u2',
      '5G core network cloud node unresponsive',
      'One of the cloud-hosted 5G core network nodes has stopped responding to health checks, risking regional service degradation.',
      10, null, null],
    ['00122', 'MedCare Hospital Group', 'Network & Systems', 'Medium', 'In Progress', 'u8', 'u3',
      'Hospital wifi coverage gaps in new wing',
      'The newly opened east wing has significant wifi dead zones affecting mobile charting devices used by nursing staff.',
      120, null, null],
    ['00123', 'Levant Insurance Group', 'Other', 'Low', 'Waiting for Client', 'u10', 'u4',
      'Request for vendor security questionnaire completion',
      'Levant Insurance\'s procurement team has requested QuanTech complete a third-party vendor security questionnaire for an upcoming audit.',
      144, null, null],
    ['00124', 'ABC Bank', 'Cloud & Infrastructure', 'High', 'In Progress', 'u6', 'u1',
      'Hybrid Cloud Migration Issue',
      'The client is experiencing connectivity issues between their on-premise infrastructure and the newly deployed cloud environment.',
      48, null, null],
  ];

  return rows.map(([suffix, company, category, priority, status, techId, clientId, title, description, createdH, resolvedH, closedH], idx) => {
    const createdAt = hoursAgo(createdH);
    const resolvedAt = resolvedH != null ? hoursAgo(resolvedH) : null;
    const closedAt = closedH != null ? hoursAgo(closedH) : null;
    const dueAt = new Date(createdAt.getTime() + SLA_HOURS_BY_PRIORITY[priority] * 60 * 60 * 1000);
    const tech = techId ? client(techId) : null;
    const clientUser = client(clientId);
    let updatedAt = createdAt;

    const history = [
      historyEntry({ type: 'created', author: clientUser, message: description, timestamp: createdAt }),
    ];

    if (tech) {
      const assignedAt = new Date(createdAt.getTime() + 30 * 60 * 1000);
      history.push(historyEntry({
        type: 'assigned', author: usersById.u10, message: `Assigned to ${tech.name}`, timestamp: assignedAt,
      }));
      updatedAt = assignedAt;

      if (status !== 'Open') {
        const inProgressAt = new Date(assignedAt.getTime() + 60 * 60 * 1000);
        history.push(historyEntry({
          type: 'status_change', author: tech, fromStatus: 'Open', toStatus: 'In Progress', timestamp: inProgressAt,
        }));
        history.push(historyEntry({
          type: 'reply', author: tech,
          message: `Thanks for the report — I've started investigating the ${category.toLowerCase()} issue and will update this ticket shortly.`,
          timestamp: new Date(inProgressAt.getTime() + 30 * 60 * 1000),
        }));
        updatedAt = new Date(inProgressAt.getTime() + 30 * 60 * 1000);
      }
    }

    if (status === 'Waiting for Client') {
      const waitingAt = new Date(updatedAt.getTime() + 2 * 60 * 60 * 1000);
      history.push(historyEntry({
        type: 'status_change', author: tech, fromStatus: 'In Progress', toStatus: 'Waiting for Client', timestamp: waitingAt,
      }));
      history.push(historyEntry({
        type: 'reply', author: tech,
        message: 'Could you confirm a few additional details on your end so we can proceed? See notes above.',
        timestamp: waitingAt,
      }));
      updatedAt = waitingAt;
    }

    if (resolvedAt) {
      history.push(historyEntry({
        type: 'status_change', author: tech, fromStatus: 'In Progress', toStatus: 'Resolved', timestamp: resolvedAt,
      }));
      history.push(historyEntry({
        type: 'reply', author: tech,
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

    return {
      id: `t${idx + 1}`,
      ticketNumber: `QNT-2026-${suffix}`,
      title,
      description,
      category,
      priority,
      status,
      affectedService: category,
      company,
      department: clientUser.department,
      contactName: clientUser.name,
      contactEmail: clientUser.email,
      contactPhone: clientUser.phone,
      clientUserId: clientUser.id,
      assignedTechnicianId: tech ? tech.id : null,
      attachments: [],
      dueAt,
      createdAt,
      updatedAt,
      resolvedAt,
      closedAt,
      history,
    };
  });
}

module.exports = { buildTickets };
