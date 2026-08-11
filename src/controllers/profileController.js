const userModel = require('../models/userModel');
const { setFlash } = require('../utils/flash');

function show(req, res) {
  res.render('profile/index', {
    title: 'Profile & Settings',
    errors: null,
  });
}

async function updateInfo(req, res) {
  const { name, phone, department } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).render('profile/index', {
      title: 'Profile & Settings',
      errors: { name: 'Name cannot be empty.' },
    });
  }
  await userModel.updateProfile(req.user.id, { name, phone, department });
  setFlash(req, 'success', 'Profile updated.');
  res.redirect('/profile');
}

async function updatePassword(req, res) {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!userModel.verifyPassword(req.user, currentPassword || '')) {
    return res.status(400).render('profile/index', {
      title: 'Profile & Settings',
      errors: { password: 'Current password is incorrect.' },
    });
  }
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).render('profile/index', {
      title: 'Profile & Settings',
      errors: { password: 'New password must be at least 8 characters.' },
    });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).render('profile/index', {
      title: 'Profile & Settings',
      errors: { password: 'New password and confirmation do not match.' },
    });
  }

  await userModel.updatePassword(req.user.id, newPassword);
  setFlash(req, 'success', 'Password changed successfully.');
  res.redirect('/profile');
}

async function updateNotifications(req, res) {
  await userModel.updateNotificationPrefs(req.user.id, {
    emailOnReply: req.body.emailOnReply === 'on',
    emailOnStatusChange: req.body.emailOnStatusChange === 'on',
    emailOnAssignment: req.body.emailOnAssignment === 'on',
  });
  setFlash(req, 'success', 'Notification preferences saved.');
  res.redirect('/profile');
}

module.exports = { show, updateInfo, updatePassword, updateNotifications };
