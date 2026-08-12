const rateLimit = require('express-rate-limit');

// Strict limiter on login attempts specifically — the highest-value target
// for credential stuffing / brute force.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait a few minutes and try again.' },
  handler: (req, res) => {
    res.status(429).render('auth/login', {
      title: 'Sign in',
      demoPassword: require('../data/seed/users').DEMO_PASSWORD,
      error: 'Too many login attempts. Please wait a few minutes and try again.',
      prefillEmail: req.body ? req.body.email || '' : '',
    });
  },
});

// Moderate global limiter so no single client can hammer the app.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

module.exports = { loginLimiter, generalLimiter };
