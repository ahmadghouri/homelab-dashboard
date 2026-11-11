import { buildIspReport } from '../services/ispReportService.js';
import { writeIspReportPdf } from '../services/ispReportPdf.js';

export async function getIspReport(req, res) {
  const { report } = await buildIspReport(req.validatedQuery.month);
  res.json(report);
}

// The data is loaded before any header is sent, so a database error still becomes a JSON error.
export async function getIspReportPdf(req, res) {
  const { month } = req.validatedQuery;
  const data = await buildIspReport(month);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="isp-report-${month}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  writeIspReportPdf(data, res);
}
