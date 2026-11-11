import { Alert } from '../models/Alert.js';
import { AlertRule, RULE_DEFINITIONS, RULE_TYPES } from '../models/AlertRule.js';
import { emitToDashboard } from '../sockets/registry.js';
import { HttpError } from '../utils/httpError.js';
import { getSettings } from './settingsService.js';
import { isTelegramConfigured, sendTelegramMessage } from './telegramService.js';

const MAX_LIST_LIMIT = 200;
const SEVERITY_ICON = { warning: '⚠️', critical: '🔴' };

// ---------- Rules ----------

// Creates any missing default rules. Existing rules keep the user's changes.
export async function ensureDefaultRules() {
  await Promise.all(
    RULE_TYPES.map((type) =>
      AlertRule.updateOne(
        { type },
        { $setOnInsert: { type, enabled: true, ...RULE_DEFINITIONS[type].defaults } },
        { upsert: true },
      ),
    ),
  );
}

export async function listRules() {
  const rules = await AlertRule.find();
  return rules.sort((a, b) => RULE_TYPES.indexOf(a.type) - RULE_TYPES.indexOf(b.type));
}

function checkLimit(type, field, value) {
  const limits = RULE_DEFINITIONS[type].limits[field];
  if (value === undefined) {
    return;
  }
  if (!limits) {
    throw new HttpError(400, `${RULE_DEFINITIONS[type].name} has no ${field} setting`);
  }
  const [min, max] = limits;
  if (value < min || value > max) {
    throw new HttpError(400, `${field} must be between ${min} and ${max}`, {
      [field]: [`Must be between ${min} and ${max}`],
    });
  }
}

// changes: { enabled?, threshold?, durationSec?, severity? } (already type-checked by zod)
export async function updateRule(id, changes) {
  const rule = await AlertRule.findById(id);
  if (!rule) {
    throw new HttpError(404, 'Alert rule not found');
  }
  checkLimit(rule.type, 'threshold', changes.threshold);
  checkLimit(rule.type, 'durationSec', changes.durationSec);
  Object.assign(rule, changes);
  await rule.save();
  return rule;
}

// ---------- Alerts ----------

export async function listAlerts({ status, limit }) {
  const filter = status === 'all' ? {} : { status };
  const [alerts, openCount] = await Promise.all([
    Alert.find(filter).sort({ createdAt: -1 }).limit(Math.min(limit, MAX_LIST_LIMIT)),
    Alert.countDocuments({ status: 'open' }),
  ]);
  return { alerts, openCount };
}

export function findOpenAlerts() {
  return Alert.find({ status: 'open' });
}

export function findOpenAlert(ruleType, targetId) {
  return Alert.findOne({ ruleType, targetId, status: 'open' });
}

function formatTelegramText(alert, resolved) {
  if (resolved) {
    return `✅ Resolved: ${alert.title}\n${alert.targetName}`;
  }
  return `${SEVERITY_ICON[alert.severity] ?? ''} ${alert.title}\n${alert.message}`.trim();
}

// Sends to Telegram when it is enabled. Failures are saved on the alert, never thrown.
async function notifyTelegram(alert, { resolved = false } = {}) {
  const settings = await getSettings();
  if (!settings.telegram.enabled || !settings.telegram.chatId || !isTelegramConfigured()) {
    return;
  }
  try {
    await sendTelegramMessage(settings.telegram.chatId, formatTelegramText(alert, resolved));
    if (!resolved) {
      await Alert.updateOne({ _id: alert._id }, { notifiedAt: new Date(), $unset: { notifyError: 1 } });
    }
  } catch (error) {
    console.error('[alerts] telegram failed:', error.message);
    await Alert.updateOne({ _id: alert._id }, { notifyError: error.message });
  }
}

export async function createAlert(data) {
  const alert = await Alert.create(data);
  emitToDashboard('alert:new', { alert: alert.toJSON() });
  notifyTelegram(alert);
  return alert;
}

export async function resolveAlert(alert, reason) {
  if (alert.status === 'resolved') {
    return alert;
  }
  alert.status = 'resolved';
  alert.resolvedAt = new Date();
  alert.resolvedReason = reason;
  await alert.save();
  emitToDashboard('alert:resolved', { alert: alert.toJSON() });
  notifyTelegram(alert, { resolved: true });
  return alert;
}

export async function getAlertOrThrow(id) {
  const alert = await Alert.findById(id);
  if (!alert) {
    throw new HttpError(404, 'Alert not found');
  }
  return alert;
}

export async function acknowledgeAlert(id) {
  const alert = await getAlertOrThrow(id);
  alert.acknowledged = true;
  await alert.save();
  emitToDashboard('alert:updated', { alert: alert.toJSON() });
  return alert;
}

// Sends a test message with the current settings.
export async function sendTestNotification() {
  const settings = await getSettings();
  await sendTelegramMessage(
    settings.telegram.chatId,
    '✅ Homelab Dashboard: test message. Alerts will arrive here.',
  );
}
