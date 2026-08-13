const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { ROLES } = require('../../config/constants');

// Demo password shown on the login page for every seeded account EXCEPT the
// admin (see buildUsers below) — a category name is enough to run arbitrary
// JS in every staff dashboard (fixed separately), so a publicly-known admin
// credential turns that into a zero-effort exploit for anyone reading this
// file on GitHub.
const DEMO_PASSWORD = 'QuanTech#2026';

const RAW_USERS = [
  // --- Enterprise clients ---
  // Rania manages ABC Bank's own users (client_admin) — sees the whole
  // company, same as a plain client, but can also administer its roster.
  { id: 'u1', name: 'Rania Saad', email: 'rania.saad@abcbank.com', role: ROLES.CLIENT_ADMIN, company: 'ABC Bank', department: 'IT Department', title: 'IT Infrastructure Manager', phone: '+961 1 234 567' },
  { id: 'u2', name: 'Walid Fakhoury', email: 'walid.fakhoury@beiruttelecom.com', role: ROLES.CLIENT, company: 'Beirut Telecom', department: 'Network Operations', title: 'Network Operations Lead', phone: '+961 1 345 678' },
  { id: 'u3', name: 'Dana Chidiac', email: 'dana.chidiac@medcaregroup.com', role: ROLES.CLIENT, company: 'MedCare Hospital Group', department: 'IT & Compliance', title: 'IT & Compliance Officer', phone: '+961 1 456 789' },
  { id: 'u4', name: 'Elie Zaarour', email: 'elie.zaarour@levantinsurance.com', role: ROLES.CLIENT, company: 'Levant Insurance Group', department: 'Digital Transformation Office', title: 'Digital Transformation Lead', phone: '+961 1 567 890' },
  { id: 'u5', name: 'Yasmine Abou Jaoude', email: 'yasmine.aj@cedarsretail.com', role: ROLES.CLIENT, company: 'Cedars Retail Holdings', department: 'IT Operations', title: 'IT Operations Manager', phone: '+961 1 678 901' },
  { id: 'u6', name: 'Rita Abdallah', email: 'rita.abdallah@continentalfreight.com', role: ROLES.CLIENT, company: 'Continental Freight Logistics', department: 'IT Department', title: 'IT Manager', phone: '+961 1 789 012' },
  { id: 'u7', name: 'Fadi Khalil', email: 'fadi.khalil@sapphirehospitality.com', role: ROLES.CLIENT, company: 'Sapphire Hospitality Group', department: 'IT & Facilities', title: 'IT & Facilities Director', phone: '+961 1 890 123' },

  // --- End-client users: scoped to one branch under ABC Bank, not the
  //     whole company (see sub_clients sc1/sc2 in seed/subClients.js) ---
  { id: 'u24', name: 'Hala Barakat', email: 'hala.barakat@abcbank.com', role: ROLES.END_CLIENT_USER, company: 'ABC Bank', subClientId: 'sc1', department: 'Branch Operations', title: 'Beirut Branch Manager', phone: '+961 1 234 601' },
  { id: 'u25', name: 'Ziad Chamoun', email: 'ziad.chamoun@abcbank.com', role: ROLES.END_CLIENT_USER, company: 'ABC Bank', subClientId: 'sc2', department: 'Branch Operations', title: 'Tripoli Branch Manager', phone: '+961 6 234 602' },

  // --- Team leaders (one per QuanTech team) ---
  { id: 'u8', name: 'Rami Abou Chakra', email: 'rami.abouchakra@quantech.com', role: ROLES.TEAM_LEADER, company: 'QuanTech SAL', department: 'Cloud & Infrastructure', title: 'Cloud & Infrastructure Team Leader', phone: '+961 1 999 108', teamId: 'tm1' },
  { id: 'u9', name: 'Nadine Haykal', email: 'nadine.haykal@quantech.com', role: ROLES.TEAM_LEADER, company: 'QuanTech SAL', department: 'Cybersecurity', title: 'Cybersecurity Team Leader', phone: '+961 1 999 109', teamId: 'tm2' },
  { id: 'u10', name: 'Omar Sfeir', email: 'omar.sfeir@quantech.com', role: ROLES.TEAM_LEADER, company: 'QuanTech SAL', department: 'Network & Systems', title: 'Network & Systems Team Leader', phone: '+961 1 999 110', teamId: 'tm3' },
  { id: 'u11', name: 'Christelle Nassar', email: 'christelle.nassar@quantech.com', role: ROLES.TEAM_LEADER, company: 'QuanTech SAL', department: 'AI & Data Analytics', title: 'AI & Data Analytics Team Leader', phone: '+961 1 999 111', teamId: 'tm4' },
  { id: 'u12', name: 'Hassan Zeidan', email: 'hassan.zeidan@quantech.com', role: ROLES.TEAM_LEADER, company: 'QuanTech SAL', department: 'Enterprise Support', title: 'Enterprise Support Team Leader', phone: '+961 1 999 112', teamId: 'tm5' },

  // --- Support agents ---
  { id: 'u13', name: 'Michael Haddad', email: 'michael.haddad@quantech.com', role: ROLES.AGENT, company: 'QuanTech SAL', department: 'Cloud & Infrastructure', title: 'Cloud & Infrastructure Engineer', phone: '+961 1 999 113', teamId: 'tm1' },
  { id: 'u14', name: 'Tarek Rahal', email: 'tarek.rahal@quantech.com', role: ROLES.AGENT, company: 'QuanTech SAL', department: 'Cloud & Infrastructure', title: 'Cloud Support Engineer', phone: '+961 1 999 114', teamId: 'tm1' },
  { id: 'u15', name: 'Sarah Khoury', email: 'sarah.khoury@quantech.com', role: ROLES.AGENT, company: 'QuanTech SAL', department: 'Cybersecurity', title: 'Cybersecurity Specialist', phone: '+961 1 999 115', teamId: 'tm2' },
  { id: 'u16', name: 'Joseph Gemayel', email: 'joseph.gemayel@quantech.com', role: ROLES.AGENT, company: 'QuanTech SAL', department: 'Cybersecurity', title: 'Security Analyst', phone: '+961 1 999 116', teamId: 'tm2' },
  { id: 'u17', name: 'Karim Fares', email: 'karim.fares@quantech.com', role: ROLES.AGENT, company: 'QuanTech SAL', department: 'Network & Systems', title: 'Network & Systems Engineer', phone: '+961 1 999 117', teamId: 'tm3' },
  { id: 'u18', name: 'Maya Boutros', email: 'maya.boutros@quantech.com', role: ROLES.AGENT, company: 'QuanTech SAL', department: 'Network & Systems', title: 'Network Support Engineer', phone: '+961 1 999 118', teamId: 'tm3' },
  { id: 'u19', name: 'Layla Mansour', email: 'layla.mansour@quantech.com', role: ROLES.AGENT, company: 'QuanTech SAL', department: 'AI & Data Analytics', title: 'AI & Data Analytics Consultant', phone: '+961 1 999 119', teamId: 'tm4' },
  { id: 'u20', name: 'Fadi Aoun', email: 'fadi.aoun@quantech.com', role: ROLES.AGENT, company: 'QuanTech SAL', department: 'AI & Data Analytics', title: 'Data Analytics Engineer', phone: '+961 1 999 120', teamId: 'tm4' },
  { id: 'u21', name: 'Sandra Nakhle', email: 'sandra.nakhle@quantech.com', role: ROLES.AGENT, company: 'QuanTech SAL', department: 'Enterprise Support', title: 'Support Engineer', phone: '+961 1 999 121', teamId: 'tm5' },
  { id: 'u22', name: 'Bilal Choucair', email: 'bilal.choucair@quantech.com', role: ROLES.AGENT, company: 'QuanTech SAL', department: 'Enterprise Support', title: 'Support Engineer', phone: '+961 1 999 122', teamId: 'tm5' },

  // --- Admins ---
  { id: 'u23', name: 'Nour El-Amine', email: 'nour.elamine@quantech.com', role: ROLES.SUPER_ADMIN, company: 'QuanTech SAL', department: 'Enterprise Support', title: 'IT Support Manager', phone: '+961 1 999 105', teamId: null },
  { id: 'u26', name: 'Sami Yared', email: 'sami.yared@quantech.com', role: ROLES.ADMIN, company: 'QuanTech SAL', department: 'Enterprise Support', title: 'IT Manager', phone: '+961 1 999 106', teamId: null },
];

