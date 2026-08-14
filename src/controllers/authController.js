const userModel = require('../models/userModel');
const passwordResetModel = require('../models/passwordResetModel');
const twoFactorService = require('../services/twoFactorService');
const emailService = require('../services/emailService');
const auditLogger = require('../services/auditLogger');
const { setFlash } = require('../utils/flash');
const { DEMO_PASSWORD } = require('../data/seed/users');
const { dashboardPathForRole } = require('../utils/roleRouting');

function showLogin(req, res) {
  res.render('auth/login', {
    title: 'Sign in',
    demoPassword: DEMO_PASSWORD,
    error: null,
    prefillEmail: '',
  });
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await userModel.findByEmail(email);

  if (!user || !user.isActive || !userModel.verifyPassword(user, password || '')) {
    await auditLogger.log({ user: null, action: 'auth.login_failed', entityType: 'user', entityId: user ? user.id : null, req });
    return res.status(401).render('auth/login', {
      title: 'Sign in',
      demoPassword: DEMO_PASSWORD,
      error: 'Invalid email or password.',
      prefillEmail: email || '',
    });
  }

  const remember = req.body.remember === 'on';

  if (user.totpEnabled) {
    req.session.regenerate((err) => {
      if (err) return res.status(500).render('auth/login', { title: 'Sign in', demoPassword: DEMO_PASSWORD, error: 'Something went wrong. Please try again.', prefillEmail: email || '' });
      req.session.pending2faUserId = user.id;
      req.session.pending2faRemember = remember;
      res.redirect('/login/verify-2fa');
    });
    return;
  }

  completeLogin(req, res, user, remember);
}

function completeLogin(req, res, user, remember) {
  // Prevent session fixation by rotating the session on privilege change.
  req.session.regenerate(async (err) => {
    if (err) {
      return res.status(500).render('auth/login', {
        title: 'Sign in',
        demoPassword: DEMO_PASSWORD,
        error: 'Something went wrong. Please try again.',
        prefillEmail: '',
      });
    }
    req.session.userId = user.id;
    if (remember) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }
    const returnTo = req.session.returnTo;
    delete req.session.returnTo;

    await auditLogger.log({ user, action: 'auth.login', entityType: 'user', entityId: user.id, req });

    if (returnTo && returnTo.startsWith('/')) {
      return res.redirect(returnTo);
    }
    res.redirect(dashboardPathForRole(user.role));
  });
}

function showVerifyTwoFactor(req, res) {
  if (!req.session.pending2faUserId) return res.redirect('/login');
  res.render('auth/verify-2fa', { title: 'Verify identity', error: null });
}

async function verifyTwoFactor(req, res) {
  if (!req.session.pending2faUserId) return res.redirect('/login');
  const user = await userModel.findById(req.session.pending2faUserId);
  if (!user) return res.redirect('/login');

  const valid = twoFactorService.verifyToken(req.body.code, user.totpSecret);
  if (!valid) {
    return res.status(401).render('auth/verify-2fa', { title: 'Verify identity', error: 'That code is incorrect or expired. Please try again.' });
  }

  const remember = req.session.pending2faRemember;
  delete req.session.pending2faUserId;
  delete req.session.pending2faRemember;
  completeLogin(req, res, user, remember);
}

function logout(req, res) {
  const user = req.user;
  auditLogger.log({ user, action: 'auth.logout', entityType: 'user', entityId: user ? user.id : null, req }).finally(() => {
    req.session.destroy(() => {
      res.clearCookie('quantech.sid');
      res.redirect('/login');
    });
  });
}

function showForgotPassword(req, res) {
  res.render('auth/forgot-password', { title: 'Forgot password', sent: false });
}

async function forgotPassword(req, res) {
  const user = await userModel.findByEmail(req.body.email);
  // Always show the same response whether or not the account exists, to
  // avoid leaking which emails are registered.
  if (user) {
    const token = await passwordResetModel.create(user.id);
    const resetUrl = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
    await emailService.send({
      to: user.email,
      subject: 'Reset your QuanTech Support Portal password',
      text: `We received a request to reset your password. Reset it here (expires in 30 minutes): ${resetUrl}\n\nIf you didn't request this, you can ignore this email.`,
    });
  }
  res.render('auth/forgot-password', { title: 'Forgot password', sent: true });
}

async function showResetPassword(req, res) {
  const record = await passwordResetModel.findValid(req.params.token);
  if (!record) {
    return res.status(400).render('auth/reset-password', { title: 'Reset password', invalid: true, errors: null, token: req.params.token, purpose: null });
  }
  res.render('auth/reset-password', { title: 'Reset password', invalid: false, errors: null, token: req.params.token, purpose: record.purpose });
}

async function resetPassword(req, res) {
  const record = await passwordResetModel.findValid(req.params.token);
  if (!record) {
    return res.status(400).render('auth/reset-password', { title: 'Reset password', invalid: true, errors: null, token: req.params.token, purpose: null });
  }

  const { password, confirmPassword } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).render('auth/reset-password', { title: 'Reset password', invalid: false, errors: { password: 'Password must be at least 8 characters.' }, token: req.params.token, purpose: record.purpose });
  }
  if (password !== confirmPassword) {
    return res.status(400).render('auth/reset-password', { title: 'Reset password', invalid: false, errors: { password: 'Passwords do not match.' }, token: req.params.token, purpose: record.purpose });
  }

  await userModel.updatePassword(record.userId, password);
  await passwordResetModel.markUsed(record.id);
  await auditLogger.log({
    user: { id: record.userId, name: null, role: null },
    action: record.purpose === 'invite' ? 'auth.invite_accepted' : 'auth.password_reset',
    entityType: 'user', entityId: record.userId, req,
  });

  setFlash(req, 'success', record.purpose === 'invite' ? 'Welcome! Your password is set — sign in below to get started.' : 'Password reset — sign in with your new password.');
  res.redirect('/login');
}

module.exports = {
  showLogin,
  login,
  showVerifyTwoFactor,
  verifyTwoFactor,
  logout,
  showForgotPassword,
  forgotPassword,
  showResetPassword,
  resetPassword,
};
