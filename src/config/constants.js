const ROLES = {
  CLIENT: 'client',
  TECHNICIAN: 'technician',
  ADMIN: 'admin',
};

const STAFF_ROLES = [ROLES.TECHNICIAN, ROLES.ADMIN];

const CATEGORIES = [
  'Cloud & Infrastructure',
  'Cybersecurity',
  'AI & Data Analytics',
  'IoT',
  'Network & Systems',
  'Software & Applications',
  'Digital Transformation',
  'Technical Support',
  'Account & Access',
  'Other',
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

// Order matters for the status timeline UI.
const STATUSES = ['Open', 'In Progress', 'Waiting for Client', 'Resolved', 'Closed'];

const OPEN_STATUSES = ['Open', 'In Progress', 'Waiting for Client'];

// SLA windows (hours) used to flag overdue tickets on the admin dashboard.
const SLA_HOURS_BY_PRIORITY = {
  Critical: 4,
  High: 24,
  Medium: 72,
  Low: 168,
};

const PRIORITY_COLORS = {
  Low: { bg: '#E6F4EA', fg: '#0B7A0B', dot: '#0CA30C' },
  Medium: { bg: '#FEF3E2', fg: '#8A5A00', dot: '#FAB219' },
  High: { bg: '#FDECE4', fg: '#A83E1C', dot: '#EC835A' },
  Critical: { bg: '#FCE4E4', fg: '#8E1616', dot: '#D03B3B' },
};

const STATUS_COLORS = {
  Open: { bg: '#E7EEFC', fg: '#17508F', dot: '#2A78D6' },
  'In Progress': { bg: '#FEF0E9', fg: '#A6431A', dot: '#EB6834' },
  'Waiting for Client': { bg: '#EFECFB', fg: '#3B2E86', dot: '#4A3AA7' },
  Resolved: { bg: '#E6F4EA', fg: '#046B04', dot: '#008300' },
  Closed: { bg: '#EEF1F5', fg: '#5A6473', dot: '#8A94A6' },
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB per file
const MAX_UPLOAD_FILES = 5;
const ALLOWED_UPLOAD_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/json',
];

module.exports = {
  ROLES,
  STAFF_ROLES,
  CATEGORIES,
  PRIORITIES,
  STATUSES,
  OPEN_STATUSES,
  SLA_HOURS_BY_PRIORITY,
  PRIORITY_COLORS,
  STATUS_COLORS,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_FILES,
  ALLOWED_UPLOAD_MIME_TYPES,
};
