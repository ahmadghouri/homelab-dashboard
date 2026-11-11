import mongoose from 'mongoose';
import { Service } from '../models/Service.js';
import { ServiceCheck } from '../models/ServiceCheck.js';
import { emitToDashboard } from '../sockets/registry.js';
import { HttpError } from '../utils/httpError.js';
import { onServiceRemoved, onServiceStatus } from './alertEngine.js';
import { probeService, targetError } from './serviceCheck.js';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const CHECK_RANGES = {
  '24h': { durationMs: DAY_MS, binMinutes: 15 },
  '7d': { durationMs: 7 * DAY_MS, binMinutes: 120 },
};

const schedules = new Map(); // serviceId -> { timer }
const runningChecks = new Map(); // serviceId -> promise of the check in progress
// Services whose state was given to the alert engine since this process started.
// The first check after a start (or resume) syncs the alert even when the status did not change.
const alertSynced = new Set();

// ---------- Checks ----------

// Saves the result only if the target did not change while the check was running.
async function saveCheckResult(service, result) {
  const now = new Date();
  const status = result.up ? 'up' : 'down';
  const changed = status !== service.status;
  const updated = await Service.findOneAndUpdate(
    { _id: service._id, type: service.type, target: service.target },
    {
      $set: {
        status,
        lastCheckedAt: now,
        lastResponseMs: result.responseMs,
        lastStatusCode: result.statusCode,
        lastError: result.error,
        ...(changed ? { statusSince: now } : {}),
      },
    },
    { returnDocument: 'after' },
  );
  if (!updated) {
    return null;
  }

  await ServiceCheck.create({
    ts: now,
    serviceId: updated._id,
    up: result.up,
    responseMs: result.responseMs,
    ...(result.statusCode !== null ? { statusCode: result.statusCode } : {}),
  });

  if (changed || !alertSynced.has(updated.id)) {
    alertSynced.add(updated.id);
    onServiceStatus(updated, status);
  }
  emitToDashboard('service:update', { service: updated.toJSON() });
  return updated;
}

async function checkOnce(serviceId) {
  // Two attempts: if the target is edited during the first one, the new target is checked.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const service = await Service.findById(serviceId);
    if (!service) {
      return null;
    }
    const result = await probeService(service);
    const updated = await saveCheckResult(service, result);
    if (updated) {
      return updated;
    }
  }
  return Service.findById(serviceId);
}

// Checks a service now. A check already running for it is shared, never doubled.
// Returns the updated service, or null when it no longer exists.
export function runServiceCheck(serviceId) {
  const id = String(serviceId);
  if (!runningChecks.has(id)) {
    runningChecks.set(
      id,
      checkOnce(id).finally(() => runningChecks.delete(id)),
    );
  }
  return runningChecks.get(id);
}

// ---------- Scheduling ----------

export function unscheduleService(serviceId) {
  const id = String(serviceId);
  clearTimeout(schedules.get(id)?.timer);
  schedules.delete(id);
}

// Runs the next check after delayMs, then keeps checking on the service's interval.
export function scheduleService(service, delayMs = service.intervalSec * 1000) {
  const id = service.id;
  unscheduleService(id);
  const entry = { intervalMs: service.intervalSec * 1000 };
  entry.timer = setTimeout(async () => {
    let next = null;
    try {
      next = await runServiceCheck(id);
    } catch (error) {
      console.error(`[services] check of ${id} failed:`, error.message);
      next = { enabled: true, intervalSec: entry.intervalMs / 1000 };
    }
    // A newer schedule (edit, pause, delete) replaced this one: let it run instead.
    if (schedules.get(id) !== entry) {
      return;
    }
    if (!next?.enabled) {
      schedules.delete(id);
      return;
    }
    scheduleService({ id, intervalSec: next.intervalSec });
  }, delayMs);
  schedules.set(id, entry);
}

export function unscheduleAllServices() {
  for (const id of schedules.keys()) {
    unscheduleService(id);
  }
}

export function listEnabledServices() {
  return Service.find({ enabled: true });
}

// ---------- CRUD ----------

async function findOrThrow(id) {
  const service = await Service.findById(id);
  if (!service) {
    throw new HttpError(404, 'Service not found');
  }
  return service;
}

export async function getService(id) {
  return findOrThrow(id);
}

