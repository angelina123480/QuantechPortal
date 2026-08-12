const userModel = require('../models/userModel');
const companyModel = require('../models/companyModel');
const passwordResetModel = require('../models/passwordResetModel');
const twoFactorService = require('../services/twoFactorService');
const emailService = require('../services/emailService');
const auditLogger = require('../services/auditLogger');
const { setFlash } = require('../utils/flash');
const { DEMO_PASSWORD } = require('../data/seed/users');
const { ROLES } = require('../config/constants');
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

async function showRegister(req, res) {
  const companies = await companyModel.list();
  res.render('auth/register', { title: 'Create account', companies, errors: null, formData: {} });
}

async function register(req, res) {
  const companies = await companyModel.list();
  const { name, email, password, confirmPassword, phone, department, title, companyMode } = req.body;
  const errors = {};

  if (!name || !name.trim()) errors.name = 'Name is required.';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'A valid email is required.';
  else if (await userModel.findByEmail(email)) errors.email = 'An account with this email already exists.';
  if (!password || password.length < 8) errors.password = 'Password must be at least 8 characters.';
  else if (password !== confirmPassword) errors.password = 'Passwords do not match.';

  let companyName = null;
  if (companyMode === 'new') {
    companyName = (req.body.newCompanyName || '').trim();
    if (!companyName) errors.company = 'Enter your company name.';
    else if (companies.some((c) => c.name.toLowerCase() === companyName.toLowerCase())) {
      errors.company = 'That company is already registered — select it from the list instead.';
    }
  } else {
    companyName = req.body.existingCompany || '';
    if (!companyName || !companies.some((c) => c.name === companyName)) errors.company = 'Select your company.';
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).render('auth/register', { title: 'Create account', companies, errors, formData: req.body });
  }

  if (companyMode === 'new') {
    await companyModel.create({ name: companyName, contactName: name, contactEmail: email, contactPhone: phone });
  }

  const user = await userModel.create({
    name, email, password, role: ROLES.CLIENT, company: companyName,
    department: department || '', title: title || '', phone: phone || null,
  });
  await auditLogger.log({ user, action: 'user.create', entityType: 'user', entityId: user.id, after: { role: ROLES.CLIENT, company: companyName }, req });

  setFlash(req, 'success', 'Account created — sign in below to get started.');
  res.redirect('/login');
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
    return res.status(400).render('auth/reset-password', { title: 'Reset password', invalid: true, errors: null, token: req.params.token });
  }
  res.render('auth/reset-password', { title: 'Reset password', invalid: false, errors: null, token: req.params.token });
}

async function resetPassword(req, res) {
  const record = await passwordResetModel.findValid(req.params.token);
  if (!record) {
    return res.status(400).render('auth/reset-password', { title: 'Reset password', invalid: true, errors: null, token: req.params.token });
  }

  const { password, confirmPassword } = req.body;
  if (!password || password.length < 8) {
    return res.status(400).render('auth/reset-password', { title: 'Reset password', invalid: false, errors: { password: 'Password must be at least 8 characters.' }, token: req.params.token });
  }
  if (password !== confirmPassword) {
    return res.status(400).render('auth/reset-password', { title: 'Reset password', invalid: false, errors: { password: 'Passwords do not match.' }, token: req.params.token });
  }

  await userModel.updatePassword(record.userId, password);
  await passwordResetModel.markUsed(record.id);
  await auditLogger.log({ user: { id: record.userId, name: null, role: null }, action: 'auth.password_reset', entityType: 'user', entityId: record.userId, req });

  setFlash(req, 'success', 'Password reset — sign in with your new password.');
  res.redirect('/login');
}

module.exports = {
  showLogin,
  login,
  showVerifyTwoFactor,
  verifyTwoFactor,
  logout,
  showRegister,
  register,
  showForgotPassword,
  forgotPassword,
  showResetPassword,
  resetPassword,
};
