const bcrypt = require('bcryptjs');
const { ROLES } = require('../../config/constants');

// Demo password shown on the login page for every seeded account.
const DEMO_PASSWORD = 'QuanTech#2026';

const RAW_USERS = [
  // --- Enterprise clients ---
  { id: 'u1', name: 'Rania Saad', email: 'rania.saad@abcbank.com', role: ROLES.CLIENT, company: 'ABC Bank', department: 'IT Department', title: 'IT Infrastructure Manager', phone: '+961 1 234 567' },
  { id: 'u2', name: 'Walid Fakhoury', email: 'walid.fakhoury@beiruttelecom.com', role: ROLES.CLIENT, company: 'Beirut Telecom', department: 'Network Operations', title: 'Network Operations Lead', phone: '+961 1 345 678' },
  { id: 'u3', name: 'Dana Chidiac', email: 'dana.chidiac@medcaregroup.com', role: ROLES.CLIENT, company: 'MedCare Hospital Group', department: 'IT & Compliance', title: 'IT & Compliance Officer', phone: '+961 1 456 789' },
  { id: 'u4', name: 'Elie Zaarour', email: 'elie.zaarour@levantinsurance.com', role: ROLES.CLIENT, company: 'Levant Insurance Group', department: 'Digital Transformation Office', title: 'Digital Transformation Lead', phone: '+961 1 567 890' },
  { id: 'u5', name: 'Yasmine Abou Jaoude', email: 'yasmine.aj@cedarsretail.com', role: ROLES.CLIENT, company: 'Cedars Retail Holdings', department: 'IT Operations', title: 'IT Operations Manager', phone: '+961 1 678 901' },
  { id: 'u6', name: 'Rita Abdallah', email: 'rita.abdallah@continentalfreight.com', role: ROLES.CLIENT, company: 'Continental Freight Logistics', department: 'IT Department', title: 'IT Manager', phone: '+961 1 789 012' },
  { id: 'u7', name: 'Fadi Khalil', email: 'fadi.khalil@sapphirehospitality.com', role: ROLES.CLIENT, company: 'Sapphire Hospitality Group', department: 'IT & Facilities', title: 'IT & Facilities Director', phone: '+961 1 890 123' },

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

  // --- Administrator ---
  { id: 'u23', name: 'Nour El-Amine', email: 'nour.elamine@quantech.com', role: ROLES.ADMIN, company: 'QuanTech SAL', department: 'Enterprise Support', title: 'IT Support Manager', phone: '+961 1 999 105', teamId: null },
];

function buildUsers() {
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const now = new Date();
  return RAW_USERS.map((u) => ({
    ...u,
    teamId: u.teamId || null,
    isActive: true,
    passwordHash,
    notificationPrefs: {
      emailOnReply: true,
      emailOnStatusChange: true,
      emailOnAssignment: u.role !== ROLES.CLIENT,
    },
    createdAt: now,
  }));
}

module.exports = { buildUsers, DEMO_PASSWORD };
