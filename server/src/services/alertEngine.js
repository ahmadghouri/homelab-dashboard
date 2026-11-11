// Decides when alerts open and close.
// - Metric rules (CPU, RAM, disk, temperature): open when the value stays at or above the
//   threshold for the rule's duration; close when it drops a few points below (hysteresis).
// - PC offline: open when a PC stays offline for the rule's duration; close when it is back.
// - Unknown network device: open when a scan finds a new untrusted device; close when the
//   device is marked trusted or forgotten.
// - Internet down / service down: open when the target stays down for the rule's duration;
//   close when it is back up.
import crypto from 'node:crypto';
import { AlertRule } from '../models/AlertRule.js';
import { Device } from '../models/Device.js';
import {
  createAlert,
  findOpenAlert,
  findOpenAlerts,
  getAlertOrThrow,
  resolveAlert,
} from './alertService.js';

// A value must drop this far below the threshold before the alert closes,
// so a value hovering around the threshold does not open and close it repeatedly.
const HYSTERESIS = 5;

const METRIC_RULES = {
  cpu_high: { read: (m) => m.cpu, label: 'CPU', unit: '%' },
  ram_high: { read: (m) => m.mem.usedPct, label: 'RAM', unit: '%' },
  disk_high: {
    read: (m) => (m.disks?.length ? Math.max(...m.disks.map((d) => d.usedPct)) : null),
    label: 'Disk',
    unit: '%',
  },
  temp_high: { read: (m) => m.tempC, label: 'CPU temperature', unit: '°C' },
};

let rules = new Map(); // type -> rule
const breachStartedAt = new Map(); // "type:deviceId" -> ms
const openAlertKeys = new Set(); // "type:targetId"
const offlineTimers = new Map(); // deviceId -> timeout
const downTimers = new Map(); // "type:targetId" -> timeout (internet and services)
const pending = new Set(); // keys with an alert being created, to avoid duplicates

// The internet has no database document, so its alerts use this fixed id.
export const INTERNET_TARGET_ID = '000000000000000000000001';

const keyOf = (type, targetId) => `${type}:${targetId}`;

function describeDuration(seconds) {
  if (!seconds) {
    return '';
  }
  return seconds >= 60 ? ` for ${Math.round(seconds / 60)} min` : ` for ${seconds} s`;
}

async function openAlert(rule, target, details) {
  const key = keyOf(rule.type, target.id);
  if (openAlertKeys.has(key) || pending.has(key)) {
    return;
  }
  pending.add(key);
  try {
    await createAlert({
      ruleType: rule.type,
      severity: rule.severity,
      targetType: target.type,
      targetId: target.id,
      targetName: target.name,
      ...details,
    });
    openAlertKeys.add(key);
  } catch (error) {
    console.error('[alerts] could not create alert:', error.message);
  } finally {
    pending.delete(key);
  }
}

async function closeAlert(type, targetId, reason) {
  const key = keyOf(type, targetId);
  if (!openAlertKeys.has(key)) {
    return;
  }
  openAlertKeys.delete(key);
  const alert = await findOpenAlert(type, targetId);
  if (alert) {
    await resolveAlert(alert, reason);
  }
}

export async function reloadRules() {
  const list = await AlertRule.find();
  rules = new Map(list.map((rule) => [rule.type, rule]));
}

export async function initAlertEngine() {
  await reloadRules();
  for (const alert of await findOpenAlerts()) {
    openAlertKeys.add(keyOf(alert.ruleType, alert.targetId.toString()));
  }
}

// ---------- Metrics ----------

