import { Settings } from '../models/Settings.js';

// Settings are read often (every alert, every scan), so the document is cached in memory.
let cached = null;
const listeners = new Set();

export async function getSettings() {
  if (!cached) {
    cached = await Settings.findOneAndUpdate(
      { key: 'app' },
      { $setOnInsert: { key: 'app' } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
  }
  return cached;
}

// patch: { telegram?: { enabled?, chatId? }, network?: { scanIntervalMin? } }
export async function updateSettings(patch) {
  const settings = await getSettings();
  const previous = settings.toObject();

  for (const [section, values] of Object.entries(patch)) {
    for (const [field, value] of Object.entries(values ?? {})) {
      settings.set(`${section}.${field}`, value);
    }
  }
  await settings.save();
  cached = settings;

  for (const listener of listeners) {
    listener(settings, previous);
  }
  return settings;
}

// Lets jobs react to changes (for example a new scan interval).
export function onSettingsChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
