const companyModel = require('../../models/companyModel');
const subClientModel = require('../../models/subClientModel');
const userModel = require('../../models/userModel');

async function index(req, res) {
  const [companies, subClients, users] = await Promise.all([
    companyModel.list(), subClientModel.listAll(), userModel.listAll({}),
  ]);

  const subClientsByCompany = {};
  subClients.forEach((sc) => {
    (subClientsByCompany[sc.parentCompany] ||= []).push(sc);
  });

  const usersByCompany = {};
  const usersBySubClient = {};
  users.forEach((u) => {
    if (u.subClientId) (usersBySubClient[u.subClientId] ||= []).push(u);
    else (usersByCompany[u.company] ||= []).push(u);
  });

  // QuanTech's own staff live under the internal company row, pinned first.
  const sorted = [...companies].sort((a, b) => {
    if (a.name === 'QuanTech SAL') return -1;
    if (b.name === 'QuanTech SAL') return 1;
    return a.name.localeCompare(b.name);
  });

  res.render('admin/hierarchy', {
    title: 'Client Hierarchy',
    companies: sorted, subClientsByCompany, usersByCompany, usersBySubClient,
  });
}

module.exports = { index };
