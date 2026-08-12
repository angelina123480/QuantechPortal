const notificationModel = require('../models/notificationModel');

async function index(req, res) {
  const notifications = await notificationModel.listForUser(req.user.id, { limit: 100 });
  await notificationModel.markAllRead(req.user.id);
  res.render('notifications/index', { title: 'Notifications', notifications });
}

async function unreadCount(req, res) {
  const count = await notificationModel.unreadCount(req.user.id);
  res.json({ count });
}

async function recent(req, res) {
  const notifications = await notificationModel.listForUser(req.user.id, { limit: 8 });
  res.json({ notifications });
}

async function markRead(req, res) {
  await notificationModel.markRead(req.params.id, req.user.id);
  res.json({ ok: true });
}

async function markAllRead(req, res) {
  await notificationModel.markAllRead(req.user.id);
  res.json({ ok: true });
}

async function remove(req, res) {
  await notificationModel.remove(req.params.id, req.user.id);
  if (req.get('Accept') === 'application/json' || req.xhr) return res.json({ ok: true });
  res.redirect('/notifications');
}

module.exports = { index, unreadCount, recent, markRead, markAllRead, remove };
