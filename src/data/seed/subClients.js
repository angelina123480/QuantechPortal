// Demo sub-clients — kept deliberately small (a couple of branches under one
// existing company) to prove the hierarchy works without cluttering the seed
// data. Fixed ids (rather than generated at insert time) so seed/users.js can
// reference them directly for end_client_user accounts.
const SUB_CLIENTS = [
  { id: 'sc1', parentCompany: 'ABC Bank', name: 'Beirut Branch', contactName: null, contactEmail: null, contactPhone: null },
  { id: 'sc2', parentCompany: 'ABC Bank', name: 'Tripoli Branch', contactName: null, contactEmail: null, contactPhone: null },
  { id: 'sc3', parentCompany: 'ABC Bank', name: 'Byblos Branch (closed)', contactName: null, contactEmail: null, contactPhone: null, isActive: false },
];

function buildSubClients() {
  const now = new Date();
  return SUB_CLIENTS.map((s) => ({ ...s, isActive: s.isActive !== false, createdAt: now }));
}

module.exports = { buildSubClients, SUB_CLIENTS };
