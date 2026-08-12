const PDFDocument = require('pdfkit');

/**
 * Renders a simple tabular PDF report — title, generated date/filter summary,
 * a table of rows, and a stats footer — mirroring toCsv's column shape so
 * Reports can share one { label, value(row) } column definition with CSV export.
 * Returns a Buffer; the caller streams it as the response body.
 */
function buildTablePdf({ title, subtitle, columns, rows, footerLines = [] }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(16).font('Helvetica-Bold').text(title);
    if (subtitle) doc.fontSize(9).font('Helvetica').fillColor('#666').text(subtitle);
    doc.moveDown(0.75);

    const startX = doc.page.margins.left;
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = usableWidth / columns.length;
    const rowHeight = 18;

    function drawRow(y, values, opts = {}) {
      doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor(opts.color || '#111');
      values.forEach((val, i) => {
        doc.text(String(val ?? ''), startX + i * colWidth, y, { width: colWidth - 6, ellipsis: true });
      });
    }

    let y = doc.y;
    drawRow(y, columns.map((c) => c.label), { bold: true });
    y += rowHeight;
    doc.moveTo(startX, y - 4).lineTo(startX + usableWidth, y - 4).strokeColor('#ccc').stroke();

    rows.forEach((row) => {
      if (y > doc.page.height - doc.page.margins.bottom - 60) {
        doc.addPage({ margin: 36, size: 'A4', layout: 'landscape' });
        y = doc.y;
      }
      drawRow(y, columns.map((c) => c.value(row)));
      y += rowHeight;
    });

    if (footerLines.length) {
      y += 10;
      doc.moveTo(startX, y - 4).lineTo(startX + usableWidth, y - 4).strokeColor('#ccc').stroke();
      footerLines.forEach((line) => {
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#111').text(line, startX, y);
        y += 14;
      });
    }

    doc.end();
  });
}

module.exports = { buildTablePdf };
