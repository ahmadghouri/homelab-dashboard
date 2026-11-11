import {
  listEnabledServices,
  scheduleService,
  unscheduleAllServices,
} from '../services/serviceMonitor.js';

// Spreads the first checks over a few seconds so they do not all start at once.
const MAX_START_DELAY_MS = 5000;

export async function startServiceMonitor() {
  const services = await listEnabledServices();
  for (const service of services) {
    scheduleService(service, Math.floor(Math.random() * MAX_START_DELAY_MS));
  }
}

export function stopServiceMonitor() {
  unscheduleAllServices();
}
