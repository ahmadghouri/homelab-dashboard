import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const API_BASE = 'https://api.telegram.org';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_MESSAGE_LENGTH = 4000;

export function isTelegramConfigured() {
  return Boolean(env.telegramBotToken);
}

function assertConfigured() {
  if (!isTelegramConfigured()) {
    throw new HttpError(400, 'Telegram is not set up. Add TELEGRAM_BOT_TOKEN to server/.env');
  }
}

// Calls the Telegram Bot API. The token is part of the URL, so errors never include the URL.
async function callTelegram(method, body) {
  assertConfigured();

  let response;
  try {
    response = await fetch(`${API_BASE}/bot${env.telegramBotToken}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new HttpError(502, 'Could not reach Telegram. Check the internet connection.');
  }

  const data = await response.json().catch(() => null);
  if (!data?.ok) {
    const reason = data?.description ?? `HTTP ${response.status}`;
    throw new HttpError(502, `Telegram rejected the request: ${reason}`);
  }
  return data.result;
}

export function sendTelegramMessage(chatId, text) {
  assertConfigured();
  if (!chatId) {
    throw new HttpError(400, 'Telegram chat ID is not set');
  }
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text: text.slice(0, MAX_MESSAGE_LENGTH),
    disable_web_page_preview: true,
  });
}

// Chats that recently messaged the bot. Used to find the chat ID after the user sends /start.
export async function findRecentChats() {
  const updates = await callTelegram('getUpdates', { limit: 50, allowed_updates: ['message'] });
  const chats = new Map();
  for (const update of updates) {
    const chat = update.message?.chat;
    if (chat) {
      const name = chat.title ?? [chat.first_name, chat.last_name].filter(Boolean).join(' ');
      chats.set(String(chat.id), { id: String(chat.id), name: name || chat.username || 'Chat', type: chat.type });
    }
  }
  return [...chats.values()];
}
