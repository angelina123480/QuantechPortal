const slaPolicyModel = require('../../models/slaPolicyModel');
const auditLogger = require('../../services/auditLogger');
const { setFlash } = require('../../utils/flash');

async function index(req, res) {
  const [policies, businessHours] = await Promise.all([slaPolicyModel.list(), slaPolicyModel.getBusinessHours()]);
  res.render('admin/sla', { title: 'SLA Configuration', policies, businessHours: businessHours || { timezone: 'UTC', days: [], startHour: 9, endHour: 18 } });
}

async function update(req, res) {
  const responseMinutes = Number(req.body.responseMinutes);
  const resolutionMinutes = Number(req.body.resolutionMinutes);
  if (!Number.isFinite(responseMinutes) || !Number.isFinite(resolutionMinutes) || responseMinutes <= 0 || resolutionMinutes <= 0) {
    setFlash(req, 'error', 'Enter valid positive minute values.');
    return res.redirect('/admin/sla');
  }
  const before = await slaPolicyModel.findByPriority(req.params.priority);
  await slaPolicyModel.update(req.params.priority, { responseMinutes, resolutionMinutes });
  await auditLogger.log({
    user: req.user, action: 'sla_policy.update', entityType: 'sla_policy', entityId: req.params.priority,
    before: before ? { responseMinutes: before.responseMinutes, resolutionMinutes: before.resolutionMinutes } : null,
    after: { responseMinutes, resolutionMinutes }, req,
  });
  setFlash(req, 'success', `${req.params.priority} SLA policy updated.`);
  res.redirect('/admin/sla');
}

async function updateBusinessHours(req, res) {
  const days = Array.isArray(req.body.days) ? req.body.days : [req.body.days].filter(Boolean);
  await slaPolicyModel.setBusinessHours({
    timezone: req.body.timezone || 'UTC',
    days,
    startHour: Number(req.body.startHour) || 9,
    endHour: Number(req.body.endHour) || 18,
  });
  await auditLogger.log({ user: req.user, action: 'system_settings.update', entityType: 'system_settings', entityId: 'business_hours', req });
  setFlash(req, 'success', 'Business hours updated.');
  res.redirect('/admin/sla');
}

module.exports = { index, update, updateBusinessHours };
