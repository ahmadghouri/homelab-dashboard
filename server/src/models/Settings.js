import mongoose from 'mongoose';

export const SCAN_INTERVAL_LIMITS = { min: 1, max: 60 };
// 0 turns scheduled speed tests off. A test downloads about 25 MB and uploads about 10 MB.
export const SPEED_TEST_INTERVAL_LIMITS = { min: 0, max: 1440 };

// App settings that can be changed from the dashboard. A single document (key: 'app').
// Secrets such as the Telegram bot token stay in .env, not here.
const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'app' },
    telegram: {
      enabled: { type: Boolean, default: false },
      chatId: { type: String, trim: true, maxlength: 64, default: '' },
    },
    network: {
      scanIntervalMin: {
        type: Number,
        default: 5,
        min: SCAN_INTERVAL_LIMITS.min,
        max: SCAN_INTERVAL_LIMITS.max,
      },
    },
    internet: {
      speedTestIntervalMin: {
        type: Number,
        default: 60,
        min: SPEED_TEST_INTERVAL_LIMITS.min,
        max: SPEED_TEST_INTERVAL_LIMITS.max,
      },
    },
  },
  { timestamps: true, versionKey: false },
);

export const Settings = mongoose.model('Settings', settingsSchema);
