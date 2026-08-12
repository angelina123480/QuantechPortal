const path = require('path');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const morgan = require('morgan');

const pool = require('./data/db');
const { attachUser } = require('./middleware/auth');
const { ensureCsrfToken, verifyCsrfToken } = require('./middleware/csrf');
const { generalLimiter } = require('./middleware/rateLimit');
const { consumeFlash } = require('./utils/flash');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const kbRoutes = require('./routes/kbRoutes');
const profileRoutes = require('./routes/profileRoutes');
const adminRoutes = require('./routes/adminRoutes');
const agentRoutes = require('./routes/agentRoutes');
const teamRoutes = require('./routes/teamRoutes');
const cannedResponseRoutes = require('./routes/cannedResponseRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const escalationRoutes = require('./routes/escalationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');

function createApp() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.disable('x-powered-by');

  // TEMPORARY diagnostic route — bisecting a production-only hang on GET /.
  // Registered before every other middleware so it proves whether the
  // request reaches Express at all before we suspect the platform/routing
  // layer. Remove once the real cause is found.
  app.get('/', (req, res) => res.status(200).send('ROOT_DIAGNOSTIC_OK'));

  // Every response here is per-session/personalized — none of it should be
  // cached. This also matters on Vercel specifically: its edge defaults to
  // marking function responses publicly cacheable, and a publicly-cacheable
  // response has its Set-Cookie header stripped (to avoid leaking one
  // visitor's session into a shared cache) — which silently broke login.
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // Zero-dependency diagnostic route, mounted before every other middleware,
  // so it can be used to rule out a hang in the Vercel/Express wiring itself
  // vs. a hang somewhere further down the middleware chain (session/DB/etc).
  app.get('/healthz', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  app.use(helmet());
  app.use(morgan(isProduction ? 'combined' : 'dev'));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  // index: false — every page is server-rendered EJS, there's no public/index.html.
  // Without this, a request for exactly "/" makes express.static attempt directory-index
  // resolution instead of a simple file-miss lookup; on Vercel's bundled read-only
  // filesystem that specific path hung instead of failing fast, timing out the function.
  app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

  app.use(
    session({
      name: 'quantech.sid',
      store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
        maxAge: null, // browser-session cookie unless "remember me" extends it
      },
    })
  );

  app.use(generalLimiter);
  app.use(attachUser);
  app.use(ensureCsrfToken);
  app.use(verifyCsrfToken);
  app.use((req, res, next) => {
    res.locals.flash = consumeFlash(req);
    res.locals.currentPath = req.path;
    next();
  });

  app.get('/', (req, res) => res.redirect(req.user ? '/dashboard' : '/login'));

  app.use('/', authRoutes);
  app.use('/', dashboardRoutes);
  app.use('/tickets', ticketRoutes);
  app.use('/kb', kbRoutes);
  app.use('/profile', profileRoutes);
  app.use('/admin', adminRoutes);
  app.use('/agent', agentRoutes);
  app.use('/team', teamRoutes);
  app.use('/canned-responses', cannedResponseRoutes);
  app.use('/notifications', notificationRoutes);
  app.use('/escalations', escalationRoutes);
  app.use('/reports', reportRoutes);
  app.use('/analytics', analyticsRoutes);

  app.use((req, res) => {
    res.status(404).render('errors/404', { title: 'Page not found' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).render('errors/500', { title: 'Something went wrong' });
  });

  return app;
}

module.exports = createApp;
