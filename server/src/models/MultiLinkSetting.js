import mongoose from 'mongoose';

export const MULTILINK_MODES = ['balanced', 'weighted', 'failover'];
export const MULTILINK_ROLES = ['active', 'backup', 'off'];
export const MULTILINK_MAX_LINES = 16;
export const MULTILINK_CAP_GB_LIMITS = { min: 0.1, max: 10000 };
export const MULTILINK_DEFAULT_SETTINGS = { mode: 'balanced', sticky: true, lines: {} };

// Settings of one internet line. Stored as a list instead of a Mongoose Map because
// line ids are interface names, which may contain dots (not allowed in Map keys).
const lineSettingSchema = new mongoose.Schema(
  {
    lineId: { type: String, required: true, maxlength: 64 },
    role: { type: String, enum: MULTILINK_ROLES, default: 'active' },
    capGb: {
      type: Number,
      min: MULTILINK_CAP_GB_LIMITS.min,
      max: MULTILINK_CAP_GB_LIMITS.max,
      default: null,
    },
  },
  { _id: false },
);

// Multi-Link Manager settings of one PC, chosen on the dashboard and pushed to its agent.
const multiLinkSettingSchema = new mongoose.Schema(
  {
    deviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', required: true, unique: true },
    mode: { type: String, enum: MULTILINK_MODES, default: 'balanced' },
    sticky: { type: Boolean, default: true },
    lines: { type: [lineSettingSchema], default: [] },
  },
  { timestamps: true, versionKey: false },
);

export const MultiLinkSetting = mongoose.model('MultiLinkSetting', multiLinkSettingSchema);
