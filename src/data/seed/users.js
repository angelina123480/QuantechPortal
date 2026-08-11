const bcrypt = require('bcryptjs');
const { ROLES } = require('../../config/constants');

// Demo password shown on the login page for every seeded account.
const DEMO_PASSWORD = 'QuanTech#2026';

const RAW_USERS = [
  // --- Enterprise clients ---
  {
    id: 'u1',
    name: 'Rania Saad',
    email: 'rania.saad@abcbank.com',
    role: ROLES.CLIENT,
    company: 'ABC Bank',
    department: 'IT Department',
    title: 'IT Infrastructure Manager',
    phone: '+961 1 234 567',
  },
  {
    id: 'u2',
    name: 'Walid Fakhoury',
    email: 'walid.fakhoury@beiruttelecom.com',
    role: ROLES.CLIENT,
    company: 'Beirut Telecom',
    department: 'Network Operations',
    title: 'Network Operations Lead',
    phone: '+961 1 345 678',
  },
  {
    id: 'u3',
    name: 'Dana Chidiac',
    email: 'dana.chidiac@medcaregroup.com',
    role: ROLES.CLIENT,
    company: 'MedCare Hospital Group',
    department: 'IT & Compliance',
    title: 'IT & Compliance Officer',
    phone: '+961 1 456 789',
  },
  {
    id: 'u4',
    name: 'Elie Zaarour',
    email: 'elie.zaarour@levantinsurance.com',
    role: ROLES.CLIENT,
    company: 'Levant Insurance Group',
    department: 'Digital Transformation Office',
    title: 'Digital Transformation Lead',
    phone: '+961 1 567 890',
  },
  {
    id: 'u5',
    name: 'Yasmine Abou Jaoude',
    email: 'yasmine.aj@cedarsretail.com',
    role: ROLES.CLIENT,
    company: 'Cedars Retail Holdings',
    department: 'IT Operations',
    title: 'IT Operations Manager',
    phone: '+961 1 678 901',
  },
  // --- QuanTech staff ---
  {
    id: 'u6',
    name: 'Michael Haddad',
    email: 'michael.haddad@quantech.com',
    role: ROLES.TECHNICIAN,
    company: 'QuanTech SAL',
    department: 'Cloud & Infrastructure',
    title: 'Cloud & Infrastructure Engineer',
    phone: '+961 1 999 101',
  },
  {
    id: 'u7',
    name: 'Sarah Khoury',
    email: 'sarah.khoury@quantech.com',
    role: ROLES.TECHNICIAN,
    company: 'QuanTech SAL',
    department: 'Cybersecurity',
    title: 'Cybersecurity Specialist',
    phone: '+961 1 999 102',
  },
  {
    id: 'u8',
    name: 'Karim Fares',
    email: 'karim.fares@quantech.com',
    role: ROLES.TECHNICIAN,
    company: 'QuanTech SAL',
    department: 'Network & Systems',
    title: 'Network & Systems Engineer',
    phone: '+961 1 999 103',
  },
  {
    id: 'u9',
    name: 'Layla Mansour',
    email: 'layla.mansour@quantech.com',
    role: ROLES.TECHNICIAN,
    company: 'QuanTech SAL',
    department: 'AI & Data Analytics',
    title: 'AI & Data Analytics Consultant',
    phone: '+961 1 999 104',
  },
  {
    id: 'u10',
    name: 'Nour El-Amine',
    email: 'nour.elamine@quantech.com',
    role: ROLES.ADMIN,
    company: 'QuanTech SAL',
    department: 'Enterprise Support',
    title: 'IT Support Manager',
    phone: '+961 1 999 105',
  },
];

function buildUsers() {
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const now = new Date();
  return RAW_USERS.map((u) => ({
    ...u,
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
