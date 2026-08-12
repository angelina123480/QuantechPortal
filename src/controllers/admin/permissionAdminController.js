const permissionModel = require('../../models/permissionModel');
const auditLogger = require('../../services/auditLogger');
const { setFlash } = require('../../utils/flash');
const { ROLES } = require('../../config/constants');

// Admin is deliberately excluded — requirePermission() always passes admins
// through regardless of this table, so toggling admin here would be a no-op.
const CONFIGURABLE_ROLES = [ROLES.AGENT, ROLES.TEAM_LEADER];

async function index(req, res) {
  const [permissions, rolePermissions] = await Promise.all([permissionModel.list(), permissionModel.listRolePermissions()]);
  const grantedSet = new Set(rolePermissions.map((rp) => `${rp.role}:${rp.permissionKey}`));
  res.render('admin/permissions', {
    title: 'Roles & Permissions', permissions, roles: CONFIGURABLE_ROLES,
    isGranted: (role, key) => grantedSet.has(`${role}:${key}`),
  });
}

async function update(req, res) {
  for (const role of CONFIGURABLE_ROLES) {
    for (const permission of await permissionModel.list()) {
      const fieldName = `${role}__${permission.key}`;
      await permissionModel.setRolePermission(role, permission.key, req.body[fieldName] === 'on');
    }
  }
  await auditLogger.log({ user: req.user, action: 'permissions.update', entityType: 'role_permissions', req });
  setFlash(req, 'success', 'Permissions updated.');
  res.redirect('/admin/permissions');
}

module.exports = { index, update };
