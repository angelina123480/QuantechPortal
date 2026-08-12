const crypto = require('crypto');

// Hand-rolled synchronizer-token CSRF protection (csurf is unmaintained).
// A per-session token is minted on first request and exposed to every view
// as res.locals.csrfToken; public/js/main.js injects it into every POST
// form and X-CSRF-Token header client-side, so no view template needs to
// know about it individually.
function ensureCsrfToken(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function check(req) {
  const submitted = (req.body && req.body._csrf) || req.get('X-CSRF-Token');
  return !!submitted && submitted === req.session.csrfToken;
}

function reject(req, res) {
  if (req.xhr || (req.get('Accept') || '').includes('application/json')) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token.' });
  }
  return res.status(403).render('errors/403', { title: 'Request blocked' });
}

// Global check, mounted before all routers. multipart/form-data bodies
// aren't parsed yet here (multer runs later, per-route) so those requests
// are deferred to verifyCsrfTokenAfterUpload, applied locally after multer.
function verifyCsrfToken(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if ((req.get('Content-Type') || '').startsWith('multipart/form-data')) return next();
  if (!check(req)) return reject(req, res);
  next();
}

// For multipart routes: insert this AFTER the multer upload middleware, once
// req.body is actually populated.
function verifyCsrfTokenAfterUpload(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  if (!check(req)) return reject(req, res);
  next();
}

module.exports = { ensureCsrfToken, verifyCsrfToken, verifyCsrfTokenAfterUpload };
