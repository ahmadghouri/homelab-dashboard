import { sendTestNotification } from '../services/alertService.js';
import { getSettings, updateSettings } from '../services/settingsService.js';
import { findRecentChats, isTelegramConfigured } from '../services/telegramService.js';

function toSettingsResponse(settings) {
  return {
    telegram: {
      botConfigured: isTelegramConfigured(),
      enabled: settings.telegram.enabled,
      chatId: settings.telegram.chatId,
    },
    network: { scanIntervalMin: settings.network.scanIntervalMin },
    internet: { speedTestIntervalMin: settings.internet.speedTestIntervalMin },
  };
}

export async function getAppSettings(req, res) {
  res.json({ settings: toSettingsResponse(await getSettings()) });
}

export async function patchAppSettings(req, res) {
  res.json({ settings: toSettingsResponse(await updateSettings(req.body)) });
}

export async function postTelegramTest(req, res) {
  await sendTestNotification();
  res.json({ sent: true });
}

export async function getTelegramChats(req, res) {
  res.json({ chats: await findRecentChats() });
}
