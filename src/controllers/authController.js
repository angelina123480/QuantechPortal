const userModel = require('../models/userModel');
const { DEMO_PASSWORD } = require('../data/seed/users');
const { ROLES } = require('../config/constants');

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

  if (!user || !userModel.verifyPassword(user, password || '')) {
    return res.status(401).render('auth/login', {
      title: 'Sign in',
      demoPassword: DEMO_PASSWORD,
      error: 'Invalid email or password.',
      prefillEmail: email || '',
    });
  }

  // Prevent session fixation by rotating the session on privilege change.
  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).render('auth/login', {
        title: 'Sign in',
        demoPassword: DEMO_PASSWORD,
        error: 'Something went wrong. Please try again.',
        prefillEmail: email || '',
      });
    }
    req.session.userId = user.id;
    if (req.body.remember === 'on') {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }
    const returnTo = req.session.returnTo;
    delete req.session.returnTo;

    if (returnTo && returnTo.startsWith('/')) {
      return res.redirect(returnTo);
    }
    res.redirect(user.role === ROLES.CLIENT ? '/dashboard' : '/admin');
  });
}

function logout(req, res) {
  req.session.destroy(() => {
    res.clearCookie('quantech.sid');
    res.redirect('/login');
  });
}

module.exports = { showLogin, login, logout };