// data: { name, type, target, intervalSec?, timeoutMs?, enabled? } (already validated)
export async function createService(data) {
  const service = await Service.create(data);
  if (service.enabled) {
    scheduleService(service, 0);
  }
  return service;
}

// changes: partial { name, type, target, intervalSec, timeoutMs, enabled } (already validated)
export async function updateService(id, changes) {
  const service = await findOrThrow(id);

  // The schema checks type + target together. A new target alone is checked against the saved type.
  if (changes.target !== undefined && changes.type === undefined) {
    const message = targetError(service.type, changes.target);
    if (message) {
      throw new HttpError(400, 'Invalid request', { target: [message] });
    }
  }

  const wasEnabled = service.enabled;
  const targetChanged =
    (changes.type ?? service.type) !== service.type ||
    (changes.target ?? service.target) !== service.target;
  const probeChanged = targetChanged || (changes.timeoutMs ?? service.timeoutMs) !== service.timeoutMs;

  Object.assign(service, changes);
  if (targetChanged) {
    // The old results belong to another target: start again from unknown.
    Object.assign(service, {
      status: 'unknown',
      statusSince: new Date(),
      lastCheckedAt: null,
      lastResponseMs: null,
      lastStatusCode: null,
      lastError: null,
    });
  }
  await service.save();

  if (!service.enabled) {
    unscheduleService(service.id);
    if (wasEnabled) {
      // A paused service is not checked, so its down alert could never close by itself.
      alertSynced.delete(service.id);
      await onServiceRemoved(service.id, 'Service paused');
    }
  } else {
    const checkNow = !wasEnabled || probeChanged;
    scheduleService(service, checkNow ? 0 : undefined);
  }

  emitToDashboard('service:update', { service: service.toJSON() });
  return service;
}

export async function deleteService(id) {
  const service = await findOrThrow(id);
  unscheduleService(service.id);
  alertSynced.delete(service.id);
  await service.deleteOne();
  await ServiceCheck.deleteMany({ serviceId: service._id });
  await onServiceRemoved(service.id);
  emitToDashboard('service:deleted', { serviceId: service.id });
}

// ---------- Stats ----------

function toPercent(up, total) {
  return total > 0 ? Math.round((up / total) * 1000) / 10 : null;
}

// All services with uptime24h / uptime7d, computed with one aggregation over all checks.
export async function listServicesWithUptime() {
  const now = Date.now();
  const since24h = new Date(now - DAY_MS);
  const since7d = new Date(now - 7 * DAY_MS);
  const in24h = { $gte: ['$ts', since24h] };

  const [services, stats] = await Promise.all([
    Service.find().sort({ createdAt: 1 }),
    ServiceCheck.aggregate([
      { $match: { ts: { $gte: since7d } } },
      {
        $group: {
          _id: '$serviceId',
          total7d: { $sum: 1 },
          up7d: { $sum: { $cond: ['$up', 1, 0] } },
          total24h: { $sum: { $cond: [in24h, 1, 0] } },
          up24h: { $sum: { $cond: [{ $and: [in24h, '$up'] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const byId = new Map(stats.map((s) => [s._id.toString(), s]));
  return services.map((service) => {
    const s = byId.get(service.id);
    return {
      ...service.toJSON(),
      uptime24h: s ? toPercent(s.up24h, s.total24h) : null,
      uptime7d: s ? toPercent(s.up7d, s.total7d) : null,
    };
  });
}

// Uptime and average response time per bin. Response time only counts successful checks,
// so timeouts do not inflate it.
export async function getServiceHistory(id, range) {
  const service = await findOrThrow(id);
  const { durationMs, binMinutes } = CHECK_RANGES[range];
  const since = new Date(Date.now() - durationMs);

  const points = await ServiceCheck.aggregate([
    { $match: { serviceId: new mongoose.Types.ObjectId(service.id), ts: { $gte: since } } },
    {
      $group: {
        _id: { $dateTrunc: { date: '$ts', unit: 'minute', binSize: binMinutes } },
        uptimePct: { $avg: { $cond: ['$up', 100, 0] } },
        avgResponseMs: { $avg: { $cond: ['$up', '$responseMs', null] } },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        ts: '$_id',
        uptimePct: { $round: ['$uptimePct', 1] },
        avgResponseMs: { $round: ['$avgResponseMs', 0] },
      },
    },
  ]);

  return { range, binMinutes, points };
}
