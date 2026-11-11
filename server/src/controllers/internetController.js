import {
  getInternetStatus,
  listOutages,
  listSpeedTests,
  runSpeedTest,
} from '../services/internetService.js';
import { getQualityHistory } from '../services/qualityService.js';

export async function getStatus(req, res) {
  const status = await getInternetStatus();
  res.json({ status });
}

export async function getSpeedTests(req, res) {
  const { range } = req.validatedQuery;
  const tests = await listSpeedTests(range);
  res.json({ range, tests });
}

// Waits for the whole test (about 10 to 40 seconds).
export async function postSpeedTest(req, res) {
  const test = await runSpeedTest('manual');
  res.json({ test });
}

export async function getOutages(req, res) {
  const outages = await listOutages(req.validatedQuery.limit);
  res.json({ outages });
}

export async function getQuality(req, res) {
  const quality = await getQualityHistory(req.validatedQuery.range);
  res.json(quality);
}
