const CATEGORIES = [
  {
    name: 'Cloud & Infrastructure',
    description: 'Cloud hosting, migrations, provisioning, backup & disaster recovery.',
    subcategories: ['Cloud Migration', 'Server Provisioning', 'Backup & Disaster Recovery'],
  },
  {
    name: 'Cybersecurity',
    description: 'Threats, phishing, endpoint protection, vulnerability management.',
    subcategories: ['Phishing / Email Security', 'Endpoint Protection', 'Vulnerability Management'],
  },
  {
    name: 'AI & Data Analytics',
    description: 'ML model deployment, data pipelines, and analytics platforms.',
    subcategories: ['Model Deployment', 'Data Pipeline', 'Model Drift / Monitoring'],
  },
  {
    name: 'IoT',
    description: 'Connected devices, sensors, and edge gateways.',
    subcategories: ['Device Connectivity', 'Firmware & Updates', 'Sensor Data'],
  },
  {
    name: 'Network & Systems',
    description: 'WiFi, VPN, WAN/LAN, and network segmentation.',
    subcategories: ['WiFi / Connectivity', 'VPN', 'VLAN / Segmentation'],
  },
  {
    name: 'Software & Applications',
    description: 'Application bugs, feature requests, and performance issues.',
    subcategories: ['Bug Report', 'Feature Request', 'Performance'],
  },
  {
    name: 'Digital Transformation',
    description: 'Roadmapping, system integration, and process automation.',
    subcategories: ['Roadmap / Strategy', 'System Integration', 'Process Automation'],
  },
  {
    name: 'Technical Support',
    description: 'General hardware, printing, and troubleshooting requests.',
    subcategories: ['Hardware', 'Printing', 'General Troubleshooting'],
  },
  {
    name: 'Account & Access',
    description: 'Passwords, MFA, and account provisioning/deprovisioning.',
    subcategories: ['Password Reset', 'MFA', 'Provisioning / Deprovisioning'],
  },
  {
    name: 'Other',
    description: 'Anything that does not fit an existing category.',
    subcategories: ['General Inquiry', 'Billing', 'Miscellaneous'],
  },
];

function buildCategories() {
  const now = new Date();
  let seq = 1;
  const categories = CATEGORIES.map((c) => ({ name: c.name, description: c.description, createdAt: now }));
  const subcategories = CATEGORIES.flatMap((c) =>
    c.subcategories.map((name) => ({ id: `sc${seq++}`, categoryName: c.name, name }))
  );
  return { categories, subcategories };
}

module.exports = { buildCategories, CATEGORIES };
