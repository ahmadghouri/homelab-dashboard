import {
  getDeviceMultiLink,
  resetLineUsage,
  runLineSpeedTest,
  saveMultiLinkSettings,
} from '../services/multiLinkService.js';
import { HttpError } from '../utils/httpError.js';
import { lineIdSchema } from '../validators/multiLinkValidators.js';

// Express already decoded the URL-encoded line id ("Ethernet%202" -> "Ethernet 2").
function readLineId(req) {
  const result = lineIdSchema.safeParse(req.params.lineId);
  if (!result.success) {
    throw new HttpError(400, 'Invalid line id');
  }
  return result.data;
}

export async function getMultiLink(req, res) {
  res.json(await getDeviceMultiLink(req.params.id));
}

export async function putMultiLinkSettings(req, res) {
  res.json(await saveMultiLinkSettings(req.params.id, req.body));
}

export async function postLineSpeedTest(req, res) {
  res.json(await runLineSpeedTest(req.params.id, readLineId(req)));
}

export async function postLineReset(req, res) {
  res.json(await resetLineUsage(req.params.id, readLineId(req)));
}
