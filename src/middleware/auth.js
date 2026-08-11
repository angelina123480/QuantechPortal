const userModel = require('../models/userModel');
const { STAFF_ROLES } = require('../config/constants');
const { asyncHandler } = require('../utils/asyncHandler');

// Loads the logged-in user (if any) onto req/res.locals for every request.
const attachUser = asyncHandler(async function attachUser(req, res, next) {
  if (req.session && req.session.userId) {
    const user = await userModel.findById(req.session.userId);
    if (user) {
      req.user = user;
      res.locals.currentUser = user;
      res.locals.isStaff = STAFF_ROLES.includes(user.role);
    } else {
      req.session.userId = null;
    }
  }
  next();
});

function requireLogin(req, res, next) {
  if (!req.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
}

function requireRole(...roles) {
  return function roleCheck(req, res, next) {
    if (!req.user) {
      req.session.returnTo = req.originalUrl;
      return res.redirect('/login');
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).render('errors/403', { title: 'Access denied' });
    }
    next();
  };
}

function requireStaff(req, res, next) {
  return requireRole(...STAFF_ROLES)(req, res, next);
}

function redirectIfAuthenticated(req, res, next) {
  if (req.user) {
    return res.redirect('/dashboard');
  }
  next();
}

module.exports = {
  attachUser,
  requireLogin,
  requireRole,
  requireStaff,
  redirectIfAuthenticated,
};
