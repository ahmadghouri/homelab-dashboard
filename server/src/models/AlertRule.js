import mongoose from 'mongoose';

export const ALERT_SEVERITIES = ['warning', 'critical'];

// The fixed set of rules. Each can be turned on or off and tuned from the dashboard.
// threshold: null when the rule has no number to compare (offline, new device).
export const RULE_DEFINITIONS = {
  cpu_high: {
    name: 'High CPU',
    unit: '%',
    defaults: { threshold: 90, durationSec: 300, severity: 'warning' },
    limits: { threshold: [10, 100], durationSec: [0, 3600] },
  },
  ram_high: {
    name: 'High RAM',
    unit: '%',
    defaults: { threshold: 90, durationSec: 300, severity: 'warning' },
    limits: { threshold: [10, 100], durationSec: [0, 3600] },
  },
  disk_high: {
    name: 'Disk almost full',
    unit: '%',
    defaults: { threshold: 90, durationSec: 0, severity: 'warning' },
    limits: { threshold: [10, 100], durationSec: [0, 3600] },
  },
  temp_high: {
    name: 'High CPU temperature',
    unit: '°C',
    defaults: { threshold: 85, durationSec: 120, severity: 'critical' },
    limits: { threshold: [40, 110], durationSec: [0, 3600] },
  },
  device_offline: {
    name: 'PC offline',
    unit: null,
    defaults: { threshold: null, durationSec: 120, severity: 'critical' },
    limits: { threshold: null, durationSec: [0, 3600] },
  },
  new_network_device: {
    name: 'Unknown device on network',
    unit: null,
    defaults: { threshold: null, durationSec: 0, severity: 'warning' },
    limits: { threshold: null, durationSec: null },
  },
  internet_down: {
    name: 'Internet down',
    unit: null,
    defaults: { threshold: null, durationSec: 60, severity: 'critical' },
    limits: { threshold: null, durationSec: [0, 3600] },
  },
  service_down: {
    name: 'Service down',
    unit: null,
    defaults: { threshold: null, durationSec: 60, severity: 'critical' },
    limits: { threshold: null, durationSec: [0, 3600] },
  },
  packet_loss_high: {
    name: 'High packet loss',
    unit: '%',
    defaults: { threshold: 10, durationSec: 300, severity: 'warning' },
    limits: { threshold: [1, 100], durationSec: [0, 3600] },
  },
  link_down: {
    name: 'Internet line down',
    unit: null,
    defaults: { threshold: null, durationSec: 60, severity: 'warning' },
    limits: { threshold: null, durationSec: [0, 3600] },
  },
  storage_account_full: {
    name: 'Drive account almost full',
    unit: '%',
    defaults: { threshold: 90, durationSec: 0, severity: 'warning' },
    limits: { threshold: [50, 100], durationSec: null },
  },
  storage_account_error: {
    name: 'Drive account not working',
    unit: null,
    defaults: { threshold: null, durationSec: 0, severity: 'critical' },
    limits: { threshold: null, durationSec: null },
  },
  project_crashed: {
    name: 'Dev project crashed',
    unit: null,
    defaults: { threshold: null, durationSec: 0, severity: 'warning' },
    limits: { threshold: null, durationSec: null },
  },
};

export const RULE_TYPES = Object.keys(RULE_DEFINITIONS);

const alertRuleSchema = new mongoose.Schema(
  {
    type: { type: String, enum: RULE_TYPES, required: true, unique: true },
    enabled: { type: Boolean, default: true },
    threshold: { type: Number, default: null },
    durationSec: { type: Number, default: 0 },
    severity: { type: String, enum: ALERT_SEVERITIES, default: 'warning' },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        const definition = RULE_DEFINITIONS[ret.type];
        ret.id = ret._id.toString();
        ret.name = definition?.name;
        ret.unit = definition?.unit;
        ret.limits = definition?.limits;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const AlertRule = mongoose.model('AlertRule', alertRuleSchema);