export async function onDeviceMetrics(device, metrics) {
  const now = Date.now();

  for (const [type, metric] of Object.entries(METRIC_RULES)) {
    const rule = rules.get(type);
    const value = metric.read(metrics);
    const key = keyOf(type, device.id);

    if (!rule?.enabled || typeof value !== 'number') {
      continue;
    }

    if (value >= rule.threshold) {
      if (!breachStartedAt.has(key)) {
        breachStartedAt.set(key, now);
      }
      if (now - breachStartedAt.get(key) >= rule.durationSec * 1000) {
        const shown = `${Math.round(value)}${metric.unit}`;
        await openAlert(
          rule,
          { type: 'device', id: device.id, name: device.name },
          {
            title: `${metric.label} high on ${device.name}`,
            message: `${metric.label} is ${shown} (limit ${rule.threshold}${metric.unit}${describeDuration(rule.durationSec)}) on ${device.name}.`,
            value: Math.round(value * 10) / 10,
          },
        );
      }
    } else {
      breachStartedAt.delete(key);
      if (value < rule.threshold - HYSTERESIS) {
        await closeAlert(type, device.id, `${metric.label} back to normal`);
      }
    }
  }
}

// ---------- Online / offline ----------

async function fireOfflineAlert(deviceId) {
  offlineTimers.delete(deviceId);
  const rule = rules.get('device_offline');
  const device = await Device.findById(deviceId);
  if (!rule?.enabled || !device || device.status !== 'offline') {
    return;
  }
  await openAlert(
    rule,
    { type: 'device', id: device.id, name: device.name },
    {
      title: `${device.name} is offline`,
      message: `${device.name} has not been connected${describeDuration(rule.durationSec)}. Last seen ${device.lastSeenAt?.toLocaleString() ?? 'never'}.`,
    },
  );
}

export function onDeviceStatus(deviceId, status) {
  clearTimeout(offlineTimers.get(deviceId));
  offlineTimers.delete(deviceId);

  if (status === 'online') {
    closeAlert('device_offline', deviceId, 'PC is back online').catch((error) =>
      console.error('[alerts] resolve failed:', error.message),
    );
    return;
  }

  const rule = rules.get('device_offline');
  if (rule?.enabled) {
    const timer = setTimeout(() => {
      fireOfflineAlert(deviceId).catch((error) =>
        console.error('[alerts] offline check failed:', error.message),
      );
    }, rule.durationSec * 1000);
    offlineTimers.set(deviceId, timer);
  }
}

// After a server start every PC is offline until its agent reconnects.
// Start the offline countdown for all of them, so a PC that never comes back is reported.
export async function watchAllDevicesOffline() {
  const devices = await Device.find({}, { _id: 1 });
  for (const device of devices) {
    onDeviceStatus(device.id, 'offline');
  }
}

export async function onDeviceRemoved(deviceId) {
  clearTimeout(offlineTimers.get(deviceId));
  offlineTimers.delete(deviceId);
  for (const type of [...Object.keys(METRIC_RULES), 'device_offline']) {
    breachStartedAt.delete(keyOf(type, deviceId));
    await closeAlert(type, deviceId, 'PC removed');
  }
}

// ---------- Network ----------

function networkDeviceLabel(device) {
  return device.customName || device.hostname || device.vendor || (device.randomizedMac ? 'Device with private MAC' : 'Unknown device');
}

export async function alertOnNewNetworkDevices(devices) {
  const rule = rules.get('new_network_device');
  if (!rule?.enabled) {
    return;
  }
  for (const device of devices) {
    const name = networkDeviceLabel(device);
    await openAlert(
      rule,
      { type: 'network_device', id: device.id, name },
      {
        title: 'Unknown device joined the network',
        message: `${name} (IP ${device.ip}, MAC ${device.mac}) is now on your network.`,
      },
    );
  }
}

export function onNetworkDeviceTrusted(deviceId, reason = 'Marked as trusted') {
  return closeAlert('new_network_device', deviceId, reason);
}

// ---------- Internet and services ----------

function stopDownTimer(type, targetId) {
  const key = keyOf(type, targetId);
  clearTimeout(downTimers.get(key));
  downTimers.delete(key);
}

// Opens the alert if the target is still down after the rule's duration.
function startDownTimer(type, target, details) {
  stopDownTimer(type, target.id);
  const rule = rules.get(type);
  if (!rule?.enabled) {
    return;
  }
  const key = keyOf(type, target.id);
  const timer = setTimeout(() => {
    downTimers.delete(key);
    openAlert(rule, target, details).catch((error) =>
      console.error('[alerts] could not open down alert:', error.message),
    );
  }, rule.durationSec * 1000);
  downTimers.set(key, timer);
}

