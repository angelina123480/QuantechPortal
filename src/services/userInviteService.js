const crypto = require('crypto');
const userModel = require('../models/userModel');
const passwordResetModel = require('../models/passwordResetModel');
const emailService = require('./emailService');
const auditLogger = require('./auditLogger');

const INVITE_TTL_MINUTES = 7 * 24 * 60; // 7 days

/**
 * Creates an invited (no usable password yet) account and emails a
 * set-password link. Shared by userAdminController.create (staff-facing,
 * any CLIENT_ROLES account) and company/userController.create
 * (client_admin-facing, client/end_client_user only).
 *
 * SECURITY: this function enforces no policy of its own — no role
 * allow-list, no company ownership check, no sub-client ownership check.
 * It trusts role/company/subClientId completely. Every caller MUST
 * validate those fields before calling inviteUser() — the isolation
 * boundary for a given caller lives entirely in that caller's own code,
 * not here.
 */
async function inviteUser({ name, email, role, company, subClientId = null, department = '', title = '', teamId = null, req, auditAction = 'user.invite' }) {
  const placeholderPassword = crypto.randomBytes(32).toString('hex');
  const user = await userModel.create({
    name, email, password: placeholderPassword, role, company, subClientId, department, title, teamId, invited: true,
  });
  const token = await passwordResetModel.create(user.id, { ttlMinutes: INVITE_TTL_MINUTES, purpose: 'invite' });
  const inviteUrl = `${req.protocol}://${req.get('host')}/reset-password/${token}`;
  await emailService.send({
    to: user.email,
    subject: 'You’re invited to the QuanTech Support Portal',
    text: `${req.user.name} has added you to the QuanTech Support Portal for ${company}. Set your password to get started (this link expires in 7 days): ${inviteUrl}\n\nIf you weren't expecting this, you can ignore this email.`,
  });
  await auditLogger.log({ user: req.user, action: auditAction, entityType: 'user', entityId: user.id, after: { role, company }, req });
  return user;
}

module.exports = { inviteUser, INVITE_TTL_MINUTES };
