// Draws the monthly ISP report as a PDF with pdfkit (built-in Helvetica, no assets).
import PDFDocument from 'pdfkit';

const MARGIN = 50;
const MAX_OUTAGES = 30;
const COLORS = {
  text: '#111827',
  muted: '#6b7280',
  line: '#d1d5db',
  bar: '#2563eb',
  band: '#f3f4f6',
};
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatValue(value, unit, digits = 2) {
  return typeof value === 'number' ? `${value.toFixed(digits)}${unit}` : 'No data';
}

function formatDuration(totalSec) {
  const sec = Math.round(totalSec);
  if (sec < 60) {
    return `${sec} s`;
  }
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min ${sec % 60} s`;
}

function formatDateTime(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function monthTitle(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  return `${MONTH_NAMES[monthNumber - 1]} ${year}`;
}

function contentWidth(doc) {
  return doc.page.width - MARGIN * 2;
}

// Starts a new page when the next block would not fit.
function ensureSpace(doc, height) {
  if (doc.y + height > doc.page.height - MARGIN - 20) {
    doc.addPage();
  }
}

function sectionTitle(doc, title) {
  ensureSpace(doc, 60);
  doc.moveDown(1);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.text).text(title, MARGIN, doc.y);
  doc.moveDown(0.4);
}

function drawHeader(doc, report, generatedAt) {
  const lastDay = new Date(new Date(report.to) - 1);
  const ongoing = new Date(report.to) > generatedAt;
  doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.text).text('ISP Performance Report');
  doc.font('Helvetica').fontSize(12).fillColor(COLORS.text).text(monthTitle(report.month));
  doc.moveDown(0.3);
  doc.fontSize(9).fillColor(COLORS.muted);
  doc.text(
    `Period: ${formatDateTime(new Date(report.from)).slice(0, 10)} to ${formatDateTime(lastDay).slice(0, 10)}${ongoing ? ' (month in progress)' : ''}`,
  );
  doc.text(`Generated: ${formatDateTime(generatedAt)}`);
  if (!report.hasData) {
    doc.moveDown(0.5).fillColor(COLORS.text).text('No monitoring data was recorded for this month.');
  }
}

// header: true makes the first row bold (a header); otherwise the first column is bold (labels).
function drawTable(doc, rows, columnWidths, { header = false } = {}) {
  const rowHeight = 18;
  const width = columnWidths.reduce((sum, w) => sum + w, 0);
  rows.forEach((row, index) => {
    ensureSpace(doc, rowHeight);
    const y = doc.y;
    if (index % 2 === 0) {
      doc.rect(MARGIN, y, width, rowHeight).fill(COLORS.band);
    }
    let x = MARGIN;
    row.forEach((cell, column) => {
      doc
        .font((header ? index === 0 : column === 0) ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(9)
        .fillColor(COLORS.text)
        .text(cell, x + 6, y + 5, { width: columnWidths[column] - 12, lineBreak: false, ellipsis: true });
      x += columnWidths[column];
    });
    doc.y = y + rowHeight;
  });
  doc.x = MARGIN;
}

function drawSummary(doc, report) {
  const { speed, uptime, quality } = report;
  sectionTitle(doc, 'Summary');
  const half = contentWidth(doc) / 2;
  drawTable(
    doc,
    [
      ['Average download', formatValue(speed.avgDownloadMbps, ' Mbps')],
      ['Average upload', formatValue(speed.avgUploadMbps, ' Mbps')],
      ['Slowest / fastest download', `${formatValue(speed.minDownloadMbps, ' Mbps')} / ${formatValue(speed.maxDownloadMbps, ' Mbps')}`],
      ['Average speed test ping', formatValue(speed.avgPingMs, ' ms', 1)],
      ['Speed tests (failed)', `${speed.tests} (${speed.failed})`],
      ['Availability', formatValue(uptime.availabilityPct, ' %')],
      ['Outages', String(uptime.outages)],
      ['Total downtime', formatDuration(uptime.totalDowntimeSec)],
      ['Longest outage', formatDuration(uptime.longestOutageSec)],
      ['Average packet loss (1.1.1.1)', formatValue(quality.avgLossPct, ' %')],
      ['Average latency (1.1.1.1)', formatValue(quality.avgLatencyMs, ' ms', 1)],
    ],
    [half, half],
  );
}

// Vertical bars of the average download per day, with a max label and day numbers.
function drawDailyChart(doc, daily) {
  sectionTitle(doc, 'Daily average download (Mbps)');
  const chartHeight = 140;
  ensureSpace(doc, chartHeight + 40);
  const width = contentWidth(doc);
  const top = doc.y + 10;
  const bottom = top + chartHeight;
  const values = daily.map((day) => day.avgDownloadMbps ?? 0);
  const max = Math.max(...values, 0);

  doc.strokeColor(COLORS.line).lineWidth(0.5);
  doc.moveTo(MARGIN, bottom).lineTo(MARGIN + width, bottom).stroke();
  doc.moveTo(MARGIN, top).lineTo(MARGIN + width, top).dash(2, { space: 2 }).stroke().undash();
  doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted);
  doc.text(max > 0 ? `${max.toFixed(1)} Mbps` : 'No speed tests', MARGIN, top - 10, { lineBreak: false });

  if (daily.length > 0) {
    const slot = width / daily.length;
    const barWidth = Math.max(2, slot * 0.7);
    daily.forEach((day, index) => {
      const x = MARGIN + index * slot + (slot - barWidth) / 2;
      const value = day.avgDownloadMbps;
      if (typeof value === 'number' && max > 0) {
        const height = Math.max(1, (value / max) * chartHeight);
        doc.rect(x, bottom - height, barWidth, height).fill(COLORS.bar);
      }
      doc
        .fontSize(6)
        .fillColor(COLORS.muted)
        .text(String(Number(day.date.slice(8))), MARGIN + index * slot, bottom + 3, {
          width: slot,
          align: 'center',
          lineBreak: false,
        });
    });
  }
  doc.x = MARGIN;
  doc.y = bottom + 16;
}

function drawOutages(doc, outages) {
  sectionTitle(doc, 'Outages');
  if (outages.length === 0) {
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text).text('No outages recorded this month.');
    return;
  }
  const width = contentWidth(doc);
  const shown = outages.slice(0, MAX_OUTAGES);
  drawTable(
    doc,
    [
      ['Started', 'Ended', 'Duration'],
      ...shown.map((outage) => [
        formatDateTime(outage.startedAt),
        outage.ongoing ? 'Ongoing' : formatDateTime(outage.endedAt),
        formatDuration(outage.durationSec),
      ]),
    ],
    [width * 0.38, width * 0.38, width * 0.24],
    { header: true },
  );
  if (outages.length > shown.length) {
    doc.moveDown(0.5);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(`${outages.length - shown.length} more outages are not listed.`);
  }
}

// The footer sits in the bottom margin, so the margin is lifted while it is written
// (otherwise pdfkit would start a new page).
function drawFooters(doc) {
  const { start, count } = doc.bufferedPageRange();
  for (let index = start; index < start + count; index += 1) {
    doc.switchToPage(index);
    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(COLORS.muted)
      .text(
        `Generated by Homelab Dashboard  |  Page ${index - start + 1} of ${count}`,
        MARGIN,
        doc.page.height - MARGIN + 15,
        { width: contentWidth(doc), align: 'center', lineBreak: false },
      );
    doc.page.margins.bottom = bottomMargin;
  }
}

// Writes the PDF for a report from buildIspReport() into a writable stream (an HTTP response).
export function writeIspReportPdf({ report, outages }, stream) {
  const generatedAt = new Date();
  const doc = new PDFDocument({
    size: 'A4',
    margin: MARGIN,
    bufferPages: true,
    info: { Title: `ISP report ${report.month}`, Author: 'Homelab Dashboard' },
  });
  doc.pipe(stream);
  drawHeader(doc, report, generatedAt);
  drawSummary(doc, report);
  drawDailyChart(doc, report.daily);
  drawOutages(doc, outages);
  drawFooters(doc);
  doc.end();
}