function logError(error) {
  console.error('[alerts] resolve failed:', error.message);
}

// online: boolean. since: Date the current state started.
// A Telegram message for "internet down" can only be sent once the internet is back,
// so the failure is saved on the alert and the "resolved" message still arrives.
export function onInternetStatus(online, { since = new Date() } = {}) {
  if (online) {
    stopDownTimer('internet_down', INTERNET_TARGET_ID);
    closeAlert('internet_down', INTERNET_TARGET_ID, 'Internet is back').catch(logError);
    return;
  }
  startDownTimer(
    'internet_down',
    { type: 'internet', id: INTERNET_TARGET_ID, name: 'Internet' },
    {
      title: 'Internet is down',
      message: `No internet connection since ${since.toLocaleString()}.`,
    },
  );
}

// service: the Service document. status: 'up' | 'down'.
export function onServiceStatus(service, status) {
  const serviceId = service.id;
  if (status === 'up') {
    stopDownTimer('service_down', serviceId);
    closeAlert('service_down', serviceId, 'Service is back up').catch(logError);
    return;
  }
  startDownTimer(
    'service_down',
    { type: 'service', id: serviceId, name: service.name },
    {
      title: `${service.name} is down`,
      message: `${service.name} (${service.target}) is not responding${service.lastError ? `: ${service.lastError}` : ''}.`,
    },
  );
}

export function onServiceRemoved(serviceId, reason = 'Service removed') {
  stopDownTimer('service_down', serviceId);
  return closeAlert('service_down', serviceId, reason);
}

// ---------- Network quality and dev projects ----------

// Alerts store an ObjectId target. Targets without a document (a ping target, a project
// from a PC's workspace.json) get a stable id derived from their name.
export function stableTargetId(text) {
  return crypto.createHash('md5').update(text).digest('hex').slice(0, 24);
}

// target: { key: '1.1.1.1', name: 'Internet (1.1.1.1)' }. lossPct: 0 to 100.
// Opens after the loss stays at or above the threshold for the rule's duration;
// closes when it drops below half the threshold.
export async function onPacketLoss(target, lossPct) {
  const rule = rules.get('packet_loss_high');
  if (!rule?.enabled || typeof lossPct !== 'number') {
    return;
  }
  const id = stableTargetId(`quality:${target.key}`);
  const key = keyOf('packet_loss_high', id);

  if (lossPct >= rule.threshold) {
    if (!breachStartedAt.has(key)) {
      breachStartedAt.set(key, Date.now());
    }
    if (Date.now() - breachStartedAt.get(key) >= rule.durationSec * 1000) {
      await openAlert(
        rule,
        { type: 'quality_target', id, name: target.name },
        {
          title: `High packet loss to ${target.name}`,
          message: `${Math.round(lossPct)}% of pings to ${target.name} were lost (limit ${rule.threshold}%${describeDuration(rule.durationSec)}).`,
          value: Math.round(lossPct * 10) / 10,
        },
      );
    }
    return;
  }
  breachStartedAt.delete(key);
  if (lossPct < rule.threshold / 2) {
    await closeAlert('packet_loss_high', id, 'Packet loss back to normal');
  }
}

// device: { id, name }. project: { id, name, exitCode? } from the agent's workspace.json.
// status: 'crashed' opens an alert right away; 'running' or 'stopped' closes it.
export async function onWorkspaceProjectStatus(device, project, status) {
  const id = stableTargetId(`workspace:${device.id}:${project.id}`);
  if (status !== 'crashed') {
    await closeAlert(
      'project_crashed',
      id,
      status === 'running' ? 'Project running again' : 'Project stopped',
    );
    return;
  }
  const rule = rules.get('project_crashed');
  if (!rule?.enabled) {
    return;
  }
  const exit = project.exitCode === null || project.exitCode === undefined ? '' : ` (exit code ${project.exitCode})`;
  await openAlert(
    rule,
    { type: 'workspace_project', id, name: `${project.name} on ${device.name}` },
    {
      title: `${project.name} crashed on ${device.name}`,
      message: `The dev project ${project.name} stopped unexpectedly${exit}. Open Workspace to see its logs.`,
    },
  );
}

