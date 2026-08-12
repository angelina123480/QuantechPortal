const userModel = require('../models/userModel');
const permissionModel = require('../models/permissionModel');
const { STAFF_ROLES, MANAGEMENT_ROLES, ROLES } = require('../config/constants');
const { asyncHandler } = require('../utils/asyncHandler');

// Loads the logged-in user (if any) onto req/res.locals for every request.
const attachUser = asyncHandler(async function attachUser(req, res, next) {
  if (req.session && req.session.userId) {
    const user = await userModel.findById(req.session.userId);
    if (user && user.isActive) {
      req.user = user;
      res.locals.currentUser = user;
      res.locals.isStaff = STAFF_ROLES.includes(user.role);
      res.locals.isManager = MANAGEMENT_ROLES.includes(user.role);
      res.locals.isAdmin = user.role === ROLES.ADMIN;
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

// Any non-client role (agent, team leader, admin).
function requireStaff(req, res, next) {
  return requireRole(...STAFF_ROLES)(req, res, next);
}

// Team leaders and admins — team management, escalations, reports, analytics.
function requireManager(req, res, next) {
  return requireRole(...MANAGEMENT_ROLES)(req, res, next);
}

function requireAdmin(req, res, next) {
  return requireRole(ROLES.ADMIN)(req, res, next);
}

// Admins bypass permission checks entirely — the granular permissions table
// only gates the toggleable extras for agent/team_leader, never admin access.
function requirePermission(key) {
  return asyncHandler(async function permissionCheck(req, res, next) {
    if (!req.user) {
      req.session.returnTo = req.originalUrl;
      return res.redirect('/login');
    }
    if (req.user.role === ROLES.ADMIN) return next();
    const granted = await permissionModel.roleHasPermission(req.user.role, key);
    if (!granted) {
      return res.status(403).render('errors/403', { title: 'Access denied' });
    }
    next();
  });
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
  requireManager,
  requireAdmin,
  requirePermission,
  redirectIfAuthenticated,
};
