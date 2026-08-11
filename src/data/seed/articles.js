function daysAgo(d) {
  return new Date(Date.now() - d * 24 * 60 * 60 * 1000);
}

const ARTICLES = [
  {
    id: 'a1',
    title: 'Best Practices for Hybrid Cloud Connectivity',
    category: 'Cloud & Infrastructure',
    tags: ['cloud', 'hybrid', 'networking', 'vpn'],
    summary: 'How to design reliable, low-latency links between on-premise infrastructure and cloud environments.',
    body: `Hybrid cloud deployments frequently run into connectivity issues between on-premise data centers and cloud-hosted environments. This article covers the most common root causes and how QuanTech engineers diagnose them.

1. Verify VPN/Direct Connect tunnel health first — most "cloud is slow" reports trace back to a degraded tunnel, not the cloud provider.
2. Check MTU mismatches between on-premise routers and cloud gateways; fragmented packets are a frequent silent cause of intermittent timeouts.
3. Review route propagation — asymmetric routing between on-premise and cloud subnets can cause connections to drop under load even when each leg looks healthy in isolation.
4. Monitor gateway throughput against contracted bandwidth during peak hours; undersized gateways degrade gracefully at first, which delays detection.
5. For latency-sensitive workloads, consider a dedicated interconnect rather than a shared VPN tunnel.

If issues persist after these checks, open a Cloud & Infrastructure ticket with your connection topology diagram attached so a QuanTech engineer can trace the path end-to-end.`,
    updatedAt: daysAgo(6),
  },
  {
    id: 'a2',
    title: 'Recognizing and Reporting Phishing Attempts',
    category: 'Cybersecurity',
    tags: ['security', 'phishing', 'email'],
    summary: 'How to identify suspicious emails and the correct escalation path within QuanTech-supported organizations.',
    body: `Phishing remains the most common initial entry point for security incidents across QuanTech's enterprise clients. Key warning signs include:

- Sender domains that closely resemble a trusted domain (e.g. an extra letter or hyphen)
- Urgent language pressuring immediate action ("your account will be suspended")
- Links where the display text does not match the underlying URL
- Unexpected attachments, especially compressed archives or macro-enabled documents

If you receive a suspicious message, do not click any links or open attachments. Report it immediately through your organization's security channel and, if it involves a QuanTech-managed system, open a Cybersecurity ticket marked Critical if credentials may have been entered, or High otherwise. QuanTech's security team can trace headers and block sender domains organization-wide.`,
    updatedAt: daysAgo(3),
  },
  {
    id: 'a3',
    title: 'Troubleshooting Intermittent Network Drops',
    category: 'Network & Systems',
    tags: ['network', 'wifi', 'troubleshooting'],
    summary: 'A step-by-step diagnostic checklist for intermittent wired and wireless connectivity issues.',
    body: `Intermittent network issues are among the hardest to diagnose because they rarely reproduce on demand. Before opening a ticket, gather this information — it significantly speeds up resolution:

1. Exact time and duration of each drop, as precisely as you can recall.
2. Whether the issue affects one device, one location, or an entire site.
3. Whether wired and wireless are both affected, or only one.
4. Any error messages or codes shown on the affected device.

Common causes QuanTech engineers check first: DHCP lease exhaustion on busy subnets, wireless channel overlap in dense office environments, and switch port errors from failing cabling. For hospital, retail, and branch-office environments specifically, physical interference from equipment (MRI machines, POS scanners, microwave ovens near APs) is a frequent and easily overlooked cause.`,
    updatedAt: daysAgo(10),
  },
  {
    id: 'a4',
    title: 'Managing Account Access and MFA Resets',
    category: 'Account & Access',
    tags: ['account', 'access', 'mfa', 'password'],
    summary: 'Self-service steps for common access issues, and when to escalate to QuanTech support.',
    body: `Most account access issues can be resolved without opening a support ticket:

- Locked out after failed MFA attempts: wait 15 minutes for the automatic lockout to clear, then retry.
- Lost access to your MFA device: use a backup code if you saved one during enrollment.
- New employee needs access: your department's IT liaison can submit provisioning requests directly.

If none of the above applies, or if you suspect your account has been compromised, open an Account & Access ticket. Mark it Critical if you believe your credentials have been used by someone else, so it's routed to the security team immediately rather than the general access queue.`,
    updatedAt: daysAgo(15),
  },
  {
    id: 'a5',
    title: 'Preparing Data for AI Model Deployment',
    category: 'AI & Data Analytics',
    tags: ['ai', 'data', 'ml', 'analytics'],
    summary: 'What QuanTech needs from your team before onboarding a new AI/ML model into production.',
    body: `Before QuanTech's AI & Data Analytics team can onboard a new model into production, we typically need:

1. A labeled, representative sample dataset (minimum 90 days of history where applicable)
2. Documented data lineage — where each field originates and how it's transformed upstream
3. Target latency and throughput requirements for inference
4. A defined owner on your side for model drift review and sign-off

Models already in production should be monitored for drift on a regular cadence. If you notice a rising false-positive/false-negative rate or degraded prediction confidence, open an AI & Data Analytics ticket with recent sample predictions attached so our team can begin a drift analysis.`,
    updatedAt: daysAgo(8),
  },
  {
    id: 'a6',
    title: 'IoT Device Connectivity Troubleshooting Guide',
    category: 'IoT',
    tags: ['iot', 'sensors', 'connectivity'],
    summary: 'Common causes of IoT devices dropping offline and how to triage before escalating.',
    body: `IoT deployments (sensors, gateways, edge devices) commonly go offline intermittently for a few recurring reasons:

- Gateway firmware out of date — check for pending updates first
- Devices operating at the edge of wireless range, especially in warehouses or retail floors with metal shelving
- Power-saving modes causing devices to miss check-in windows under certain network conditions
- Local network congestion from unrelated high-bandwidth traffic sharing the same access points

When opening an IoT ticket, include the device model, gateway ID, and approximate time pattern of the drops (e.g. "every device on floor 2 loses connection around 2pm daily") — this pattern is usually the fastest path to root cause.`,
    updatedAt: daysAgo(4),
  },
  {
    id: 'a7',
    title: 'Planning a Digital Transformation Initiative',
    category: 'Digital Transformation',
    tags: ['digital transformation', 'strategy', 'roadmap'],
    summary: 'How QuanTech structures discovery, roadmap, and rollout phases for enterprise transformation projects.',
    body: `QuanTech structures digital transformation engagements in three phases:

1. Discovery — current-state assessment of systems, data flows, and stakeholder pain points, typically 2-4 weeks.
2. Roadmap — a prioritized, phased plan balancing quick wins against foundational infrastructure work, reviewed jointly with your leadership team.
3. Rollout — phased implementation with defined checkpoints, so course corrections happen early rather than at the end.

To kick off a new initiative, open a Digital Transformation ticket describing the business objective (not just the technical ask) — this lets QuanTech assign the right mix of consultants from the start rather than re-scoping mid-project.`,
    updatedAt: daysAgo(12),
  },
  {
    id: 'a8',
    title: 'Getting the Fastest Response on a Support Ticket',
    category: 'Technical Support',
    tags: ['support', 'tickets', 'sla'],
    summary: 'How ticket priority, detail, and category selection affect response time.',
    body: `A few practices consistently get faster resolutions from QuanTech's support team:

- Choose the priority honestly: Critical is reserved for outages or security incidents affecting business operations right now. Overusing Critical slows down triage for everyone, including you next time.
- Pick the most specific category available rather than defaulting to "Other" — this routes your ticket directly to the right specialist team.
- Include exact error messages, screenshots, and timestamps rather than paraphrasing — engineers can search logs directly against a timestamp.
- Name the affected service or system precisely (e.g. "Core Banking Gateway v3" rather than "the system").

Each priority level has a target initial-response SLA: Critical within 4 hours, High within 24 hours, Medium within 72 hours, and Low within a week. You can track your ticket's status and full conversation history at any time from My Tickets.`,
    updatedAt: daysAgo(2),
  },
];

function buildArticles() {
  return ARTICLES;
}

module.exports = { buildArticles };