// ---------- Multi-link internet lines (M10) ----------

// device: { id, name }. line: { id, name } (id is the interface name on that PC).
// up: false starts the rule's delay; true closes the alert.
export function onLinkStatus(device, line, up) {
  const id = stableTargetId(`link:${device.id}:${line.id}`);
  if (up) {
    stopDownTimer('link_down', id);
    closeAlert('link_down', id, 'Line is back').catch(logError);
    return;
  }
  startDownTimer(
    'link_down',
    { type: 'internet_line', id, name: `${line.name} on ${device.name}` },
    {
      title: `${line.name} is down on ${device.name}`,
      message: `The internet line ${line.name} on ${device.name} stopped working. Traffic moved to the other lines.`,
    },
  );
}

// ---------- Drive storage accounts (M11) ----------

// account: { id, email }. usedPct: 0 to 100 (null when the account has no limit).
// Opens at or above the threshold; closes 5 points below it.
export async function onStorageQuota(account, usedPct) {
  const rule = rules.get('storage_account_full');
  if (!rule?.enabled || typeof usedPct !== 'number') {
    return;
  }
  if (usedPct >= rule.threshold) {
    await openAlert(
      rule,
      { type: 'storage_account', id: account.id, name: account.email },
      {
        title: `Drive account ${account.email} is almost full`,
        message: `${account.email} is ${Math.round(usedPct)}% full (limit ${rule.threshold}%). New uploads go to other accounts.`,
        value: Math.round(usedPct * 10) / 10,
      },
    );
  } else if (usedPct < rule.threshold - HYSTERESIS) {
    await closeAlert('storage_account_full', account.id, 'Space is available again');
  }
}

// error: a safe message when the account stopped working (for example the Google login was
// revoked), or null when it works again.
export async function onStorageAccountError(account, error) {
  if (!error) {
    await closeAlert('storage_account_error', account.id, 'Account works again');
    return;
  }
  const rule = rules.get('storage_account_error');
  if (!rule?.enabled) {
    return;
  }
  await openAlert(
    rule,
    { type: 'storage_account', id: account.id, name: account.email },
    {
      title: `Drive account ${account.email} is not working`,
      message: `${account.email}: ${error}. Reconnect it from Drive > Accounts.`,
    },
  );
}

export function onStorageAccountRemoved(accountId) {
  return Promise.all([
    closeAlert('storage_account_full', accountId, 'Account removed'),
    closeAlert('storage_account_error', accountId, 'Account removed'),
  ]);
}

// ---------- Manual actions and rule changes ----------

// The condition may still be true: metric rules then wait a full duration before reopening.
export async function resolveAlertManually(id) {
  const alert = await getAlertOrThrow(id);
  const targetId = alert.targetId.toString();
  openAlertKeys.delete(keyOf(alert.ruleType, targetId));
  breachStartedAt.delete(keyOf(alert.ruleType, targetId));
  return resolveAlert(alert, 'Resolved by user');
}

export async function onRuleChanged(rule) {
  await reloadRules();
  if (rule.enabled) {
    return;
  }
  // A disabled rule closes its open alerts and forgets partial breaches.
  for (const key of breachStartedAt.keys()) {
    if (key.startsWith(`${rule.type}:`)) {
      breachStartedAt.delete(key);
    }
  }
  if (rule.type === 'device_offline') {
    for (const timer of offlineTimers.values()) {
      clearTimeout(timer);
    }
    offlineTimers.clear();
  }
  for (const [key, timer] of downTimers) {
    if (key.startsWith(`${rule.type}:`)) {
      clearTimeout(timer);
      downTimers.delete(key);
    }
  }
  for (const key of openAlertKeys) {
    if (key.startsWith(`${rule.type}:`)) {
      await closeAlert(rule.type, key.slice(rule.type.length + 1), 'Rule turned off');
    }
  }
}
