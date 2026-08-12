const DEPARTMENTS = [
  { id: 'd1', name: 'Cloud & Infrastructure', description: 'Cloud platforms, hosting, backup & disaster recovery.' },
  { id: 'd2', name: 'Cybersecurity', description: 'Threat response, endpoint protection, vulnerability management.' },
  { id: 'd3', name: 'Network & Systems', description: 'Connectivity, WAN/LAN, VPN, and on-prem systems.' },
  { id: 'd4', name: 'AI & Data Analytics', description: 'ML model deployment, data pipelines, analytics platforms.' },
  { id: 'd5', name: 'Enterprise Support', description: 'General technical support, accounts/access, and cross-cutting requests.' },
];

function buildDepartments() {
  const now = new Date();
  return DEPARTMENTS.map((d) => ({ ...d, createdAt: now }));
}

module.exports = { buildDepartments, DEPARTMENTS };
