const userModel = require('../models/userModel');
const twoFactorService = require('../services/twoFactorService');
const auditLogger = require('../services/auditLogger');
const { setFlash } = require('../utils/flash');

function show(req, res) {
  res.render('profile/index', {
    title: 'Profile & Settings',
    errors: null,
    pending2fa: req.session.pending2faSetup || null,
  });
}

async function updateInfo(req, res) {
  const { name, phone, department } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).render('profile/index', {
      title: 'Profile & Settings',
      errors: { name: 'Name cannot be empty.' },
      pending2fa: req.session.pending2faSetup || null,
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
      pending2fa: req.session.pending2faSetup || null,
    });
  }
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).render('profile/index', {
      title: 'Profile & Settings',
      errors: { password: 'New password must be at least 8 characters.' },
      pending2fa: req.session.pending2faSetup || null,
    });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).render('profile/index', {
      title: 'Profile & Settings',
      errors: { password: 'New password and confirmation do not match.' },
      pending2fa: req.session.pending2faSetup || null,
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

async function setupTwoFactor(req, res) {
  const secret = twoFactorService.generateSecret();
  const qrDataUrl = await twoFactorService.buildQrCodeDataUrl(req.user.email, secret);
  req.session.pending2faSetup = { secret, qrDataUrl };
  res.redirect('/profile');
}

async function confirmTwoFactor(req, res) {
  const pending = req.session.pending2faSetup;
  if (!pending) return res.redirect('/profile');

  const valid = twoFactorService.verifyToken(req.body.code, pending.secret);
  if (!valid) {
    return res.status(400).render('profile/index', {
      title: 'Profile & Settings',
      errors: { twoFactor: 'That code is incorrect. Please try again.' },
      pending2fa: pending,
    });
  }

  await userModel.setTotp(req.user.id, { secret: pending.secret, enabled: true });
  delete req.session.pending2faSetup;
  await auditLogger.log({ user: req.user, action: 'user.2fa_enabled', entityType: 'user', entityId: req.user.id, req });
  setFlash(req, 'success', 'Two-factor authentication is now enabled.');
  res.redirect('/profile');
}

async function disableTwoFactor(req, res) {
  await userModel.setTotp(req.user.id, { secret: null, enabled: false });
  await auditLogger.log({ user: req.user, action: 'user.2fa_disabled', entityType: 'user', entityId: req.user.id, req });
  setFlash(req, 'success', 'Two-factor authentication has been disabled.');
  res.redirect('/profile');
}

module.exports = {
  show,
  updateInfo,
  updatePassword,
  updateNotifications,
  setupTwoFactor,
  confirmTwoFactor,
  disableTwoFactor,
};
