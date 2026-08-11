const bcrypt = require('bcryptjs');
const store = require('../data/store');
const { ROLES, STAFF_ROLES } = require('../config/constants');

function findById(id) {
  return store.users.find((u) => u.id === id) || null;
}

function findByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  return store.users.find((u) => u.email.toLowerCase() === normalized) || null;
}

function verifyPassword(user, plainPassword) {
  return bcrypt.compareSync(plainPassword, user.passwordHash);
}

function listTechnicians() {
  return store.users.filter((u) => STAFF_ROLES.includes(u.role));
}

function isStaff(user) {
  return !!user && STAFF_ROLES.includes(user.role);
}

function isClient(user) {
  return !!user && user.role === ROLES.CLIENT;
}

function updateProfile(id, updates) {
  const user = findById(id);
  if (!user) return null;
  const allowed = ['name', 'phone', 'department', 'company'];
  for (const key of allowed) {
    if (updates[key] !== undefined && updates[key] !== '') {
      user[key] = updates[key];
    }
  }
  return user;
}

function updateNotificationPrefs(id, prefs) {
  const user = findById(id);
  if (!user) return null;
  user.notificationPrefs = {
    emailOnReply: !!prefs.emailOnReply,
    emailOnStatusChange: !!prefs.emailOnStatusChange,
    emailOnAssignment: !!prefs.emailOnAssignment,
  };
  return user;
}

function updatePassword(id, newPlainPassword) {
  const user = findById(id);
  if (!user) return null;
  user.passwordHash = bcrypt.hashSync(newPlainPassword, 10);
  return user;
}

module.exports = {
  findById,
  findByEmail,
  verifyPassword,
  listTechnicians,
  isStaff,
  isClient,
  updateProfile,
  updateNotificationPrefs,
  updatePassword,
};
