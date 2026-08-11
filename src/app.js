const path = require('path');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const morgan = require('morgan');

const { attachUser } = require('./middleware/auth');
const { consumeFlash } = require('./utils/flash');

const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const kbRoutes = require('./routes/kbRoutes');
const profileRoutes = require('./routes/profileRoutes');
const adminRoutes = require('./routes/adminRoutes');

function createApp() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(morgan(isProduction ? 'combined' : 'dev'));
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use(
    session({
      name: 'quantech.sid',
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

  app.use(attachUser);
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
