// Minimal RFC 4180-ish CSV serialization — no dependency needed for this scale.
function escapeCsvField(value) {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows, columns) {
  const header = columns.map((c) => escapeCsvField(c.label)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsvField(c.value(row))).join(',')
  );
  return [header, ...lines].join('\r\n');
}

module.exports = { toCsv };
