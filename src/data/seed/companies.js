const COMPANIES = [
  { name: 'ABC Bank', contactName: 'Rania Saad', contactEmail: 'rania.saad@abcbank.com', contactPhone: '+961 1 234 567', industry: 'Banking & Finance', teamId: 'tm5' },
  { name: 'Beirut Telecom', contactName: 'Walid Fakhoury', contactEmail: 'walid.fakhoury@beiruttelecom.com', contactPhone: '+961 1 345 678', industry: 'Telecommunications', teamId: 'tm3' },
  { name: 'MedCare Hospital Group', contactName: 'Dana Chidiac', contactEmail: 'dana.chidiac@medcaregroup.com', contactPhone: '+961 1 456 789', industry: 'Healthcare', teamId: 'tm5' },
  { name: 'Levant Insurance Group', contactName: 'Elie Zaarour', contactEmail: 'elie.zaarour@levantinsurance.com', contactPhone: '+961 1 567 890', industry: 'Insurance', teamId: 'tm4' },
  { name: 'Cedars Retail Holdings', contactName: 'Yasmine Abou Jaoude', contactEmail: 'yasmine.aj@cedarsretail.com', contactPhone: '+961 1 678 901', industry: 'Retail', teamId: 'tm2' },
  { name: 'Continental Freight Logistics', contactName: 'Rita Abdallah', contactEmail: 'rita.abdallah@continentalfreight.com', contactPhone: '+961 1 789 012', industry: 'Logistics & Transportation', teamId: 'tm1' },
  { name: 'Sapphire Hospitality Group', contactName: 'Fadi Khalil', contactEmail: 'fadi.khalil@sapphirehospitality.com', contactPhone: '+961 1 890 123', industry: 'Hospitality', teamId: 'tm5' },
  { name: 'QuanTech SAL', contactName: 'Nour El-Amine', contactEmail: 'nour.elamine@quantech.com', contactPhone: '+961 1 999 100', industry: 'Managed IT Services', teamId: null },
];

function buildCompanies() {
  const now = new Date();
  return COMPANIES.map((c) => ({ ...c, createdAt: now }));
}

module.exports = { buildCompanies, COMPANIES };