const ADMIN_TIER_ROLES = [ROLES.ADMIN, ROLES.SUPER_ADMIN];

function buildUsers() {
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  // Freshly random on every seed run and never stored in source — set
  // ADMIN_SEED_PASSWORD to pin a known value (e.g. for CI), otherwise it's
  // printed once below and must be saved from the console output. Shared by
  // both admin-tier accounts (admin + super_admin) — this is demo data only,
  // never anything a real deployment would reuse across real accounts.
  const adminPassword = process.env.ADMIN_SEED_PASSWORD || crypto.randomBytes(9).toString('base64url');
  const adminPasswordHash = bcrypt.hashSync(adminPassword, 10);
  console.log(`\nAdmin/Super Admin password for this seed run: ${adminPassword}\n(save this now — it will not be shown again)\n`);

  const now = new Date();
  return RAW_USERS.map((u) => ({
    ...u,
    teamId: u.teamId || null,
    subClientId: u.subClientId || null,
    isActive: true,
    passwordHash: ADMIN_TIER_ROLES.includes(u.role) ? adminPasswordHash : passwordHash,
    notificationPrefs: {
      emailOnReply: true,
      emailOnStatusChange: true,
      emailOnAssignment: u.role !== ROLES.CLIENT,
    },
    createdAt: now,
  }));
}

module.exports = { buildUsers, DEMO_PASSWORD };
