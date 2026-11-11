import {
  createService,
  deleteService,
  getService,
  getServiceHistory,
  listServicesWithUptime,
  runServiceCheck,
  updateService,
} from '../services/serviceMonitor.js';
import { HttpError } from '../utils/httpError.js';

export async function getServices(req, res) {
  const services = await listServicesWithUptime();
  res.json({ services });
}

// The first check starts right away in the background.
export async function postService(req, res) {
  const service = await createService(req.body);
  res.status(201).json({ service });
}

export async function patchService(req, res) {
  const service = await updateService(req.params.id, req.body);
  res.json({ service });
}

export async function removeService(req, res) {
  await deleteService(req.params.id);
  res.status(204).end();
}

export async function postServiceCheck(req, res) {
  await getService(req.params.id);
  const service = await runServiceCheck(req.params.id);
  if (!service) {
    throw new HttpError(404, 'Service not found');
  }
  res.json({ service });
}

export async function getServiceChecks(req, res) {
  const history = await getServiceHistory(req.params.id, req.validatedQuery.range);
  res.json(history);
}
