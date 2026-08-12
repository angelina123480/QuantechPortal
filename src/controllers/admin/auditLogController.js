const auditLogModel = require('../../models/auditLogModel');

async function index(req, res) {
  const { action, q, page } = req.query;
  const result = await auditLogModel.list({ action, search: q, page: Number(page) || 1, pageSize: 50 });
  const actions = await auditLogModel.listActions();

  res.render('admin/audit-logs', {
    title: 'Audit Logs',
    logs: result.logs,
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
    actions,
    query: req.query,
  });
}

module.exports = { index };
